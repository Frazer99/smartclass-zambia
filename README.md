# SmartClass Zambia -- v0.2 (this build)

Your AI Teacher, Anytime, Anywhere. Built by ZedCode Technologies.

This build implements the platform requested on top of the SRS: an AI
teacher (Lesson section) and an interactive Past Paper section, content
driven entirely by admin-uploaded syllabus/materials/past papers, Form 2-6
subject coverage, a 10-minute free trial per subject, and K50/subject/month
subscriptions via MTN Money, Airtel Money and Visa.

## What's implemented

- **Auth**: register/login (JWT), student + admin roles, Form 2-6 selection.
- **Admin content pipeline**: upload a syllabus document (.pdf/.docx/.txt) ->
  the system parses it and auto-creates the topic list for that subject/Form;
  upload approved textbooks/pamphlets/notes, which feed the AI teacher's
  retrieval-augmented answers; create past papers with a question-by-question
  breakdown (text, marks, marking scheme).
- **Subjects by Form**: Form 2-3 = Mathematics + Science; Form 4-6 =
  Mathematics + Physics + Chemistry (configurable in the DB, not hardcoded).
- **Lesson section**: pick a topic, the SmartTeach(TM) engine greets the
  learner, explains step by step (grounded in uploaded material via TF-IDF
  retrieval), asks a comprehension check, waits for the answer, detects
  hesitation/wrong answers and re-explains from another angle (up to 3
  attempts), then assigns practice and summarizes. Every teacher turn also
  produces smart-whiteboard content.
- **Past Paper section**: pick a past paper (whole paper or specific
  question(s)), the AI teacher walks through each selected question step by
  step (grounded in the marking scheme/answer guide when provided), answers
  learner follow-up "why" questions, and moves to the next question on
  request.
- **Free trial + subscriptions**: every interactive AI-teacher turn reports
  elapsed time; the first 10 minutes per subject are free, then the API
  returns 402 Payment Required and the frontend shows a paywall modal.
  Subscribing (K50/subject/month) via MTN Mobile Money, Airtel Money or Visa
  unlocks unlimited access to that subject until the subscription expires.
- **Progress tracking** per topic (mastery %, lessons completed, correct/attempted).

## Stack

- Backend: FastAPI + SQLAlchemy 2 + Pydantic v2, JWT auth (bcrypt), SQLite by
  default / any DB via `DATABASE_URL` (Postgres/Supabase in production per
  the SRS). TF-IDF (scikit-learn) retrieval over admin-approved materials as
  the RAG substrate described in SRS 5.2/12.6.
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind.
- **No paid API keys required to run.** AI explanations, TTS/avatar and
  payment gateways all sit behind swappable provider interfaces
  (`AIProvider`, `PaymentProvider`) that default to deterministic mock
  implementations, per the SRS's "validate first, add real vendors once the
  product proves out" strategy (12.1/12.7/14.15). Real voice/avatar/LLM/
  payment integration points are documented below.

## Quick start

### Backend
```bash
cd backend
pip install -r requirements.txt
python seed.py        # creates demo subjects/topics/material/past paper + admin/student logins
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                  # http://localhost:3000
```

Demo logins (seeded): `admin@smartclass.zm` / `student@smartclass.zm`, password `password123`.

### Tests
```bash
cd backend && python -m pytest tests/ -q
cd frontend && npm run build
```

## Repo layout

```
backend/
  app/
    core/        config, db session, JWT/password security
    models/      SQLAlchemy models (users, subjects, topics, materials,
                 syllabus docs, past papers/questions, lesson sessions/
                 messages, progress, trial usage, subscriptions, payments)
    schemas/     Pydantic request/response models
    services/
      document_parser.py   text extraction (pdf/docx/txt) + syllabus->topics
      retrieval.py          TF-IDF retrieval over approved materials (RAG)
      smartteach.py         the SmartTeach(TM) teaching-engine logic + AIProvider
      access_control.py     free-trial + subscription gating
      payment_provider.py   MTN MoMo / Airtel Money / Visa(DPO) provider interface
    routers/     auth, catalog, admin_content, lessons, past_papers, progress,
                 subscriptions
  seed.py        demo data
  tests/         pytest end-to-end smoke tests
frontend/
  app/           Next.js App Router pages (landing, auth, dashboard, subjects
                 [Lesson/Past Paper tabs], classroom [chat + whiteboard],
                 progress, admin)
  components/    Navbar, PaywallModal, Whiteboard, RequireAuth
  lib/           API client, auth context
docs/            this file's companions (see below)
```

## Wiring in real vendors later (no rewrite needed)

- **LLM**: set `AI_PROVIDER=openai` and `OPENAI_API_KEY`, then implement an
  `OpenAIProvider(AIProvider)` in `app/services/smartteach.py` following the
  same `explain/evaluate_answer/answer_followup` interface `MockAIProvider`
  already implements.
- **Voice**: the client already sends/receives plain text turns; add
  Web Speech API (or a TTS/STT vendor) capture/playback around the existing
  `/api/lessons/message` and `/api/past-papers/message` calls -- no backend
  contract change needed.
- **Avatar**: `AVATAR_PROVIDER` env var reserved for a future HeyGen-style
  integration; the chat/whiteboard UI is already decoupled from the avatar.
- **Payments**: set `PAYMENT_PROVIDER=mtn_momo|airtel_money|dpo` plus the
  matching API key env var; `MtnMomoProvider`/`AirtelMoneyProvider`/
  `DpoCardProvider` stubs in `app/services/payment_provider.py` show exactly
  where the real "request to pay" / card-tokenization call goes. The
  `/api/billing/webhook` endpoint is already wired for async confirmation.
- **Vector DB**: `retrieval.py`'s `retrieve_context()` signature can be
  swapped from TF-IDF to pgvector/embeddings without touching any router.

## Known limitations of this build

- The AI teacher is a deterministic, template-driven engine grounded in
  admin-uploaded content (no external LLM calls) -- see "Wiring in real
  vendors" above to upgrade.
- Voice and the on-screen avatar are not implemented in this pass; the
  chat/whiteboard contract is designed so they can be added without
  reshaping the API.
- Payments run through a mock provider that auto-approves, so the full
  subscribe -> unlock flow is demonstrable end to end without merchant
  credentials; swap in real MTN/Airtel/DPO credentials to go live.
