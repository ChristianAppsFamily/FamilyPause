# FamilyPause Pre-Launch QA — Sections 2 & 3

**Site:** https://familypause.com/app  
**Tested:** 2026-06-23  
**Environment:** Production (www.familypause.com)  
**Browser:** Chromium headless via Playwright (desktop 1440×900, mobile 390×844)  
**Tester:** Automated QA agent (report-only, no code changes)

## Health Score: **78 / 100**

Core auth and onboarding flows work end-to-end. Sign up, sign in, forgot password, and join-with-real-invite all succeed. Two major gaps: invited spouses see full onboarding step 1 instead of skipping to Ready, and the QA brief’s `FP-TEST` join URL is not a valid production invite code.

---

## Section 2 — Authentication

| # | Checklist Item | Result | Notes |
|---|----------------|--------|-------|
| 2.1 | Navigate to sign up — all four fields present | **Pass** | First name, email, password, confirm password. Screenshot: `02-signup-desktop.png` |
| 2.2 | Each field accepts input | **Pass** | Verified during validation and signup tests |
| 2.3 | Tab order moves through fields in order | **Pass** | Name → email confirmed via focus chain |
| 2.4 | Empty form — validation errors for required fields | **Pass** | Single banner: “Please fill in all fields.” Not per-field. Screenshot: `03-signup-empty-validation.png` |
| 2.5 | Invalid email format — error message appears | **Pass** | No client-side block on button click; Supabase returns error. Screenshot: `04c-signup-invalid-email-supabase-error.png` |
| 2.6 | Password under 8 characters — error message | **Pass** | “Password must be at least 8 characters.” Screenshot: `05-signup-short-password.png` |
| 2.7 | Mismatched passwords — error message | **Pass** | “Passwords don't match.” Screenshot: `06-signup-mismatch-password.png` |
| 2.8 | Valid signup — account created, moves to onboarding | **Pass** | Test account created; Welcome screen shown. Screenshot: `07-signup-success-onboarding.png` |
| 2.9 | Sign up readable on mobile (390px) | **Pass** | Left panel hidden; form full-width. Screenshot: `21-mobile-signup-390.png` |
| 2.10 | Mobile — keyboard does not cover submit button (iPhone) | **Not Tested** | Headless browser cannot simulate iOS keyboard; submit button at y≈663 in 844px viewport (visible without scroll) |
| 2.11 | Sign in — email and password fields present | **Pass** | Screenshot: `01-signin-desktop.png` |
| 2.12 | Sign in — wrong credentials show error | **Pass** | “Email or password is incorrect. Try again.” Screenshot: `14-signin-wrong-credentials.png` |
| 2.13 | Sign in — correct credentials land in app | **Pass** | Lands on card draw / app shell. Screenshot: `15-signin-correct-credentials.png` |
| 2.14 | Forgot password link visible and clickable | **Pass** | Screenshot: `16-forgot-password.png` |
| 2.15 | Forgot password — confirmation after submit | **Pass** | Green banner with email confirmation. Screenshot: `17-forgot-password-sent.png` |
| 2.16 | Join screen loads from `/join/FP-TEST` | **Pass** | Join form renders. Screenshot: `18-join-FP-TEST-prefill.png` |
| 2.17 | Join — invite code pre-filled from URL | **Pass** | `FP-TEST` and real code `FP-5ZSW-EZPN` both pre-filled |
| 2.18 | Join — complete form lands in correct workspace | **Pass** (real code) / **Fail** (FP-TEST) | Real invite `FP-5ZSW-EZPN` → account + onboarding. `FP-TEST` → invalid code error. Screenshots: `19-join-real-result.png`, `19-join-FP-TEST-result.png` |

### Test Accounts Created

| Email | Purpose | Result |
|-------|---------|--------|
| `fpqa1782209693783@mailinator.com` | Primary signup + sign-in + forgot password | Created successfully |
| `fpjoin1782209907035@mailinator.com` | Join via real invite `FP-5ZSW-EZPN` | Created successfully, joined workspace |

Password used for all test accounts: `TestPass123!`

---

## Section 3 — Onboarding

