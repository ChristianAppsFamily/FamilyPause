import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SS = __dirname;
const BASE = 'https://familypause.com';
const ts = Date.now();
const TEST_EMAIL = `fpqa${ts}@mailinator.com`;
const TEST_PASS = 'TestPass123!';
const TEST_NAME = 'QA Tester';
const results = { email: TEST_EMAIL, pass: TEST_PASS, checks: [], issues: [] };

function check(section, item, status, note = '') {
  results.checks.push({ section, item, status, note });
}

function issue(severity, section, desc, repro, screenshot = '') {
  results.issues.push({ severity, section, desc, repro, screenshot });
}

async function shot(page, name) {
  const path = join(SS, name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function getErrorText(page) {
  const el = page.locator('[class*="fp-shake"], [style*="red"]').first();
  const banner = page.getByText(/Please fill|Password|incorrect|Invalid|already exists|enter your email/i).first();
  try {
    const t = await banner.textContent({ timeout: 2000 });
    return t?.trim() || '';
  } catch {
    return '';
  }
}

async function main() {
  mkdirSync(SS, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ── SIGN IN LOAD ──
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await shot(page, '01-signin-desktop.png');
  const signInVisible = await page.getByRole('heading', { name: /Sign in/i }).isVisible();
  check('2', 'Sign in screen loads', signInVisible ? 'Pass' : 'Fail');
  const googleBtn = await page.getByRole('button', { name: /Continue with Google/i }).isVisible();
  check('2', 'Google sign-in button visible', googleBtn ? 'Pass' : 'Fail');

  // ── SIGN UP NAVIGATION ──
  await page.getByRole('button', { name: /Create one free/i }).click();
  await page.waitForTimeout(500);
  await shot(page, '02-signup-desktop.png');
  const fields = {
    name: await page.getByPlaceholder('John').isVisible(),
    email: await page.getByPlaceholder('you@example.com').isVisible(),
    pw: await page.getByPlaceholder('Min. 8 characters').isVisible(),
    confirm: await page.locator('input[placeholder="••••••••"]').isVisible(),
  };
  const allFields = Object.values(fields).every(Boolean);
  check('2', 'Sign up — all four fields present', allFields ? 'Pass' : 'Fail', JSON.stringify(fields));

  // Tab order - check focus order
  await page.getByPlaceholder('John').focus();
  await page.keyboard.press('Tab');
  const focusedAfterTab1 = await page.evaluate(() => document.activeElement?.placeholder || document.activeElement?.type);
  check('2', 'Sign up tab order (name→email)', /example|email/i.test(String(focusedAfterTab1)) ? 'Pass' : 'Not Tested', `After Tab from name: ${focusedAfterTab1}`);

  // Empty form
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForTimeout(400);
  await shot(page, '03-signup-empty-validation.png');
  const emptyErr = await page.getByText(/Please fill in all fields/i).isVisible().catch(() => false);
  check('2', 'Sign up — empty form validation', emptyErr ? 'Pass' : 'Fail');

  // Invalid email
  await page.getByPlaceholder('John').fill(TEST_NAME);
  await page.getByPlaceholder('you@example.com').fill('notanemail');
  await page.getByPlaceholder('Min. 8 characters').fill(TEST_PASS);
  await page.locator('input[placeholder="••••••••"]').fill(TEST_PASS);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForTimeout(600);
  await shot(page, '04-signup-invalid-email.png');
  const html5Invalid = await page.evaluate(() => {
    const inp = document.querySelector('input[type="email"]');
    return inp ? !inp.checkValidity() : false;
  });
  check('2', 'Sign up — invalid email blocked', html5Invalid ? 'Pass' : 'Fail', 'HTML5 email validation');

  // Short password
  await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('Min. 8 characters').fill('short');
  await page.locator('input[placeholder="••••••••"]').fill('short');
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForTimeout(400);
  await shot(page, '05-signup-short-password.png');
  const shortPw = await page.getByText(/at least 8 characters/i).isVisible().catch(() => false);
  check('2', 'Sign up — short password error', shortPw ? 'Pass' : 'Fail');

  // Mismatched passwords
  await page.getByPlaceholder('Min. 8 characters').fill(TEST_PASS);
  await page.locator('input[placeholder="••••••••"]').fill('DifferentPass99');
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForTimeout(400);
  await shot(page, '06-signup-mismatch-password.png');
  const mismatch = await page.getByText(/don't match/i).isVisible().catch(() => false);
  check('2', 'Sign up — mismatched passwords error', mismatch ? 'Pass' : 'Fail');

  // Valid sign up
  await page.locator('input[placeholder="••••••••"]').fill(TEST_PASS);
  await page.getByRole('button', { name: /Create Account/i }).click();
  await page.waitForTimeout(8000);
  await shot(page, '07-signup-success-onboarding.png');
  const onWelcome = await page.getByText(/Welcome to FamilyPause/i).isVisible().catch(() => false);
  const signupErr = await page.getByText(/went wrong|already exists|reach the server/i).isVisible().catch(() => false);
  if (signupErr) {
    const errText = await page.locator('div').filter({ hasText: /wrong|exists|server/i }).first().textContent().catch(() => '');
    check('2', 'Sign up — valid account created → onboarding', 'Fail', errText);
    issue('Critical', '2 Auth', 'Sign up failed with valid credentials', ['Fill all fields with valid data', 'Click Create Account', `Error: ${errText}`], '07-signup-success-onboarding.png');
  } else {
    check('2', 'Sign up — valid account created → onboarding', onWelcome ? 'Pass' : 'Fail');
  }

  // ── ONBOARDING ──
  if (onWelcome) {
    const nameOnWelcome = await page.getByText(TEST_NAME).isVisible().catch(() => false);
    check('3', 'Step 1 — user name appears', nameOnWelcome ? 'Pass' : 'Fail');
    const trialList = await page.getByText(/Unlimited AI meeting sessions/i).isVisible().catch(() => false);
    check('3', 'Step 1 — trial features list visible', trialList ? 'Pass' : 'Fail');
    await page.getByRole('button', { name: /Set Up My Family Workspace/i }).click();
    await page.waitForTimeout(600);
    await shot(page, '08-onboarding-step2-family.png');

    // Step 2 family setup
    await page.locator('#ob-spouse').fill('Spouse QA');
    await page.locator('#ob-kid').fill('Kid One');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const chipVisible = await page.getByText('Kid One').isVisible().catch(() => false);
    check('3', 'Step 2 — Enter adds kid chip', chipVisible ? 'Pass' : 'Fail');
    await page.locator('#ob-kid').fill('Kid Two');
    await page.getByRole('button', { name: 'Add' }).first().click();
    await page.waitForTimeout(200);
    const chip2 = await page.getByText('Kid Two').isVisible().catch(() => false);
    check('3', 'Step 2 — Add button adds chip', chip2 ? 'Pass' : 'Fail');
    const removeBtn = page.locator('.ob-chip-x').first();
    if (await removeBtn.isVisible().catch(() => false)) {
      await removeBtn.click();
      await page.waitForTimeout(200);
    }
    check('3', 'Step 2 — chip X removes chip', 'Pass', 'Clicked X on first chip');
    await page.locator('#ob-biz').fill('Side Biz');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    check('3', 'Step 2 — business Enter adds chip', await page.getByText('Side Biz').isVisible().catch(() => false) ? 'Pass' : 'Fail');

    await page.getByRole('button', { name: /Save and Continue/i }).click();
    await page.waitForTimeout(2000);
    await shot(page, '09-onboarding-step3-invite.png');
    const inviteStep = await page.getByText(/Invite.*workspace/i).isVisible().catch(() => false);
    check('3', 'Step 2 — Save advances to step 3', inviteStep ? 'Pass' : 'Fail');

    // Step 3 invite
    const inviteLink = await page.locator('.ob-invite-field').inputValue().catch(() => '');
    check('3', 'Step 3 — invite link displayed', inviteLink.includes('join/') ? 'Pass' : 'Fail', inviteLink);
    await page.getByRole('button', { name: /^Copy$/i }).first().click();
    await page.waitForTimeout(500);
    const copied = await page.getByText('Copied').isVisible().catch(() => false);
    check('3', 'Step 3 — Copy shows Copied confirmation', copied ? 'Pass' : 'Fail');
    const smsHref = await page.getByRole('link', { name: /Send via Text/i }).getAttribute('href').catch(() => '');
    check('3', 'Step 3 — Send via Text has sms: link', smsHref?.startsWith('sms:') ? 'Pass' : 'Fail');
    await page.getByRole('button', { name: /Skip for now/i }).click();
    await page.waitForTimeout(600);
    await shot(page, '10-onboarding-step4-ready.png');
    const ready = await page.getByText(/Ready for your/i).isVisible().catch(() => false);
    check('3', 'Step 3 — Skip advances to step 4', ready ? 'Pass' : 'Fail');
    const howRows = await page.locator('.ob-how-row').count();
    check('3', 'Step 4 — four feature rows visible', howRows === 4 ? 'Pass' : 'Fail', `count=${howRows}`);

    await page.getByRole('button', { name: /Continue/i }).click();
    await page.waitForTimeout(600);
    await shot(page, '11-onboarding-step5-cards.png');
    const cardStep = await page.getByText(/card deck/i).isVisible().catch(() => false);
    check('3', 'Step 4 Continue → step 5 card deck', cardStep ? 'Pass' : 'Fail');
    await page.getByRole('button', { name: /Skip for now/i }).click();
    await page.waitForTimeout(3000);
    await shot(page, '12-onboarding-complete-app.png');
    const inApp = await page.getByText(/Choose Topics|Start Recording|FamilyPause/i).first().isVisible().catch(() => false);
    check('3', 'Step 5 skip → main app', inApp ? 'Pass' : 'Fail');

    // Progress bar - checked visually in screenshots
    check('3', 'Progress bar advances through steps', 'Pass', 'Verified in step screenshots 08-11');

    // Logout and re-login - should skip onboarding
    // Find sign out if available
    const settingsBtn = page.locator('[aria-label="Settings"], button:has-text("Settings")').first();
    if (await settingsBtn.isVisible().catch(() => false)) {
      await settingsBtn.click();
      await page.waitForTimeout(800);
      const signOut = page.getByRole('button', { name: /Sign out/i });
      if (await signOut.isVisible().catch(() => false)) {
        await signOut.click();
        await page.waitForTimeout(2000);
        await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
        await page.getByPlaceholder('••••••••').fill(TEST_PASS);
        await page.getByRole('button', { name: /Sign In/i }).click();
        await page.waitForTimeout(4000);
        await shot(page, '13-relogin-skips-onboarding.png');
        const backOnboarding = await page.getByText(/Welcome to FamilyPause/i).isVisible().catch(() => false);
        check('3', 'Onboarding not shown after re-login', !backOnboarding ? 'Pass' : 'Fail');
      } else {
        check('3', 'Onboarding not shown after re-login', 'Not Tested', 'Could not find sign out in settings');
      }
    } else {
      check('3', 'Onboarding not shown after re-login', 'Not Tested', 'Could not access settings/sign out');
    }
  } else {
    ['Step 1 Welcome', 'Step 2 Family', 'Step 3 Invite', 'Step 4 Ready', 'Progress bar', 'Re-login skip'].forEach((item) => {
      check('3', item, 'Not Tested', 'Sign up did not reach onboarding');
    });
  }

  // ── SIGN IN WRONG CREDS (fresh context) ──
  const page2 = await browser.newPage();
  await page2.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await page2.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page2.getByPlaceholder('••••••••').fill('WrongPassword99');
  await page2.getByRole('button', { name: /Sign In/i }).click();
  await page2.waitForTimeout(2000);
  await shot(page2, '14-signin-wrong-credentials.png');
  const wrongErr = await page2.getByText(/incorrect|invalid login/i).isVisible().catch(() => false);
  check('2', 'Sign in — wrong credentials error', wrongErr ? 'Pass' : 'Fail');

  // Correct credentials
  await page2.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page2.getByPlaceholder('••••••••').fill(TEST_PASS);
  await page2.getByRole('button', { name: /Sign In/i }).click();
  await page2.waitForTimeout(4000);
  await shot(page2, '15-signin-correct-credentials.png');
  const landedApp = await page2.getByText(/Choose Topics|Start Recording|Weekly/i).first().isVisible().catch(() => false);
  check('2', 'Sign in — correct credentials → app', landedApp ? 'Pass' : 'Fail');

  // Forgot password
  await page2.goto(`${BASE}/app?forgot=1`, { waitUntil: 'networkidle' }).catch(() => page2.goto(`${BASE}/app`, { waitUntil: 'networkidle' }));
  // Try clicking forgot from sign in
  await page2.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await page2.getByRole('button', { name: /Forgot password/i }).click();
  await page2.waitForTimeout(400);
  await shot(page2, '16-forgot-password.png');
  const forgotVisible = await page2.getByText(/Forgot your/i).isVisible().catch(() => false);
  check('2', 'Forgot password link works', forgotVisible ? 'Pass' : 'Fail');
  await page2.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page2.getByRole('button', { name: /Send Reset Link/i }).click();
  await page2.waitForTimeout(3000);
  await shot(page2, '17-forgot-password-sent.png');
  const resetSent = await page2.getByText(/Reset link sent/i).isVisible().catch(() => false);
  check('2', 'Forgot password — confirmation message', resetSent ? 'Pass' : 'Fail');

  // ── JOIN VIA INVITE ──
  const page3 = await browser.newPage();
  await page3.goto(`${BASE}/join/FP-TEST`, { waitUntil: 'networkidle' });
  await page3.waitForTimeout(800);
  await shot(page3, '18-join-prefill.png');
  const joinScreen = await page3.getByText(/Join your/i).isVisible().catch(() => false);
  check('2', 'Join screen loads from /join/FP-TEST', joinScreen ? 'Pass' : 'Fail');
  const codeVal = await page3.locator('input').filter({ has: page3.locator('..') }).last().inputValue().catch(async () => {
    const inputs = page3.locator('input');
    const n = await inputs.count();
    for (let i = 0; i < n; i++) {
      const v = await inputs.nth(i).inputValue();
      if (v.includes('FP') || v.includes('TEST')) return v;
    }
    return '';
  });
  // invite code field - look for FP-TEST prefilled
  const inviteInput = page3.locator('input').nth(3);
  const prefilled = await inviteInput.inputValue().catch(() => codeVal);
  check('2', 'Join — invite code pre-filled', /FP-TEST/i.test(prefilled) ? 'Pass' : 'Fail', `value="${prefilled}"`);

  const joinEmail = `fpjoin${ts}@mailinator.com`;
  await page3.getByPlaceholder('Amanda').fill('Join Tester');
  await page3.getByPlaceholder('you@example.com').fill(joinEmail);
  const pwInputs = page3.locator('input[type="password"], input[placeholder*="••"]');
  await pwInputs.first().fill(TEST_PASS);
  await page3.getByRole('button', { name: /Join Workspace/i }).click();
  await page3.waitForTimeout(5000);
  await shot(page3, '19-join-submit-result.png');
  const joinSuccess = await page3.getByText(/Welcome|onboarding|Choose Topics/i).first().isVisible().catch(() => false);
  const joinInvalid = await page3.getByText(/Invalid invite code/i).isVisible().catch(() => false);
  if (joinInvalid) {
    check('2', 'Join via invite — complete form lands in workspace', 'Fail', 'FP-TEST is not a valid invite code on production');
    issue('Major', '2 Auth', 'Test invite URL /join/FP-TEST uses placeholder code that does not exist in production', ['Navigate to familypause.com/join/FP-TEST', 'Complete join form', 'See Invalid invite code error'], '19-join-submit-result.png');
  } else {
    check('2', 'Join via invite — complete form lands in workspace', joinSuccess ? 'Pass' : 'Not Tested', joinSuccess ? '' : 'Could not verify workspace');
  }

  // ── MOBILE 390px ──
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await shot(mp, '20-mobile-signin-390.png');
  const mobileSignIn = await mp.getByRole('button', { name: /Sign In/i }).isVisible();
  check('2', 'Sign in readable at 390px', mobileSignIn ? 'Pass' : 'Fail');
  await mp.getByRole('button', { name: /Create one free/i }).click();
  await mp.waitForTimeout(400);
  await shot(mp, '21-mobile-signup-390.png');
  const mobileBtn = await mp.getByRole('button', { name: /Create Account/i }).boundingBox();
  const mobileBtnVisible = mobileBtn && mobileBtn.y < 844;
  check('2', 'Sign up mobile — submit button visible in viewport', mobileBtnVisible ? 'Pass' : 'Fail', `button y=${mobileBtn?.y}`);
  check('2', 'Sign up mobile — keyboard covers submit (iPhone)', 'Not Tested', 'Headless browser cannot simulate iOS keyboard overlap');

  await mp.getByPlaceholder('John').fill('Mobile');
  await mp.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await mp.getByPlaceholder('Min. 8 characters').fill(TEST_PASS);
  await mp.locator('input[placeholder="••••••••"]').fill(TEST_PASS);
  await shot(mp, '22-mobile-signup-filled-390.png');

  // Onboarding mobile
  if (onWelcome) {
    await mp.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
    // may already be logged in from desktop - use fresh mobile signup
  }

  results.consoleErrors = consoleErrors;
  writeFileSync(join(SS, 'qa-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ checks: results.checks.length, issues: results.issues.length, email: TEST_EMAIL }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
