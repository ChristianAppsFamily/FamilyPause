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
import { isValidEmail, requestFamilyPauseGuide } from "../lib/sendGuide";

const LANDING_SECTION_IDS = new Set(["how", "who", "pricing", "deck"]);
const GUIDE_COVER_SRC = "/images/familypause-guide-cover.jpg";

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
  font-weight: 400;
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
  font-family: var(--serif); text-transform: none; letter-spacing: 0;
  font-size: 15px; font-weight: 500; border: none; border-radius: var(--r-sm);
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
.fp-landing .btn-lg { padding: 17px 32px; font-size: 16px; }
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
.fp-landing .logo { display: flex; align-items: center; gap: 10px; flex-shrink: 0; line-height: 1; }
.fp-landing .logo .word { font-family: var(--display); font-size: 21px; font-weight: 600; line-height: 1; }
.fp-landing .logo .word b { color: var(--terra); font-weight: 600; }
.fp-landing .logo img {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: block;
  flex-shrink: 0;
}
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
  font-size: 16px;
  font-weight: 600;
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
.fp-landing .herogrid { display: grid; grid-template-columns: 1.04fr .96fr; gap: 56px; align-items: start; padding: 44px 0 96px; }
.fp-landing .herocopy { align-self: center; }
.fp-landing .hero h1 { font-size: 44px; line-height: 1.12; letter-spacing: -.02em; margin: 0 0 22px; }
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
  background: #fff;
  box-shadow: 0 24px 70px rgba(70, 45, 20, .26);
  padding: 48px 40px 28px;
  text-align: center;
  overflow: hidden;
}
.fp-guide-modal-wide {
  max-width: 960px;
  padding: 44px 44px 36px;
}
.fp-guide-form-wide {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 36px 40px;
  align-items: center;
  text-align: left;
}
.fp-guide-modal-wide .fp-guide-eyebrow {
  font-size: 12px;
  margin-bottom: 14px;
}
.fp-guide-modal-wide .fp-guide-title {
  font-size: 40px;
  font-style: normal;
  line-height: 1.15;
  margin: 0 0 14px;
}
.fp-guide-modal-wide .fp-guide-subline {
  font-size: 20px;
  line-height: 1.5;
  color: var(--ink);
  max-width: none;
  margin: 0 0 22px;
}
.fp-guide-modal-wide .fp-guide-input {
  font-size: 18px;
  padding: 15px 18px;
}
.fp-guide-modal-wide .fp-guide-fields { gap: 12px; }
.fp-guide-modal-wide .fp-guide-submit,
.fp-guide-modal-wide .btn {
  font-size: 18px;
  padding: 17px 28px;
}
.fp-guide-modal-wide .fp-guide-fine {
  font-size: 15px;
  margin-top: 14px;
}
.fp-guide-modal-wide .fp-guide-success h2 {
  font-size: 36px;
  font-style: normal;
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
.fp-guide-cover {
  width: 100%;
  max-width: 200px;
  aspect-ratio: 2 / 3;
  height: auto;
  object-fit: cover;
  display: block;
  margin: 0 auto 16px;
  border-radius: 8px;
  border: 1px solid var(--line);
  box-shadow: 0 10px 28px rgba(70, 45, 20, .16);
  background: #fff;
}
.fp-guide-form-wide .fp-guide-cover {
  max-width: none;
  margin: 0;
}
.fp-guide-form-wide .fp-guide-brand {
  width: 180px;
  height: 180px;
  margin: 0 auto;
  border-radius: 22px;
  border: none;
  box-shadow: 0 10px 28px rgba(70, 45, 20, .16);
  background: var(--terra);
  object-fit: cover;
  overflow: hidden;
}
.fp-guide-copy { min-width: 0; }
.fp-guide-form-wide .fp-guide-subline {
  max-width: none;
}
.fp-guide-fine {
  margin: 12px 0 0;
  font-family: var(--serif);
  font-size: 12px;
  color: #A09070;
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
.fp-guide-fields { display: flex; flex-direction: column; gap: 10px; }
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
.fp-landing .mtag { font-family: var(--serif); font-size: 12px; letter-spacing: 0; text-transform: none; padding: 4px 8px; border-radius: 5px; font-weight: 500; }
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
.fp-landing .mbtn { flex: 1; text-align: center; font-family: var(--serif); font-size: 13px; font-weight: 500; letter-spacing: 0; text-transform: none; padding: 9px; border-radius: var(--r-sm); border: none; }
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
  font-family: var(--serif); font-size: 13px; font-weight: 500; letter-spacing: 0; text-transform: none;
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
.fp-landing .quote .qby { font-family: var(--serif); font-size: 16px; font-weight: 500; letter-spacing: 0; text-transform: none; color: rgba(255,255,255,.9); }

/* how it works */
.fp-landing #how.section { padding: 72px 0; }
.fp-landing #how .shead {
  max-width: 760px;
  margin: 0 auto 36px;
  text-align: center;
}
.fp-landing #how .shead h2 { font-size: 42px; margin: 12px 0 14px; }
.fp-landing #how .shead p { font-size: 17px; }
.fp-landing #how .how-photo {
  display: block;
  width: 100%;
  max-width: 720px;
  height: auto;
  margin: 0 auto;
  border-radius: var(--r-lg);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  background: #fff;
}