| # | Checklist Item | Result | Notes |
|---|----------------|--------|-------|
| 3.1 | Step 1 Welcome loads; user name correct | **Pass** | “QA Tester” / “Spouse Join” displayed. Screenshot: `07-signup-success-onboarding.png` |
| 3.2 | Step 1 — trial features list visible | **Pass** | 5 trial features in gold box |
| 3.3 | Step 1 — Begin Setup button works | **Pass** | “Set Up My Family Workspace →” advances to step 2 |
| 3.4 | Step 2 — spouse name field accepts input | **Pass** | Screenshot: `08-onboarding-step2-family.png` |
| 3.5 | Step 2 — kids Enter adds chip | **Pass** | |
| 3.6 | Step 2 — Add button adds chip | **Pass** | |
| 3.7 | Step 2 — chip X removes chip | **Pass** | |
| 3.8 | Step 2 — business names work same way | **Pass** | Enter adds “Side Biz” chip |
| 3.9 | Step 2 — Save and Continue advances to step 3 | **Pass** | Screenshot: `09-onboarding-step3-invite.png` |
| 3.10 | Step 3 — invite link displayed | **Pass** | `www.familypause.com/join/FP-5ZSW-EZPN` |
| 3.11 | Step 3 — Copy copies link; Copied confirmation | **Pass** | “Copied” state observed |
| 3.12 | Step 3 — Send via Text opens SMS with message | **Pass** | `sms:?body=...` href present (native SMS not opened in headless) |
| 3.13 | Step 3 — Skip advances to step 4 | **Pass** | Screenshot: `10-onboarding-step4-ready.png` |
| 3.14 | Step 4 Ready — four feature rows visible | **Pass** | 4 rows in how-it-works card |
| 3.15 | Step 4 — Start/Continue button enters main app | **Partial** | CTA is “Continue →” (not “Start”); goes to **step 5 card deck**, not session home. After step 5 skip → locked card draw screen. Screenshots: `11-onboarding-step5-cards.png`, `12-onboarding-complete-app.png` |
| 3.16 | Progress bar advances through steps | **Pass** | 5-segment bar fills per step (app has 5 steps, brief lists 4) |
| 3.17 | Onboarding not shown after completion | **Pass** | Re-login goes directly to app. Screenshot: `13-relogin-skips-onboarding.png` |
| 3.18 | Joined spouse skips family/invite steps (step 4) | **Fail** | Invited user lands on step 1 Welcome, not step 4 Ready. Screenshot: `19-join-real-result.png` |

### Brief vs Production Note

The live app implements **5 onboarding steps** (Welcome → Family → Invite → Ready → Card Deck). The QA brief describes 4 steps and a “Start” button on step 4. Production uses “Continue →” on step 4 and routes to card deck unlock on step 5.

---

## Issues Found

### Issue 1 — Joined spouse sees full onboarding instead of Ready screen

- **Section:** 3 — Onboarding (also affects 2 — Join flow)
- **Severity:** **Major**
- **Description:** When a user joins via a valid invite link and creates an account, they are shown onboarding step 1 (Welcome) instead of skipping to step 4 (Ready) as intended by `AppRouter` (`onboardingPath(joined ? 4 : 1)`).
- **Steps to reproduce:**
  1. Sign up as Account A and complete onboarding; copy invite link (e.g. `/join/FP-XXXX-XXXX`).
  2. Open a private/incognito window and visit the invite URL.
  3. Complete the join form with a new email and password.
  4. Observe Welcome screen (step 1) with progress bar at 1/5 instead of Ready (step 4).
- **Screenshot:** `19-join-real-result.png`
- **Device/Browser:** Chromium headless, desktop 1440×900

### Issue 2 — QA brief join test URL `FP-TEST` is not valid on production

- **Section:** 2 — Join via invite
- **Severity:** **Major** (blocks QA / docs; not an app regression if code is correct)
- **Description:** `familypause.com/join/FP-TEST` pre-fills the code but submission returns “Invalid invite code.” The README lists this as a test helper; production uses codes like `FP-5ZSW-EZPN`.
- **Steps to reproduce:**
  1. Navigate to https://familypause.com/join/FP-TEST
  2. Fill name, email, password
  3. Click “Join Family Workspace”
  4. Error banner appears
- **Screenshot:** `19-join-FP-TEST-result.png`
- **Device/Browser:** Chromium headless, desktop 1440×900

### Issue 3 — Invalid email triggers API call with developer-facing error

