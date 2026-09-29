/*
# SmartClass Zambia — Local Language Support

## Purpose
Lets a pupil choose to have their AI teacher respond primarily in one
of Zambia's local languages instead of English — named as a future
phase in the very first SRS document for this project, not attempted
until now.

## Language codes — verified, not guessed
ISO 639-3, confirmed against multiple independent sources before being
written into this migration (the same discipline applied to the
Lifeline/Childline 116 helpline number and the DPO payment gateway
earlier in this project — a wrong code here silently breaks the whole
feature, so it wasn't worth guessing from memory):
  bem — Bemba (~4.1 million speakers, Zambia's most widely spoken)
  nya — Nyanja/Chinyanja (also the ISO 639-1 code "ny"; "Nyanja" is the
        name used in Zambia specifically, vs. "Chichewa" in Malawi)
  toi — Tonga (Zambia/Zimbabwe specifically — NOT "ton" (Tongan, the
        Pacific language) or "tog" (a Tumbuka dialect spoken in Malawi,
        confusingly also sometimes called "Tonga"); this distinction
        matters and is easy to get wrong)
  loz — Lozi

## Honest limitation, not hidden
Whether OpenAI's models actually produce fluent, natural output in these
specific languages is genuinely uncertain — they're far less represented
in typical LLM training data than English, French, or Spanish, and this
cannot be verified from a build environment with no way to evaluate
actual language quality. The feature is built so a pupil can try it and
switch back to English easily if quality isn't there yet — see the
account page's language selector, which carries an explicit "quality may
vary" note rather than presenting this as a finished, guaranteed
capability.

## profiles.preferred_language
Nullable-equivalent default 'en' — every existing pupil keeps working in
English with no migration-time behavior change. A CHECK constraint
limits values to the five supported options rather than accepting
arbitrary text, since an edge function will pass this value into the AI
system prompt and an unconstrained value could produce a nonsensical or
malformed instruction.

Idempotent, no destructive operations.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en';

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_preferred_language_check
  CHECK (preferred_language IN ('en', 'bem', 'nya', 'toi', 'loz'));
