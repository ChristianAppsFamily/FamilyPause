import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const URL = 'https://familypause.com/';
const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1280', width: 1280, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
];

const report = {
  url: URL,
  browser: 'Chromium (Chrome engine)',
  testedAt: new Date().toISOString(),
  viewports: {},
  consoleErrors: [],
  networkTiming: null,
  navTests: {},
  ctaTests: {},
  demoTest: {},
  footerLinks: [],
  externalLinks: [],
  https: null,
  redirect: null,
};

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    process.env.CHROME_PATH,
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function collectPageData(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: r.width,
        h: r.height,
        x: r.x,
        y: r.y,
        visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0',
        fontSize: cs.fontSize,
        overflow: cs.overflow,
      };
    };
    const textOf = (sel) => document.querySelector(sel)?.textContent?.trim().slice(0, 200) || null;
    const overlaps = () => {
      const hero = document.querySelector('.hero h1');
      const sub = document.querySelector('.hero .sub');
      if (!hero || !sub) return false;
      const hr = hero.getBoundingClientRect();
      const sr = sub.getBoundingClientRect();
      return !(hr.bottom <= sr.top || sr.bottom <= hr.top);
    };
    const steps = [...document.querySelectorAll('.steps4 .stp')].map((el, i) => ({
      index: i + 1,
      title: el.querySelector('h3')?.textContent?.trim(),
      visible: el.getBoundingClientRect().width > 0,
      snum: el.querySelector('.snum')?.textContent?.trim(),
      hasIcon: !!el.querySelector('.sico'),
    }));
    const aud = [...document.querySelectorAll('.audgrid .aud')].map((el, i) => ({
      index: i + 1,
      title: el.querySelector('h3')?.textContent?.trim(),
      rect: el.getBoundingClientRect(),
    }));
    const tiers = [...document.querySelectorAll('.pricegrid .tier')].map((el) => ({
      label: el.querySelector('.plabel')?.textContent?.trim(),
      price: el.querySelector('.amt')?.textContent?.trim(),
      subprice: el.querySelector('.subprice')?.textContent?.trim(),
      cta: el.querySelector('.btn')?.textContent?.trim(),
    }));
    const navLinks = [...document.querySelectorAll('.navlinks a')].map((a) => ({
      text: a.textContent.trim(),
      href: a.getAttribute('href'),
      targetId: a.getAttribute('href')?.replace('#', ''),
      targetExists: !!document.querySelector(a.getAttribute('href')),
    }));
    const logo = document.querySelector('.logo img');
    const footerLinks = [...document.querySelectorAll('footer a, .foot a, .fp-footer-link')].map((a) => ({
      text: (a.textContent || '').trim(),
      href: a.getAttribute('href') || '',
      tag: a.tagName,
    }));
    const external = [...document.querySelectorAll('a[href^="http"]')].map((a) => ({
      text: (a.textContent || '').trim().slice(0, 80),
      href: a.href,
    }));
    const demo = {
      present: !!document.querySelector('#try, #trysec, .trysec'),
      input: !!document.querySelector('.trysec textarea, #trysec textarea, .demo-input'),
      counter: !!document.querySelector('.trycount, .charcount, [class*="count"]'),
      distillBtn: !!document.querySelector('.distill'),
      distillDisabled: document.querySelector('.distill')?.classList.contains('active') === false,
    };
    const noads = textOf('.privacy p, .band-olive p');
    const contractsNote = document.body.innerText.includes('No contracts') || document.body.innerText.includes('no card') || document.body.innerText.includes('no credit card');
    return {
      title: document.title,
      heroH1: textOf('.hero h1'),
      heroSub: textOf('.hero .sub'),
      heroH1Rect: rect('.hero h1'),
      heroCTA: rect('.hero .ctas .btn-primary'),
      heroOverlapBad: overlaps(),
      navVisible: rect('.nav'),
      navLinksDisplay: getComputedStyle(document.querySelector('.navlinks') || document.body).display,
      logo: logo ? { src: logo.src, naturalW: logo.naturalWidth, naturalH: logo.naturalHeight, displayW: logo.clientWidth, displayH: logo.clientHeight } : null,
      navLinks,
      steps,
      aud,
      tiers,
      billingToggle: !!document.querySelector('.billing-toggle'),
      billingAnnual: document.querySelector('.billing-pill.on')?.textContent?.trim(),
      demo,
      noads,
      noadsVisible: !!document.querySelector('.band-olive, .privacy'),
      contractsNote,
      footerLinks,
      copyright: document.body.innerText.includes('familypause.com') || document.body.innerText.includes('©'),
      external,
      sectionIds: ['how', 'who', 'pricing', 'try'].map((id) => ({ id, exists: !!document.getElementById(id) })),
    };
  });
}

