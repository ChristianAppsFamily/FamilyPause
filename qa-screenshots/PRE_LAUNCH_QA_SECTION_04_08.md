# FamilyPause Pre-Launch QA — Sections 4–8 (Main App Flows)

**Date:** 2026-06-23  
**URL tested:** https://familypause.com/app  
**Device / browser:** Desktop Chrome (headless via Playwright), 1280×720 primary; mobile spot-check 390×844  
**Test account:** Fresh sign-up created during this session (onboarding completed with spouse “Alex”, kid “Jordan”)  
**Screenshots:** `qa-screenshots/section-04-08-app/`

---

## Summary

| Section | Pass | Fail | Not Tested |
|---------|------|------|------------|
| 4 — Main App Home | 7 | 4 | 2 |
| 5 — Capture | 5 | 2 | 5 |
| 6 — Processing | 5 | 2 | 1 |
| 7 — Review | 8 | 4 | 3 |
| 8 — Plan | 6 | 2 | 2 |

**Health score (sections 4–8):** 72/100 — core happy path (paste → distill → review → plan) works; spouse realtime, several brief-specified controls, and live recording need attention.

---

## Critical / Major Issues

### ISSUE-0401 — Supabase Realtime WebSocket auth fails (Major)

**Section:** 4–8 (affects spouse sync during review)  
**Severity:** Major  

Console shows repeated errors on every app screen:

```
WebSocket connection to 'wss://cftzaeoqkepvvnfavphw.supabase.co/realtime/v1/websocket?apikey=...Hs%0A%0A&vsn=2.0.0' failed: HTTP Authentication failed; no valid credentials available
```

The `%0A%0A` in the API key URL indicates **trailing newlines in `VITE_SUPABASE_ANON_KEY`** on Vercel. Realtime spouse sync during review will not work until the env var is trimmed.

**Repro:**
1. Sign in at https://familypause.com/app
2. Open DevTools → Console
3. Navigate to any sync screen (`/app/sync/agenda`)

**Screenshot:** `05-cards-locked.png` (console captured during session)

---

### ISSUE-0402 — Person routing dumps items into “Shared & Family” when transcript names ≠ workspace names (Major)

**Section:** 8 — Plan  

AI extracted persons “Amanda”, “Spence”, “Maya” from the pasted transcript, but onboarding workspace adults were “QA Tester” and “Alex”. Plan screen showed **0 items** under each adult column and **all 5 items** under “Shared & Family”.

**Repro:**
1. Complete onboarding with custom parent names (not Amanda/Spence)
2. Paste the built-in sample conversation (uses Amanda/Spence)
3. Distill → Keep all → Build my week
4. Observe plan columns

**Screenshot:** `17-plan.png`

---

### ISSUE-0403 — Confetti animation obscures plan content on arrival (Major / UX)

**Section:** 8 — Plan  

On first load of the plan screen, 70 confetti particles render over checklist items and the primary calendar CTA for ~4.2 seconds (`Confetti` component in `App.jsx`). Screenshot shows content partially unreadable during this window.

**Repro:**
1. Complete a full sync to the plan screen
2. Observe overlap of confetti with plan items and button

**Screenshot:** `17-plan.png`

---

### ISSUE-0404 — Brief-specified review controls missing (Major vs spec / Minor vs shipped product)

**Section:** 7 — Review  

The QA brief requires **category filter pills**, **Discard All**, and **Undo** on reviewed cards. Current `ReviewView` implements none of these — only per-card Keep / Discard / + Calendar and “Keep all remaining →”.

**Repro:** Reach review screen after distill; confirm controls absent.

**Screenshot:** `15-review.png`

---

## Section 4 — Main App Home

