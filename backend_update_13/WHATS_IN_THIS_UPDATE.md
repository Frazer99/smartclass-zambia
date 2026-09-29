# School / Teacher Analytics — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## New files (2)
supabase/migrations/20260725080000_school_teacher_analytics.sql
    Three admin-gated SQL functions: get_distinct_schools(),
    get_school_topic_analytics(school, grade), and
    get_common_misconceptions(school, grade, topic). Functions, not a
    view — a view would either bypass RLS or be limited by the caller's
    own row-level access, neither of which fits an aggregate view. Same
    SECURITY DEFINER + role-check pattern already used for
    recompute_topic_mastery.

app/admin/(protected)/tabs/school-analytics-tab.tsx
    New admin tab UI: school + Form filters, a topic mastery table sorted
    worst-first, and a common-misconceptions list.

## Modified files (2)
app/admin/(protected)/page.tsx
    Wires the new tab in: Tab type, nav entry, state, fetchSchoolAnalytics
    (called on load and whenever the filters change), render call site.

README.md
    New "School / Teacher Analytics" section, including two real
    limitations stated plainly rather than glossed over:
    (1) common misconceptions are grouped by exact text, not meaning —
    an LLM-generated description isn't a fixed taxonomy, so two
    differently-worded descriptions of the same mistake won't merge into
    one count; (2) school names are free text grouped by exact match, so
    inconsistent spelling/capitalization across pupils won't merge either.
    Both are real, named gaps with a suggested real fix (embedding-based
    clustering for the first, a normalized schools table for the second),
    not attempted in this pass to keep the change scoped.

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. Nothing else — no new Edge Function, no new secret. Purely a database
   function + admin UI addition, reusing tables (student_topic_mastery,
   student_interactions, profiles) that already exist.
