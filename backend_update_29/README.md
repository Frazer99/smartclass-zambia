# SmartClass Zambia

An AI tutoring platform for Zambian secondary school pupils (Form 1–6),
built around **Mr. Chomba**, an illustrated AI teacher who explains lessons
by voice and smart board, aligned to the Zambian curriculum.

Flagship product of ZedCode Technologies. See `SmartClass_Zambia_SRS.docx`
for the original product requirements this build is based on.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 13 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Supabase (Postgres, Auth, Row Level Security, Edge Functions) |
| AI | OpenAI (`gpt-4o-mini`) via a Supabase Edge Function, with a RAG layer over `content_materials` |
| Voice | Browser Web Speech API (`SpeechSynthesis`) — no external TTS service yet |
| Hosting | Netlify (`@netlify/plugin-nextjs`) |

---

## Getting started

### 1. Environment variables

Create `.env` (a placeholder already exists) with:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

The Edge Functions additionally need, set in the Supabase dashboard
(Project Settings → Edge Functions → Secrets), not in `.env`:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...   # optional — ai-teacher-chat falls back to canned
                      # responses if this isn't set, so the app still runs
                      # without it
```

### 2. Database

Run every file in `supabase/migrations/` **in filename order** against your
Supabase project (via the Supabase CLI, `supabase db push`, or pasted into
the SQL editor one at a time). They're written to be idempotent
(`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), so re-running is safe.

Deploy the twelve Edge Functions in `supabase/functions/` (the Supabase
CLI picks up `_shared/` automatically — it's not deployed as its own
function):

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
supabase functions deploy send-welcome-email
supabase functions deploy send-weekly-digest
supabase functions deploy verify-payment
```

### 3. Install and run

```
npm install
npm run dev
```

Then visit `http://localhost:3000`. New pupils go through
`/register` → `/onboarding` (grade selection) → `/dashboard`.

---

## Project structure

```
app/
  page.tsx                     landing / redirect
  login/, register/            pupil auth screens
  onboarding/                  post-registration grade picker (fallback; registration collects Form directly now)
  admin/
    login/                     separate admin login (own auth guard, own chrome — see "Admin" below)
    (protected)/                route group: everything requiring an admin session
      layout.tsx                 admin-only nav/chrome, redirects non-admins to admin/login
      page.tsx                   admin dashboard (curriculum, users, materials, questions, analytics tabs)
      tabs/
  (app)/                       everything behind pupil auth (see layout.tsx for the nav)
    dashboard/                 "Lessons" — subject tabs, topic grid, search
    topic/[id]/                lessons within a topic
    lesson/[id]/               the AI teacher lesson runner (Mr. Chomba + smart board)
    practice/[id]/             practice questions for a topic
    past-papers/               "Past Papers" — browse by subject + year
    past-papers/[id]/          a single paper: whole paper vs specific questions
    past-papers/[id]/run/      the question runner (shared by both modes)
    progress/                  mastery/progress dashboard
middleware.ts                  optional admin-subdomain rewrite (inert unless ADMIN_SUBDOMAIN_HOST is set)
components/
  auth-provider.tsx            Supabase auth context (user, profile, signOut)
  teacher/
    TeacherAvatar.tsx          Mr. Chomba — illustrated SVG avatar, 4 expression states
    TeachingModeToggle.tsx     "Video teacher" vs "Text explanation" switch
  ui/                          shadcn/ui primitives
hooks/
  use-speech-to-text.ts        Browser SpeechRecognition wrapper (SRS 12.12 STT)
lib/
  supabase-client.ts           Supabase client + all shared TypeScript types
  adaptiveLearning.ts          Weak-area analysis + next-lesson recommendation (SRS 12.9/12.10)
  teachingMode.ts               localStorage-backed video/text preference
  utils.ts
supabase/
  migrations/                  schema, in chronological order (see below)
  functions/
    ai-teacher-chat/           the AI teacher's brain (vector RAG + OpenAI, or fallback)
    content-materials/         admin CRUD for curriculum/textbook/past-paper references
    generate-embeddings/       admin-triggered backfill of pgvector embeddings
    moe-ecz-sync/              seeds content_materials from known MoE/ECZ sources
    _shared/embeddings.ts      shared OpenAI embedding helper (used by the three above)
```

---

## Core features

### Auth & onboarding
Email/password via Supabase Auth. `profiles` extends `auth.users` with
`full_name`, `school` (optional), `grade` (1–6, displayed as "Form 1"–"Form 6"),
and `role` (`pupil` | `admin`). Per the current curriculum offering: Mathematics
is offered Form 1–6; Science is Form 1–3 only; Physics and Chemistry are
Form 4–6 only. School and Form are collected directly on `/register` (School
is optional, Form is a required chip selector) — registration goes straight
to `/dashboard` afterward. `/onboarding` still exists as a fallback Form
picker but nothing links to it anymore now that registration collects Form
directly.

**Password reset**: `/forgot-password` (linked from both `/login` and
`/admin/login` — same shared page, since sending a reset email doesn't need
role-specific framing) sends a real email via Supabase Auth's own
`resetPasswordForEmail` — no custom email server needed. `/reset-password`
is the shared landing page the email link points to; it waits for
Supabase's client SDK to fire a `PASSWORD_RECOVERY` auth event (parsing the
recovery token out of the URL happens asynchronously) before showing the
new-password form, and shows a clear "this link isn't valid" state if that
event never fires within a few seconds (an already-used or expired link)
rather than showing a form that would just fail. **Requires one thing
outside the codebase**: add `<your-site-url>/reset-password` as an allowed
Redirect URL in the Supabase dashboard (Authentication → URL Configuration)
— the email link won't work without it.

**Account management** (`/account`, linked from the nav bar avatar):
pupils can update their name, school, and Form, and change their password
without needing the email-reset flow. The profile update deliberately never
touches `role` — and even if a request did, `prevent_self_role_escalation`
(a `BEFORE UPDATE` trigger added alongside this feature) silently keeps
`role` unchanged for anyone who isn't already an admin, closing a gap that
existed before this page did: the original `update_own_profile` RLS policy
allowed a user to update *any* column on their own row, including `role`,
with no restriction — exploitable via a direct Supabase client call
regardless of what UI existed. RLS policies can't cleanly express
"this column only for privileged callers" (`WITH CHECK` only sees the new
row, not the old one), so a trigger is the correct tool here, not a policy
change.