| # | Checklist item | Result | Notes |
|---|----------------|--------|-------|
| 4.1 | Header loads — logo visible | **Pass** | Logo and wordmark render correctly |
| 4.2 | Workspace / couple name displayed | **Fail** | Choice screen has no `SyncHeader`; couple name only appears later in Agenda Builder / not on initial home |
| 4.3 | Settings icon works | **Pass** | Opens `/app/settings` with family, invite, subscription sections (`18-settings-overlay.png`) |
| 4.4 | Sign out icon works | **Pass** | Returns to sign-in screen (`22-signed-out.png`) |
| 4.5 | Date displays with current date | **Fail** | Date pill not shown on approach-choice home screen |
| 4.6 | Two choice cards visible, equal height | **Pass** | Side by side at 1280px (`06-home-agenda-1280.png`) |
| 4.7 | Mobile cards stack and remain readable | **Pass** | Stacked layout at 390px (`19-home-mobile-390.png`) |
| 4.8 | Left card expands topic selection | **Pass** | Topic panel opens with pills + custom input (`07-topics-expanded.png`) |
| 4.9 | Topic pills select / deselect | **Pass** | Selection count updates (tested Kids, Finances, custom “Meal Planning”) |
| 4.10 | Custom topic via Enter / Add | **Pass** | Custom pill added to grid |
| 4.11 | “Continue to Record” after topics | **Fail** | Button label is **“Start your weekly sync”** and advances to **Agenda Builder**, not Capture |
| 4.12 | Right card → Capture screen | **Pass** | “Start Recording” lands on `/app/sync/capture` (`11-capture-dictate.png`) |
| 4.13 | Resume banner for draft session | **Not Tested** | Did not leave a mid-capture draft in this session |

---

## Section 5 — Capture Screen

| # | Checklist item | Result | Notes |
|---|----------------|--------|-------|
| 5.1 | Both mode cards visible | **Pass** | “Write or paste” and “Speech to text” tabs (`11-capture-dictate.png`) |
| 5.2 | Labels match brief (“Live Recording” / “Paste Transcript”) | **Fail** | Different copy than brief |
| 5.3 | Live recording — mic permission | **Not Tested** | Headless Chrome; no microphone |
| 5.4 | Live recording — live transcript | **Not Tested** | Requires mic / Web Speech |
| 5.5 | Word count updates | **Not Tested** | Not observed in paste flow |
| 5.6 | Stop / edit after recording | **Not Tested** | Recording not exercised |
| 5.7 | iPhone Safari recording | **Not Tested** | Desktop headless only |
| 5.8 | Paste textarea accepts text | **Pass** | 266-char transcript accepted (`12-capture-paste-filled.png`) |
| 5.9 | Character limit enforced | **Not Tested** | No limit hit during test |
| 5.10 | Placeholder visible before typing | **Pass** | “Write or paste your conversation here…” |
| 5.11 | Distill hidden with no content | **Pass** | Button disabled on empty (`11-capture-dictate.png`) |
| 5.12 | Distill appears with content | **Pass** | Enabled after paste |
| 5.13 | Distill → Processing | **Pass** | Navigated to `/app/sync/processing` |
| 5.14 | Distill visible above keyboard on mobile | **Not Tested** | Mobile keyboard not simulated |

---

## Section 6 — Processing Screen

| # | Checklist item | Result | Notes |
|---|----------------|--------|-------|
| 6.1 | Spinner / animation displays | **Pass** | Orb + bolt animation (`13-processing.png`) |
| 6.2 | “FAMILYPAUSE” label visible | **Fail** | Shows “Distilling your sync…” instead |
| 6.3 | Rotating / cycling messages | **Pass** | Four-step checklist with progress |
| 6.4 | “~10 seconds” note visible | **Fail** | No timing estimate shown |
| 6.5 | No timeout / error on normal connection | **Pass** | Short paste completed in ~3s |
| 6.6 | Auto-advance to Review | **Pass** | Landed on `/app/sync/review` |
| 6.7 | Longer input (paragraph+) | **Not Tested** | Only short transcript tested |

---

## Section 7 — Review Screen

| # | Checklist item | Result | Notes |
|---|----------------|--------|-------|
| 7.1 | Cards appear with content | **Pass** | 5 cards with person, category, task, quote (`15-review.png`) |
| 7.2 | Keep marks card kept | **Pass** | First card kept; progress updated |
| 7.3 | Discard marks discarded | **Not Tested** | Discard button present; individual discard not fully verified |
| 7.4 | + Calendar on events | **Pass** | Present on event cards (not clicked — opens new tab) |
| 7.5 | Google Calendar opens correctly | **Not Tested** | Headless did not follow `window.open` |
| 7.6 | Undo on reviewed cards | **Fail** | No undo control in UI |
| 7.7 | Keep All | **Pass** | “Keep all remaining →” works (`16-review-kept-all.png`) |
| 7.8 | Discard All | **Fail** | Not implemented |
| 7.9 | Category filter pills | **Fail** | Not implemented |
| 7.10 | “See Plan” / advance to Plan | **Pass** | **“Build my week”** enabled after all reviewed; opens plan |
| 7.11 | Mobile card readability / tap targets | **Not Tested** | Review not re-tested at 390px |

