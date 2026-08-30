# QA audit implementation — Aug 30, 2026

Code changes from the QA audit plan. **Not yet deployed to familypause.com** at time of writing.

## Verified locally

| Check | Result |
| ----- | ------ |
| `npm run build` | Pass |
| `node --test src/lib/*.test.js` | 10/10 pass (reminders + calendar sync states) |
| Plan sync states | `pending` / `succeeded` / `partial` / `failed` — no idle→green |
| Times draft flush | Continue applies unconfirmed drafts to `cards` |
| Itinerary week | Uses same 7-day window as Plan/PDF (`getPlanningWeekDates`) |
| Stripe checkout | Family/pro plans throw if edge checkout fails (no Payment Link fallback) |
| Settings upgrade | Returns to `/app/settings?checkout=success` + polls |
| App subscription poll | After paywall close + `?checkout=success` on sync routes |
| Auth footer | Landing + MarketingChrome use auth-aware CTA |
| Reset password | Expired-link message after 8s + request-new-link button |
| Unit tests | `calendarSyncState.js` + `googleCalendar.test.js` |

## Skipped (environment blockers)

| Check | Reason |
| ----- | ------ |
| Google Calendar sync E2E | OAuth verification pending |
| Settings paid upgrade E2E | Stripe test keys + webhook not wired on Settings button |
| Supabase SMTP delivery | Dashboard configuration only — see `DEPLOY.md` |
| Live site regression | Production not yet on this commit |

## Deploy steps after merge

1. **Vercel** — deploy frontend from `main`
2. **Supabase** — `supabase db push` (leads table) + `supabase functions deploy capture-lead --no-verify-jwt`
3. **Supabase Dashboard** — SMTP + paste `docs/password-reset-email.html` into Reset password template
4. **When Stripe ready** — test keys, webhook, deploy `stripe-checkout` + `stripe-webhook --no-verify-jwt`, re-run Cluster 4–5 QA with card `4242…`
5. **When Google OAuth verified** — re-run Cluster 1 calendar sync E2E

## Suggested live QA (post-deploy)

1. Enterprise waitlist on `/#pricing` → row in `leads`
2. Capture four timed appointments → no Reminder cards; manual Set Reminder only
3. Times: edit time without Confirm → Continue → Review shows updated time
4. Sunday sync → Plan week strip matches Itinerary dates
5. Signed-in new tab on `/` → header and footer **Continue**
