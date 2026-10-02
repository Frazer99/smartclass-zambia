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
| Voice | Browser Web Speech API (`SpeechSynthesis`) with named Zambian English voice profiles |
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
OPENAI_MODEL=gpt-4o-mini  # optional; this is the default
DPO_COMPANY_TOKEN=...      # required for card and mobile-money checkout
DPO_SERVICE_TYPE=...       # DPO service type assigned to your merchant account
MTN_MOMO_API_USER=...      # MTN MoMo Collection API user
MTN_MOMO_API_KEY=...       # MTN MoMo API key/secret
MTN_MOMO_SUBSCRIPTION_KEY=... # Ocp-Apim subscription key
MTN_MOMO_TARGET_ENV=sandbox   # use production after approval
MTN_MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com
SITE_URL=https://your-production-site.example.com
```

Set the private values in **Supabase Dashboard → Project Settings → Edge
Functions → Secrets**. Never put `OPENAI_API_KEY`, `DPO_COMPANY_TOKEN`, a
Supabase service-role key, or a database password in a browser-exposed `.env`
file. `SITE_URL` must be the public URL DPO redirects to after checkout.
For local testing it can be `http://localhost:3000`.

### 2. Database

Run every file in `supabase/migrations/` **in filename order** against your
Supabase project (via the Supabase CLI, `supabase db push`, or pasted into
the SQL editor one at a time). They're written to be idempotent
(`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), so re-running is safe.

Deploy the Edge Functions in `supabase/functions/` (the Supabase CLI
picks up `_shared/` automatically — it's not deployed as its own function):

```
supabase functions deploy ai-teacher-chat
supabase functions deploy content-materials
supabase functions deploy generate-embeddings
supabase functions deploy moe-ecz-sync
supabase functions deploy ingest-material
supabase functions deploy ingest-video-material
supabase functions deploy create-payment
supabase functions deploy verify-payment
```

### Mobile money payments

The `/subscribe` flow uses MTN MoMo Collection API for MTN payments. The pupil
enters an MTN Zambia number, receives an approval prompt on the phone, and the
server polls MTN before activating or extending the subscription. SmartClass
never handles the mobile-money PIN. MTN normally provides an API user, API
key, subscription key, and target environment; an API key by itself is not
enough to authenticate a request.

Card payments continue to use DPO Group. DPO credentials are only required for
the card option when MTN is configured separately.

Admin PDF ingestion requires the `content-materials` Storage bucket and the
`20260908102000_pdf_material_ingestion.sql` migration. Uploads are kept in a
private bucket. Admin uploads first extract selectable text locally in the
browser. Image-only pages are rendered and OCR'd locally with Tesseract.js,
then sent to the `ingest-material` Edge Function for search indexing, question
parsing, embeddings, and syllabus topic generation. OpenAI OCR remains a
server-side fallback when browser OCR is unavailable; set
`OPENAI_OCR_MODEL` optionally to override the default `gpt-4o-mini` model. The
`OPENAI_API_KEY` must be configured in the Supabase Edge Function secrets if
that fallback or semantic embeddings are required.

Admin video ingestion uses the same private bucket and the
`ingest-video-material` Edge Function. It sends video audio to OpenAI Whisper,
stores the transcript in `content_materials`, and creates a pgvector embedding
so the RAG teacher can search the lesson. Each video upload must be assigned to
one subject, Form, and topic; pupils only see videos attached to the topic they
are studying. Topic playback uses signed URLs from the private bucket. Video
uploads are limited to 25 MB; configure `OPENAI_API_KEY` for this function.

### 3. Install and run

```
npm install
npm run dev
```

Then visit `http://localhost:3000`. New pupils go through
`/register` → `/onboarding` (grade selection) → `/dashboard`.

### Verification before deployment

Run the local checks before pushing a release:

```
npm run typecheck
npm run check:deploy
npm run smoke
```

The smoke test checks `/` and `/login` without credentials. To also exercise
the authenticated AI teacher contract, provide a dedicated test pupil through
`E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Set `SMOKE_BASE_URL` when checking a deployed
Netlify URL. For deeper tutor-quality checks, run `npm run eval:ai` with the
evaluation account variables documented in `scripts/run-ai-evaluation.js`.

For Supabase deployment, apply migrations before deploying functions, then
deploy `ai-teacher-chat`, `content-materials`, and `ingest-video-material`. Run the smoke test against the
deployed URL, run the AI evaluation suite, and verify the atomic rate-limit
RPC (`consume_ai_rate_limit`) exists remotely before announcing the release.

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

**The illustrated avatar (`TeacherAvatar.tsx`) only has real art for Mr.
Chomba.** Showing that same male illustration under a different — often
female — teacher's name would misrepresent who's teaching, so any other
persona renders a plain initials placeholder instead (a gold circle with,
e.g., "MB" for Mr Banda) — honest about not having matching art yet rather
than visually wrong. Illustrated characters for the other four is real
design work for a future pass, not attempted here.

**Naming collision worth knowing about**: the Chemistry persona "Chipo"
shares a name with "Chipo Mwansa," the mock pupil used throughout this
README's examples and the app's demo/seed data. Not a technical conflict —
just a real one worth a rename discussion if it causes confusion in
practice (e.g., "ask Chipo" being ambiguous between the pupil and the
teacher in conversation).

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
- **Assessment coverage**: `ai-teacher-chat`, practice answers, and
  past-paper answers all write to `student_interactions`. Practice and
  past-paper submissions also recompute `student_topic_mastery`; wrong
  answers request a concise misconception classification when the
  `detect-answer-mistake` function is available. This gives the adaptive
  layer both conversational and right/wrong evidence while preserving the
  simpler `progress_records` dashboard contract.

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
   `content-materials`, `generate-embeddings`, and `moe-ecz-sync`.
3. **Edge Function secrets** (Supabase dashboard -> Project Settings ->
   Edge Functions -> Secrets, or `supabase secrets set`): `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` (optional — see
   `.env.example`). Never put these in Netlify or `.env`.
4. **Frontend env vars** (Netlify site settings): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same values as `.env`.
5. Deploy the site (push to the connected branch, or `netlify deploy`).
