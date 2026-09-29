# Subscriptions, Payments & Free-Tier Gating — update only

Same pattern as every previous update: just the files touched this
session, same relative paths, drop straight in and overwrite. This is
the largest single feature built this whole conversation — read this
whole file before deploying, not just the file list.

## Read this first: what's real vs. genuinely uncertain

REAL and verified:
- DPO Group genuinely supports Zambia + ZMW + both card and mobile money
  (confirmed via DPO's own docs, multiple independent community
  integration packages, and a Zambia-focused fintech blog — not assumed)
- The XML request/response shapes in _shared/dpo.ts match DPO's real,
  confirmed API structure (the "API3G" convention used consistently
  across every real DPO integration found)
- Full clean `next build` passed, 19 routes, bracket-balanced throughout

GENUINELY UNCERTAIN, not hidden:
- I could not confirm DPO's exact redirect-URL query parameter after
  payment. /subscribe/complete checks a few plausible names and falls
  back to the pupil's own most recent pending payment (the token was
  already stored server-side when create-payment ran), so this is robust
  to that uncertainty rather than silently breaking — but it has never
  been tested against a real DPO merchant account, because I have no way
  to get one from this environment. TEST THOROUGHLY in DPO's sandbox
  mode before handling real money.
- The K50/month price is a PLACEHOLDER, same as the moderation retention
  window was — a real ZedCode business decision, not a recommendation.
  Change it from the admin Billing tab.

## New files (8)
supabase/migrations/20260727080000_subscriptions_payments.sql
    subscriptions, payments, platform_settings tables. Four functions:
    has_active_subscription(), grant_bonus_subscription(),
    set_platform_free_mode(), get_revenue_summary() — all admin-gated
    except has_active_subscription (which any authenticated user/service
    role needs to call, since ai-teacher-chat checks it per message).

supabase/functions/_shared/dpo.ts
    Raw XML request/response handling for DPO's real API — createToken()
    and verifyToken(). NOTE: your _shared/ folder already has
    embeddings.ts and email.ts from earlier updates — this goes alongside
    them, don't replace the whole folder.

supabase/functions/create-payment/index.ts
supabase/functions/verify-payment/index.ts
    The two-step payment flow. Deploy both:
      supabase functions deploy create-payment verify-payment

app/(app)/subscribe/page.tsx
app/(app)/subscribe/complete/page.tsx
    Pupil-facing checkout (choose mobile money or card) and the
    post-payment confirmation page.

app/admin/(protected)/tabs/billing-tab.tsx
    Admin Billing tab: revenue cards, free-mode toggle, price editor,
    bonus-grant form, payments table.

## Modified files (5)
supabase/functions/ai-teacher-chat/index.ts
    New free-tier quota gate, inserted right after rate limiting and
    before content moderation (fails fast before the expensive OpenAI
    work). Skipped entirely for subscribed/bonus/free-mode pupils via
    has_active_subscription(). Exceeding the quota returns 402 with
    source: "subscription_required", not the same as the existing 429
    rate-limit response. Redeploy: supabase functions deploy ai-teacher-chat

app/admin/(protected)/page.tsx
    Wires BillingTab in: Tab type, nav entry, state, fetchBilling (called
    on load), handleToggleFreeMode, handleUpdatePrice, handleGrantBonus.

app/(app)/lesson/[id]/page.tsx
    Handles the new 402 response as a distinct banner ("Subscribe →")
    rather than falling through to a generic error — the chat input
    disables while the prompt is showing, matching how a real paywall
    should behave, not just an error toast.

scripts/check-deploy-readiness.js
.env.example
    Updated for 2 new Edge Functions and 3 new secrets
    (DPO_COMPANY_TOKEN, DPO_SERVICE_TYPE, SITE_URL).

README.md
    Full "Subscriptions & Payments" section — read this section
    specifically before deploying, it has the complete manual setup list
    and the honest uncertainty note about the redirect parameter.

## After copying these in
1. Run the new migration in the Supabase SQL editor
2. Sign up for a real DPO merchant account at dpopay.com (needs business
   registration documents and bank details — this takes real time)
3. supabase functions deploy create-payment verify-payment
4. supabase functions deploy ai-teacher-chat (picks up the new quota gate)
5. Set DPO_COMPANY_TOKEN, DPO_SERVICE_TYPE, SITE_URL as Edge Function secrets
6. Test the ENTIRE payment flow in DPO's sandbox mode before going live —
   this has never been tested against a real DPO account from this build
   environment
7. Set a real subscription price from the admin Billing tab
