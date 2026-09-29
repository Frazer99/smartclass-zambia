# Warning pre-fill hybrid — update only

Same pattern as every previous update: just the file touched this
session, same relative path, drop straight in and overwrite. Frontend
only — no migration, no Edge Function, no new dependency.

## What changed
app/admin/(protected)/tabs/moderation-tab.tsx
    New suggestWarningReason() function: a template lookup from the
    flag's OpenAI Moderation categories to a pre-drafted warning reason
    (sexual / hate / harassment / violence / generic fallback) — not
    another LLM call, since the categories are already clean labels.

    The "Warn pupil" button now pre-fills the reason input with this
    suggestion instead of starting blank — one click to approve as-is,
    or edit first if it doesn't quite fit.

    The button is now explicitly excluded for self-harm-severity flags
    (flag.severity !== 'self_harm' in the render condition, not just
    left out by omission) — a kid in distress should never be treated
    as a rule-breaker, and this exclusion needed to be a real, checked
    condition, not something that could be silently forgotten later.

## How this was verified
- Confirmed visually with a screenshot: a self-harm-flagged card shows
  ONLY "Mark reviewed," no warn button at all; a harassment-flagged card
  shows both buttons.
- Extracted and ran the suggestWarningReason logic directly against
  sample category combinations (single categories, multiple categories
  together to confirm priority ordering, an empty/unrecognized category
  to confirm the generic fallback) — all six test cases returned the
  correct category.

## After copying this in
Nothing to deploy — pure frontend, no migration, no secret, no Edge
Function. Copy the file and it works.
