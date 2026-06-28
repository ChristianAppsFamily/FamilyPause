# FamilyPause Pre-Launch QA — Executive Summary

**Original QA date:** 2026-06-23  
**Fix implementation:** 2026-06-13  
**Site:** https://familypause.com

## Verdict (post-fix)

**Code fixes shipped in repo.** Launch-ready after deploy + Vercel env configuration (Stripe payment links, trimmed Supabase keys). Re-run section QA on production after deploy to confirm.

## Launch blockers — status

| # | Issue | Status | Notes |
|---|--------|--------|-------|
| 1 | Stripe `PLACEHOLDER_*` URLs | **Code fixed** | `src/lib/stripeLinks.js` reads `VITE_STRIPE_*` env vars. Set live URLs in Vercel before purchases work. |
| 2 | Supabase anon key trailing newlines | **Code fixed** | `src/lib/supabase.js` trims URL/key. Re-paste keys in Vercel (no trailing whitespace) and redeploy. |
| 3 | No `robots.txt` | **Fixed** | `public/robots.txt` (Disallow all pre-launch); excluded from SPA rewrite in `vercel.json`. |

## Major issues — status

| Issue | Status |
|--------|--------|
| Invited spouse onboarding step 1 vs step 4 | **Fixed** — `AppRouter.jsx` respects `onboardingData.joined` in URL sync |
| Person routing (transcript vs workspace names) | **Fixed** — AI prompt + `normalizeCardPeople()` in `src/lib/familyContext.js` |
| Plan confetti obscures content | **Fixed** — top banner only, 2.2s, lower z-index |
| Review: filters, Discard All, Undo | **Fixed** — `ReviewView` in `App.jsx` |
| Settings Open library → draw | **Fixed** — `cardsPath("library")` from Settings |
| Faith Mode toggle | **Fixed** — Settings section + `workspaces.faith_mode` |
| Send via Text invite | **Fixed** — Settings `sms:` link |
| `/app/paywall` trial-ended on active trial | **Fixed** — resolves reason from subscription or `"upgrade"` |
| `/cards` product page | **Fixed** — `CardsProductPage.jsx` at `/cards` |

## Minor / polish — status

| Issue | Status |
|--------|--------|
| Mobile nav hidden ≤960px | **Fixed** — hamburger + slide-down panel in `Landing.jsx` |
| Footer copyright | Unchanged (already © 2026 FamilyPause) |
| Copy/UI drift vs brief | Out of scope this pass |
| `/join/FP-TEST` on prod | QA doc only — use real invite codes |

## Post-deploy verification checklist

1. **Vercel env:** `VITE_STRIPE_FAMILY_ANNUAL`, `VITE_STRIPE_FAMILY_PRO`, `VITE_STRIPE_CARD_DIGITAL`, trimmed `VITE_SUPABASE_*`
2. **Deploy** main branch to production
3. **`curl https://familypause.com/robots.txt`** — plain text, not SPA HTML
4. **DevTools → Network → realtime** — WebSocket URL has no `%0A`
5. **Join flow** — second account via `/join/{code}` lands on onboarding step 4
6. **Settings** — Faith mode toggle, Send via Text, Open library
7. **`/cards`** — product page loads
8. **`/app/paywall`** during active trial — upgrade copy, not trial ended
9. **Stripe buttons** — each opens live checkout (not 403)
10. **Edge function:** `supabase functions deploy landing-demo` (if demo date chips not showing)

## Section reports (original)

| File | Health |
|------|--------|
| `PRE_LAUNCH_QA_SECTION_01.md` | 8.5/10 |
| `PRE_LAUNCH_QA_SECTION_02_03.md` | 78/100 |
| `PRE_LAUNCH_QA_SECTION_04_08.md` | 72/100 |
| `PRE_LAUNCH_QA_SECTION_09_14.md` | 3 critical, 5 major |

Screenshots under `qa-screenshots/section-*/`.

## Still not tested

- iPhone Safari / Web Speech live recording
- Two-account realtime sync E2E (verify after deploy + env fix)
- Welcome / Sunday emails
- PageSpeed Insights
- Trial-expired paywall trigger (manual, after trial ends)
