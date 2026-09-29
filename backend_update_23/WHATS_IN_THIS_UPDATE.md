# Persona management admin tooling — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite.

## Important: run the migration BEFORE using the new tab
Without it, every save in the Personas tab will silently fail (RLS
blocks the UPDATE) — teacher_personas has had a SELECT policy since it
was created but never an UPDATE one. The one successful update so far
(Chipo's avatar_id) only worked because it was run directly in the SQL
Editor, which bypasses RLS entirely — not through the app.

## New file (1)
supabase/migrations/20260802080000_teacher_personas_admin_update.sql
    Admin-only UPDATE policy for teacher_personas, same role-check
    pattern as every other admin-gated write in this project.

## Modified files (2)
app/admin/(protected)/tabs/personas-tab.tsx
    New admin tab: paste an avatar_id (and optional voice_id) for any
    of the five personas and save directly, no SQL needed. Shows
    plainly whether each persona currently has a live avatar connected
    or is using the illustrated fallback.

app/admin/(protected)/page.tsx
    Wires the tab in: Tab type, nav entry, state, fetchPersonas (called
    on load), handleSavePersona.

README.md
    New "Persona Management" section explaining the RLS gap this closes.

## After copying these in
1. Run the new migration in the Supabase SQL editor — do this first,
   the tab won't work without it
2. Nothing else — no new Edge Function, no new secret. Reuses the
   existing teacher_personas table and columns from earlier updates.
3. Go to /admin -> Personas and wire up Linda, Mrs Tembo, Mr
   Chomba, and Mr Banda the same way Chipo was set up — paste each
   persona's avatar_id from your LiveAvatar dashboard, click Save
