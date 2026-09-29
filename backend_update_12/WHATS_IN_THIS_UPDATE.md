# Real-time video avatar (LiveAvatar / HeyGen) — update only

Same pattern as every previous update: just the files touched across this
whole integration, same relative paths, drop straight in and overwrite.

## Important: it's "HeyGen," but the real product is now "LiveAvatar"
You said HeyGen. I found their real-time streaming avatar product has
been spun off into its own brand — LiveAvatar (app.liveavatar.com,
api.liveavatar.com) — separate from heygen.com itself, with the older
`@heygen/streaming-avatar` package now deprecated. Everything below
targets the current, real product, not the older one.

## New files (3)
supabase/migrations/20260724080000_liveavatar_persona_mapping.sql
    Adds liveavatar_avatar_id / liveavatar_voice_id (both nullable) to
    teacher_personas.

supabase/functions/liveavatar-token/index.ts
    Mints a short-lived, avatar-scoped session token server-side — your
    API key never reaches the browser. Uses LITE mode deliberately: your
    existing ai-teacher-chat (RAG, personas, rate limiting, moderation,
    mistake detection) stays the source of what's said; LiveAvatar only
    renders it as live video. Returns {available: false} (not an error)
    whenever nothing's configured yet, so the app never breaks over this.
    Deploy: supabase functions deploy liveavatar-token

components/teacher/LiveTeacherAvatar.tsx
    Wraps the real @heygen/liveavatar-web-sdk. Falls back to the existing
    illustrated TeacherAvatar whenever a live session isn't available —
    verified with a real screenshot showing the fallback rendering
    correctly with zero visible breakage when the connection fails.

## Modified files (6)
app/(app)/lesson/[id]/page.tsx
app/(app)/past-papers/[id]/run/page.tsx
    Both now use LiveTeacherAvatar instead of the plain illustrated one.
    speak() prefers the live avatar's own voice when connected (never
    both browser TTS and live avatar audio at once); the lesson page
    calls interrupt() on the avatar when the pupil sends a new message
    mid-speech.

package.json
    Adds @heygen/liveavatar-web-sdk as a real, installed dependency
    (confirmed against the live npm registry, not assumed to exist).

scripts/check-deploy-readiness.js
README.md
.env.example
    Updated for the 8th Edge Function and the new LIVEAVATAR_API_KEY
    secret. README has a full "Real-Time Video Avatar" section, including
    exactly how the integration was verified without being able to test
    it end-to-end (see below).

## How this was actually verified, given none of it can run here
No LiveAvatar account, no configured avatar_id, no network access to
their servers from this sandbox — so I could not test an actual live
connection. What I did instead, rather than guess:
  - Confirmed the npm package is real by querying the live npm registry
  - Installed it in a scratch directory and read its ACTUAL .d.ts type
    files to get the real method/event names (start, stop, attach,
    message, interrupt, AVATAR_SPEAK_STARTED/ENDED) — not from
    documentation or memory, from the shipped package itself
  - Cross-checked the token-request JSON shape against a maintained
    third-party reference implementation
  - Screenshotted the real app with a deliberately failed connection,
    confirming the fallback to the illustrated avatar works with no
    visible breakage

## Manual setup required — this is real work outside any codebase
1. Sign up at app.liveavatar.com, get an API key
2. Create or pick an avatar for each of the 5 personas you want live
   video for. A genuinely custom one needs 2+ minutes of real, consented
   footage — a content/consent decision, not a config step
3. Set liveavatar_avatar_id (and optionally liveavatar_voice_id) on the
   matching teacher_personas rows for whichever personas you've set up
4. supabase functions deploy liveavatar-token
5. Set LIVEAVATAR_API_KEY as an Edge Function secret
6. Consider Sandbox Mode for testing without consuming real credits

## One real cost, not hidden
The LiveKit WebRTC client this SDK needs is unavoidably heavy — both
lesson/[id] and past-papers/[id]/run now share roughly +120KB of First
Load JS for it (Next.js deduplicates it into one shared chunk between
the two pages, not paid twice). Worth weighing against a low-bandwidth
audience — the illustrated-avatar experience stays fully functional and
lightweight for any persona or pupil connection that doesn't use live
video; nothing about this is required to use the app.

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. Do the manual LiveAvatar setup above (this is the part that takes
   real time and a real decision about consent/footage)
3. supabase functions deploy liveavatar-token
4. Set LIVEAVATAR_API_KEY as an Edge Function secret