### Lessons (`/dashboard`)
Subject tabs (Mathematics, Science, Physics, Chemistry — each scoped to the
grades they're offered for) → topic grid, filtered to the pupil's grade →
full-text search across `search_index` (topics, lessons, and key terms in
one query). Each topic links to its lessons and its practice questions.

### The AI teacher — Mr. Chomba
- **Illustrated avatar** (`TeacherAvatar.tsx`): pure SVG, no image assets.
  Four states — `idle`, `speaking`, `thinking`, `encouraging` — each with
  distinct eyebrows/eyes/mouth, plus a talking-mouth loop, an idle blink,
  thinking-dots, and a `writing` badge that can appear independently of
  (and usually alongside) speaking, since a real teacher talks and writes
  at the same time.
- **Voice**: browser `SpeechSynthesis`. `isSpeaking` is driven by the
  utterance's real `onstart`/`onend` events, so the avatar's mouth only
  animates while audio is actually playing. Pupils can also *speak* their
  questions via `hooks/use-speech-to-text.ts`, wrapping the browser's
  native `SpeechRecognition` API — no external STT service or API key
  needed. The mic button only renders when the browser supports it
  (Chrome/Edge/Safari; not Firefox), with a live interim-transcript
  preview while listening. This closes SRS 12.12's speech-to-text half;
  it was text-only before.
- **Smart board**: steps/examples/summary from the lesson's `content`
  (JSON: `intro`, `steps[]`, `examples[]`, `summary`) are written to the
  board as the lesson progresses.
- **Chat**: pupils can type a question at any point; it's sent to the
  `ai-teacher-chat` Edge Function along with lesson context and the last 10
  turns of history. RAG retrieval (SRS 12.6, 13.3) uses **real semantic
  vector search** (pgvector + OpenAI `text-embedding-3-small`, matching the
  original "PostgreSQL + pgvector" plan) across three sources —
  `content_materials`, `search_index`, and worked `past_paper_questions`
  explanations — via the `match_content_materials` / `match_search_index` /
  `match_past_paper_questions` SQL functions, scoped to the pupil's
  grade/subject when known. This finds conceptually related content even
  when the pupil's wording shares no keywords with the source material.
  If no query embedding could be generated (no `OPENAI_API_KEY`, or a
  transient API failure) or vector search finds nothing (e.g. a table has
  no embedded rows yet), it transparently falls back to the original
  keyword/ILIKE search — see `lib/adaptiveLearning.ts`'s sibling,
  `supabase/functions/_shared/embeddings.ts`, for the shared embedding
  helper both this function and `content-materials` use. New content is
  embedded automatically on write; the admin Materials tab's **"Generate
  Embeddings"** button backfills anything created before embeddings
  existed (including the seed data — nothing is pre-embedded, since that
  would require calling OpenAI from this build environment, which has no
  network access to do so). The system prompt also receives a
  **personalization note** (SRS 12.9) from `lib/adaptiveLearning.ts` when
  the pupil has been struggling on the current topic, so Mr. Chomba already
  knows to slow down before they even ask. If `OPENAI_API_KEY` isn't
  configured at all, chat still works via the rule-based fallback response
  instead of failing outright.
- **Auth required + rate limited**: `ai-teacher-chat` now requires a valid
  Supabase session — previously it accepted requests from anyone with the
  function's URL, with no way to attribute or bound usage, which meant no
  real cost control on an endpoint that calls OpenAI twice per message
  (chat completion plus an embedding for vector search). Each authenticated
  pupil is limited to 8 messages/minute (burst protection) and 60
  messages/hour (sustained-cost protection), counted from
  `ai_interaction_logs` — no separate rate-limit table needed, since that
  table already records every turn. Exceeding either limit returns 429 with
  a plain-language message ("You're sending messages a little fast...")
  rather than a generic error, and the lesson page shows it as a toast
  rather than putting words in Mr. Chomba's mouth for something he didn't
  actually say. Rate-limited attempts are themselves logged
  (`source: 'rate_limited'`) so the admin AI Insights panel can surface
  repeated rate limiting as an abuse signal, separate from genuine OpenAI
  fallbacks.
- **Continuous learning pipeline** (SRS 12.17): every chat turn is logged
  to `ai_interaction_logs` (topic, source used, **which retrieval method
  fired** — vector, keyword, or none, via the `retrieval_method` column —
  whether curriculum context was found, whether the pupil's message
  matched confusion-signal language) — never blocking the response if
  logging fails. The admin Analytics tab's **AI Teaching Insights** panel
  aggregates this into a fallback rate, a confusion rate, and a per-topic
  breakdown, so the content team can see exactly which topics need better
  material — the "identify improvements" step of the pipeline. Automatically
  retraining a
  model from this data is a future phase (SRS 12.7); today it's a signal
  for a human to act on.
- **Video teacher / Text explanation**: a persistent (localStorage) toggle.
  Video mode is the full avatar + voice + board experience above. Text mode
  turns off the avatar and TTS entirely and shows the same explanations as
  plain text — useful for low-bandwidth situations or pupils who'd rather
  read. Available on both the lesson page and past-paper questions.

### Past Papers (`/past-papers`)
A separate section from Lessons, built on three new tables:
`past_papers` (subject, grade, year, term, total marks, duration),
`past_paper_questions` (numbered questions, multiple-choice or short-answer,
answer key, explanation, marks), and `past_paper_attempts` (per-pupil
history, mirroring `practice_attempts`).

- Browse by subject, papers listed newest-year-first.
- Open a paper to see every question, or hit **Start whole paper** to go
  through all of them in sequence.
- Jump to **one specific question** from the paper detail page
  (`/past-papers/[id]/run?q=<number>`) — answers it in isolation, no
  auto-advance, then returns to the paper.
- Same video/text mode toggle as lessons; explanations come from the
  question's own `explanation` field (spoken or shown as text) rather than
  a live AI call, since past-paper answers are fixed and don't need RAG.

Seeded with 2 Grade 12 Mathematics papers (2023, 2024) and 1 Grade 10
Physics paper as a working example — real data entry happens through the
admin panel's Questions tab (or directly via new migrations) the same way.

### Progress (`/progress`)
Per-topic mastery, lessons completed, and practice accuracy, aggregated
from `progress_records`.

### Adaptive learning (`lib/adaptiveLearning.ts`)
Implements SRS 12.9 (Student Personalization AI) and 12.10 (Adaptive
Learning Algorithm) for real, not just as a planning document. On every
dashboard load:

- `analyzeWeakAreas()` ranks the pupil's topics — across **all** subjects
  for their grade, not just the one they're currently viewing — using three
  signals: topic mastery from `progress_records`, a trailing wrong-answer
  streak from their last 5 `practice_attempts` on that topic, and whether
  the topic has been attempted at all. Each weak area gets a severity
  (`high`/`medium`/`low`) and a plain-language reason (e.g. *"Missed the
  last 3 practice questions in a row"*, *"Mastery is still low (28%)"*,
  *"Not started yet"*).
- `recommendNextLesson()` picks the single best next lesson from the
  highest-severity weak area, resuming that topic at the pupil's next
  uncompleted lesson (not restarting from lesson 1). Falls back to "a good
  place to start" when nothing qualifies as weak yet.
- The dashboard surfaces both: the hero "continue learning" card now shows
  *why* that lesson was picked, and a **Focus Areas** panel lists up to
  three weak topics (with subject, reason, and a direct link to practice)
  so the recommendation isn't a black box.

This runs entirely client-side against data already being fetched. Both
`practice_attempts` (via `practice_questions.topic_id`) and
`past_paper_attempts` (via a new nullable `past_paper_questions.topic_id`,
added specifically for this — see the
`20260714070000_link_past_papers_to_topics` migration) feed the same
weak-area analysis, so a pupil struggling on a past paper counts the same
as struggling in practice mode. Past-paper questions are opt-in tagged by
an admin; untagged ones still work as ordinary questions, they just don't
contribute to adaptive learning. The next natural extension is exposing
this same weak-area reasoning to a future parent dashboard.

### Content Moderation
`ai-teacher-chat` never screened pupil messages before this — every
message went straight to RAG retrieval and the teaching LLM. For a
platform built for minors, that was a real gap independent of anything
else in the codebase. Every message is now screened by **OpenAI's
Moderation API** (a free, purpose-built endpoint — deliberately not a
custom keyword list, which would be both less effective and would mean
enumerating harmful terms in this codebase to detect them) before it
reaches RAG or the teaching model.

Flagged messages never reach the normal teaching flow. Two response
paths, not one, because a self-harm disclosure and an off-topic or
inappropriate message call for different things:

- **Self-harm signals** get a caring response pointing the pupil to a
  trusted adult and Lifeline/Childline Zambia's **116 Child Helpline**
  (verified real, current, and government-mandated — not invented; a
  wrong number here would be actively harmful, so this was checked
  against multiple independent sources before being written into the
  system prompt).
- **Everything else flagged** (harassment, hate, sexual content,
  violence, etc.) gets a calm, firm redirect back to the lesson —
  logged, not lectured at.

Every flagged message is written to `moderation_flags` (migration
`20260723080000`) for admin review, visible in the admin panel's
**Moderation** tab — self-harm severity sorted first and visually
distinct (a red border and a banner naming the count), since that's what
most needs a human's attention, not routine content-policy noise.
Reviewing a flag is about a school's own follow-up, not undoing the
pupil's response — they already saw it. Read access is admin-only, not
even the pupil who triggered it, since this is a safeguarding record, not
a personal-data self-service view.

**Genuinely unresolved, not glossed over**: this table can contain a
pupil's message during a moment of real distress. That's real data real
people (school staff, ZedCode's own team) may need to act on, which is
why it's captured rather than only anonymized or aggregated — but it also
deserves an actual data retention policy (how long flagged messages are
kept, who beyond "any admin" should see `self_harm` severity specifically)
that this codebase doesn't decide. That's a real operational decision for
whoever runs this in production.

### Data Export (CSV / PDF)
Two export paths, both dependency-free — no new npm packages added.

- **CSV** (`lib/exportCsv.ts`): a minimal, no-dependency CSV builder —
  deliberately not `papaparse` or similar, since a progress export is a
  handful of flat columns (topic, mastery %, lesson counts) that will
  never hit the edge cases a real CSV library buys correctness for
  (embedded newlines, exotic encodings). Handles standard quoting for the
  one case that matters (a value containing a comma or quote). Available
  from `/progress` (a pupil's own data) and the admin Users tab's pupil
  detail panel (any pupil's data, admin-only).
- **PDF** (`/progress/report`): rather than add an untested PDF library —
  `jsPDF` and similar have real font-embedding complexity, and this build
  environment has no way to verify one actually renders correctly — this
  is a print-optimized page. The browser's own "Save as PDF" print
  destination, available with zero added dependencies in every modern
  browser, produces the actual PDF. Deliberately light/paper-toned rather
  than the app's usual dark chalkboard theme (a printed page shouldn't try
  to lay down a full dark background — wastes ink, and most printers/PDF
  viewers don't render it well anyway). The shared `(app)/layout.tsx` now
  hides its nav bar and switches to a white background under
  `@media print` for every page, not just this one — a sensible default
  for the whole app, verified with Playwright's print-media emulation
  (confirmed the nav/buttons actually disappear, not just assumed from
  the CSS).

### Subscribers by Subject, Warnings, Account Deletion & Audit Log
Three related additions to the admin panel, plus an honest look at what
"support 100,000 users" and "more security" actually mean at the
database level versus what's a business/infrastructure decision this
codebase can't make on ZedCode's behalf.

**Subscribers by subject** (Billing tab): subscriptions in this schema
are platform-wide, not per-subject — a pupil doesn't subscribe to
Mathematics specifically. "Subscribers by subject" is computed as: for
each subject, how many currently-active subscribers (paid or bonus) are
in a Form that subject is offered to. A Form 5 pupil with an active
subscription counts toward both Mathematics and Physics, since both are
offered to Form 5 — the totals overlap across subjects rather than
summing to the platform's total subscriber count, and the admin UI says
so explicitly rather than leaving that ambiguous.

**Warnings** (`issue_warning()`, Moderation tab): a warning is visible to
the pupil who receives it, not just admins — a warning nobody sees can't
change behavior. A genuine design question worth explaining, not just a
feature list: should the system issue warnings automatically, or should
an admin? Neither extreme is right. Fully automatic risks punishing a
pupil for a moderation false positive, and — the more serious problem —
would need a hard-coded, easy-to-forget exclusion for self-harm flags,
since a kid in distress must never be treated as a rule-breaker. Fully
manual (typing a reason from scratch every time) doesn't hold up once
the platform has enough pupils that an admin can't hand-write every
warning. The middle ground built here: the "Warn pupil" button on a
flagged message **pre-drafts** a suggested reason from the flag's
OpenAI Moderation category (a template lookup, not a second LLM call —
the categories are already clean, structured labels; re-interpreting
them with another AI call would add cost and latency for no benefit) —
editable before sending, one click to approve as-is. **The suggestion
button doesn't exist at all for self-harm-severity flags** — checked
explicitly in the render logic (`flag.severity !== 'self_harm'`), not
left out by omission, confirmed with a screenshot showing the button
genuinely absent from a self-harm flag's card while present on a
harassment flag's. A standalone warning form (not tied to a specific
flag) is also available for behavior an admin notices outside the
moderation queue.

**Escalation to deletion is a human decision, not automatic** —
this migration deliberately does not auto-delete anyone after N
warnings. A false-positive moderation flag, a misunderstanding, or a
pupil genuinely changing their behavior after one warning would all be
poorly served by an automatic cutoff; an admin sees the pattern and
decides, the same reasoning already applied to moderation data
retention not auto-scheduling itself.

**Account deletion** (`delete-user-account` Edge Function, not a plain
SQL function — deleting the real `auth.users` row requires the Auth
Admin API, which only a service-role server context can call). Genuinely
irreversible, so the admin UI requires typing `DELETE` to enable the
button — not a single click for something permanent. Logs a snapshot
(who, why, warning count, name/email) to `account_deletions_log` *before*
deleting anything, since that information is gone once the account
actually goes.

**`admin_action_log`**: general audit trail, not just for
warnings/deletions — retrofitted onto the existing free-mode toggle and
bonus-grant functions too, so "who changed what, when" has one place to
check rather than being scattered or, for several of these actions, not
recorded anywhere at all until now.

**On "support more than 100,000 users without fail"** — the honest
version: this migration adds two indexes (`profiles.grade`,
`profiles.school`) that several admin queries filter/join on with no
index backing either before now — a real, concrete fix; at a handful of
test users this doesn't matter, at real scale it's a full table scan on
every one of those queries. What this migration *can't* do: guarantee
100,000-user reliability outright. That depends on things outside a
migration's control — your Supabase plan tier and its connection/compute
limits, whether you're using the connection pooler (see the "Enable
IPv4 add-on" / pooler discussion earlier in this README) under real
concurrent load, and a genuine gap worth naming rather than pretending
doesn't exist: **several admin queries (`fetchUsers`, the moderation
flags list, the payments list) currently fetch a flat, capped list
(e.g. `.limit(200)`) rather than paginating** — a reasonable stopgap at
current scale, but not something that scales cleanly to tens of
thousands of rows in those specific lists. Real pagination for every
admin list is a bigger UI undertaking than this pass attempted.

**On "put more security"** — also the honest version: RLS has been on
every table since the very first migration, every privileged database
function already checked the caller's admin role before this update, and
secrets have never been exposed to the browser anywhere in this project.
What's genuinely new here is `admin_action_log` — accountability for
sensitive actions that previously happened without a durable record. What
this update does *not* add: infrastructure-level hardening (WAF, DDoS
protection, IP allow-listing) — those are Supabase-platform or
hosting-level configuration, not something a database migration
controls.

### Subscriptions & Payments
Real payments via **DPO Group** (Direct Pay Online) — confirmed to
support both card (Visa/Mastercard) and mobile money (MTN MoMo, Airtel
Money), specifically in Zambia and ZMW, not just guessed as a plausible
option. A 15-messages-per-day free tier, admin-controlled bonus grants
and a platform-wide free-mode toggle, and admin visibility into every
payment plus daily/monthly revenue.

**Why DPO, not a more famous name like Flutterwave or Stripe**: neither
of those has confirmed strong Zambia-specific coverage. DPO does —
multiple independent sources (their own docs, several community
integration packages, a Zambia-focused fintech blog) confirm Zambia and
ZMW as explicitly supported, with both payment types in one integration.

**Why raw `fetch()` against DPO's real API, not an npm package**: the
only Node.js wrapper found for DPO was small, unofficial (3 stars), and
inconsistent about its own package name across its own README examples
— too fragile a foundation for real payments. `supabase/functions/_shared/dpo.ts`
talks directly to DPO's actual XML-based API (confirmed via the `API3G`
convention used consistently across every real DPO integration found),
the same "call the real API directly" approach already used for OpenAI,
LiveAvatar, and Resend elsewhere in this project.

**The flow**: `create-payment` (Edge Function) creates a DPO payment
token and returns DPO's hosted payment page URL — the pupil is
redirected there, and DPO collects the actual card number or mobile
money PIN on their own page; this project never touches either. DPO
redirects back to `/subscribe/complete`, which calls `verify-payment` to
**re-check the real payment status directly with DPO server-to-server**
— the redirect itself is never trusted alone, since a redirect URL can be
replayed or spoofed by anyone who knows its shape, and only a
provider-to-server status check can't be.

**Free tier**: 15 AI chat messages/day (admin-configurable via
`platform_settings.free_daily_message_limit`), counted from
`ai_interaction_logs` — the same table already used for rate limiting, so
no separate usage-tracking table was needed. `ai-teacher-chat` checks
`has_active_subscription()` first (which also covers platform-wide free
mode and bonus grants) and only counts against the quota for pupils with
none of those. Exceeding it returns `402` with a distinct
`subscription_required` response, handled in the lesson page as a
banner with a "Subscribe →" link, not a generic error toast.

**Admin controls** (`/admin` → Billing): today's and this month's
revenue (only ever computed from `payments.status = 'completed'` —
pending/failed attempts are visible in the table for troubleshooting,
never counted as revenue), a platform-wide free-mode toggle
(`set_platform_free_mode()`), per-pupil bonus grants
(`grant_bonus_subscription()`, with or without an expiry), and the
subscription price itself (editable, stored in `platform_settings`).

**Genuinely uncertain, stated plainly rather than hidden**: I could not
confirm the exact query parameter DPO appends to the redirect URL after
payment from available documentation. `/subscribe/complete` checks a few
plausible parameter names, and — since the payment token was already
stored server-side when `create-payment` ran — falls back to the pupil's
own most recent pending payment if none of those names match. This makes
the flow robust to that uncertainty rather than silently breaking if my
guess at the parameter name was wrong, but **this entire payment flow
has never been tested against a real DPO merchant account** — there's no
way to do that from this build environment. Test thoroughly in DPO's
sandbox before handling real money.

**The subscription price is a placeholder** (K50/month), the same way
the moderation retention window was a placeholder — a real business
decision for ZedCode, not something this migration should assert.
Change it any time from the admin Billing tab.

**Manual setup required**:
1. Sign up at [dpopay.com](https://dpopay.com) for a real merchant
   account — needs business registration documents and bank details.
2. Get your Company Token and Service Type ID from DPO's dashboard.
3. `supabase functions deploy create-payment verify-payment`
4. Set `DPO_COMPANY_TOKEN`, `DPO_SERVICE_TYPE`, and `SITE_URL` as Edge
   Function secrets.
5. Decide on a real subscription price and set it from the admin
   Billing tab (replacing the K50 placeholder).

### Data Retention for Flagged Content
The content moderation migration (`20260723080000`) deliberately left
this unresolved — a real policy decision, not a code problem. This
migration (`20260726080000`) builds the *infrastructure* for a retention
policy without asserting what that policy should be:

- **`cleanup_old_moderation_flags(days_to_keep, delete_self_harm)`**:
  only ever deletes rows that are already `reviewed = true` (an
  unreviewed flag is never silently removed, however old) and older than
  the given window. **Self-harm-flagged rows are never touched unless
  `delete_self_harm` is explicitly passed as `true`** — the one firm
  stance this migration does take: a safe default that requires a human
  to actively loosen it, rather than a convenient default that requires
  a human to notice and tighten it. Every run — including runs that
  delete zero rows — logs a summary (counts and a severity breakdown,
  *not* the deleted message content, since logging that would defeat the
  point of deleting it) to `moderation_flags_cleanup_log`.
- **Not scheduled to run automatically.** The `cron.schedule(...)` call
  that would actually enable this exists only as a comment in the
  migration file. Deleting flagged messages — especially anything
  self-harm-related — needs an explicit decision from ZedCode with real
  legal/safeguarding guidance (Zambian data protection law, the school's
  own safeguarding obligations) before any automatic deletion starts;
  this codebase provides the mechanism, not the policy.
- Visible in the admin **Moderation** tab: a small "Data Retention" panel
  explaining exactly this, plus a history of any cleanup runs (empty by
  default, since none are scheduled).

### School / Teacher Analytics
The realistic version of the design doc's "teacher/administrator
analytics" and "parent dashboard" sections — aggregated mastery and
common misconceptions, filterable by school and Form — without building
a separate parent/teacher account system. Admin-only today
(`/admin` → School Analytics); a future parent/teacher login could reuse
the same three backend functions rather than duplicating them.

- **`get_distinct_schools()`, `get_school_topic_analytics(school, grade)`,
  `get_common_misconceptions(school, grade, topic)`** (migration
  `20260725080000`) — three `SECURITY DEFINER` SQL functions, each
  checking the caller is an admin as its first statement. Deliberately
  functions, not a plain view: a view runs with the *owner's* privileges
  by default (bypassing RLS entirely) or, with `security_invoker`, the
  *caller's* RLS — but a pupil's RLS only shows their own rows, the
  opposite of what an aggregate view needs. Same gated-function pattern
  already used for `recompute_topic_mastery`.
- Topic mastery is sorted **worst-first** — the topics needing attention
  are what a teacher actually wants to see, not an alphabetical list.
- **Real limitation, stated plainly**: common misconceptions are grouped
  by *exact text*, not meaning. `detected_mistake` is an LLM-generated
  natural-language description (from `ai-teacher-chat` and
  `detect-answer-mistake`), not a fixed taxonomy — "added instead of
  subtracting the constant" and "adds instead of subtracting" describe
  the same misconception but won't merge into one count here. Good enough
  to spot a clearly recurring, consistently-worded issue; not a
  substitute for a human skimming the list. A future version could
  cluster by embedding similarity — the same pgvector infrastructure
  already in this project — rather than exact match; not attempted in
  this pass to keep the change reviewable.
- School names are free text (whatever a pupil typed at registration),
  grouped by exact string match — "Kabulonga Girls Secondary School" and
  a differently-capitalized or abbreviated entry for the same school
  won't merge. A normalized `schools` reference table (pupils pick from a
  list instead of typing freely) would fix this properly; not attempted
  here to keep this change scoped to analytics, not a registration-flow
  redesign.

### Real-Time Video Avatar (LiveAvatar / HeyGen)
An optional, graceful upgrade on top of every named persona's illustrated
avatar — a real photorealistic streaming video teacher, via **LiveAvatar**
(HeyGen's real-time avatar product — note it's now its own distinct brand,
`app.liveavatar.com`, separate from `heygen.com` itself; the older
`@heygen/streaming-avatar` package is deprecated in favour of
`@heygen/liveavatar-web-sdk`, which is what's actually installed here).

**LITE mode, deliberately**: LiveAvatar offers a FULL mode (it runs the
entire AI pipeline — ASR, LLM, TTS) and a LITE mode (it only handles
WebRTC video/lip-sync; you bring your own conversational stack). This
project uses LITE mode specifically so `ai-teacher-chat` — its RAG
retrieval, five named personas, rate limiting, content moderation, and
mistake detection — stays the source of what the teacher actually says.
LiveAvatar just renders that text as a live, lip-synced video instead of
browser TTS. LITE mode also runs at half the credit cost of FULL (1 vs 2
credits/minute), since you're not paying LiveAvatar to run an AI pipeline
you already have.

**Architecture**:
- `teacher_personas` gains two nullable columns, `liveavatar_avatar_id`
  and `liveavatar_voice_id` (migration `20260724080000`) — nullable
  because creating an actual avatar is a real, manual, human step (see
  below), not something a migration can automate.
- `liveavatar-token` (new Edge Function): mints a short-lived,
  avatar-scoped session token server-side — `LIVEAVATAR_API_KEY` never
  reaches the browser. Returns `{ available: false }` (not an error)
  whenever the resolved persona has no avatar configured yet, or the
  secret isn't set, or the token request fails for any reason.
- `LiveTeacherAvatar.tsx` (new component): wraps `LiveAvatarSession` from
  the real SDK. Whenever a live session isn't available, it renders the
  exact same illustrated `TeacherAvatar` instead — a pupil should never
  see a broken `<video>` element or blank space where their teacher
  should be. This is the same graceful-degradation pattern used
  throughout this project (no `OPENAI_API_KEY` → rule-based fallback; no
  `RESEND_API_KEY` → email silently doesn't send).
- Wired into both `lesson/[id]/page.tsx` and
  `past-papers/[id]/run/page.tsx`: `speak(text)` prefers the live
  avatar's own voice when connected (never both browser TTS and live
  avatar audio playing at once), and the lesson page calls `interrupt()`
  on the avatar when the pupil sends a new message mid-speech — a real
  teacher stops talking when interrupted, so the avatar does too.

**How this was verified, given none of it can be tested end-to-end from
this sandbox** (no LiveAvatar account, no configured avatar_id, no
network access to their servers here): the npm package name and its
entire method/event surface (`start()`, `stop()`, `attach()`, `message()`,
`interrupt()`, `AVATAR_SPEAK_STARTED`/`AVATAR_SPEAK_ENDED`) were confirmed
against the **actual installed package's real `.d.ts` type files**, not
assumed from documentation or training data — this SDK is new enough
(published within the last few months as of this writing) that guessing
would have been genuinely risky. The token-request JSON shape (`mode:
"LITE"`, `avatar_id`, `avatar_persona.voice_id`) was cross-checked against
a maintained third-party reference implementation. What *was* verified
end-to-end: the fallback path — screenshotted the lesson page with a
deliberately failed connection attempt, confirming it degrades to the
illustrated avatar with zero visible breakage.

**Manual setup required — cannot be automated by this codebase**:
1. Sign up at [app.liveavatar.com](https://app.liveavatar.com) and get an
   API key from the developers page.
2. Create (or pick from the stock library) a distinct avatar for each of
   the five personas you want live video for. A genuinely custom avatar
   needs at least two minutes of real, consented video footage of that
   person — this is a real content/consent decision for ZedCode, not a
   configuration step.
3. Set `liveavatar_avatar_id` (and optionally `liveavatar_voice_id`) on
   the matching row in `teacher_personas` for each persona you've set up.
4. `supabase functions deploy liveavatar-token`, and set
   `LIVEAVATAR_API_KEY` as an Edge Function secret.
5. Consider [Sandbox Mode](https://docs.liveavatar.com/docs/sandbox-mode)
   for testing the integration itself without consuming real credits.

**Real cost, not hidden**: the LiveKit WebRTC client this SDK depends on
is unavoidably heavy — both `lesson/[id]` and `past-papers/[id]/run`
now share roughly +120KB of First Load JS for it (deduplicated by
Next.js's code-splitting into a shared chunk, not paid twice). Worth
weighing against SmartClass's low-bandwidth Zambian audience; the
illustrated-avatar experience remains fully functional and lightweight
for any persona (or any pupil's connection) that doesn't use live video.

### Named Teacher Personas
Five subject/grade-specific AI teachers, not one persona for everything —
`teacher_personas` maps subject + Form range to a name and a description
`ai-teacher-chat` includes in its system prompt:

| Persona | Subject | Forms |
|---|---|---|
| Linda | Mathematics | 1–3 |
| Mrs Tembo | Science | 1–3 |
| Mr Chomba | Mathematics | 4–6 |
| Mr Banda | Physics | 4–6 |
| Chipo | Chemistry | 4–6 |

All five are described in their persona text as Zambian in appearance and
speaking with a Zambian accent — a text model can't literally have an
accent, but is instructed to write consistent with one, extending the
existing local-context instruction already in the system prompt. The
frontend (`lesson/[id]/page.tsx`, `past-papers/[id]/run/page.tsx`)
resolves and displays the correct name *before* the first AI response,
not after, by querying `teacher_personas` directly on page load — so the
header never briefly shows the wrong teacher.

**All five personas now have real illustrated art** (`TeacherAvatar.tsx`).
Originally only Mr. Chomba did — every other persona showed a plain
initials placeholder rather than misrepresenting who was teaching by
reusing his male illustration under a different, often female, name. That
gap is closed with one shared, parametrized SVG renderer (not five
hardcoded components): a `PersonaConfig` per teacher defines the static
visual traits — skin tone, headwrap or hairstyle, shirt colour, glasses
shape — while the state-driven expressions (idle/speaking/thinking/
encouraging) and every animation (blink, talk, thinking dots, sparkle,
writing badge) are shared, unchanged code that now just reads persona
colours instead of Chomba's hardcoded ones. Linda and Mrs Tembo
wear gele-style headwraps (gold and teal respectively, in a mirrored
knot position so they're distinct at a glance); Mr Banda keeps a
short-hair silhouette closer to Chomba's but adds a mustache and a rust
shirt; Chipo has natural short hair rendered as a rounded, bumpy
silhouette, in blue. Every portrait was prototyped and screenshotted
before being written into the component — not shipped blind — and each
was then re-verified rendering correctly inside the real lesson page and
past-paper runner at actual in-app size, not just in isolation. A name
that doesn't match any of the five known personas still falls back to
the honest initials placeholder, now the true fallback for a genuinely
unrecognised persona rather than the default for four out of five.

**Naming collision worth knowing about**: the Chemistry persona "Chipo"
shares a name with "Chipo Mwansa," the mock pupil used throughout this
README's examples and the app's demo/seed data. Not a technical conflict —
just a real one worth a rename discussion if it causes confusion in
practice (e.g., "ask Chipo" being ambiguous between the pupil and the
teacher in conversation).

### SmartTeach: Escalating Explanation Strategies & "Welcome Back" Memory
Two pieces from the original SmartTeach design, previously unbuilt:
teaching strategy that actually changes when a pupil stays confused, and
the AI remembering a specific past struggle by name when a pupil returns.

**Escalating strategies** (`topic_explanation_attempts`, migration
`20260729080000`): per the original spec's exact order — (1) a direct
explanation, (2) a visual example, (3) a local Zambian everyday example,
(4) breaking the problem into the smallest possible steps. Each time
`detectConfusion()` (already in `ai-teacher-chat`) fires for a given
pupil+topic, the attempt counter increments and the system prompt is
told explicitly which strategy to use next and not to repeat the
previous kind of explanation. The counter resets to 0 the moment the
pupil stops showing confusion signals, so a later, unrelated struggle on
the same topic starts the escalation over rather than jumping straight
to "smallest possible steps" for a different question entirely. Tracked
per topic, not globally — a pupil struggling with quadratics and doing
fine with algebra gets escalating help on the former without it
affecting the latter.

**"Welcome back" memory, now a real AI-generated greeting, not a
template** (`generate-greeting` Edge Function): this started as a
templated sentence — deliberately, to avoid an API call before the pupil
had said anything — but that traded away exactly the "feels like a real
teacher, not a script" quality the rest of the teaching conversation
already had (`ai-teacher-chat` was always a genuine live LLM call; only
this opening moment wasn't). Revisited on direct feedback: the greeting
is now generated by the resolved persona itself, in their own words,
each time — resolves the same named persona as `ai-teacher-chat`
(by subject+grade), looks up the pupil's most recent genuinely-past
struggle (a different calendar day, not the same sitting, the same
"returns the next day" framing from the original design) from
`student_interactions`, and asks the model for a short, natural greeting
that references it if it fits, "without making it feel like a checklist
item." Deliberately **not** counted against the daily free-message quota
and **not** run through content moderation — this isn't a pupil message
being screened, it's the system introducing the lesson before the pupil
has said anything to screen. Falls back to a plain template (the
original implementation, kept as a safety net) whenever
`OPENAI_API_KEY` isn't set or the OpenAI call fails, so a pupil never
sees a missing or broken greeting because of an API hiccup — verified by
reading the actual fallback path in the code, the same care given to
every other optional-AI-call feature in this project.

### SmartTeach: Learning Style Adaptation
Distinct from (and built on top of) escalating explanation strategies
above, which is *reactive* — it only changes approach once a pupil is
already confused. This is *proactive*: over time, `ai-teacher-chat`
learns which kind of explanation tends to actually resolve a given
pupil's confusion, and leans on that style from the **start** of a future
explanation, before any confusion has shown up at all — matching the
original design's "SmartTeach should learn the learner's preferred
explanation style over time" section.

Deliberately reuses the exact same four strategy categories from
escalation (`direct`, `visual`, `local_example`, `step_by_step`) rather
than inventing a second, competing vocabulary — a pupil's preference and
the escalation sequence are the same underlying concept (which kind of
explanation works for this person), just applied proactively instead of
reactively.

**No new signal collection needed** — this reuses the confusion
detection already driving escalation. When a pupil stops showing
confusion and they'd had an active escalation with a recorded strategy
right before that, the transition itself is the signal: whatever
strategy was last used appears to have helped. Logged to
`student_learning_style_signals` (one row per resolution event, not an
aggregate, so the preference calculation can be refined later — e.g.
weighting recent signals more heavily — without a new migration).

**`get_preferred_learning_style(student_id)`** only returns a preference
once there are at least 3 resolved signals — a pattern from one lucky
topic isn't a real preference yet, and defaulting to it prematurely
could actively work against a pupil whose real style hasn't shown itself.
Below that threshold, `ai-teacher-chat` proceeds with no style
instruction at all, exactly as it did before this feature existed.

**The proactive instruction only applies when the pupil isn't currently
confused** — when they are, the escalation instruction already covers
that case, more urgently and specifically; sending both at once would be
two competing style instructions in the same prompt.

### Offline Mode (PWA)
"Offline mode" is scoped honestly here, not oversold. This is a web app
calling OpenAI, Anthropic, LiveAvatar, and DPO — none of those can
possibly work with no internet connection, and nothing about this update
pretends otherwise.

**What actually works offline**: the app shell itself (opening the app
with no connection shows the real interface, not a browser error page),
and previously-viewed lesson/topic/subject/past-paper content — a pupil
who already opened a lesson can re-read it later with no connection.

**What deliberately never gets cached**: anything under `/functions/v1/`
or `/auth/v1/` — AI chat, the live avatar, greetings, payments, sign-in.
Caching a stale "successful" response for any of these would be actively
misleading, not helpful; `public/sw.js`'s fetch handler explicitly
excludes both path patterns before any caching logic even runs.

**No build-time precache list** — Next.js gives every JS/CSS chunk a
content hash that changes on every deploy, so a hardcoded list of asset
URLs to precache would go stale the moment the app is redeployed.
`sw.js` uses runtime caching instead (cache what's actually requested,
as it's requested): cache-first for hashed static assets, network-first
with a cache fallback for HTML page navigations, and stale-while-revalidate
for Supabase REST reads (serve the cached version instantly if there is
one, refresh it from the network in the background).

**`public/manifest.json`** makes the app installable (Android/Chrome
"Add to Home Screen", desktop PWA install). Icons are real PNGs generated
from the existing logo (`app/icon.svg` → 192px/512px via `cairosvg`),
not placeholders — verified by actually viewing the generated 192px
image, not just confirming the file existed.

**Two real Next.js version-specific bugs hit and fixed while building
this, not glossed over**:
1. `export const viewport: Viewport = { themeColor: ... }` — the
   `Viewport` type doesn't exist in this project's installed Next.js
   13.5.1, despite matching the documented pattern for the version
   number. The build itself caught this. Fixed by reading the *actual*
   installed type definitions in `node_modules/next` directly rather
   than guessing again, which showed `themeColor` belongs inside the
   plain `metadata` export in this version, not a separate one.
2. Even after that fix, `<link rel="apple-touch-icon">` still didn't
   render through `metadata.icons.apple`, in two different attempts
   (string form, then array form) that both matched the type definitions
   exactly. Rather than keep guessing at an API that wasn't behaving as
   documented, added it as a plain, manually-written `<link>` tag
   directly in the root layout's `<head>` JSX — a supported Next.js
   escape hatch for exactly this situation. Confirmed working by fetching
   the actual rendered page HTML and finding the tag, not by re-reading
   the code and assuming it worked this time.

**`components/pwa/offline-banner.tsx`**: shown only when the browser
reports no connection at all, with specific wording about what still
works (cached lessons) versus what doesn't (AI chat, saving progress,
payments) — a pupil deserves to know which is which rather than assume
the whole app is broken.

### Legal Documents — Terms of Service & Privacy Policy (drafts)
Not application code — two Word documents drafted to give ZedCode
Technologies a real starting point, not a finished legal deliverable.
Both carry a prominent notice, unmissable at the top of the document,
that they haven't been reviewed by a lawyer and must not be published
or relied on until one has.

**One specific thing surfaced deliberately, not glossed over**: Section
17 of Zambia's Data Protection Act No. 3 of 2021 bars processing a
child's personal data without parent or guardian consent. Today,
pupil registration is fully self-service — a pupil enters their own
name, email, and password directly, with no verification that a parent
has actually consented, only an optional field where a pupil can later
add a parent's email for progress updates. The Privacy Policy draft
gives this its own boxed, highlighted section (Section 5) rather than a
passing mention, stating plainly that this is a real, unresolved gap
between the current registration flow and what the Act appears to
require — and that the section shouldn't be finalized, and registration
shouldn't be treated as compliant, until ZedCode's own lawyer has made
that call.

Both documents also disclose the specific third-party providers this
project actually uses (Supabase, OpenAI, Anthropic, DPO Group,
LiveAvatar, Resend) and the cross-border data transfer this implies,
since Part X of the Act places conditions on transfers of personal data
outside Zambia — another real area flagged for legal review, not
assumed to be fine.

### Real Error Alerting (Email)
Closes the "an admin has to remember to check System Health" gap named
directly when asked about production readiness. `app_error_log` gaining
a new row now triggers a real email — but throttled: at most one email
per error source every 15 minutes, so a genuine outage (say, both AI
providers failing at once) generates one clear signal instead of dozens
of emails flooding the admin's inbox at exactly the moment a clear
signal matters most. Further errors from the same source within that
window are still logged normally, just don't trigger a second email.

Reuses the exact same Resend integration already powering welcome
emails and the weekly digest — no new email provider, no new secret.
Configured from `/admin` → System Health → "Error Alerts", where an
admin sets (or clears, to disable) the address alerts go to. Requires
the same `app.settings.supabase_url` / `app.settings.supabase_service_role_key`
Postgres setup already documented for the weekly digest — this piece
doesn't work without that prerequisite, same as the digest doesn't.

`platform_settings.alert_email` deliberately has no default seeded —
alerting stays off until an admin sets a real address; sending real
alerts to an empty or placeholder value would be worse than not
alerting at all.

### Printable Past Paper Solutions & Teaching Notes
A pupil can print (or "Save as PDF") a past paper's full solutions, or
a lesson's teaching notes, for offline revision — same print-optimized
approach already established by `/progress/report`: the browser's own
print destination, not an added PDF library with real font-embedding
complexity this build environment has no way to verify renders
correctly.

**`/past-papers/[id]/solutions`**: every question, its correct answer,
and its explanation. Deliberately uses the explanation already stored
on each `past_paper_questions` row rather than a fresh AI call made
specifically for this page — that content is already real, reviewed
curriculum material; generating a new explanation on top of it would
cost an API call for no clear benefit over what's already there.
Linked from the past paper overview page as "Print solutions."

**`/lesson/[id]/notes`**: the lesson's own structured teaching content
(intro, steps with board work, worked examples, summary) — the actual
material the AI teacher works from, not a transcript of the specific
chat conversation in that session (which would vary pupil to pupil and
isn't the reusable "notes to revise from" a printable page should be).
Linked from the lesson page itself as "Print notes."

**Verified with real screenshots, and an honest note about where
verification stopped**: the teaching notes page was confirmed rendering
correctly end-to-end with real sample lesson content — all three steps
with their board work, both worked examples, and the summary, in the
correct print-optimized paper-toned layout. The solutions page's visual
verification hit a crash specific to a throwaway test mock (a `.map()`
call failing against mock data that had already had genuine mistakes
earlier in that same debugging session — invalid syntax, a silently-
failed string replacement). Rather than keep spending effort chasing
what was very likely a mock-only artifact, verification stopped at:
the real, actual production build — full TypeScript checking against
the genuine Supabase client types, not a mock — compiles this page
cleanly with zero errors. That's meaningfully short of a confirmed
visual render, and worth testing directly against a real past paper
before relying on it.

### Production Observability, Admin Pagination & Schools Reference
Three of the honest gaps named when directly asked "how secure and
scalable is this system" — closed here, with the same care taken to
flag what's genuinely fixed versus what's a smaller, real limitation
still worth knowing.

**Error logging** (`app_error_log`, migration `20260804080000`): not a
replacement for a real third-party service like Sentry — this build
environment has no way to create that account. What it is: a genuine,
queryable record of what broke, when, and for whom, in the same
database everything else lives in. `_shared/errorLog.ts` (Edge
Functions) and `lib/logError.ts` (frontend) both write to it;
`app/error.tsx` and `app/global-error.tsx` use Next.js's native error
boundary convention to catch rendering crashes instead of showing a
blank screen. Viewable at `/admin` → System Health.

**A real scoping bug caught while wiring this in, not after**: in three
of the four Edge Functions this was added to, `supabase` was declared
*inside* the `try` block — meaning it was never actually reachable from
the corresponding `catch` block at all. Calling `logError(supabase, ...)`
there would have thrown a `ReferenceError` the first time it needed to
fire, silently breaking the exact mechanism meant to catch failures.
Fixed by creating a fresh client inside each catch block specifically
for the logging call — cheap, no network cost, no risk to the
function's main logic.

**Admin list pagination** — the Users, Moderation, and Payments lists
all previously fetched everything with no limit, or a flat capped
`.limit(200)`. Real, server-side pagination now, with one deliberate
exception: unreviewed moderation flags (especially self-harm ones) stay
fully unpaginated and sorted to the top — burying an urgent flag on
"page 2" of a naive scheme is the one outcome that couldn't be risked.
**A second real regression caught mid-build**: the "pending teacher
approval" banner was deriving its list from the paginated Users array,
which meant a pending teacher could become genuinely invisible if their
row fell on a page the admin wasn't currently viewing. Fixed with its
own separate, unpaginated query — the same reasoning as any small,
bounded "needs action" queue.

**`schools` reference table** — a real fix for the free-text school
matching limitation documented since the School Analytics migration.
Deliberately *not* a foreign-key migration of `profiles.school` (a much
larger, riskier change touching every function that reads school as
text); instead, a table that auto-populates via trigger whenever a
genuinely new school name is used, powering a native HTML `<datalist>`
autocomplete (`components/SchoolAutocomplete.tsx`) on all three
school-entry points (pupil registration, teacher registration, account
settings) — nudging new signups toward existing, consistent spelling
without blocking a genuinely new school from being entered.

### Exam Countdown & Revision Recommendations
A pupil sets an exam date and gets a real countdown plus grounded
revision recommendations — not a generic reminder with no actual
guidance.

**Per-subject, not one date for the whole pupil** — past papers and
topic mastery are both already subject-scoped throughout this project,
so a single blended exam date couldn't produce a genuinely targeted
recommendation for a pupil taking, say, Mathematics and Physics on
different dates. `exam_dates` (migration `20260805080000`) is one row
per (pupil, subject).

**`get_exam_prep_recommendations(subject_id)`** returns two grounded
recommendation types, both scoped to the calling pupil and their own
Form: the 5 lowest-mastery topics for that subject (from
`student_topic_mastery`, the richer adaptive learning engine v2 signal
— a topic never attempted at all sorts to the very top, since "never
touched" is at least as urgent as "attempted and still weak"), and past
papers to revise, ordered unattempted-first then lowest-score-first.

Verified with a real screenshot, not just code review: a Mathematics
exam 5 days away rendering in urgent rust-red, a Physics exam 45 days
away in calm teal, and expanding Mathematics genuinely showing two
specific weak topics with real mastery percentages and two past papers
correctly sorted unattempted-first.

### Parent & Teacher Accounts
Two real roles, not just email recipients — a parent can log in and see
their own child's live progress (the design doc's "parent dashboard"),
and a teacher can see their own school's aggregated analytics without
needing admin access. The largest single feature of this project, so
this section is longer than most — worth reading in full before
deploying, not skimming.

**A real conflict this surfaced and had to be resolved carefully**:
`profiles.role` has been protected since migration `20260719080000`
(`prevent_self_role_escalation`) — a `BEFORE UPDATE` trigger that
silently reverts any role change from a non-admin session. That's
exactly right for stopping a pupil from promoting themselves to admin
later, but it would have *also* blocked a legitimate parent/teacher
signup from ever setting their own role correctly. The fix: `role` is
now set at `INSERT` time instead, inside `handle_new_user()` itself
(reading `raw_user_meta_data->>'role'`, allowlisted to only `'pupil'`,
`'parent'`, or `'teacher'` — **never** `'admin'`, regardless of what a
signup request claims). `prevent_self_role_escalation` only fires on
`UPDATE`, so it never even sees this happen, and every existing pupil
signup path is completely unaffected — it never sent a `role` in its
metadata before, and still doesn't now, so it still defaults to
`'pupil'` exactly as before this migration.

**Parent accounts** (`/register/parent`, `/parent`): linking to a child
is automatic in either order — a parent can sign up before or after
their child adds the parent's email in `/account`. A trigger
(`sync_parent_child_links`, fired on relevant `profiles` changes) checks
for a match whichever direction happens first. `get_my_children()` and
`get_child_progress(child_id)` are both genuinely access-controlled
server-side — the latter checks a real `parent_child_links` row exists
before returning anything, not just filtered in the UI. Verified with a
real screenshot: two linked children, one expanded showing actual
per-topic mastery percentages, correctly color-coded.

**A known, deliberately accepted risk in this linking mechanism**:
matching is done purely by email address, and this project never
verified whether email confirmation is enforced anywhere in the signup
flow. If it isn't, a pupil could enter *any* email as their
parent/guardian email — not necessarily one they're entitled to link —
and if that email is ever used to register a parent account, the link
fires automatically, with no confirmation step from the pupil and no
proof the parent account holder is actually that pupil's guardian. A
safer design (the pupil explicitly approving a pending link from their
own already-authenticated account, rather than a silent automatic
match) was proposed and consciously declined in favor of keeping the
simpler automatic behavior. This is relevant to the Privacy Policy
draft's Section 5 note on Data Protection Act Section 17 (parental
consent for children's data) — an unverified automatic match is the
opposite of a deliberate consent step, and this tradeoff should be
revisited alongside that legal review, not forgotten as an implementation
detail.

**Teacher accounts** (`/register/teacher`, `/teacher`) — **deliberately
not self-service**. `profiles.teacher_approved` defaults to `false`; an
admin has to approve from the Users tab (a new "pending approval"
section there) before a teacher account can see anything. This isn't
extra friction for its own sake — teacher access exposes aggregated
performance data across an entire school's real pupils, which is a
genuine enough privilege that a login form alone shouldn't be the only
gate. An unapproved teacher who tries to log in is signed back out
immediately with a clear message, not left in a confusing half-logged-in
state.

**Reuses the existing school analytics functions rather than
duplicating them** — `get_school_topic_analytics()` and
`get_common_misconceptions()` (originally admin-only, from migration
`20260725080000`) are extended, not copied, to also accept an approved
teacher — but strictly scoped to their own school, checked **inside the
function itself**: a teacher's request for a different school's data is
rejected server-side, not just hidden by the UI not offering a picker
for other schools.

**Both dashboards are standalone routes, not folded into the existing
`(app)` pupil layout** — that layout's nav (Lessons, Past Papers,
Progress) and its assumption of a Form/grade genuinely don't apply to
either role, and retrofitting one shared layout to handle three
different role-based nav sets felt like a real risk to the pupil
experience for a session already this large. `/login` was made
role-aware instead (checks `profile.role` after sign-in and routes to
`/dashboard`, `/parent`, or `/teacher` accordingly) — the one place that
genuinely needed to branch.

**Manual setup required**: none beyond running the migration — no new
Edge Function, no new secret. A teacher does need admin approval before
their account does anything (see above); that's a deliberate step, not
a missing one.

### Pupil-Facing Privacy Self-Service
Real data export and genuine self-service account deletion — not just
the admin-triggered version. Prioritized specifically because real
payments and real minors' data are both actually live in this project
now, not hypothetical; this is closer to an obligation than a nice-to-have.

**`lib/exportUserData.ts`**: pulls together everything a pupil's account
actually owns — profile, progress, topic mastery, subscriptions,
payments, practice/past-paper attempts, and their own chat/interaction
history — into one downloadable JSON file. RLS already scopes every one
of these queries to the calling pupil's own rows, so the function
doesn't need its own authorization logic; it's reading the same tables
the app already reads from, as the pupil themselves, nothing more
privileged. Deliberately excludes `moderation_flags` and `user_warnings`
— whether to show a pupil the exact flagged message or warning reason,
unfiltered, is a separate, more sensitive product decision than "export
my own learning data," and isn't decided by this function. Verified
end-to-end, not just that the button renders: actually triggered the
download in a real browser and inspected the resulting file — correct
structure, every expected key present, real profile data matching what
was seeded.

**Self-service deletion, sharing one function with the admin-triggered
version** (`delete-user-account`) rather than a separate one — keeping
the genuinely sensitive part (the audit snapshot, the real
`auth.admin.deleteUser()` call) in exactly one place. The function
previously *explicitly blocked* self-deletion (`"You cannot delete your
own account this way"`) — inverted so a caller deleting their own
account is always allowed (no admin role needed; anyone is entitled to
delete their own data), while deleting *someone else's* account still
requires admin + a reason, unchanged from before. A pupil's own
`reason` field is optional — nobody should have to justify a decision
about their own account to themselves — and self-deletions are
deliberately **not** written to `admin_action_log` (no admin acted, so
logging one there would misrepresent what happened), while still
getting a full snapshot in `account_deletions_log` either way;
`deleted_by === deleted_user_id` is how a later admin reading that log
can tell it was self-service without needing a separate flag.

Same "type DELETE to confirm" pattern already established in the admin
Moderation tab's own account-deletion form — consistency matters for
something this irreversible, not a new pattern invented for pupils
specifically.

### Persona Management (Admin Self-Service for LiveAvatar)
Connecting each of the five named personas to a real LiveAvatar
avatar_id previously meant a raw SQL `UPDATE` run by hand in the
Supabase SQL Editor — which is genuinely how Chipo's avatar_id got set.
That worked, but only because the SQL Editor uses an elevated role that
bypasses RLS; **`teacher_personas` never actually had an UPDATE policy**
for any authenticated session, including an admin's own. A real,
blocking gap the moment there was a second or third persona to wire up.

**Fixed in two parts**: migration `20260802080000` adds an admin-only
UPDATE policy (same role-check pattern used everywhere else in this
project), and a new admin **Personas** tab (`/admin` → Personas) lets an
admin paste an avatar_id and optional voice_id directly for any persona
and save — no SQL, no asking someone else to run a query. Each persona
shows plainly whether it currently has a live avatar connected or is
using the illustrated fallback — neither state is an error, both work.

Screenshotted and confirmed with mixed states: a persona with a real
avatar_id pre-filled and marked "Live avatar connected," alongside two
with empty inputs marked "Using illustrated avatar" — not just assumed
from the code that both states would render correctly.

### Multi-Provider AI: OpenAI + Anthropic (Claude)
`ai-teacher-chat`'s teaching response generation can use either OpenAI or
Anthropic — with genuine automatic fallback, not a cosmetic either/or
toggle. If the admin-preferred provider fails or isn't configured, the
other one picks up the same request without the pupil ever seeing a
failure, as long as at least one is working.

**Deliberately scoped to chat completions only.** Content moderation
(`moderateMessage()`) and embeddings (`_shared/embeddings.ts`, powering
RAG search) stay OpenAI-only — Anthropic doesn't offer a public
moderation endpoint or an embeddings API, so there's no real "switch
providers" story for either of those. Only the actual teaching response
text is multi-provider.

**Anthropic's API details were verified against current documentation
before writing `_shared/llm.ts`**, not assumed — the endpoint
(`POST https://api.anthropic.com/v1/messages`), both required headers
(`x-api-key`, `anthropic-version: 2023-06-01`), and the response shape
(a `content` array of typed blocks, meaningfully different from OpenAI's
single `choices[0].message.content` string) are genuinely different from
OpenAI's API, not just a model-name swap. Model: `claude-haiku-4-5-20251001`
— matching the same cost-conscious "mini"-tier choice already used for
OpenAI (`gpt-4o-mini`) throughout this project, not the largest/most
expensive model for a routine tutoring exchange.

**Admin-configurable** (`/admin` → Analytics → AI Teaching Insights →
"AI Provider"): a simple two-button toggle for which provider is tried
first, stored in `platform_settings.primary_ai_provider` (default
`openai`) — the same key-value table already used for the free-mode
toggle and subscription price, rather than a new single-purpose table
for one more admin-tunable value.

**A stale reference caught and fixed while wiring this in**: the admin
Analytics tab's "Fallback Rate" metric was computed as `source !==
'openai'`, which would have silently miscounted every genuine
Anthropic-sourced response as a fallback the moment this feature shipped.
Fixed to check for the literal `'fallback'` source instead (the
rule-based canned response, used only when neither provider works) — a
real regression caught during this same change, not after.

### Local Language Support
A pupil can set their teacher to respond primarily in Bemba, Nyanja,
Tonga, or Lozi instead of English — named as a future phase in the very
first SRS document for this project, not attempted until this update.

**The language codes were verified, not guessed** — ISO 639-3, checked
against multiple independent sources before being written into the
migration, since a wrong code silently breaks the whole feature:
`bem` (Bemba), `nya` (Nyanja — also `ny` under ISO 639-1; "Nyanja" is the
name used in Zambia specifically, "Chichewa" in Malawi for the same
language), `toi` (Tonga — specifically the Zambia/Zimbabwe language, not
`ton` which is Tongan, the Pacific language, and not `tog` which is a
Tumbuka dialect spoken in Malawi that also confusingly goes by "Tonga"),
`loz` (Lozi).

**Honest uncertainty, not hidden**: whether OpenAI's models actually
produce fluent, natural output in these specific languages cannot be
verified from a build environment with no way to evaluate real language
quality — they're far less represented in typical LLM training data than
English, French, or Spanish. `ai-teacher-chat` instructs the model to
mix in English for technical/mathematical terms where natural (genuine
Zambian classroom code-switching, not a workaround) and to prefer English
over guessing at an unclear translation. The account page's selector
(`/account` → Teaching Language) is explicitly labeled **"(beta)"** with
a note that quality may vary and switching back to English is always one
click away — this isn't presented anywhere as a finished, guaranteed
capability. Verified by screenshot that the selector itself renders and
saves correctly; the actual language output quality is the one thing in
this entire project that genuinely cannot be checked from here.

### Proactive Engagement
The AI teacher notices when a pupil goes quiet mid-lesson and checks in
— the same "engage like a real teacher, not statically" principle
already applied to the opening greeting, now applied to silence during
the lesson too.

**`generate-greeting` gained a `checkin` mode** rather than a new,
separate function — reuses the same persona resolution and
graceful-fallback structure already proven for the opening greeting.
References what the pupil last said if there's anything to reference,
rather than a generic "are you there?"

**Idle detection** (`lesson/[id]/page.tsx`): 60 seconds of no activity
after the pupil has sent at least one message triggers the check-in — not
from page load, since checking in before a pupil has even started
reading the greeting would read as nagging, not a teacher noticing
genuine quiet.

**A real bug caught and fixed during this build, not after shipping**:
the first version reset the "already checked in" flag on *any* new
message being added to the conversation — including the check-in's own
message. That would have meant an AI teacher checking in every 60
seconds forever if a pupil went silent and never came back. Fixed so
only genuine pupil activity (typing or sending a message) re-enables a
future check-in — one silence gets exactly one check-in, not a repeating
nag.

### Student Learning Profile (Adaptive Learning Engine v2)
A richer layer added *alongside* `progress_records` (mastery % + attempt
counts) and `ai_interaction_logs` (chat turns for the AI Insights panel) —
neither of those changed or needs to change; every existing page that
reads them keeps working exactly as before. This is intentionally
additive rather than a replacement in the same pass, since migrating every
consumer (dashboard, lesson page, practice page, `adaptiveLearning.ts`) to
a new schema at the same time as introducing it is exactly the kind of
large, simultaneous, hard-to-verify change worth avoiding — especially
here, where nothing can be tested against a live database before shipping.

- **`student_interactions`**: one row per meaningful interaction, richer
  than `ai_interaction_logs` — the actual question, the pupil's response,
  and (new) `detected_mistake`: a short description of the specific
  misconception shown, not just right/wrong. Detected via a second,
  low-token OpenAI call in `ai-teacher-chat` (`detectMistake()`), only
  attempted for substantive messages (skips greetings/one-word replies) to
  avoid doubling API cost on every single chat turn.
- **`student_topic_mastery`**: one row per pupil per topic, blending
  multiple signals (matching the design's list: quiz performance, repeat
  questions, past-paper performance, recency) into a single `mastery_score`
  with a `confidence` band (low/medium/high, based on how many data points
  back the score) and a banded `status`
  (needs_support/developing/good_progress/proficient/mastered).
- **`recompute_topic_mastery(student, topic)`** (SQL function,
  migration `20260722080000`): the shared source of truth for turning
  interaction history into a mastery score — `ai-teacher-chat`, the
  practice page, and the past-paper runner all call this same function via
  RPC after logging an assessable interaction, rather than three separate
  implementations of the same math. Only recomputes from interactions
  where `correct IS NOT NULL` — most chat turns are open-ended and
  correctly don't count, while practice and past-paper answers always do.
- **Practice and past-paper pages both write to `student_interactions`
  now** (closing what was a known gap as of the previous update):
  `practice/[id]/page.tsx` logs every submitted answer with
  `interaction_type: 'practice_question'`; the past-paper runner does the
  same for `interaction_type: 'past_paper_question'`, but only for
  questions an admin has tagged with a `topic_id` (untagged past-paper
  questions still work normally, they just can't be attributed to a
  specific topic — the same opt-in tagging `lib/adaptiveLearning.ts`
  already relies on for the dashboard's Focus Areas panel). Between chat,
  practice, and past papers, `student_topic_mastery` now reflects a real
  blend of signals rather than chat data alone.
- **`detected_mistake` for wrong practice/past-paper answers**: a
  dedicated Edge Function, `detect-answer-mistake`, called only when an
  answer is wrong (a correct one has nothing to classify). Structured
  rather than inferred — unlike `ai-teacher-chat`'s open-chat version,
  this one is given the actual correct answer alongside the pupil's
  submission, which makes for a more reliable classification (e.g.
  distinguishing "added instead of subtracting the constant term" from a
  plain arithmetic slip is much easier to call with both answers in
  hand). Requires a valid session, same baseline as every other function;
  no separate rate limit, since wrong answers are already naturally
  bounded by how many questions a pupil can submit. Degrades gracefully
  to `mistake: null` — never an error the frontend has to handle
  specially — when `OPENAI_API_KEY` isn't configured or the classification
  call fails for any reason.

### Email Notifications
Two emails, both via Resend (`supabase/functions/_shared/email.ts`) — not
Supabase Auth's own email sending, which is scoped to auth events
(confirmations, password resets) and can't carry arbitrary app content.

- **Welcome email**: sent by a database trigger (`trg_welcome_email`,
  `AFTER INSERT ON profiles`) calling `send-welcome-email` via `pg_net`,
  not by the frontend after signup. Deliberate — a trigger fires exactly
  once no matter how the profile row was created (normal registration, an
  admin creating an account, a future bulk import), where a frontend call
  would silently miss every path except the one specific form it was
  wired to, and would delay the signup page waiting on an email API.
- **Weekly progress digest**: scheduled via `pg_cron` (Monday 07:00 UTC /
  09:00 Zambia time), one cron trigger fans out to one email per opted-in
  pupil with any activity in the last 7 days — pupils with zero activity
  are skipped entirely rather than sent an empty "you did nothing" email,
  since a weekly nag with nothing to show for it just trains people to
  ignore every future digest, including the ones worth reading. Goes to
  `profiles.parent_email` when set, otherwise the pupil's own login email
  — the realistic version of "parents get updates" without building a
  separate parent account system.
- Both respect `profiles.email_notifications_enabled` (default `true`),
  and pupils manage their own parent email + opt-out on `/account`.
- **Requires manual setup this migration can't do for you** — see the
  header comment in `20260720080000_email_notifications.sql` in full, but
  in short: `ALTER DATABASE postgres SET app.settings.supabase_url = ...`
  and `...supabase_service_role_key = ...` (once, with your real project's
  values), confirm `pg_net` and `pg_cron` are enabled (Database →
  Extensions), deploy `send-welcome-email` and `send-weekly-digest`, and
  set `RESEND_API_KEY` + `EMAIL_FROM` as Edge Function secrets. Until all
  of that's done, the trigger/cron calls simply fail silently — the app
  keeps working normally either way, it just won't send emails yet.

### AI Evaluation Suite (SRS 12.16)
`scripts/run-ai-evaluation.js` + `scripts/eval/test-cases.js`. SRS 12.16
defines four testing dimensions: accuracy, teaching quality, curriculum
alignment, and user testing. The fourth is a real-world process with
students and teachers — not something a script can automate — but the
first three are real and runnable:

- **12 test cases**, not invented examples — pulled from the actual seeded
  past-paper questions with known correct answers, so a failure means
  something is genuinely wrong, not that the test itself is unrealistic.
- **Heuristic scoring always runs**, no API key needed: does the response
  contain the correct answer (`accuracy`), is it long enough and free of
  discouraging phrases to actually look like teaching rather than a bare
  answer (`teaching_quality`), does it stay on-topic and use local context
  (`curriculum_alignment`). Verified with a small smoke test against
  fabricated responses before shipping — the pass/partial-credit/fail math
  is correct, not just plausible-looking.
- **Optional LLM-judge scoring** when `OPENAI_API_KEY` is set: a second
  OpenAI call grades each response against a rubric (0-100 + one-line
  reason), blended with the heuristic score — closer to actually judging
  "does this explain clearly," which a string match alone can't do.
- Calls the **real, deployed** `ai-teacher-chat` function as an actual
  pupil would (signs in as a real test account via `EVAL_TEST_EMAIL`/
  `EVAL_TEST_PASSWORD`, same auth, same rate limits — the script paces
  itself to stay under the 8/minute burst limit rather than tripping it).
- Results print as a console report and, if `SUPABASE_SERVICE_ROLE_KEY` is
  set, persist to `ai_eval_runs`/`ai_eval_results` — visible as a score
  trend in the admin Analytics tab's **AI Evaluation History** card.
- Run with `npm run eval:ai`. **Can't be run from this build sandbox** —
  it needs network access to a live Supabase project and OpenAI, which
  this environment doesn't have; it's meant for a developer machine or CI.

### Admin (`/admin`, separate auth path)
Admin lives on its own route structure, entirely separate from the pupil
app: `app/admin/login/page.tsx` is a dedicated login screen (deliberately
plain — no chalk dust, no card tilt, no pupil-facing tagline, no
"create an account" link, since admin accounts are provisioned, not
self-registered), and `app/admin/(protected)/layout.tsx` wraps every admin
page with its own auth guard and its own chrome (no Lessons/Past
Papers/Progress nav) instead of the pupil app's `app/(app)/layout.tsx`.

There's still only one identity system — the same Supabase Auth as the
pupil app — so this isn't a second backend to stand up, just a second
front door and a stricter guard:

- Visiting `/admin` with no session redirects to `/admin/login`, not
  `/login`.
- Visiting `/admin` with a **non-admin** session immediately signs that
  session out, shows "This account doesn't have admin access," and
  redirects to `/admin/login` — an actual access attempt ends the session
  rather than quietly bouncing to `/dashboard`.
- Landing on `/admin/login` itself while already signed in as a pupil
  (e.g. left open in another tab) does **not** force a sign-out — it's
  just a login form, so visiting it isn't treated as an access attempt;
  it shows a small notice instead and lets the pupil navigate away or
  sign in with different (admin) credentials, which cleanly swaps the
  session.
- The pupil app's nav bar only shows an "Admin" link at all when
  `profile.role === 'admin'` — regular pupils never see any UI hint that
  an admin panel exists.

**Optional subdomain**: `middleware.ts` will rewrite requests for a
configured `ADMIN_SUBDOMAIN_HOST` (e.g. `admin.smartclasszambia.com`) onto
the `/admin` routes automatically, so the admin panel can live at its own
subdomain with no `/admin` visible in the URL at all. This requires two
things outside the codebase that I can't do from here: a DNS record for
the subdomain, and adding it as a custom domain in your Netlify site
settings pointing at the same deployment. Until both of those exist, this
middleware never runs (no request ever arrives with that hostname) and
`/admin` / `/admin/login` on the main domain work exactly as described
above regardless.

Tabs for curriculum, lessons, questions, materials (the `content_materials`
table — curriculum docs, textbooks, past-paper references awaiting
ingestion), users, analytics, and settings.

---

## Database schema (all tables)

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`: name, grade, role |
| `subjects` | Mathematics, Science, Physics, Chemistry — grade ranges, icon, color |
| `topics` | Curriculum topics, scoped to grade + subject |
| `lessons` | Lesson content (JSON: intro/steps/examples/summary) per topic |
| `lesson_sessions` | A pupil's run through one lesson — status, transcript |
| `practice_questions` / `practice_attempts` | Per-topic practice, same shape as past papers |
| `progress_records` | Rolled-up mastery per pupil per topic |
| `content_materials` | Curriculum/textbook/past-paper *references* for the AI's RAG layer (not the same as `past_papers`, which holds structured, answerable questions) |
| `search_index` | Denormalized text for the dashboard's search bar |
| `past_papers` / `past_paper_questions` / `past_paper_attempts` | Structured past papers by year, whole-paper or per-question |
| `ai_interaction_logs` | Every AI chat turn (source, curriculum-context hit, confusion signal) — the continuous learning pipeline's data capture (SRS 12.17) |

All tables use Row Level Security. Curriculum-shaped tables (subjects,
topics, lessons, questions, past papers) are public-read; personal data
(sessions, attempts, progress, profile) is scoped to `auth.uid()`.

---

## Design system

Chalkboard aesthetic, defined in `app/globals.css` and `tailwind.config.ts`:

- **Colors**: `board`/`board-deep` (background), `chalk` (text), `gold`/`gold-deep`
  (primary accent), `rust` (secondary/error accent), `teal` (success accent),
  `ink`/`paper`/`paper-edge` (light "note card" surfaces).
- **Fonts**: Fraunces (display/headings), Caveat (Mr. Chomba's spoken lines
  and hand-written board text), Inter (UI), Space Mono (numbers/stats).
- **Motifs**: `.chalk-noise` + `.dust` (ambient chalkboard texture),
  `.card-board` / `.card-paper` / `.card-topic` / `.card-note` (the
  chalkboard-vs-paper card language used throughout).
- **Logo** (`components/brand/Logo.tsx`): an open book (gold + chalk
  pages) with a rising spark above it — education grounded in something
  real, with an AI spark on top. The spark reuses the exact 4-point shape
  from `TeacherAvatar`'s "encouraging" state, so the mark and Mr. Chomba's
  own expressions read as one hand-drawn chalk language rather than two
  unrelated design systems. `LogoMark` is the icon alone; `Wordmark` is the
  icon + "SmartClass Zambia" lockup, in four sizes (`sm`/`md`/`lg`/`hero`).
  Used in the nav bar, login/register/onboarding, and the landing page —
  previously each of those five spots had its own copy-pasted text-only
  wordmark; now there's one source of truth. Also present as `app/icon.svg`,
  which Next.js automatically serves as the site favicon via its `app/icon`
  file convention — no manual `<link rel="icon">` needed.

---

## Build status

Last certified with a fully clean install (`rm -rf node_modules .next &&
npm install && npx next build`): **compiles clean**, all 14 routes
generated, zero type errors. Fixed three real bugs found this way (none
were catchable before this, since a working `npm install` wasn't possible
until recently): two implicit-`any` parameter errors in
`app/(app)/progress/page.tsx` and `app/(app)/topic/[id]/page.tsx`, and a
nullable-type mismatch between `Topic.subject_id` and
`WeakArea.subjectId` in `lib/adaptiveLearning.ts`. The only build output is
one harmless, well-known webpack warning about `@supabase/realtime-js`'s
dynamic `require()` — it doesn't affect functionality.

`npm audit` reports vulnerabilities in transitive dev-tooling dependencies
(`brace-expansion`, `cross-spawn`, `ajv`, etc. — all ReDoS in build-time
packages, not runtime app code). Not force-fixed, since `npm audit fix
--force` risks breaking the dependency tree for packages that don't affect
the shipped app.

Runtime behavior against a live Supabase project has **not** been verified
end-to-end from this environment — its network can't reach `supabase.co`.
Every screen up through this point has been visually confirmed either via
a real (mock-data) render or by code review; see the preview screenshots
shared alongside this project for the mock-data renders of the dashboard,
Past Papers, lesson, and progress screens.

---

## What's real vs. seeded

- Auth, database schema, RLS, the dashboard, lesson runner, practice mode,
  progress tracking, and the Past Papers flow are all fully functional
  against a real Supabase backend.
- The AI teacher calls real OpenAI when `OPENAI_API_KEY` is set; otherwise
  it degrades to a rule-based fallback rather than breaking.
- Curriculum content (topics/lessons/questions) is seeded for Mathematics
  (Form 1–6), Science (Form 1–3), Physics and Chemistry (Form 4–6) — enough
  to demo every flow, not the full Zambian Curriculum syllabus.
- Past papers are seeded with 3 real example papers (2 Maths, 1 Physics) —
  a starting scaffold, not the full ECZ archive. Past papers are ECZ
  documents specifically; where a direct ECZ system integration isn't
  available, they're uploaded manually via the admin Materials tab instead
  (`moe-ecz-sync` is the automated-sync attempt for when that integration
  exists).
- `moe-ecz-sync` seeds *references* to known MoE/ECZ sources into
  `content_materials`; it doesn't scrape or ingest the actual documents.

---

## Deployment

Configured for Netlify (`netlify.toml`, `@netlify/plugin-nextjs`).

Run `node scripts/check-deploy-readiness.js` before deploying — it verifies
`.env`, migration files, and Edge Functions are all in place (it doesn't
deploy anything itself; see below for that).

1. **Database**: run every file in `supabase/migrations/` in filename
   order against your Supabase project.
2. **Edge Functions**: `supabase functions deploy ai-teacher-chat`,
   `content-materials`, `create-payment`, `delete-user-account`,
   `detect-answer-mistake`, `generate-embeddings`, `generate-greeting`,
   `liveavatar-token`, `moe-ecz-sync`, `send-welcome-email`,
   `send-weekly-digest`, and `verify-payment`.
3. **Edge Function secrets** (Supabase dashboard -> Project Settings ->
   Edge Functions -> Secrets, or `supabase secrets set`): `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (optional — see
   `.env.example`). Never put these in Netlify or `.env`.
4. **Frontend env vars** (Netlify site settings): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same values as `.env`.
5. Deploy the site (push to the connected branch, or `netlify deploy`).