async function testNavScroll(page, href, id) {
  await page.evaluate((h) => {
    const a = [...document.querySelectorAll('a')].find((el) => el.getAttribute('href') === h);
    a?.click();
  }, href);
  await page.waitForTimeout(600);
  const y = await page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, inView: r.top >= -80 && r.top < window.innerHeight * 0.6 };
  }, id);
  return y;
}

(async () => {
  const chromePath = findChrome();
  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromePath) launchOpts.executablePath = chromePath;

  const browser = await chromium.launch(launchOpts);

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: false,
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  const t0 = Date.now();
  const response = await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  const loadMs = Date.now() - t0;
  report.networkTiming = { loadMs, status: response?.status(), finalUrl: page.url() };
  report.https = page.url().startsWith('https://');
  report.redirect = page.url();

  report.consoleErrors = [...new Set(consoleErrors)];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    const data = await collectPageData(page);
    report.viewports[vp.name] = data;
    await page.screenshot({ path: path.join(OUT, `${vp.name}-full.png`), fullPage: true });
    if (vp.name === '390') {
      await page.screenshot({ path: path.join(OUT, `${vp.name}-hero.png`), clip: { x: 0, y: 0, width: 390, height: 700 } });
      await page.evaluate(() => window.scrollTo(0, document.getElementById('pricing')?.offsetTop - 60 || 2000));
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, `${vp.name}-pricing.png`) });
    }
  }

  // Desktop nav scroll tests at 1440
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  for (const link of [
    { href: '#how', id: 'how' },
    { href: '#try', id: 'try' },
    { href: '#who', id: 'who' },
    { href: '#pricing', id: 'pricing' },
  ]) {
    report.navTests[link.href] = await testNavScroll(page, link.href, link.id);
  }

  // CTA: Start Free Week -> signup
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const [signupNav] = await Promise.all([
    page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => null),
    page.click('.navcta .btn-primary'),
  ]);
  report.ctaTests.navStartFree = { url: page.url(), hasSignup: page.url().includes('signup=1') };

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => null),
    page.click('.hero .btn-primary'),
  ]);
  report.ctaTests.heroStartFree = { url: page.url(), hasSignup: page.url().includes('signup=1') };

  // Sign in
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await Promise.all([
    page.waitForURL(/\/app/, { timeout: 15000 }).catch(() => null),
    page.click('.navcta .signin'),
  ]);
  report.ctaTests.signIn = { url: page.url(), hasSignup: page.url().includes('signup=1') };

  // Demo interaction at 1440
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.getElementById('try')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  const demoInput = page.locator('.trysec textarea, #trysec textarea').first();
  const demoExists = (await demoInput.count()) > 0;
  if (demoExists) {
    await demoInput.fill('We need to call the dentist for Jordan on Thursday at 3pm. Spence will review the budget Tuesday night.');
    await page.waitForTimeout(400);
    const counterText = await page.locator('.trycount, .trysec .count, .trymeta').first().textContent().catch(() => null);
    const distill = page.locator('.distill').first();
    const distillActive = await distill.evaluate((el) => el.classList.contains('active'));
    await page.screenshot({ path: path.join(OUT, 'demo-typed.png') });
    if (distillActive) {
      await distill.click();
      await page.waitForTimeout(12000);
      const resultsVisible = await page.locator('.tryresults.show, .tryresults').first().isVisible().catch(() => false);
      const convVisible = await page.locator('.trysec .conv').first().isVisible().catch(() => false);
      report.demoTest = { typed: true, counterText, distillActive, resultsVisible, convVisible };
      await page.screenshot({ path: path.join(OUT, 'demo-results.png'), fullPage: false });
    } else {
      report.demoTest = { typed: true, counterText, distillActive: false };
    }
  } else {
    report.demoTest = { present: false };
  }

  // Footer link checks (HEAD requests via page)
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('.foot a[href], footer a[href]')].map((a) => ({
      text: a.textContent.trim(),
      href: a.href,
    }))
  );
  for (const link of links) {
    let status = null;
    let error = null;
    try {
      const r = await page.request.get(link.href, { timeout: 15000 });
      status = r.status();
    } catch (e) {
      error = String(e.message || e);
    }
    report.footerLinks.push({ ...link, status, error });
  }

  const externals = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href^="http"]')].map((a) => a.href))]
  );
  for (const href of externals) {
    if (!href.includes('familypause.com') && !href.includes('fonts.googleapis')) {
      let status = null;
      let error = null;
      try {
        const r = await page.request.get(href, { timeout: 15000 });
        status = r.status();
      } catch (e) {
        error = String(e.message || e);
      }
      report.externalLinks.push({ href, status, error });
    }
  }

  fs.writeFileSync(path.join(OUT, 'qa-data.json'), JSON.stringify(report, null, 2));
  console.log('QA_DONE', JSON.stringify({ loadMs, consoleErrors: report.consoleErrors.length, finalUrl: report.redirect }));
  await browser.close();
})();