- **Section:** 2 — Sign Up validation
- **Severity:** **Minor**
- **Description:** Submitting `notanemail` (no `@`) does not show an in-app validation message before the API call. The form attempts signup and Supabase returns “Unable to validate email address: invalid format” — technical copy, not user-friendly.
- **Steps to reproduce:**
  1. Go to sign up
  2. Enter name, email `notanemail`, valid passwords
  3. Click “Create Account & Start Free Trial”
  4. Observe Supabase error in red banner after network request
- **Screenshot:** `04c-signup-invalid-email-supabase-error.png`
- **Device/Browser:** Chromium headless, desktop 1440×900

### Issue 4 — Empty form shows one banner, not per-field errors

- **Section:** 2 — Sign Up validation
- **Severity:** **Minor**
- **Description:** Brief asks for validation errors on all required fields; app shows a single “Please fill in all fields.” banner.
- **Steps to reproduce:**
  1. Go to sign up
  2. Click submit without filling fields
- **Screenshot:** `03-signup-empty-validation.png`
- **Device/Browser:** Chromium headless, desktop 1440×900

### Issue 5 — Post-onboarding lands on locked card draw, not session home

- **Section:** 3 — Onboarding completion
- **Severity:** **Minor**
- **Description:** After completing/skipping step 5 (card deck), user lands on the locked card draw screen rather than the session start home (Choose Topics / Start Recording). May be intentional product flow but differs from brief (“Start button takes user into the main app”).
- **Steps to reproduce:**
  1. Complete full onboarding including skip on card deck step
  2. Observe locked card draw as first screen
- **Screenshot:** `12-onboarding-complete-app.png`
- **Device/Browser:** Chromium headless, desktop 1440×900

---

## Mobile Readability (390px)

| Screen | Result | Screenshot |
|--------|--------|------------|
| Sign in | **Pass** — readable, full-width form, no horizontal scroll | `20-mobile-signin-390.png` |
| Sign up | **Pass** — fields and CTA visible; left marketing panel hidden | `21-mobile-signup-390.png` |
| Keyboard covers submit (iPhone) | **Not Tested** | Requires real device |

---

## Console Errors

No JavaScript console errors observed on sign-in, sign-up, onboarding, or join screens during testing.

---

## Screenshots Index

All files in `qa-screenshots/section-02-03-auth/`:

| File | Description |
|------|-------------|
| `01-signin-desktop.png` | Sign in — desktop |
| `02-signup-desktop.png` | Sign up — desktop |
| `03-signup-empty-validation.png` | Empty form validation |
| `04-signup-invalid-email.png` | Invalid email attempt (loading state) |
| `04b-invalid-email-html5.png` | HTML5 validation (`bad`) |
| `04c-signup-invalid-email-supabase-error.png` | Supabase invalid email error |
| `05-signup-short-password.png` | Short password error |
| `06-signup-mismatch-password.png` | Mismatched passwords |
| `07-signup-success-onboarding.png` | Successful signup → Welcome |
| `08-onboarding-step2-family.png` | Family setup |
| `09-onboarding-step3-invite.png` | Invite spouse |
| `10-onboarding-step4-ready.png` | Ready screen |
| `11-onboarding-step5-cards.png` | Card deck step |
| `12-onboarding-complete-app.png` | Post-onboarding card draw |
| `13-relogin-skips-onboarding.png` | Re-login skips onboarding |
| `14-signin-wrong-credentials.png` | Wrong password error |
| `15-signin-correct-credentials.png` | Successful sign in |
| `16-forgot-password.png` | Forgot password form |
| `17-forgot-password-sent.png` | Reset link sent confirmation |
| `18-join-FP-TEST-prefill.png` | Join FP-TEST prefill |
| `18-join-real-prefill.png` | Join real code prefill |
| `19-join-FP-TEST-result.png` | FP-TEST invalid error |
| `19-join-real-result.png` | Real join → Welcome (bug: should be step 4) |
| `20-mobile-signin-390.png` | Mobile sign in |
| `21-mobile-signup-390.png` | Mobile sign up |

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| Major | 2 |
| Minor | 3 |
| Not Tested | 2 (iOS keyboard overlap, Send via Text native SMS) |

**Critical/Major takeaways:**
1. **Invited spouses always see onboarding step 1** — routing bug likely in `AppRouter.jsx` URL sync effect forcing `onboardingPath(1)` when user is still on `/join/:code` after auth.
2. **`/join/FP-TEST` is not a valid production invite** — update QA docs to use a real workspace invite code from a test account.
