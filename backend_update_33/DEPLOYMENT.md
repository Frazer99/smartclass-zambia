# SmartClass Zambia — Deployment Guide

This is the complete, ordered process for taking this project from code
to a real, running deployment. Follow the phases in order — several
steps genuinely depend on the one before them (migrations before
functions, functions before secrets that reference them, etc.).

Treat this as a checklist, not a read-once document. Tick items off as
you go, and don't skip the verification steps at the end — several real
bugs earlier in this project's build were only caught by actually
testing the thing, not by assuming the code was correct.

---

## Phase 0 — Before you start

- [ ] Confirm you have a Supabase project created, and know its project
      ref (the subdomain in `https://<project-ref>.supabase.co`).
- [ ] Confirm the Supabase CLI is installed and authenticated
      (`supabase login`), OR plan to use the SQL Editor / dashboard
      manually for everything below — both paths are documented per step.
- [ ] If any API key for this project has ever been pasted into a chat,
      email, or shared document, **rotate it now**, before using it
      anywhere real. Treat anything typed outside a proper secrets
      manager as compromised.

---

## Phase 1 — Database

### 1.1 Run every migration, in order

There are 37 migration files in `supabase/migrations/`. Their filenames
are timestamps, so **alphabetical order is the correct order** — this
matters, several later migrations depend on tables/columns created by
earlier ones.

**Fastest path (Supabase CLI):**
```
supabase link --project-ref <your-project-ref>
supabase db push
```
This applies all 36 in the correct order in one command. If you hit an
IPv6/connection issue with the direct database connection, use the
Session Pooler connection string instead:
```
supabase db push --db-url "postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres"
```
(Get the exact pooler host from Supabase Dashboard → Connect → Session
pooler.)

**Manual path (SQL Editor):** open each file in `supabase/migrations/`
in filename order, paste its full contents into the SQL Editor, run it,
then move to the next file. Every migration is written to be
idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) — if you're ever
unsure whether one already ran, it's safe to run it again.

### 1.2 One-time Postgres configuration (required for email features)

Two features — the weekly progress digest and error alerting — need
Postgres to know your project's own URL and service role key, because
they call an Edge Function from inside a database trigger via `pg_net`.

Run once in the SQL Editor (replace with your real values):
```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<project-ref>.supabase.co';
ALTER DATABASE postgres SET app.settings.supabase_service_role_key = '<your-service-role-key>';
```

### 1.3 Enable required extensions

Dashboard → Database → Extensions → enable:
- [ ] `pg_net` (used by the email/alert triggers above)
- [ ] `pg_cron` (used by the weekly digest schedule and the moderation
      cleanup function, if you later decide to schedule it)
- [ ] `vector` (pgvector — should already be enabled by migration
      `20260716090000`, confirm it shows as enabled)

### 1.4 Verify the schema actually landed

Run in the SQL Editor:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```
You should see roughly 30 tables. If something looks short, re-check
which migrations actually ran — this project hit real schema-drift
issues earlier from partial migration runs, and catching it here is
much easier than debugging it later.

### 1.5 Create your first admin account

This has to happen before most of Phase 4 below — several of those
steps require `/admin` access, which nobody has yet.

Every account starts as a regular pupil (`role` defaults to `'pupil'`),
and by design, only an existing admin can promote another account —
there's a trigger (`prevent_self_role_escalation`) specifically
preventing anyone from granting themselves admin. That's correct and
intentional, but it means the very first admin has to be created
directly in the database, once, by you.

1. Register a normal pupil account through the app first (`/register`)
   — use the real email/account you want as your own admin login.
2. In the SQL Editor, find your user id:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'your-real-email@example.com';
   ```
