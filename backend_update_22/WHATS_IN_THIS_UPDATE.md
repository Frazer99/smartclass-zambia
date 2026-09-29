# Offline mode (PWA) + Multi-provider AI (OpenAI + Anthropic) — update only

Same pattern as every previous update: just the files touched across
both pieces of work, same relative paths, drop straight in and
overwrite.

## Part 1: Offline mode — read the scope before assuming more works
This is a web app calling OpenAI, Anthropic, LiveAvatar, and DPO — none
of those can work with no internet connection, and nothing here pretends
otherwise. What actually works offline: the app shell (opens instead of
a browser error page) and previously-viewed lesson content. What never
gets cached, on purpose: anything under /functions/v1/ or /auth/v1/ — AI
chat, the live avatar, payments, sign-in.

New files:
  public/manifest.json       — PWA manifest, installable app
  public/sw.js                — service worker, runtime caching only
                                 (no build-time precache list, since
                                 Next.js's hashed chunk filenames change
                                 every deploy)
  public/icon-192.png         — real PNGs generated from app/icon.svg,
  public/icon-512.png           not placeholders (verified by viewing them)
  components/pwa/service-worker-registration.tsx — registers sw.js,
                                 production only
  components/pwa/offline-banner.tsx — shown only when genuinely offline,
                                 specific about what still works

Modified:
  app/layout.tsx — manifest link, theme-color, apple-touch-icon, mounts
                   both new components. Two real Next.js 13.5.1-specific
                   bugs were hit and fixed while building this (a
                   Viewport type that doesn't exist in this installed
                   version, and metadata.icons.apple silently not
                   rendering at all) — see the README's "Offline Mode"
                   section for the full story; the apple-touch-icon fix
                   ended up as a manual <link> tag in the head, not the
                   metadata API.

## Part 2: Multi-provider AI (OpenAI + Anthropic)
New files:
  supabase/migrations/20260801080000_multi_provider_ai.sql
      Seeds platform_settings.primary_ai_provider (default 'openai')
  supabase/functions/_shared/llm.ts
      generateChatCompletion() — tries the preferred provider, falls
      back to the other automatically if it fails or isn't configured.
      Anthropic's API details (endpoint, both headers, response shape)
      were verified against current documentation before writing this,
      not assumed. Scoped to chat completions only — moderation and
      embeddings stay OpenAI-only, no Anthropic equivalent exists for
      either.

Modified:
  supabase/functions/ai-teacher-chat/index.ts
      Replaces the direct OpenAI-only call with generateChatCompletion().
      Redeploy: supabase functions deploy ai-teacher-chat
  app/admin/(protected)/tabs/analytics-tab.tsx
  app/admin/(protected)/page.tsx
      New "AI Provider" toggle in Analytics -> AI Teaching Insights.
      ALSO fixes a real regression caught while wiring this in: the
      Fallback Rate metric checked source !== 'openai', which would
      have silently counted every genuine Anthropic response as a
      fallback. Fixed to check for the literal 'fallback' source.
  scripts/check-deploy-readiness.js
  .env.example
      Documents ANTHROPIC_API_KEY as optional.

## Shared
  README.md — new "Offline Mode (PWA)" and "Multi-Provider AI" sections

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. supabase functions deploy ai-teacher-chat
3. Set ANTHROPIC_API_KEY as an Edge Function secret if you want Claude
   as a real fallback (optional — everything works with just OpenAI,
   exactly as before this update)
4. Offline mode needs no deployment step beyond the normal Next.js
   build/deploy — the service worker registers itself automatically in
   production