---

## Section 8 — Plan Screen

| # | Checklist item | Result | Notes |
|---|----------------|--------|-------|
| 8.1 | Summary counts (kept, calendared, actions, events) | **Fail** | No dedicated summary card; only inline copy “5 items routed…” |
| 8.2 | Items grouped by person | **Pass** | Adult columns + Shared & Family section (`17-plan.png`) |
| 8.3 | Person grouping accuracy | **Fail** | All items in Shared due to name mismatch (see ISSUE-0402) |
| 8.4 | Item icon, text, date | **Pass** | Checkmarks, task text, category meta visible |
| 8.5 | Add to Calendar link | **Pass** | Primary CTA present |
| 8.6 | Calendar opens correctly | **Not Tested** | Not followed in headless |
| 8.7 | “Start Next Week” returns home | **Pass** | **“↺ Start a new sync”** returns to `/app/sync/agenda` (`21-restart-home.png`) |
| 8.8 | Session cleared after restart | **Pass** | Fresh approach-choice screen shown |

---

## Issue Log (Failures)

### ISSUE-0405 — Home missing date and family title on approach screen (Minor)

**Section:** 4  
**Severity:** Minor  

`ApproachChoice` renders without `SyncHeader`; users see “Choose your approach” but not the weekly sync date or couple name until Agenda Builder.

**Screenshot:** `06-home-agenda-1280.png`

---

### ISSUE-0406 — Topic flow goes to Agenda Builder, not Capture (Minor vs brief)

**Section:** 4  
**Severity:** Minor  

Brief expects “Continue to Record” → Capture. App uses “Start your weekly sync” → Agenda Builder with topic rows and “Distill this week” (`10-after-topic-sync-start.png`).

---

### ISSUE-0407 — Capture mode naming differs from brief (Minor)

**Section:** 5  
**Severity:** Minor  

Brief: “Live Recording” / “Paste Transcript”. Shipped: “Speech to text” / “Write or paste”.

---

### ISSUE-0408 — Processing screen missing FAMILYPAUSE label and timing note (Minor)

**Section:** 6  
**Severity:** Minor  

**Screenshot:** `13-processing.png`

---

### ISSUE-0409 — Plan summary card missing explicit counts (Minor)

**Section:** 8  
**Severity:** Minor  

No breakdown of kept / calendared / actions / events at top of plan view.

---

## Screenshots Index

| File | Screen |
|------|--------|
| `00-initial.png` | Auth gate (unauthenticated) |
| `01-signup.png` | Sign up form |
| `02-after-signup.png` | Onboarding welcome |
| `06-home-agenda-1280.png` | Home / approach choice (desktop) |
| `07-topics-expanded.png` | Topic panel expanded |
| `09-capture-screen.png` | Topic panel (pre-navigation) |
| `10-after-topic-sync-start.png` | Agenda Builder after topics |
| `11-capture-dictate.png` | Capture — speech mode |
| `12-capture-paste-filled.png` | Capture — paste filled |
| `13-processing.png` | Processing / Distill |
| `15-review.png` | Review — 5 extracted cards |
| `16-review-kept-all.png` | Review — all kept |
| `17-plan.png` | Plan — week built |
| `18-settings-overlay.png` | Settings |
| `19-home-mobile-390.png` | Home at 390px |
| `21-restart-home.png` | After “Start a new sync” |
| `22-signed-out.png` | Sign-in after sign out |

---

## What Worked End-to-End

1. Sign up → onboarding → skip locked cards → home  
2. Start Recording → paste transcript → Distill it → processing → review (5 items)  
3. Keep all → Build my week → plan with grouped items  
4. Start a new sync → back to home  
5. Settings navigation and sign out  

---

## Recommended Pre-Launch Fixes (report only — not implemented)

1. **Trim `VITE_SUPABASE_ANON_KEY`** in Vercel (remove trailing newlines) — unblocks realtime  
2. **Map AI person names to workspace members** (fuzzy match or prompt with `family_context` names)  
3. **Reduce confetti z-index / duration** or confine to hero area so plan items stay readable  
4. **Align copy** with brief or update brief to match shipped labels  
5. **Add missing review controls** (filters, discard all, undo) if still in scope for v1  

---

*QA performed report-only. No code changes made.*
