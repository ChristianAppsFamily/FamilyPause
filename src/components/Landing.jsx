// ─────────────────────────────────────────────────────────────────────────────
// Landing.jsx: FamilyPause marketing site
// Ported from the design bundle (project/FamilyPause Landing.html + landing/landing.css).
// All styles are scoped under `.fp-landing` so the landing's generic class names
// (.btn, .eyebrow, .section, .word, .tag…) never collide with the app's global CSS.
//
// Props:
//   onSignIn()   optional (nav "Sign in")
//   onStart()    optional (all "Start / trial" CTAs)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import SampleCardCarousel from "./SampleCardCarousel.jsx";
import ExitIntentModal from "./ExitIntentModal.jsx";
import { supabase } from "../lib/supabase";

const LANDING_SECTION_IDS = new Set(["how", "who", "pricing", "deck"]);

function scrollToLandingSection(id, { smooth = true } = {}) {
  if (!id || !LANDING_SECTION_IDS.has(id)) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  return true;
}

const css = `
.fp-landing {
  --cream: #F6EFE0;
  --r-xl: 26px;
  --shadow-lg: 0 14px 40px rgba(70,45,20,.12), 0 40px 90px rgba(70,45,20,.12);
  --wrap: 1160px;
  font-family: var(--serif);
  color: var(--ink);
  background: var(--paper);
  -webkit-font-smoothing: antialiased;
  font-size: 17px;
  line-height: 1.65;
}
.fp-landing * { box-sizing: border-box; }
.fp-landing h1, .fp-landing h2, .fp-landing h3, .fp-landing h4 {
  font-family: var(--display); font-weight: 600; margin: 0; letter-spacing: -.012em; color: var(--ink);
}
.fp-landing em { font-style: italic; }
.fp-landing a { color: inherit; text-decoration: none; }

.fp-landing .wrap { max-width: var(--wrap); margin: 0 auto; padding: 0 40px; }
.fp-landing .eyebrow {
  font-family: var(--mono); text-transform: uppercase; letter-spacing: .24em;
  font-size: 12px; font-weight: 500; color: var(--terra); display: inline-block;
}

/* buttons */
.fp-landing .btn {
  font-family: var(--mono); text-transform: uppercase; letter-spacing: .07em;
  font-size: 13px; font-weight: 500; border: none; border-radius: var(--r-sm);
  padding: 15px 26px; cursor: pointer; display: inline-flex; align-items: center; gap: 9px;
  transition: transform .12s, box-shadow .22s, background .2s, color .2s; white-space: nowrap;
}
.fp-landing .btn:active { transform: translateY(1px); }
.fp-landing .btn-primary { background: var(--terra); color: #fff; box-shadow: 0 8px 20px rgba(190,90,55,.26); }
.fp-landing .btn-primary:hover { background: var(--terra-d); box-shadow: 0 12px 28px rgba(190,90,55,.34); transform: translateY(-1px); }
.fp-landing .btn-ghost { background: transparent; color: var(--ink-2); border: 1.5px solid var(--line-2); }
.fp-landing .btn-ghost:hover { border-color: var(--terra); color: var(--terra); }
.fp-landing .btn-cream { background: #fff; color: var(--terra-d); box-shadow: 0 8px 20px rgba(60,40,20,.14); }
.fp-landing .btn-cream:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(60,40,20,.20); }
.fp-landing .btn-lg { padding: 17px 32px; font-size: 14px; }
.fp-landing .btn-block { width: 100%; justify-content: center; }

.fp-landing .linktext {
  font-family: var(--mono); font-size: 13px; letter-spacing: .05em; text-transform: uppercase;
  color: var(--ink-2); display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  background: none; border: none; padding: 6px 2px; border-bottom: 1.5px solid transparent; transition: .18s;
}
.fp-landing .linktext:hover { color: var(--terra); border-bottom-color: var(--terra); }
.fp-landing .fineprint { font-family: var(--mono); font-size: 12px; letter-spacing: .04em; color: var(--ink-3); text-transform: uppercase; }

/* nav */
.fp-landing .nav {
  position: sticky; top: 0; z-index: 40;
  -webkit-backdrop-filter: saturate(140%) blur(10px); backdrop-filter: saturate(140%) blur(10px);
  background: rgba(251,246,236,.82); border-bottom: 1px solid transparent;
  transition: border-color .3s, box-shadow .3s;
}
.fp-landing .nav.scrolled { border-color: var(--line); box-shadow: 0 6px 20px rgba(70,45,20,.05); }
.fp-landing .nav .row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  height: 74px;
  gap: 20px;
}
.fp-landing .logo { display: flex; align-items: center; gap: 11px; flex-shrink: 0; line-height: 1; }
.fp-landing .logo .word { font-family: var(--display); font-size: 21px; font-weight: 600; line-height: 1; }
.fp-landing .logo .word b { color: var(--terra); font-weight: 600; }
.fp-landing .navlinks {
  display: flex; align-items: center; justify-content: center;
  gap: 28px; min-width: 0;
}
.fp-landing .navlinks a {
  font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
  color: var(--ink-2); transition: color .18s; white-space: nowrap; line-height: 1;
}
.fp-landing .navlinks a:hover { color: var(--terra); }
.fp-landing .navlinks .navlink-btn {
  font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
  color: var(--ink-2); transition: color .18s; white-space: nowrap; line-height: 1;
  background: none; border: none; padding: 0; cursor: pointer;
}
.fp-landing .navlinks .navlink-btn:hover { color: var(--terra); }
.fp-landing .navcta {
  display: flex; align-items: center; gap: 16px; flex-shrink: 0;
}
.fp-landing .navcta .signin {
  font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase;
  color: var(--ink-2); cursor: pointer; background: none; border: none; padding: 0;
  line-height: 1; white-space: nowrap;
}
.fp-landing .navcta .signin:hover { color: var(--terra); }
.fp-landing .navcta .btn { line-height: 1; white-space: nowrap; }
.fp-landing .hero .ctas { display: flex; align-items: center; gap: 14px; margin: 30px 0 22px; flex-wrap: nowrap; }
.fp-landing .hero .ctas .btn {
  white-space: nowrap;
  flex: 0 0 auto;
}
.fp-landing .guide-trigger {
  min-height: 52px;
  padding-left: 22px;
  padding-right: 22px;
  font-size: 13px;
  background: transparent;
  border: 1px solid #D8CFC0;
  color: #6A5A40;
}
.fp-landing .guide-trigger:hover {
  border-color: var(--terra);
  color: var(--terra);
}
.fp-landing .navcta .btn .short-label { display: none; }
.fp-landing .navcta .btn .long-label { display: inline; }
.fp-landing .navmenu-btn {
  display: none;
  background: none; border: none;
  width: 44px; height: 44px; align-items: center; justify-content: center;
  cursor: pointer; color: var(--ink); padding: 0; flex-shrink: 0;
}
.fp-landing .navmenu-btn svg { display: block; }
.fp-landing .navmobile {
  display: none;
  position: fixed; inset: 74px 0 0 0; z-index: 90;
  background: rgba(42, 37, 29, 0.28);
  backdrop-filter: blur(2px);
}
.fp-landing .navmobile.open { display: block; }
.fp-landing .navmobile-panel {
  background: var(--paper);
  width: 100%;
  min-height: 100%;
  padding: 8px 0 32px;
  display: flex; flex-direction: column;
  border-bottom: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.fp-landing .navmobile-links {
  display: flex; flex-direction: column;
}
.fp-landing .navmobile-links a {
  font-family: var(--serif);
  font-size: 18px;
  line-height: 1.35;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink);
  text-decoration: none;
  padding: 18px 32px;
  border-bottom: 1px solid var(--line);
  transition: color .15s, background .15s;
}
.fp-landing .navmobile-links a:hover,
.fp-landing .navmobile-links a:focus-visible {
  color: var(--terra);
  background: var(--paper-2);
}
.fp-landing .navmobile-actions {
  margin-top: auto;
  padding: 28px 32px 0;
  display: flex; flex-direction: column; gap: 12px;
}
.fp-landing .navmobile-actions .signin {
  font-family: var(--serif);
  font-size: 18px;
  text-transform: none;
  letter-spacing: 0;
  color: var(--ink-2);
  background: none; border: none;
  padding: 14px 0;
  cursor: pointer;
  text-align: left;
}
.fp-landing .navmobile-actions .signin:hover { color: var(--terra); }

/* hero */
.fp-landing .hero { position: relative; overflow: hidden; }
.fp-landing .hero::before {
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(900px 540px at 82% 4%, var(--terra-tint), transparent 62%),
              radial-gradient(760px 520px at 4% 18%, #FBEFE0, transparent 58%);
}
.fp-landing .hero .wrap { position: relative; z-index: 1; }
.fp-landing .herogrid { display: grid; grid-template-columns: 1.04fr .96fr; gap: 56px; align-items: center; padding: 84px 0 96px; }
.fp-landing .hero h1 { font-size: 66px; line-height: 1.02; letter-spacing: -.02em; margin: 0 0 26px; }
.fp-landing .hero h1 em { color: var(--terra); font-style: italic; }
.fp-landing .hero .sub { font-size: 19px; line-height: 1.6; color: var(--ink-2); max-width: 520px; margin: 0 0 18px; }
.fp-landing .hero .sub b { color: var(--ink); font-weight: 600; }

/* Free Planning Guide modal */
.fp-guide-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(46, 40, 32, .46);
  backdrop-filter: blur(3px);
}
.fp-guide-modal {
  position: relative;
  width: 100%;
  max-width: 420px;
  border-radius: 16px;
  background: #FAF7F2;
  box-shadow: 0 24px 70px rgba(70, 45, 20, .26);
  padding: 48px 40px 28px;
  text-align: center;
  overflow: hidden;
}
.fp-guide-modal::before {
  content: "";
  position: absolute;
  top: 0;
  left: 50%;
  width: 34px;
  height: 3px;
  transform: translateX(-50%);
  border-radius: 0 0 3px 3px;
  background: var(--terra);
}
.fp-guide-close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #A09070;
  cursor: pointer;
  font-size: 23px;
  line-height: 1;
}
.fp-guide-close:hover { color: var(--terra); background: var(--terra-tint); }
.fp-guide-brand {
  width: 30px;
  height: 30px;
  display: block;
  margin: 0 auto 10px;
  border-radius: 7px;
}
.fp-guide-eyebrow {
  margin: 0 0 12px;
  color: #A09070;
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: .23em;
  text-transform: uppercase;
}
.fp-guide-title {
  font-family: var(--display);
  font-size: 24px;
  line-height: 1.2;
  font-style: italic;
  font-weight: 600;
  color: #2E2820;
  margin: 0 0 10px;
}
.fp-guide-subline {
  font-family: var(--serif);
  font-size: 14px;
  line-height: 1.55;
  color: #6A5A40;
  max-width: 300px;
  margin: 0 auto 22px;
}
.fp-guide-input {
  width: 100%;
  background: var(--paper);
  border: 1px solid var(--line-2);
  border-radius: 8px;
  color: var(--ink);
  padding: 13px 16px;
  font: 16px var(--serif);
  text-align: left;
  outline: none;
  transition: border-color .2s, box-shadow .2s;
}
.fp-guide-input::placeholder { color: #A09070; }
.fp-guide-input:focus {
  border-color: var(--terra);
  box-shadow: 0 0 0 3px var(--terra-tint);
}
.fp-guide-input[aria-invalid="true"] { border-color: var(--red); }
.fp-guide-error {
  margin: 8px 0 0;
  padding: 9px 11px;
  border-radius: 7px;
  background: #FAE0DA;
  color: var(--red);
  font: 13px/1.4 var(--serif);
}
.fp-guide-submit {
  margin-top: 12px;
  box-shadow: 0 8px 20px rgba(190, 90, 55, .24);
}
.fp-guide-success { text-align: center; padding: 12px 0 2px; }
.fp-guide-check {
  width: 34px;
  height: 34px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--olive-tint);
  color: var(--olive);
  font-size: 18px;
  font-weight: 600;
}
.fp-guide-success h2 {
  font-family: var(--display);
  font-size: 24px;
  line-height: 1.25;
  font-style: italic;
  font-weight: 600;
  margin: 0 0 22px;
  color: #2E2820;
}

/* Exit-intent founding offer */
.fp-exit-backdrop {
  position: fixed; inset: 0; z-index: 80;
  background: rgba(42, 37, 29, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 20px; backdrop-filter: blur(2px);
}
.fp-exit-modal {
  position: relative;
  width: min(100%, 440px);
  background: var(--paper-card, #FCF8F0);
  border: 1px solid var(--line, #E6D9C4);
  border-radius: 18px;
  padding: 36px 28px 28px;
  box-shadow: 0 18px 50px rgba(70, 45, 20, 0.18);
  text-align: center;
}
.fp-exit-x {
  position: absolute; top: 12px; right: 12px;
  width: 36px; height: 36px; border: none; border-radius: 8px;
  background: transparent; color: var(--ink-3);
  font-size: 22px; line-height: 1; cursor: pointer;
}
.fp-exit-x:hover { color: var(--terra); background: var(--terra-tint); }
.fp-exit-pill {
  display: inline-block;
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--terra-d);
  background: var(--terra-soft, #F1DDCF);
  border-radius: 999px;
  padding: 6px 12px;
  margin-bottom: 14px;
}
.fp-exit-hl {
  font-family: var(--display);
  font-style: italic;
  font-weight: 600;
  font-size: 28px;
  line-height: 1.15;
  color: #2E2820;
  margin: 0 0 10px;
  text-align: center;
}
.fp-exit-sub {
  font-family: var(--serif);
  font-size: 15px;
  line-height: 1.55;
  color: #6A5A40;
  margin: 0;
  text-align: center;
}
.fp-exit-rule {
  border: none;
  border-top: 1px solid #D8CFC0;
  margin: 16px 0;
  width: 100%;
}
.fp-exit-offers {
  list-style: none;
  margin: 0 0 14px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}
.fp-exit-offers li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-family: var(--serif);
  font-size: 14px;
  line-height: 1.45;
  color: #2E2820;
}
.fp-exit-ico {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  margin-top: 2px;
}
.fp-exit-ico--olive { background: var(--olive, #5E6B37); }
.fp-exit-ico--gold { background: var(--gold, #C09740); }
.fp-exit-spots {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.04em;
  margin: 0 0 16px;
  text-align: center;
}
.fp-exit-fine {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--ink-3, #8C8070);
  margin: 12px 0 10px;
  text-align: center;
}
.fp-exit-pass {
  display: block;
  width: 100%;
  background: none;
  border: none;
  font-family: var(--serif);
  font-size: 14px;
  color: var(--ink-3);
  cursor: pointer;
  padding: 8px;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.fp-exit-pass:hover { color: var(--terra); }
.fp-exit-success { text-align: center; padding: 8px 0 4px; }
.fp-exit-check {
  width: 52px; height: 52px; border-radius: 50%; margin: 0 auto 16px;
  display: flex; align-items: center; justify-content: center;
  background: var(--olive-soft); color: var(--olive-d);
  font-size: 22px; font-weight: 600;
}
.fp-exit-success h2 {
  font-family: var(--display); font-size: 26px; font-style: italic;
  margin: 0 0 10px; color: #2E2820;
}
.fp-exit-success p {
  font-family: var(--serif); font-size: 15px; color: #6A5A40; margin: 0;
  line-height: 1.5;
}

/* final CTA lifestyle photo */
.fp-landing .finalcta-photo {
  display: block;
  width: 100%;
  max-width: 880px;
  height: 380px;
  margin: 0 auto 40px;
  object-fit: cover;
  object-position: center 35%;
  border-radius: 16px;
  box-shadow: 0 8px 28px rgba(46, 40, 32, 0.12);
  background: var(--paper-3);
}
@media (max-width: 720px) {
  .fp-landing .finalcta-photo { height: 220px; }
}

/* hero mockup */
.fp-landing .mock { background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--r-xl); box-shadow: var(--shadow-lg); padding: 20px; position: relative; transform: rotate(.4deg); }
.fp-landing .mock.mock-live {
  animation: mockFloat 7s ease-in-out infinite;
  will-change: transform;
}
@keyframes mockFloat {
  0%, 100% { transform: rotate(.4deg) translateY(0); }
  50% { transform: rotate(.4deg) translateY(-7px); }
}
.fp-landing .mock .extracted {
  animation: mockBadgeIn .55s cubic-bezier(.2,.7,.2,1) .25s both, mockBadgePulse 3.2s ease-in-out 1.1s infinite;
}
@keyframes mockBadgeIn {
  from { opacity: 0; transform: scale(.88) translateY(-6px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes mockBadgePulse {
  0%, 100% { box-shadow: 0 8px 18px rgba(94,107,55,.28); }
  50% { box-shadow: 0 10px 24px rgba(94,107,55,.4); }
}
.fp-landing .mock .mock-card {
  opacity: 0;
  animation: mockCardIn .55s cubic-bezier(.2,.7,.2,1) forwards;
}
.fp-landing .mock .mock-card-1 { animation-delay: .45s; }
.fp-landing .mock .mock-card-2 { animation-delay: .62s; }
.fp-landing .mock .mock-card-3 { animation-delay: .79s; }
@keyframes mockCardIn {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
.fp-landing .mock .mfoot {
  position: absolute; bottom: -14px; left: 24px;
  font-family: var(--mono); font-size: 11px; letter-spacing: .04em;
  color: var(--olive-d); background: var(--olive-tint); border: 1px solid var(--olive-soft);
  padding: 7px 13px; border-radius: 999px;
  opacity: 0;
  animation: mockFootIn .5s cubic-bezier(.2,.7,.2,1) 1.05s forwards;
}
@keyframes mockFootIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.fp-landing .mock .macts { pointer-events: none; }
.fp-landing .mock .mbtn { cursor: default; }
.fp-landing .mock .mbar i:nth-child(1){ background:#D98E6A; } .fp-landing .mock .mbar i:nth-child(2){ background:var(--gold); } .fp-landing .mock .mbar i:nth-child(3){ background:var(--olive); }
.fp-landing .mock .mbar { display: flex; align-items: center; gap: 7px; padding: 4px 4px 16px; }
.fp-landing .mock .mbar i { width: 11px; height: 11px; border-radius: 50%; background: var(--line-2); }
.fp-landing .mock .mtitle { margin-left: auto; font-family: var(--mono); font-size: 10.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); }
.fp-landing .mock .extracted { position: absolute; top: -16px; right: 20px; font-family: var(--mono); font-size: 11px; letter-spacing: .05em; background: var(--olive); color: #fff; padding: 8px 14px; border-radius: 999px; box-shadow: 0 8px 18px rgba(94,107,55,.28); display: inline-flex; align-items: center; gap: 7px; }
.fp-landing .mock .review-eyebrow { text-align: right; font-family: var(--mono); font-size: 10.5px; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); padding: 0 4px 12px; }
.fp-landing .mcard { border: 1px solid var(--line); border-left: 3px solid var(--terra); border-radius: var(--r); padding: 15px 16px; margin-bottom: 11px; background: #fff; }
.fp-landing .mcard.olive { border-left-color: var(--olive); }
.fp-landing .mcard.gold  { border-left-color: var(--gold); }
.fp-landing .mcard .mtags { display: flex; gap: 7px; margin-bottom: 9px; }
.fp-landing .mtag { font-family: var(--mono); font-size: 9.5px; letter-spacing: .06em; text-transform: uppercase; padding: 3px 7px; border-radius: 5px; font-weight: 500; }
.fp-landing .mtag.spence { background: var(--terra-soft); color: var(--terra-d); }
.fp-landing .mtag.amanda { background: var(--olive-soft); color: var(--olive-d); }
.fp-landing .mtag.both   { background: var(--gold-soft); color: #8a6a16; }
.fp-landing .mtag.cat    { background: var(--paper-3); color: var(--ink-2); }
.fp-landing .mcard .mt { font-family: var(--display); font-size: 16px; font-weight: 600; line-height: 1.2; margin-bottom: 6px; }
.fp-landing .mcard .mq { font-style: italic; font-size: 12.5px; color: var(--ink-2); margin-bottom: 11px; line-height: 1.4; }
.fp-landing .mcard .mwhen-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 11px; }
.fp-landing .mcard .mwhen { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 10.5px; color: var(--terra-d); background: var(--terra-tint); border: 1px solid var(--terra-soft); padding: 4px 9px; border-radius: 6px; margin-bottom: 11px; }
.fp-landing .mcard .mstatus {
  display: inline-flex; align-items: center; gap: 6px;
  font-family: var(--mono); font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
  padding: 4px 9px; border-radius: 6px; margin-bottom: 11px;
}
.fp-landing .mcard .mwhen-row .mwhen,
.fp-landing .mcard .mwhen-row .mstatus { margin-bottom: 0; }
.fp-landing .mcard .mstatus.needs { background: var(--gold-soft); color: #8a6a16; border: 1px solid #e6d29a; }
.fp-landing .mcard .mstatus.ready { background: var(--olive-soft); color: var(--olive-d); border: 1px solid var(--olive-soft); }
.fp-landing .mcard .macts { display: flex; gap: 8px; }
.fp-landing .mbtn { flex: 1; text-align: center; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; padding: 9px; border-radius: var(--r-sm); border: none; }
.fp-landing .mbtn.keep { background: var(--olive-soft); color: var(--olive-d); }
.fp-landing .mbtn.disc { background: var(--terra-tint); color: var(--terra-d); }
.fp-landing .mbtn.cal  { background: var(--gold-soft); color: #8a6a16; }
.fp-landing .mbtn.edit { background: var(--paper-2); color: var(--ink-2); border: 1px solid var(--line); }
.fp-landing .mock .mfoot-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-top: 6px; padding: 10px 4px 2px; flex-wrap: wrap;
}
.fp-landing .mock .mfoot-bar .mstat {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: .04em; color: var(--ink-3); text-transform: uppercase;
}
.fp-landing .mock .mfoot-bar .mcal {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase;
  background: var(--terra); color: #fff; border: none; border-radius: var(--r-sm); padding: 9px 14px;
}

.fp-landing #how,
.fp-landing #who,
.fp-landing #pricing,
.fp-landing #deck {
  scroll-margin-top: 88px;
}

/* sections: each band gets its own surface so blocks don't blend */
.fp-landing .section { padding: 96px 0; }
.fp-landing .section-paper { background: var(--paper); }
.fp-landing .section-alt { background: var(--paper-2); }
.fp-landing .section-cream { background: var(--cream); }
.fp-landing .section-deep { background: var(--paper-3); }
.fp-landing .shead { max-width: 720px; margin-bottom: 56px; }
.fp-landing .shead h2 { font-size: 50px; line-height: 1.04; margin: 16px 0 18px; }
.fp-landing .shead h2 em { color: var(--terra); }
.fp-landing .shead p { font-size: 18.5px; color: var(--ink-2); margin: 0; }

/* testimonial band */
.fp-landing .band-terra { background: linear-gradient(135deg, var(--terra), #B14F2C); color: #fff; }
.fp-landing .band { padding: 76px 0; position: relative; overflow: hidden; }
.fp-landing .quote { text-align: center; max-width: 920px; margin: 0 auto; position: relative; }
.fp-landing .quote .qmark { font-family: var(--display); font-size: 120px; line-height: .6; color: rgba(255,255,255,.22); height: 56px; display: block; }
.fp-landing .quote blockquote { font-family: var(--display); font-style: italic; font-weight: 500; font-size: 40px; line-height: 1.28; margin: 0 0 26px; letter-spacing: -.01em; }
.fp-landing .quote .qby { font-family: var(--mono); font-size: 12.5px; letter-spacing: .18em; text-transform: uppercase; color: rgba(255,255,255,.85); }

/* how it works */
.fp-landing .steps4 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0; }
.fp-landing .stp { padding: 8px 22px; border-left: 1px solid var(--line); }
.fp-landing .stp:first-child { padding-left: 0; border-left: none; }
.fp-landing .stp:last-child { padding-right: 0; }
.fp-landing .stp .sico { width: 30px; height: 30px; color: var(--ink); margin-bottom: 26px; }
.fp-landing .stp .snum { font-family: var(--display); font-size: 52px; font-weight: 600; color: var(--terra-soft); line-height: 1; margin-bottom: 14px; }
.fp-landing .stp h3 { font-size: 23px; margin-bottom: 12px; }
.fp-landing .stp p { font-size: 15.5px; color: var(--ink-2); line-height: 1.6; margin: 0; }
.fp-landing .how-reassure {
  margin: 40px 0 0; text-align: center;
  font-family: var(--serif); font-size: 16px; color: var(--ink-2); font-style: italic;
}

/* who it's for */
.fp-landing .audgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.fp-landing .aud { background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 34px 34px 36px; transition: transform .2s, box-shadow .25s, border-color .2s; }
.fp-landing .aud:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: var(--line-2); }
.fp-landing .aud .aico { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; margin-bottom: 22px; background: var(--terra-tint); color: var(--terra-d); border: 1px solid var(--terra-soft); }
.fp-landing .aud:nth-child(2) .aico { background: var(--gold-soft); color: #8a6a16; border-color: #e6d29a; }
.fp-landing .aud:nth-child(3) .aico { background: var(--olive-tint); color: var(--olive-d); border-color: var(--olive-soft); }
.fp-landing .aud:nth-child(4) .aico { background: var(--paper-3); color: var(--ink-2); border-color: var(--line-2); }
.fp-landing .aud:nth-child(5) .aico { background: var(--terra-tint); color: var(--terra-d); border-color: var(--terra-soft); }
.fp-landing .aud h3 { font-size: 25px; margin-bottom: 12px; }
.fp-landing .aud p { font-size: 16px; color: var(--ink-2); margin: 0; line-height: 1.62; }

/* privacy band */
.fp-landing .band-olive { background: linear-gradient(135deg, var(--olive), #525E2F); color: #fff; }
.fp-landing .privacy { text-align: center; max-width: 880px; margin: 0 auto; }
.fp-landing .privacy p { font-family: var(--display); font-size: 32px; line-height: 1.35; margin: 0; font-weight: 500; }
.fp-landing .privacy em { font-style: italic; color: #F2E7C9; }

/* card deck section */
.fp-landing .deck-section {
  border-top: 1px solid var(--line-2);
  border-bottom: 1px solid var(--line-2);
  background: var(--paper-2);
  padding: 96px 0 88px;
}
.fp-landing .deck-section .shead {
  max-width: 640px;
  margin: 0 auto 52px;
  text-align: center;
}
.fp-landing .deck-section .shead p {
  max-width: 560px;
  margin: 14px auto 0;
}
.fp-landing .deck-section .shead p + p {
  margin-top: 12px;
}
.fp-landing .deck-carousel-wrap {
  margin: 0 auto 40px;
  max-width: 640px;
}
.fp-landing .deck-actions {
  display: flex;
  gap: 14px;
  justify-content: center;
  flex-wrap: wrap;
}
.fp-landing .deck-support {
  max-width: 640px;
  margin: 0 auto 28px;
  text-align: center;
  font-size: 16.5px;
  color: var(--ink-2);
  line-height: 1.55;
}

/* pricing */
.fp-landing .section-pricing {
  background: var(--cream);
  padding: 88px 0 96px;
}
.fp-landing .pricewrap { background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--r-xl); padding: 18px; box-shadow: var(--shadow); margin-top: 8px; }
.fp-landing .pricegrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.fp-landing .tier { background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 34px 30px; display: flex; flex-direction: column; position: relative; }
.fp-landing .tier.pop { background: linear-gradient(160deg, var(--terra), #B0502C); color: #fff; border: none; box-shadow: var(--shadow-lg); transform: translateY(-10px); }
.fp-landing .tier .plabel { font-family: var(--mono); font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 18px; }
.fp-landing .tier.pop .plabel { color: rgba(255,255,255,.8); }
.fp-landing .popbadge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-family: var(--mono); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; background: var(--gold); color: #fff; padding: 6px 15px; border-radius: 999px; box-shadow: 0 6px 14px rgba(192,151,64,.4); }
.fp-landing .price { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
.fp-landing .price .amt { font-family: var(--display); font-size: 58px; font-weight: 600; line-height: 1; letter-spacing: -.02em; }
.fp-landing .price .per { font-family: var(--mono); font-size: 12px; color: var(--ink-3); letter-spacing: .04em; }
.fp-landing .tier.pop .price .per { color: rgba(255,255,255,.85); }
.fp-landing .tier .subprice { font-family: var(--mono); font-size: 12px; letter-spacing: .03em; color: var(--ink-3); margin-bottom: 26px; }
.fp-landing .tier.pop .subprice { color: rgba(255,255,255,.85); }
.fp-landing .tier.pop .billing-toggle {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}
.fp-landing .tier.pop .billing-pill {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: .1em;
  text-transform: uppercase;
  border: none;
  border-radius: 999px;
  padding: 7px 12px;
  cursor: pointer;
  background: rgba(250,247,242,.18);
  color: rgba(250,247,242,.72);
  transition: background .18s, color .18s, box-shadow .18s;
}
.fp-landing .tier.pop .billing-pill.on {
  background: #FAF7F2;
  color: #B85C38;
  box-shadow: 0 2px 8px rgba(46,40,32,.12);
}
.fp-landing .tier.pop .planhint {
  font-family: var(--serif);
  font-style: italic;
  font-size: 13px;
  color: rgba(250,247,242,.78);
  margin: 0 0 26px;
  line-height: 1.4;
}
.fp-landing .tier.pop .planhint-link {
  font: inherit;
  font-style: italic;
  color: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.fp-landing .tier.pop .planhint-link:hover { color: #FAF7F2; }
.fp-landing .tier-includes {
  margin: 0 0 13px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: rgba(255,255,255,.82);
}
.fp-landing .feats { list-style: none; padding: 0; margin: 0 0 28px; display: flex; flex-direction: column; gap: 13px; flex: 1; }
.fp-landing .feats li { display: flex; gap: 11px; font-size: 15px; line-height: 1.4; color: var(--ink-2); }
.fp-landing .tier.pop .feats li { color: rgba(255,255,255,.94); }
.fp-landing .feats li .far { color: var(--terra); flex: none; margin-top: 3px; }
.fp-landing .tier.pop .feats li .far { color: #F2E7C9; }
.fp-landing .pricefoot { text-align: center; margin-top: 26px; }

/* live demo: try it now */
.fp-landing .trysec {
  --demo-cream: #FAF7F2;
  --demo-surface: #F0EAE0;
  --demo-border: #D8CFC0;
  --demo-ink: #2E2820;
  --demo-mid: #6A5A40;
  --demo-muted: #A09070;
  --demo-terra: #B85C38;
  --demo-terra-light: #F5D8CC;
  --demo-terra-dark: #7A2E14;
  --demo-olive: #4A6741;
  --demo-olive-light: #D8E8D4;
  --demo-gold: #C49A3C;
  --demo-gold-light: #FAF0D4;
  background: var(--demo-cream);
  padding: 88px 0 96px;
  position: relative;
}
.fp-landing .trysec::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--demo-surface);
  opacity: 0.55;
  pointer-events: none;
}
.fp-landing .trywrap {
  position: relative;
  max-width: 760px;
  margin: 0 auto;
  padding: 0 40px;
}
.fp-landing .tryhead { text-align: center; margin-bottom: 32px; }
.fp-landing .tryhead .demo-eyebrow {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--demo-terra);
  text-transform: uppercase;
  display: block;
  margin-bottom: 18px;
}
.fp-landing .tryhead h2 {
  font-family: var(--display);
  font-style: italic;
  font-size: 44px;
  line-height: 1.12;
  color: var(--demo-ink);
  margin-bottom: 18px;
}
.fp-landing .tryhead h2 em { color: var(--demo-terra); font-style: italic; }
.fp-landing .tryhead .lead {
  font-family: var(--serif);
  font-size: 17px;
  color: var(--demo-mid);
  max-width: 520px;
  margin: 0 auto 14px;
  line-height: 1.6;
}
.fp-landing .tryhead .note {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--demo-muted);
  margin: 0 0 32px;
}
.fp-landing .tryta {
  width: 100%;
  height: 160px;
  min-height: 160px;
  resize: vertical;
  background: var(--demo-cream);
  border: 1px solid var(--demo-border);
  border-radius: 12px;
  padding: 20px;
  font-family: var(--serif);
  font-size: 15px;
  color: var(--demo-ink);
  line-height: 1.55;
  outline: none;
  transition: border-color .2s, box-shadow .2s;
}
.fp-landing .tryta::placeholder { color: var(--demo-muted); font-style: italic; }
.fp-landing .tryta:focus {
  border-color: var(--demo-terra);
  box-shadow: 0 0 0 3px var(--demo-terra-light);
}
.fp-landing .tryta:disabled { opacity: 0.85; }
.fp-landing .tryrow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 14px;
}
.fp-landing .trycount {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--demo-muted);
}
.fp-landing .trycount.warn { color: var(--demo-gold); }
.fp-landing .trycount.at-max { color: var(--demo-terra); }
.fp-landing .trymax {
  font-family: var(--mono);
  font-size: 10px;
  color: var(--demo-muted);
  margin: 6px 0 0;
}
.fp-landing .distill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: var(--demo-terra);
  color: #FAF7F2;
  border: none;
  border-radius: 8px;
  padding: 12px 28px;
  font-family: var(--serif);
  font-size: 15px;
  cursor: not-allowed;
  opacity: 0.5;
  transition: opacity .2s, box-shadow .2s, transform .12s;
}
.fp-landing .distill.active {
  opacity: 1;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(184, 92, 56, 0.28);
}
.fp-landing .distill.active:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(184, 92, 56, 0.34); }
.fp-landing .distill .fpmark { display: inline-flex; gap: 5px; align-items: flex-end; }
.fp-landing .distill .pillgrp { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.fp-landing .distill .dot { width: 4px; height: 4px; border-radius: 50%; background: #FAF7F2; opacity: 0.9; }
.fp-landing .distill .pill { width: 10px; height: 16px; border-radius: 5px; background: #FAF7F2; opacity: 0.95; }
.fp-landing .distill .dloader { display: none; gap: 5px; align-items: center; }
.fp-landing .distill .dtext { display: inline; }
.fp-landing .distill.is-loading .dtext { display: none; }
.fp-landing .distill.is-loading .dloader { display: inline-flex; }
.fp-landing .distill.is-loading .fpmark { display: none; }
.fp-landing .distill .ld {
  width: 6px; height: 6px; border-radius: 50%; background: #FAF7F2;
  animation: demoDotPulse 1.2s ease-in-out infinite;
}
.fp-landing .distill .ld:nth-child(2) { animation-delay: 0.15s; }
.fp-landing .distill .ld:nth-child(3) { animation-delay: 0.3s; }
@keyframes demoDotPulse {
  0%, 80%, 100% { opacity: 0.35; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1); }
}
.fp-landing .tryprog {
  display: none;
  margin-top: 16px;
}
.fp-landing .tryprog.show { display: block; }
.fp-landing .progtrack {
  height: 3px;
  background: var(--demo-border);
  border-radius: 999px;
  overflow: hidden;
}
.fp-landing .progfill {
  height: 100%;
  background: var(--demo-terra);
  border-radius: 999px;
  transition: width 0.15s linear;
}
.fp-landing .progstatus {
  font-family: var(--serif);
  font-style: italic;
  font-size: 13px;
  color: var(--demo-muted);
  margin: 10px 0 0;
  text-align: center;
}
.fp-landing .tryex { text-align: center; margin-top: 28px; }
.fp-landing .tryex .exlead {
  font-family: var(--serif);
  font-size: 13px;
  color: var(--demo-muted);
  margin-bottom: 12px;
}
.fp-landing .exrow { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.fp-landing .expill {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--demo-muted);
  background: var(--demo-surface);
  border: 1px solid var(--demo-border);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.fp-landing .expill:hover { border-color: var(--demo-terra); color: var(--demo-terra); }
.fp-landing .tryerr {
  margin-top: 14px;
  padding: 14px 16px;
  background: #FBEAE5;
  border: 1px solid #E8C4B8;
  border-radius: 10px;
  text-align: center;
}
.fp-landing .tryerr p { font-family: var(--serif); font-size: 14px; color: var(--demo-terra-dark); margin: 0 0 10px; }
.fp-landing .tryretry {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: none;
  border: 1px solid var(--demo-terra);
  color: var(--demo-terra);
  border-radius: 7px;
  padding: 8px 16px;
  cursor: pointer;
}
.fp-landing .tryresults { display: none; }
.fp-landing .tryresults.show { display: block; }
.fp-landing .resrule {
  border: none;
  border-top: 2px solid var(--demo-terra);
  margin: 0 0 18px;
}
.fp-landing .reslabel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--demo-muted);
  margin-bottom: 22px;
}
.fp-landing .reslabel .chk {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  color: var(--demo-olive);
  animation: demoCheckPop 0.4s cubic-bezier(0.3, 1.4, 0.5, 1) both;
}
.fp-landing .reslabel .chk svg { width: 16px; height: 16px; }
@keyframes demoCheckPop {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.fp-landing .rescards { margin-bottom: 28px; }
.fp-landing .trysec .democard.mcard {
  opacity: 0;
  transform: translateY(16px);
  margin-bottom: 12px;
  background: var(--demo-surface);
}
.fp-landing .trysec .democard.mcard.in {
  animation: demoFadeUp 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}
@keyframes demoFadeUp {
  to { opacity: 1; transform: translateY(0); }
}
.fp-landing .trysec .demo-static {
  pointer-events: none;
  user-select: none;
}
.fp-landing .trysec .democard .mbtn {
  cursor: default;
  display: inline-block;
}
.fp-landing .trysec .conv {
  background: var(--demo-surface);
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  margin-top: 8px;
}
.fp-landing .trysec .conv h3 {
  font-family: var(--display);
  font-style: italic;
  font-size: 26px;
  color: var(--demo-ink);
  margin-bottom: 14px;
  line-height: 1.2;
}
.fp-landing .trysec .conv h3 em { color: var(--demo-terra); font-style: italic; }
.fp-landing .trysec .convlead {
  font-family: var(--serif);
  font-size: 15px;
  color: var(--demo-mid);
  max-width: 480px;
  margin: 0 auto 22px;
  line-height: 1.55;
}
.fp-landing .trysec .convbtns {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.fp-landing .trysec .convnote {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--demo-muted);
  margin: 0;
}
.fp-landing .trylimit .limitbox {
  background: var(--demo-gold-light);
  border: 1px solid var(--demo-border);
  border-left: 4px solid var(--demo-gold);
  border-radius: 12px;
  padding: 28px 24px;
  text-align: center;
}
.fp-landing .trylimit .llabel {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--demo-gold);
  margin-bottom: 12px;
}
.fp-landing .trylimit .lbody {
  font-family: var(--serif);
  font-size: 16px;
  color: var(--demo-mid);
  margin: 0 0 20px;
  line-height: 1.5;
}

/* final cta */
.fp-landing .finalcta {
  text-align: center; position: relative; overflow: hidden;
  background: var(--paper);
  border-top: 1px solid var(--line-2);
}
.fp-landing .finalcta::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(700px 380px at 50% 0%, var(--terra-tint), transparent 65%); }
.fp-landing .finalcta .wrap { position: relative; }
.fp-landing .finalcta h2 { font-size: 64px; line-height: 1.04; letter-spacing: -.02em; max-width: 880px; margin: 0 auto 24px; }
.fp-landing .finalcta h2 em { color: var(--terra); display: block; }
.fp-landing .finalcta p { font-size: 19px; color: var(--ink-2); max-width: 560px; margin: 0 auto 34px; }
.fp-landing .finalcta .fineprint { margin-top: 22px; }

/* footer */
.fp-landing .foot {
  border-top: 1px solid var(--line-2);
  background: var(--paper-2);
  padding: 54px 0 60px;
}
.fp-landing .foot .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 30px; flex-wrap: wrap; }
.fp-landing .foot .word { font-family: var(--display); font-size: 26px; font-weight: 600; }
.fp-landing .foot .word b { color: var(--terra); }
.fp-landing .foot .tag { color: var(--ink-3); font-size: 13.5px; line-height: 1.45; margin-top: 6px; max-width: 280px; }
.fp-landing .foot .fcols { display: flex; gap: 64px; }
.fp-landing .foot .fcol h4 { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); margin-bottom: 14px; font-weight: 500; }
.fp-landing .foot .fcol a { display: block; font-size: 14.5px; color: var(--ink-2); margin-bottom: 9px; transition: color .15s; }
.fp-landing .foot .fcol a:hover { color: var(--terra); }
.fp-landing .fp-footer-link { display: block; font-size: 14.5px; color: var(--ink-2); margin-bottom: 9px; transition: color .15s; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; text-align: left; }
.fp-landing .fp-footer-link:hover { color: var(--terra); }
.fp-landing .foot .legal { margin-top: 44px; padding-top: 24px; border-top: 1px solid var(--line); }

.fp-landing .reveal { opacity: 1; transform: translateY(22px); transition: opacity .7s cubic-bezier(.2,.7,.2,1), transform .7s cubic-bezier(.2,.7,.2,1); }
.fp-landing .reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .fp-landing .reveal { opacity: 1; transform: none; transition: none; }
  .fp-landing .mock.mock-live { animation: none; }
  .fp-landing .mock .extracted,
  .fp-landing .mock .mock-card,
  .fp-landing .mock .mfoot { animation: none; opacity: 1; transform: none; }
}

@media (max-width: 1280px) {
  .fp-landing .navlinks { gap: 20px; }
  .fp-landing .navlinks a { font-size: 11px; letter-spacing: .05em; }
  .fp-landing .navcta { gap: 14px; }
  .fp-landing .navcta .btn { padding: 13px 20px; font-size: 12px; }
}
@media (max-width: 960px) {
  .fp-landing .herogrid { grid-template-columns: 1fr; gap: 48px; padding: 60px 0 72px; }
  .fp-landing .hero h1 { font-size: 52px; }
  .fp-landing .mock { max-width: 460px; }
  .fp-landing .steps4 { grid-template-columns: 1fr 1fr; gap: 36px 0; }
  .fp-landing .stp { border-left: none; padding: 0 20px; }
  .fp-landing .stp:nth-child(odd) { padding-left: 0; }
  .fp-landing .audgrid { grid-template-columns: 1fr; }
  .fp-landing .pricegrid { grid-template-columns: 1fr; }
  .fp-landing .tier.pop { transform: none; }
  .fp-landing .shead h2, .fp-landing .finalcta h2 { font-size: 40px; }
  .fp-landing .quote blockquote { font-size: 30px; }
  .fp-landing .privacy p { font-size: 26px; }
}
@media (max-width: 768px) {
  .fp-landing .navlinks { display: none; }
  .fp-landing .navcta .signin,
  .fp-landing .navcta .btn:not(.navmenu-btn) { display: none; }
  .fp-landing .navmenu-btn { display: inline-flex; }
  .fp-landing .navmobile { inset: 64px 0 0 0; }
  .fp-landing .nav .row { height: 64px; }
}
@media (max-width: 720px) {
  .fp-landing .trywrap { padding: 0 16px; }
  .fp-landing .tryhead h2 { font-size: 34px; }
  .fp-landing .tryrow { flex-direction: column; align-items: stretch; }
  .fp-landing .distill { width: 100%; justify-content: center; }
  .fp-landing .trysec .convbtns { flex-direction: column; align-items: stretch; }
  .fp-landing .trysec .convbtns .btn { width: 100%; justify-content: center; }
}
@media (max-width: 560px) {
  .fp-landing .wrap { padding: 0 22px; }
  .fp-landing .hero h1 { font-size: 42px; }
  .fp-landing .hero .ctas { align-items: stretch; flex-direction: column; flex-wrap: wrap; gap: 12px; }
  .fp-landing .hero .ctas .btn { width: 100%; justify-content: center; }
  .fp-landing .steps4 { grid-template-columns: 1fr; }
  .fp-landing .foot .fcols { gap: 36px; flex-wrap: wrap; }
  .fp-guide-modal { padding: 44px 22px 24px; }
}
@media (max-width: 480px) {
  .fp-landing .navcta .btn:not(.navmenu-btn) { display: none; }
}
`;

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