3. Promote it:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = '<the-id-from-step-2>';
   ```
4. Log in at `/admin/login` with that same account to confirm it worked.

Every admin account after this first one can be created normally, from
`/admin` → Users, by an existing admin — this manual step is only ever
needed once, to get the first one.

---

## Phase 2 — Edge Functions

### 2.1 Deploy all 13 functions

```
supabase functions deploy ai-teacher-chat
supabase functions deploy content-materials
supabase functions deploy create-payment
supabase functions deploy delete-user-account
supabase functions deploy detect-answer-mistake
supabase functions deploy generate-embeddings
supabase functions deploy generate-greeting
supabase functions deploy liveavatar-token
supabase functions deploy moe-ecz-sync
supabase functions deploy send-error-alert
supabase functions deploy send-weekly-digest
supabase functions deploy send-welcome-email
supabase functions deploy verify-payment
```

The CLI bundles `supabase/functions/_shared/` automatically — it's not
deployed as its own function, don't try to deploy it separately.

**No CLI access?** Every function can also be deployed via the
dashboard's "Deploy a new function → Via Editor," pasting each file's
contents directly. Functions that import from `_shared/` (ai-teacher-chat,
content-materials, generate-embeddings, generate-greeting,
send-weekly-digest, send-welcome-email) need that shared code inlined
first if you go this route — ask for a "dashboard-ready" version of any
function that needs it if you're not using the CLI.

### 2.2 Set every secret

Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | Required? | Used by |
|---|---|---|
| `SUPABASE_URL` | Yes | every function |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | every function |
| `OPENAI_API_KEY` | Recommended | AI chat, moderation, embeddings, mistake detection |
| `ANTHROPIC_API_KEY` | Optional | AI chat fallback/alternate provider |
| `RESEND_API_KEY` | Recommended | welcome email, weekly digest, error alerts |
| `EMAIL_FROM` | Recommended | same three as above |
| `LIVEAVATAR_API_KEY` | Optional | real-time video avatars (falls back to illustrated avatars without it) |
| `DPO_COMPANY_TOKEN` | Required for payments | create-payment, verify-payment |
| `DPO_SERVICE_TYPE` | Required for payments | create-payment |
| `SITE_URL` | Required for payments | create-payment (builds DPO's redirect URLs) |

Nothing crashes if an optional secret is missing — every integration in
this project has a documented graceful fallback. Payments and DPO are
the exception: without those three, subscription purchases simply won't
work.

---

## Phase 3 — Frontend

### 3.1 Environment variables

The Next.js app itself needs two public env vars (safe to expose to the
browser — these are not secrets):
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3.2 Deploy the Next.js app

This project hasn't been tested against a specific hosting platform —
Vercel is the natural fit for Next.js and requires no special
configuration beyond the two env vars above, but any Node-compatible
host works. Standard build command: `npm run build`.

### 3.3 Confirm the PWA/offline layer registers

The service worker only registers in production builds
(`NODE_ENV === 'production'`), not in local dev — this is intentional,
so don't be alarmed if offline caching doesn't seem to work with
`npm run dev`. Confirm it after a real production deploy instead.

---

## Phase 4 — Manual setup that isn't code

None of these can be automated from a migration or a deploy script —
they're real, human steps.

- [ ] **LiveAvatar** (optional): create or select an avatar per persona
      at app.liveavatar.com, then wire each `avatar_id` in via
      `/admin` → Personas — no SQL needed, that tab was built
      specifically to avoid it.
- [ ] **DPO payments**: sign up for a real merchant account at
      dpopay.com. **Test the entire payment flow in DPO's sandbox mode
      before enabling it for real pupils** — this integration has never
      been tested against a real DPO account from this build environment.
- [ ] **Subscription price**: set a real value from `/admin` → Billing
      → Subscription Price. The default (K50) is a placeholder, not a
      recommendation.
- [ ] **Error alert email**: set a real address from `/admin` → System
      Health → Error Alerts, once Phase 1.2 is done.
- [ ] **Legal review**: have a qualified Zambian lawyer review the
      Terms of Service and Privacy Policy drafts before publishing
      either — in particular the Privacy Policy's Section 5, which
      flags a real, unresolved question about parental consent for
      children's data under the Data Protection Act.
- [ ] **Moderation data retention**: decide, with real legal input, how
      long to keep flagged messages — the cleanup function exists but
      is deliberately not scheduled until that decision is made (see
      the migration header in `20260723080000` and `20260726080000`).
- [ ] **Curriculum content**: assess how much real lesson/practice/past
      paper content exists beyond the original seed data — this is the
      actual bottleneck to the platform being useful at scale, not
      anything in this checklist.

---

## Phase 5 — Post-deploy verification

Don't consider this done until you've actually done each of these —
not read the code and assumed it works.

- [ ] Register a real pupil account. Confirm the welcome email arrives
      (if `RESEND_API_KEY` is set).
- [ ] Register a parent account with the same email as that pupil's
      parent/guardian email. Confirm they show up on `/parent`.
- [ ] Register a teacher account. Confirm it's blocked from `/teacher`
      until approved from `/admin` → Users.
- [ ] Start a lesson. Confirm the AI teacher actually responds (not
      just the rule-based fallback) — this confirms `OPENAI_API_KEY`
      and/or `ANTHROPIC_API_KEY` are working.
- [ ] Trigger a deliberate error (e.g., an invalid request to an Edge
      Function) and confirm it shows up in `/admin` → System Health,
      and that the alert email arrives if configured.
- [ ] Run a payment through DPO's sandbox end to end, including
      returning to `/subscribe/complete` and confirming the
      subscription activates.
- [ ] Set an exam date on the dashboard and confirm the countdown and
      recommendations render.
- [ ] Try the offline banner: load the app, then disable your network
      connection, and confirm a cached page still loads with the
      offline banner showing.

---

## A note on scope

This guide covers what's genuinely known and built. It does not cover
load testing (never performed — no way to generate real concurrent
traffic from a build environment), a security penetration test, or a
formal accessibility audit — none of which this document can responsibly
claim to have done for you.
