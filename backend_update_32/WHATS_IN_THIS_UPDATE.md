# Fix: seed_past_papers used pre-restructuring Grade numbering

## What was broken
supabase/migrations/20260712090500_seed_past_papers.sql was originally
written using Grade 8-12 numbering (correct at the time — it predates
the Form 1-6 restructuring migration, 20260715080000). Running it AFTER
that restructuring already happened, in isolation rather than fresh in
full filename order, hits past_papers_grade_check (which limits grade
to 1-6) directly and fails.

On a genuinely fresh database migrated in full order, this doesn't
bite — the restructuring migration's own UPDATE statement
(`grade = grade - 7 WHERE grade BETWEEN 8 AND 12`) runs and quietly
fixes these rows BEFORE that migration adds its CHECK constraint. The
bug only surfaces when this specific file gets re-run later, in
isolation, on a database that's already past the restructuring.

## The fix
- Grade 12 -> grade: 5 (both Mathematics papers)
- Grade 10 -> grade: 3 (the Physics paper)
- Titles updated too: "Grade 12 Mathematics Paper 1" -> "Form 5
  Mathematics Paper 1", "Grade 10 Physics Paper 1" -> "Form 3 Physics
  Paper 1" — using "Grade" in a title a pupil actually sees would be
  inconsistent with every other page in the app.
- This is the SAME file, same filename/timestamp — overwrite it in
  place, don't add it as a new migration alongside the old one.

## Two more instances of the same bug, found but NOT fixed here
Left as-is at your explicit request. Documented in README.md under "A
known, deliberately unfixed bug in two other seed migrations":

- 20260710151134_seed_curriculum.sql, line 266 (topics.grade = 12)
- 20260711122538_seed_multi_subject_v2.sql, lines 337, 558
  (topics.grade = 12 x2), lines 637-639 (content_materials.grade = 12 x3)

Same failure mode, same fix if you ever want it: Grade 12 -> Form 5.

## After copying this in
Only relevant if you re-run this specific migration file directly
(e.g., via the SQL Editor) on a database that already has the Form 1-6
restructuring applied. If you're running a full fresh `supabase db push`
or pasting every migration in order for the first time, this was never
actually broken in that scenario.