export default function Landing({ onSignIn = () => {}, onStart = () => {} }) {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [familyBilling, setFamilyBilling] = useState("monthly");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [leadModal, setLeadModal] = useState(null); // "guide" | "waitlist" | "deck-waitlist" | null
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState("idle");
  const [leadError, setLeadError] = useState("");
  const rootRef = useRef(null);

  // Scroll to /#how, /#who, /#pricing, /#deck after mount (SPA hash nav from blog/footer).
  useEffect(() => {
    const id = (location.hash || "").replace(/^#/, "");
    if (!id) return undefined;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      scrollToLandingSection(id, { smooth: true });
    };
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [location.hash, location.pathname, location.key]);

  const goToSection = (id) => (event) => {
    event.preventDefault();
    if (scrollToLandingSection(id, { smooth: true })) {
      window.history.replaceState(null, "", `/#${id}`);
    }
    setMobileNavOpen(false);
  };

  useEffect(() => {
    const root = rootRef.current;
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const els = root ? [...root.querySelectorAll(".reveal")] : [];
    let io;
    let fallback;

    if (els.length) {
      const reveal = (el) => el.classList.add("in");
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver(
          (entries) => entries.forEach((e) => {
            if (e.isIntersecting) {
              reveal(e.target);
              io.unobserve(e.target);
            }
          }),
          { threshold: 0.08, rootMargin: "0px 0px -4% 0px" }
        );
        els.forEach((el) => io.observe(el));
      } else {
        els.forEach(reveal);
      }
      fallback = window.setTimeout(() => els.forEach(reveal), 1500);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
      if (fallback) window.clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (!leadModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLeadModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leadModal]);

  const openLeadModal = (kind) => {
    setLeadEmail("");
    setLeadError("");
    setLeadStatus("idle");
    setLeadModal(kind);
  };

  const closeLeadModal = () => {
    setLeadModal(null);
  };

  const submitLead = async (event) => {
    event.preventDefault();
    const email = leadEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLeadError("Enter a valid email address.");
      return;
    }

    setLeadError("");
    setLeadStatus("loading");
    const kind = leadModal === "waitlist"
      ? "ministry-waitlist"
      : leadModal === "deck-waitlist"
        ? "physical-deck-waitlist"
        : "guide";
    const { error } = await supabase.functions.invoke("capture-lead", {
      body: { email, kind },
    });

    if (error) {
      setLeadStatus("idle");
      setLeadError(
        kind === "guide"
          ? "We couldn't send the guide. Please try again."
          : "We couldn't join the waitlist. Please try again.",
      );
      return;
    }

    setLeadStatus("success");
  };

  return (
    <div className="fp-landing" ref={rootRef}>
      <style>{css}</style>

      {/* NAV */}
      <header className={"nav" + (scrolled ? " scrolled" : "")}>
        <div className="wrap row">
          <a className="logo" href="#top" onClick={() => setMobileNavOpen(false)}>
            <img src="/uploads/Logo_4.png" alt="FamilyPause" style={{ height: 36, width: 36, borderRadius: 8, display: "block" }} />
            <span className="word"><b>Family</b>Pause</span>
          </a>
          <nav className="navlinks">
            <a href="/#how" onClick={goToSection("how")}>How It Works</a>
            <a href="/#who" onClick={goToSection("who")}>Who It&apos;s For</a>
            <a href="/#pricing" onClick={goToSection("pricing")}>Pricing</a>
            <a href="/#deck" onClick={goToSection("deck")}>Card Deck</a>
            <a href="/blog">Blog</a>
          </nav>
          <div className="navcta">
            <button type="button" className="signin" onClick={onSignIn}>Sign In</button>
            <button className="btn btn-primary" onClick={onStart}>Create My Plan</button>
            <button
              type="button"
              className="navmenu-btn"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2}>
                {mobileNavOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
        <div className={"navmobile" + (mobileNavOpen ? " open" : "")} onClick={() => setMobileNavOpen(false)}>
          <nav className="navmobile-panel" onClick={(e) => e.stopPropagation()}>
            <div className="navmobile-links">
              <a href="/#how" onClick={goToSection("how")}>How It Works</a>
              <a href="/#who" onClick={goToSection("who")}>Who It&apos;s For</a>
              <a href="/#pricing" onClick={goToSection("pricing")}>Pricing</a>
              <a href="/#deck" onClick={goToSection("deck")}>Card Deck</a>
              <a href="/blog" onClick={() => setMobileNavOpen(false)}>Blog</a>
            </div>
            <div className="navmobile-actions">
              <button
                type="button"
                className="signin"
                onClick={() => { setMobileNavOpen(false); onSignIn(); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => { setMobileNavOpen(false); onStart(); }}
              >
                Create My Plan
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="wrap">
            <div className="herogrid">
              <div className="herocopy">
                <h1>So much going on.<br /><em>Create one plan your family can move on.</em></h1>
                <p className="sub">No more typing events into your calendar one by one.<br />Type it, paste it, or record your family talking.<br />FamilyPause handles the rest.</p>
                <div className="ctas">
                  <button className="btn btn-primary btn-lg" onClick={onStart}>Create My Family Plan</button>
                  <button className="btn btn-lg guide-trigger" onClick={() => openLeadModal("guide")}>Get My Free Plan Guide</button>
                </div>
                <p className="fineprint">Starts your free 7-day trial • No credit card required</p>
              </div>

              <div className="mock mock-live" aria-hidden="true">
                <span className="extracted">6 items found, ready for review</span>
                <div className="mbar"><i /><i /><i /><span className="mtitle">FamilyPause · Your Plan</span></div>
                <div className="review-eyebrow">Your plan</div>

                <div className="mcard mock-card mock-card-1">
                  <div className="mtags"><span className="mtag cat">Task</span><span className="mtag cat">Finances</span></div>
                  <div className="mt">Call the accountant about Q2 filing</div>
                  <div className="mq">&ldquo;We need to call the accountant before the end of the month.&rdquo;</div>
                  <div className="mstatus needs">Needs a date</div>
                  <div className="macts">
                    <button type="button" tabIndex={-1} className="mbtn cal">Schedule</button>
                    <button type="button" tabIndex={-1} className="mbtn disc">Discard</button>
                  </div>
                </div>

                <div className="mcard olive mock-card mock-card-2">
                  <div className="mtags"><span className="mtag cat">Appointment</span><span className="mtag amanda">Kids</span></div>
                  <div className="mt">Take Jordan to the dentist</div>
                  <div className="mwhen-row">
                    <div className="mwhen">
                      <svg width="12" height="12" viewBox="0 0 24 24" {...stroke} strokeWidth={2}><path d="M7 3v3M17 3v3M4 8h16" /><path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></svg>
                      Thursday, June 11 · 3:00 PM
                    </div>
                    <div className="mstatus ready">Ready for calendar</div>
                  </div>
                  <div className="macts">
                    <button type="button" tabIndex={-1} className="mbtn edit">Edit</button>
                    <button type="button" tabIndex={-1} className="mbtn keep">Add</button>
                  </div>
                </div>

                <div className="mcard gold mock-card mock-card-3">
                  <div className="mtags"><span className="mtag both">Decision</span><span className="mtag cat">Family</span></div>
                  <div className="mt">Switch Harbor to the 4pm swim group</div>
                  <div className="mq">&ldquo;We decided mornings weren&apos;t working, starts Monday.&rdquo;</div>
                  <div className="mstatus ready">Ready for calendar</div>
                  <div className="macts">
                    <button type="button" tabIndex={-1} className="mbtn edit">Edit</button>
                    <button type="button" tabIndex={-1} className="mbtn keep">Add</button>
                  </div>
                </div>

                <div className="mfoot-bar">
                  <span className="mstat">2 ready · 1 needs scheduling</span>
                  <button type="button" tabIndex={-1} className="mcal">Add 2 to calendar</button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIAL BAND */}
        <section className="band band-terra">
          <div className="wrap quote reveal">
            <span className="qmark">&ldquo;</span>
            <blockquote>I put everything we had going on into FamilyPause, and within minutes our week finally made sense.</blockquote>
            <div className="qby">Spence, Founder and First User</div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section section-alt" id="how">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">How it works</span>
              <h2>Start with the chaos.<br />End with a <em>plan.</em></h2>
              <p>No perfect lists, templates, or agendas required. Type it, paste it, or record your family talking it through. FamilyPause finds the appointments, tasks, reminders, and decisions, then organizes everything into a plan you review and approve together before it auto-syncs straight to your calendar.</p>
            </div>
            <div className="steps4 reveal">
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
                <div className="snum">01</div>
                <h3>Add what&apos;s going on</h3>
                <p>Type a messy list, paste a message or schedule, or record your family talking. It doesn&apos;t need to be organized, and it doesn&apos;t need to be a formal meeting.</p>
              </div>
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>
                <div className="snum">02</div>
                <h3>Create your plan</h3>
                <p>FamilyPause finds the appointments, tasks, reminders, and decisions, and organizes them by person and category.</p>
              </div>
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M5 12.5 10 17.5 19.5 6.5" /></svg>
                <div className="snum">03</div>
                <h3>Review and schedule together</h3>
                <p>Check every item before it goes anywhere. Confirm what&apos;s known and choose dates, times, and reminders for anything that&apos;s missing.</p>
              </div>
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 16.5h4" /></svg>
                <div className="snum">04</div>
                <h3>Add it to your calendar</h3>
                <p>Approve what matters and everything auto-syncs straight to Google Calendar. A clean family plan organized by person and type, already there when you need it.</p>
              </div>
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M12 3v12" /><path d="M8 11l4 4 4-4" /><path d="M5 19h14" /></svg>
                <div className="snum">05</div>
                <h3>Take it anywhere</h3>
                <p>Print your plan as a PDF, save it to your clipboard, or copy and paste it straight into Notion or Slack.</p>
              </div>
            </div>
            <p className="how-reassure reveal">Nothing reaches your calendar until you approve it.</p>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="section section-paper" id="who">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">Who it&apos;s for</span>
              <h2>Built for real families with real life to manage.</h2>
              <p>Whether you&apos;re coordinating busy schedules, raising kids, or simply trying to stay on the same page, FamilyPause helps you turn conversations into a plan everyone can follow.</p>
            </div>
            <div className="audgrid reveal">
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg></div>
                <h3>Married Couples</h3>
                <p>Two schedules. Shared responsibilities. Endless things to remember. FamilyPause helps you create one shared plan so everyone knows what&apos;s happening, who&apos;s responsible, and what comes next.</p>
              </div>
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg></div>
                <h3>Busy Parents</h3>
                <p>School emails, appointments, practices, errands, and last-minute changes don&apos;t arrive in order. FamilyPause gathers everything into one place and turns the chaos into a clear plan.</p>
              </div>
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}><path d="M12 3v18M7 8h10" /></svg></div>
                <h3>Families Who Pause Together</h3>
                <p>Start your weekly planning with a conversation. Pull a card, talk about what matters, and let FamilyPause capture the appointments, decisions, reminders, and next steps so nothing gets forgotten.</p>
              </div>
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg></div>
                <h3>Entrepreneur Households</h3>
                <p>When work and family constantly overlap, details can easily slip through the cracks. FamilyPause helps you capture those conversations and turn them into calendar-ready actions.</p>
              </div>
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5z" /></svg></div>
                <h3>Homeschool Families</h3>
                <p>Lessons, activities, appointments, and family life all compete for attention. FamilyPause helps you organize the week without adding another complicated planning system.</p>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST / PRIVACY BAND */}
        <section className="band band-olive">
          <div className="wrap privacy reveal">
            <p>FamilyPause is ad-free. Your family&apos;s conversations and plans stay private. We never sell your information or use it to target you with advertising.</p>
          </div>
        </section>

        <section className="deck-section" id="deck">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">The FamilyPause Conversation Deck</span>
              <h2>Better conversations.<br />Better <em>plans.</em></h2>
              <p>
                Before you plan the week, start with a real question. Pull a card on marriage, kids, finances, faith, dreams, or home. Talk it through. Then move into planning your week. Every appointment, reminder, and decision from your conversation is automatically added to your calendar.
              </p>
            </div>
            <div className="deck-carousel-wrap reveal">
              <SampleCardCarousel interactive={false} />
            </div>
            <p className="deck-support reveal">
              7 conversation cards are free for everyone.
              Upgrade to Family Plan to unlock the complete digital deck, free for our first 100 subscribers. Prefer something you can hold? Join the waitlist for the physical deck!
            </p>
            <div className="deck-actions reveal">
              <button type="button" className="btn btn-primary" onClick={() => openLeadModal("deck-waitlist")}>
                Join The Physical Deck Waitlist
              </button>
              <button type="button" className="btn btn-ghost" onClick={onStart}>Create My Family Plan</button>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="section section-pricing" id="pricing">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">Pricing</span>
              <h2>Start with a free trial.<br /><em>Choose what works for your family.</em></h2>
              <p>Try every Family Plan feature free for 7 days. No credit card required. When your trial ends, you&apos;ll automatically continue on the Free plan unless you choose to upgrade.</p>
            </div>
            <div className="pricewrap reveal">
              <div className="pricegrid">
                <div className="tier">
                  <div className="plabel">Free</div>
                  <div className="price"><span className="amt">$0</span></div>
                  <div className="subprice">Everything you need to keep creating family plans after your trial.</div>
                  <ul className="feats">
                    <li><span className="far">→</span> Type, paste, or record what needs planning</li>
                    <li><span className="far">→</span> One plan per day</li>
                    <li><span className="far">→</span> Review extracted items before they are scheduled</li>
                    <li><span className="far">→</span> Add approved items to your calendar</li>
                    <li><span className="far">→</span> View your week as a simple itinerary</li>
                    <li><span className="far">→</span> Copy your plan as text into any app</li>
                    <li><span className="far">→</span> 7 free Conversation Starter Cards</li>
                  </ul>
                  <button className="btn btn-ghost btn-block" onClick={onStart}>Continue Free</button>
                </div>

                <div className="tier pop">
                  <span className="popbadge">Most Popular</span>
                  <div className="plabel">Family Plan</div>
                  <div className="billing-toggle" role="group" aria-label="Billing period">
                    <button
                      type="button"
                      className={`billing-pill${familyBilling === "monthly" ? " on" : ""}`}
                      aria-pressed={familyBilling === "monthly"}
                      onClick={() => setFamilyBilling("monthly")}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      className={`billing-pill${familyBilling === "annual" ? " on" : ""}`}
                      aria-pressed={familyBilling === "annual"}
                      onClick={() => setFamilyBilling("annual")}
                    >
                      Annual
                    </button>
                  </div>
                  <div className="price">
                    <span className="amt">{familyBilling === "monthly" ? "$7" : "$59"}</span>
                    <span className="per">{familyBilling === "monthly" ? "/ month" : "/ year"}</span>
                  </div>
                  <p className="planhint">
                    {familyBilling === "monthly" ? (
                      <button
                        type="button"
                        className="planhint-link"
                        onClick={() => setFamilyBilling("annual")}
                      >
                        Or $59/year, less than $5/month
                      </button>
                    ) : (
                      "less than $5/month"
                    )}
                  </p>
                  <p className="tier-includes">Everything in Free, plus:</p>
                  <ul className="feats">
                    <li><span className="far">→</span> Edit titles, dates, times, and family members</li>
                    <li><span className="far">→</span> Resolve missing dates and times inline</li>
                    <li><span className="far">→</span> Create unlimited plans</li>
                    <li><span className="far">→</span> Access your complete plan history</li>
                    <li><span className="far">→</span> Invite your spouse with real-time syncing</li>
                    <li><span className="far">→</span> Organize with family members and custom categories</li>
                    <li><span className="far">→</span> Print or download your plan and itinerary as a PDF</li>
                    <li><span className="far">→</span> Export to Notion, Slack, or anywhere as a formatted list</li>
                    <li><span className="far">→</span> Unlock the complete digital Conversation Card Deck (free for the first 100 subscribers)</li>
                  </ul>
                  <button className="btn btn-cream btn-block" onClick={onStart}>Start Your Free Trial</button>
                </div>

                <div className="tier">
                  <div className="plabel">Church &amp; Ministry</div>
                  <div className="subprice" style={{ marginBottom: 18 }}>Help couples, families, and ministry teams plan together with FamilyPause.</div>
                  <ul className="feats">
                    <li><span className="far">→</span> Multiple private workspaces</li>
                    <li><span className="far">→</span> Team and staff access</li>
                    <li><span className="far">→</span> Centralized ministry billing</li>
                    <li><span className="far">→</span> Everything included in Family Plan</li>
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => openLeadModal("waitlist")}
                  >
                    Join the Waitlist
                  </button>
                </div>
              </div>
              <div className="pricefoot fineprint">Starts your free 7-day trial • No credit card required</div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section finalcta">
          <div className="wrap">
            <img
              className="finalcta-photo reveal"
              src="/images/fp-final-cta.png"
              alt="A couple having their weekly FamilyPause conversation at the kitchen table"
              loading="lazy"
              decoding="async"
              width={1672}
              height={941}
            />
            <h2>So much going on.<br /><em>One plan to move forward with.</em></h2>
            <p>Stop manually entering every event one by one. Type it, paste it, or record your family talking it through. FamilyPause finds everything, you approve it together, then it auto-syncs straight to your calendar.</p>
            <button className="btn btn-primary btn-lg" onClick={onStart}>Create My Family Plan</button>
            <p className="fineprint">Starts your free 7-day trial • No credit card required</p>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="foot">
        <div className="wrap">
          <div className="row">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <img src="/uploads/Logo_4.png" alt="" style={{ width: 32, height: 32, borderRadius: 8, display: "block" }} />
                <div className="word"><b>Family</b>Pause</div>
              </div>
              <div className="tag">So much going on. One plan to move forward with.</div>
            </div>
            <div className="fcols">
              <div className="fcol">
                <h4>Product</h4>
                <a href="/#how" onClick={goToSection("how")}>How It Works</a>
                <a href="/#who" onClick={goToSection("who")}>Who It&apos;s For</a>
                <a href="/#pricing" onClick={goToSection("pricing")}>Pricing</a>
                <a href="/#deck" onClick={goToSection("deck")}>Card Deck</a>
              </div>
              <div className="fcol">
                <h4>Company</h4>
                <a href="/blog">Blog</a>
                <a href="/privacy.html">Privacy</a>
                <a href="/terms.html">Terms</a>
                <a href="/contact">Contact</a>
              </div>
              <div className="fcol">
                <h4>Get Started</h4>
                <button className="fp-footer-link" onClick={onSignIn}>Sign In</button>
                <button className="fp-footer-link" onClick={onStart}>Create My Family Plan</button>
              </div>
            </div>
          </div>
          <div className="legal fineprint">© 2026 FamilyPause · Built with intention · <a href="https://www.biblegateway.com/passage/?search=Ecclesiastes%204%3A9-12&version=NASB" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Ecclesiastes 4:9</a></div>
        </div>
      </footer>

      <ExitIntentModal onStarted={onStart} />

      {leadModal && (
        <div className="fp-guide-backdrop" onMouseDown={closeLeadModal}>
          <div
            className="fp-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="fp-guide-close" onClick={closeLeadModal} aria-label="Close">
              ×
            </button>

            {leadStatus === "success" ? (
              <div className="fp-guide-success">
                <div className="fp-guide-check" aria-hidden="true">✓</div>
                <h2 id="lead-modal-title">
                  {leadModal === "guide"
                    ? "Check your inbox. It's on the way."
                    : "You're on the list. We'll be in touch."}
                </h2>
                <button type="button" className="btn btn-primary btn-block" onClick={closeLeadModal}>
                  All set
                </button>
              </div>
            ) : (
              <form onSubmit={submitLead} noValidate>
                <img className="fp-guide-brand" src="/uploads/Logo_4.png" alt="" />
                {leadModal === "waitlist" ? (
                  <>
                    <p className="fp-guide-eyebrow">Church &amp; Ministry</p>
                    <h2 className="fp-guide-title" id="lead-modal-title">Join the waitlist</h2>
                    <p className="fp-guide-subline">
                      Be first to bring FamilyPause to your couples, ministry teams, and family programs.
                    </p>
                  </>
                ) : leadModal === "deck-waitlist" ? (
                  <>
                    <p className="fp-guide-eyebrow">Physical Deck</p>
                    <h2 className="fp-guide-title" id="lead-modal-title">Join the waitlist</h2>
                    <p className="fp-guide-subline">
                      Be first to know when the printed FamilyPause Conversation Deck is ready.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="fp-guide-eyebrow">Free Planning Guide</p>
                    <h2 className="fp-guide-title" id="lead-modal-title">The One-Plan Guide</h2>
                    <p className="fp-guide-subline">
                      A simple but effective weekly planning system for families with too much going on.
                    </p>
                  </>
                )}
                <input
                  className="fp-guide-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={leadEmail}
                  onChange={(event) => {
                    setLeadEmail(event.target.value);
                    if (leadError) setLeadError("");
                  }}
                  aria-label="Email address"
                  aria-invalid={Boolean(leadError)}
                  aria-describedby={leadError ? "lead-modal-error" : undefined}
                  disabled={leadStatus === "loading"}
                />
                {leadError && (
                  <p className="fp-guide-error" id="lead-modal-error" role="alert">{leadError}</p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary btn-block fp-guide-submit"
                  disabled={leadStatus === "loading"}
                >
                  {leadStatus === "loading"
                    ? (leadModal === "guide" ? "Sending..." : "Joining...")
                    : (leadModal === "guide" ? "Send Me the Guide" : "Join the Waitlist")}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