/* who it's for */
.fp-landing #who.section {
  padding: 72px 0;
  background: linear-gradient(135deg, var(--olive), #525E2F);
  color: #fff;
}
.fp-landing #who .shead {
  max-width: 760px;
  margin: 0 auto 36px;
  text-align: center;
}
.fp-landing #who .eyebrow { color: #F2E7C9; }
.fp-landing #who .shead h2 { color: #fff; }
.fp-landing #who .shead h2 em { color: #F2E7C9; }
.fp-landing #who .shead p { color: rgba(255,255,255,.9); }
.fp-landing #who .who-photo {
  display: block;
  width: 100%;
  max-width: 960px;
  height: auto;
  margin: 0 auto;
  border-radius: var(--r-lg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}

/* privacy band */
.fp-landing .band-olive { background: linear-gradient(135deg, var(--olive), #525E2F); color: #fff; }
.fp-landing .privacy-band {
  max-width: 960px;
  margin: 0 auto;
  text-align: center;
}
.fp-landing .privacy-band-photo {
  display: block;
  width: 100%;
  height: auto;
  margin: 0 auto 40px;
  border-radius: var(--r-lg);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
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
  font-size: 17px;
  color: var(--ink-2);
  line-height: 1.55;
}
.fp-landing .deck-support b { color: var(--ink); font-weight: 600; }

/* pricing */
.fp-landing .section-pricing {
  background: var(--cream);
  padding: 88px 0 96px;
}
.fp-landing .pricewrap { background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--r-xl); padding: 18px; box-shadow: var(--shadow); margin-top: 8px; }
.fp-landing .pricegrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.fp-landing .tier { background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 34px 30px; display: flex; flex-direction: column; position: relative; }
.fp-landing .tier.pop { background: linear-gradient(160deg, var(--terra), #B0502C); color: #fff; border: none; box-shadow: var(--shadow-lg); transform: translateY(-10px); }
.fp-landing .tier .plabel {
  font-family: var(--display);
  font-style: normal;
  font-weight: 600;
  font-size: 22px;
  letter-spacing: -.01em;
  text-transform: none;
  color: var(--ink);
  margin-bottom: 18px;
}
.fp-landing .tier.pop .plabel { color: #fff; }
.fp-landing .popbadge { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-family: var(--serif); font-size: 13px; font-weight: 500; letter-spacing: 0; text-transform: none; background: var(--gold); color: #fff; padding: 6px 15px; border-radius: 999px; box-shadow: 0 6px 14px rgba(192,151,64,.4); }
.fp-landing .price { display: flex; align-items: baseline; gap: 4px; margin-bottom: 6px; }
.fp-landing .price .amt { font-family: var(--display); font-size: 58px; font-weight: 600; line-height: 1; letter-spacing: -.02em; }
.fp-landing .price .per { font-family: var(--serif); font-size: 16px; font-weight: 500; color: var(--ink-3); letter-spacing: 0; }
.fp-landing .tier.pop .price .per { color: rgba(255,255,255,.85); }
.fp-landing .tier .subprice { font-family: var(--serif); font-size: 15px; letter-spacing: 0; color: var(--ink-2); margin-bottom: 26px; line-height: 1.45; }
.fp-landing .tier.pop .subprice { color: rgba(255,255,255,.85); }
.fp-landing .tier.pop .billing-toggle {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}
.fp-landing .tier.pop .billing-pill {
  font-family: var(--serif);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
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
  font-family: var(--serif);
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
  color: rgba(255,255,255,.88);
}
.fp-landing .feats { list-style: none; padding: 0; margin: 0 0 28px; display: flex; flex-direction: column; gap: 13px; flex: 1; }
.fp-landing .feats li { display: flex; gap: 11px; font-size: 15px; line-height: 1.4; color: var(--ink-2); }
.fp-landing .tier.pop .feats li { color: rgba(255,255,255,.94); }
.fp-landing .feats li .far { color: var(--terra); flex: none; margin-top: 3px; }
.fp-landing .tier.pop .feats li .far { color: #F2E7C9; }
.fp-landing .pricefoot { text-align: center; margin-top: 26px; }

/* footer */
.fp-landing .foot {
  border-top: 1px solid var(--line-2);
  background: var(--paper-2);
  padding: 54px 0 60px;
}
.fp-landing .foot .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 30px; flex-wrap: wrap; }
.fp-landing .foot .brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.fp-landing .foot .brand-row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  line-height: 1;
}
.fp-landing .foot .brand-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.fp-landing .foot .brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: block;
  flex-shrink: 0;
  object-fit: contain;
}
.fp-landing .foot .word { font-family: var(--display); font-size: 22px; font-weight: 600; line-height: 1; margin-top: -1px; }
.fp-landing .foot .word b { color: var(--terra); }
.fp-landing .foot .brand-tag {
  font-family: var(--serif);
  font-style: italic;
  font-weight: 500;
  font-size: 14px;
  line-height: 1.15;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink-2);
  margin: 0;
  padding: 0;
  max-width: none;
  display: block;
  border-radius: 0;
  background: none;
}
.fp-landing .foot .fcols { display: flex; gap: 64px; }
.fp-landing .foot .fcol h4 { font-family: var(--mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--terra); margin-bottom: 14px; font-weight: 600; }
.fp-landing .foot .fcol a { display: block; font-size: 14.5px; color: var(--ink-2); margin-bottom: 9px; transition: color .15s; }
.fp-landing .foot .fcol a:hover { color: var(--terra); }
.fp-landing .fp-footer-link { display: block; font-size: 14.5px; color: var(--ink-2); margin-bottom: 9px; transition: color .15s; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; text-align: left; }
.fp-landing .fp-footer-link:hover { color: var(--terra); }
.fp-landing .foot .legal {
  margin-top: 44px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  font-family: var(--serif);
  font-size: 15.5px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--ink-2);
}

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
  .fp-landing .navcta .btn { padding: 13px 20px; font-size: 14px; }
}
@media (max-width: 960px) {
  .fp-landing .herogrid { grid-template-columns: 1fr; gap: 48px; padding: 40px 0 72px; }
  .fp-landing .herocopy { align-self: start; }
  .fp-landing .hero h1 { font-size: 38px; }
  .fp-landing .mock { max-width: 460px; }
  .fp-landing .pricegrid { grid-template-columns: 1fr; }
  .fp-landing .tier.pop { transform: none; }
  .fp-landing .shead h2 { font-size: 40px; }
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
@media (max-width: 560px) {
  .fp-landing .wrap { padding: 0 22px; }
  .fp-landing .hero h1 { font-size: 29px; line-height: 1.1; }
  .fp-landing .hero .ctas { align-items: stretch; flex-direction: column; flex-wrap: wrap; gap: 12px; }
  .fp-landing .hero .ctas .btn { width: 100%; justify-content: center; }
  .fp-landing .foot .fcols { gap: 36px; flex-wrap: wrap; }
  .fp-guide-modal { padding: 44px 22px 24px; }
  .fp-guide-modal-wide {
    max-width: 100%;
    padding: 36px 22px 24px;
  }
  .fp-guide-modal-wide .fp-guide-title { font-size: 32px; }
  .fp-guide-modal-wide .fp-guide-subline { font-size: 18px; }
  .fp-guide-form-wide {
    grid-template-columns: 1fr;
    gap: 18px;
    text-align: center;
  }
  .fp-guide-form-wide .fp-guide-cover {
    max-width: 180px;
    margin: 0 auto;
  }
  .fp-guide-form-wide .fp-guide-brand {
    width: 96px;
    height: 96px;
    margin: 0 auto;
  }
  .fp-guide-form-wide .fp-guide-subline {
    margin-left: auto;
    margin-right: auto;
  }
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
  const [leadFirstName, setLeadFirstName] = useState("");
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

  useEffect(() => {
    const onPop = () => {
      const id = (window.location.hash || "").replace(/^#/, "");
      if (id) scrollToLandingSection(id, { smooth: true });
      else if (window.location.pathname === "/") window.scrollTo({ top: 0, behavior: "auto" });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const goToSection = (id) => (event) => {
    event.preventDefault();
    setMobileNavOpen(false);
    const hash = `#${id}`;
    if (window.location.hash === hash) {
      scrollToLandingSection(id, { smooth: true });
      return;
    }
    const prev = window.history.state || {};
    window.history.pushState(
      { ...prev, idx: (typeof prev.idx === "number" ? prev.idx : 0) + 1 },
      "",
      `/${hash}`
    );
    scrollToLandingSection(id, { smooth: true });
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
    const img = new Image();
    img.src = GUIDE_COVER_SRC;
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
    setLeadFirstName("");
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
    if (!isValidEmail(email)) {
      setLeadError("Enter a valid email address.");
      return;
    }

    setLeadError("");
    setLeadStatus("loading");
    const firstName = leadFirstName.trim();

    if (leadModal === "guide") {
      const result = await requestFamilyPauseGuide({ email, firstName });
      if (result.error) {
        setLeadStatus("idle");
        setLeadError(result.error);
        return;
      }
      setLeadStatus("success");
      return;
    }

    const kind = leadModal === "waitlist"
      ? "ministry-waitlist"
      : "physical-deck-waitlist";
    const { data, error } = await supabase.functions.invoke("capture-lead", {
      body: {
        email,
        kind,
        ...(firstName ? { first_name: firstName } : {}),
      },
    });

    if (error || data?.error) {
      setLeadStatus("idle");
      setLeadError("We couldn't join the waitlist. Please try again.");
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
            <img src="/uploads/Logo_4.png" alt="FamilyPause" />
            <span className="word"><b>Family</b>Pause</span>
          </a>
          <nav className="navlinks">
            <a href="/#how" onClick={goToSection("how")}>How It Works</a>
            <a href="/#who" onClick={goToSection("who")}>Who It&apos;s For</a>
            <a href="/#deck" onClick={goToSection("deck")}>Conversation Cards</a>
            <a href="/#pricing" onClick={goToSection("pricing")}>Pricing</a>
          </nav>
          <div className="navcta">
            <button className="btn btn-primary" onClick={onSignIn}>Sign In</button>
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
              <a href="/#deck" onClick={goToSection("deck")}>Conversation Cards</a>
              <a href="/#pricing" onClick={goToSection("pricing")}>Pricing</a>
            </div>
            <div className="navmobile-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => { setMobileNavOpen(false); onSignIn(); }}
              >
                Sign In
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
                <h1>Input your family&apos;s plans.<br />FamilyPause <em>auto-syncs</em> them to your calendar.</h1>
                <p className="sub">No more manually typing in events one by one. Instead record, paste, or speak your plans. FamilyPause <b>automatically</b> adds them to your calendar.</p>
                <div className="ctas">
                  <button className="btn btn-primary btn-lg" onClick={onStart}>Start My Free Trial</button>
                  <button className="btn btn-lg guide-trigger" onClick={() => openLeadModal("guide")}>Get Free FamilyPause Guide</button>
                </div>
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
            <blockquote>It was the time spent, typing events into the calendar manually. FamilyPause was born, saving us so much time by auto-syncing it all for us.</blockquote>
            <div className="qby">Spencer &amp; Amanda, Founders and First Users</div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section section-alt" id="how">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">How it works</span>
              <h2>Start with what you&apos;ve got.<br />End with a <em>plan.</em></h2>
              <p>No perfect lists required. Paste it, record it, or type it. FamilyPause finds the appointments, tasks, reminders, then organizes everything into a plan you review before it auto-syncs to your calendar.</p>
            </div>
            <img
              className="how-photo reveal"
              src="/images/fp-how-capture.png"
              alt="FamilyPause Capture screen where you type, paste, or speak to build your plan"
              loading="lazy"
              decoding="async"
              width={1024}
              height={758}
            />
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="section" id="who">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">Who it&apos;s for</span>
              <h2>Built for families with full schedules to manage.</h2>
              <p>Whether you&apos;re coordinating for multiple kids, homeschooling, or running a small business. FamilyPause helps turn events and reminders into a plan that keeps everyone in the loop.</p>
            </div>
            <img
              className="who-photo reveal"
              src="/images/fp-hero.jpg"
              alt="Spencer and Amanda at the table with FamilyPause cards and the weekly plan on a tablet"
              loading="lazy"
              decoding="async"
              width={1024}
              height={576}
            />
          </div>
        </section>

        {/* TRUST / PRIVACY BAND — parked for now
        <section className="band band-olive">
          <div className="wrap privacy-band reveal">
            <img
              className="privacy-band-photo"
              src="/images/fp-wall-display.png"
              alt="FamilyPause conversation card on a wall display in a home"
              loading="lazy"
              decoding="async"
              width={1672}
              height={941}
            />
            <div className="privacy">
              <p>FamilyPause is ad-free. Your family&apos;s conversations and plans stay private. We never sell your information or use it to target you with advertising.</p>
            </div>
          </div>
        </section>
        */}

        <section className="deck-section" id="deck">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">The FamilyPause Conversation Cards</span>
              <h2>Better conversations.<br />Better <em>plans.</em></h2>
              <p>
                Before you plan the week, pull a card on marriage, kids, finances, faith, dreams, or home. Talk it through. Then move into planning your week.
              </p>
            </div>
            <div className="deck-carousel-wrap reveal">
              <SampleCardCarousel interactive={false} />
            </div>
            <p className="deck-support reveal">
              7 conversation cards are free for everyone. Upgrade to Family Plan to unlock the Conversation Starter Card Deck, free for our first 100 subscribers.
            </p>
            <div className="deck-actions reveal">
              <button type="button" className="btn btn-primary" onClick={() => openLeadModal("deck-waitlist")}>
                Join the Conversation Starter Card Deck Waitlist
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
              <h2>Start with a <em>free</em> trial today.</h2>
              <p>Try every Family Plan feature free for 7 days. No credit card required. When your trial ends, you&apos;ll automatically continue on the Free plan unless you choose to upgrade.</p>
            </div>
            <div className="pricewrap reveal">
              <div className="pricegrid">
                <div className="tier">
                  <div className="plabel">Free</div>
                  <div className="price"><span className="amt">$0</span></div>
                  <div className="subprice">Everything you need to keep creating family plans after your trial.</div>
                  <ul className="feats">
                    <li><span className="far">→</span> Type, paste, or record what needs planning.</li>
                    <li><span className="far">→</span> Edit item titles, dates, times.</li>
                    <li><span className="far">→</span> One plan per week.</li>
                    <li><span className="far">→</span> Review extracted items before they are scheduled.</li>
                    <li><span className="far">→</span> Add approved items to your calendar.</li>
                    <li><span className="far">→</span> View your week as a simple itinerary.</li>
                    <li><span className="far">→</span> Copy your plan as text into any app.</li>
                    <li><span className="far">→</span> 7 free Conversation Starter Cards.</li>
                  </ul>
                  <button className="btn btn-ghost btn-block" onClick={onStart}>Continue Free</button>
                </div>

                <div className="tier pop">
                  <span className="popbadge">Most popular</span>
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
                    <span className="amt">{familyBilling === "monthly" ? "$9" : "$79"}</span>
                    <span className="per">{familyBilling === "monthly" ? "/month" : "/year"}</span>
                  </div>
                  <p className="planhint">
                    {familyBilling === "monthly" ? (
                      <button
                        type="button"
                        className="planhint-link"
                        onClick={() => setFamilyBilling("annual")}
                      >
                        Or $79/year, less than $7/month
                      </button>
                    ) : (
                      "Or $79/year, less than $7/month"
                    )}
                  </p>
                  <p className="tier-includes">Everything in Free, plus:</p>
                  <ul className="feats">
                    <li><span className="far">→</span> Works with the Google Calendar you already share.</li>
                    <li><span className="far">→</span> Assign items to family members.</li>
                    <li><span className="far">→</span> Resolve missing dates and times inline.</li>
                    <li><span className="far">→</span> Create unlimited plans.</li>
                    <li><span className="far">→</span> Save unfinished sessions and resume anytime.</li>
                    <li><span className="far">→</span> Organize family members and custom categories.</li>
                    <li><span className="far">→</span> Print or download your plan and itinerary as a PDF.</li>
                    <li><span className="far">→</span> Export to Notion, Slack, or anywhere as a formatted list.</li>
                    <li><span className="far">→</span> Unlock the Conversation Starter Card Deck (free for the first 100 subscribers).</li>
                  </ul>
                  <button className="btn btn-cream btn-block" onClick={onStart}>Start Your Free Trial</button>
                </div>

                <div className="tier">
                  <div className="plabel">Enterprise</div>
                  <div className="subprice" style={{ marginBottom: 18 }}>Help families within your organization save time and plan better with FamilyPause.</div>
                  <ul className="feats">
                    <li><span className="far">→</span> Multiple private workspaces.</li>
                    <li><span className="far">→</span> Team and staff access.</li>
                    <li><span className="far">→</span> Centralized billing.</li>
                    <li><span className="far">→</span> Everything included in Family Plan.</li>
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
      </main>

      {/* FOOTER */}
      <footer className="foot">
        <div className="wrap">
          <div className="row">
            <div className="brand">
              <div className="brand-row">
                <img className="brand-mark" src="/uploads/Logo_4.png" alt="" />
                <div className="brand-copy">
                  <div className="word"><b>Family</b>Pause</div>
                  <div className="brand-tag">Less Chaos. More Time.</div>
                </div>
              </div>
            </div>
            <div className="fcols">
              <div className="fcol">
                <h4>Product</h4>
                <a href="/#how" onClick={goToSection("how")}>How It Works</a>
                <a href="/#who" onClick={goToSection("who")}>Who It&apos;s For</a>
                <a href="/#deck" onClick={goToSection("deck")}>Conversation Cards</a>
                <a href="/#pricing" onClick={goToSection("pricing")}>Pricing</a>
                <a href="/mobile">Mobile Apps</a>
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
                <button className="fp-footer-link" onClick={onStart}>Start My Free Trial</button>
              </div>
            </div>
          </div>
          <div className="legal">© 2026 FamilyPause · Built with intention · <a href="https://www.biblegateway.com/passage/?search=Ecclesiastes%204%3A9-12&version=NASB" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Ecclesiastes 4:9</a></div>
        </div>
      </footer>

      <ExitIntentModal onStarted={onStart} disabled={!!leadModal} />

      {leadModal && (
        <div className="fp-guide-backdrop" onMouseDown={closeLeadModal}>
          <div
            className="fp-guide-modal fp-guide-modal-wide"
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
                    ? "Check your email, your guide is on the way."
                    : "You're on the list. We'll be in touch."}
                </h2>
                <button type="button" className="btn btn-primary btn-block" onClick={closeLeadModal}>
                  All set
                </button>
              </div>
            ) : (
              <form
                className="fp-guide-form-wide"
                onSubmit={submitLead}
                noValidate
              >
                {leadModal === "guide" ? (
                  <img
                    className="fp-guide-cover"
                    src={GUIDE_COVER_SRC}
                    alt="The FamilyPause Guide"
                    width={280}
                    height={420}
                    decoding="async"
                    fetchPriority="high"
                  />
                ) : (
                  <img className="fp-guide-brand" src="/uploads/Logo_4.png" alt="" />
                )}
                <div className="fp-guide-copy">
                {leadModal === "waitlist" ? (
                  <>
                    <p className="fp-guide-eyebrow">Enterprise</p>
                    <h2 className="fp-guide-title" id="lead-modal-title">Join the waitlist</h2>
                    <p className="fp-guide-subline">
                      Help families within your organization save time and plan better with FamilyPause.
                    </p>
                  </>
                ) : leadModal === "deck-waitlist" ? (
                  <>
                    <p className="fp-guide-eyebrow">Conversation Cards</p>
                    <h2 className="fp-guide-title" id="lead-modal-title">Join the waitlist</h2>
                    <p className="fp-guide-subline">
                      Be first to know when the printed FamilyPause Conversation Starter Card Deck is ready.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="fp-guide-eyebrow">Free Planning Guide</p>
                    <h2 className="fp-guide-title" id="lead-modal-title">The FamilyPause Guide</h2>
                    <p className="fp-guide-subline">
                      A simple but effective weekly planning system for families with too much going on.
                    </p>
                  </>
                )}
                <div className="fp-guide-fields">
                  {leadModal === "guide" && (
                    <input
                      className="fp-guide-input"
                      type="text"
                      name="given-name"
                      autoComplete="given-name"
                      placeholder="First name (optional)"
                      value={leadFirstName}
                      onChange={(event) => setLeadFirstName(event.target.value)}
                      aria-label="First name"
                      disabled={leadStatus === "loading"}
                    />
                  )}
                  <input
                    className="fp-guide-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={leadEmail}
                    required
                    onChange={(event) => {
                      setLeadEmail(event.target.value);
                      if (leadError) setLeadError("");
                    }}
                    aria-label="Email address"
                    aria-invalid={Boolean(leadError)}
                    aria-describedby={leadError ? "lead-modal-error" : undefined}
                    disabled={leadStatus === "loading"}
                  />
                </div>
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
                    : (leadModal === "guide" ? "Send Me the Guide." : "Join the Waitlist")}
                </button>
                {leadModal === "guide" && (
                  <p className="fp-guide-fine">No spam. Unsubscribe anytime.</p>
                )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
