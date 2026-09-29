# Data export (CSV/PDF) — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite. No new
migration, no new Edge Function, no new npm dependency.

## New files (2)
lib/exportCsv.ts
    Minimal, no-dependency CSV builder + browser download trigger.
app/(app)/progress/report/page.tsx
    The "PDF" export: a print-optimized, light/paper-toned page. The
    browser's own "Save as PDF" print destination produces the actual
    PDF — no PDF library added, since I couldn't verify one renders
    correctly from this sandbox. Screenshotted with Playwright's print-
    media emulation and confirmed the nav bar / buttons actually
    disappear when printing, not just assumed from the CSS.

## Modified files (4)
app/(app)/progress/page.tsx
    "Download CSV" and "Print / Save as PDF" buttons in the header.
app/(app)/layout.tsx
    The shared nav bar now hides itself and the app switches to a white
    background under @media print — for every page, not just the report,
    since that's the right default for the whole app going forward.
app/admin/(protected)/tabs/users-tab.tsx
    "Export CSV" button in the pupil detail panel's Topic Progress
    section — lets an admin export any pupil's progress, not just their
    own (reuses lib/exportCsv.ts).
README.md
    New "Data Export (CSV / PDF)" section explaining both paths and why
    no new dependency was added for either.

## After copying these in
Nothing to deploy — this is 100% frontend, no migration, no Edge
Function, no new secret. Just copy the files and it works.
