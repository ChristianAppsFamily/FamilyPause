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
import LandingDemo from "./LandingDemo.jsx";

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
.fp-landing .nav .row { display: flex; align-items: center; justify-content: space-between; height: 74px; }
.fp-landing .logo { display: flex; align-items: center; gap: 11px; }
.fp-landing .logo .word { font-family: var(--display); font-size: 21px; font-weight: 600; }
.fp-landing .logo .word b { color: var(--terra); font-weight: 600; }
.fp-landing .navlinks { display: flex; align-items: center; gap: 34px; }
.fp-landing .navlinks a { font-family: var(--mono); font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); transition: color .18s; }
.fp-landing .navlinks a:hover { color: var(--terra); }
.fp-landing .navcta { display: flex; align-items: center; gap: 18px; }
.fp-landing .navcta .signin { font-family: var(--mono); font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); cursor: pointer; background: none; border: none; padding: 0; }
.fp-landing .navcta .signin:hover { color: var(--terra); }
.fp-landing .navcta .btn .short-label { display: none; }
.fp-landing .navcta .btn .long-label { display: inline; }

/* hero */
.fp-landing .hero { position: relative; overflow: hidden; }
.fp-landing .hero::before {
  content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background: radial-gradient(900px 540px at 82% 4%, var(--terra-tint), transparent 62%),
              radial-gradient(760px 520px at 4% 18%, #FBEFE0, transparent 58%);
}
.fp-landing .hero .wrap { position: relative; z-index: 1; }
.fp-landing .herogrid { display: grid; grid-template-columns: 1.04fr .96fr; gap: 56px; align-items: center; padding: 84px 0 96px; }
.fp-landing .hero h1 { font-size: 66px; line-height: 1.02; letter-spacing: -.02em; margin: 22px 0 26px; }
.fp-landing .hero h1 em { color: var(--terra); }
.fp-landing .hero .sub { font-size: 19px; line-height: 1.6; color: var(--ink-2); max-width: 520px; margin: 0 0 18px; }
.fp-landing .hero .sub b { color: var(--ink); font-weight: 600; }
.fp-landing .hero .ctas { display: flex; align-items: center; gap: 22px; margin: 30px 0 22px; flex-wrap: wrap; }

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
.fp-landing .mcard .mwhen { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 10.5px; color: var(--terra-d); background: var(--terra-tint); border: 1px solid var(--terra-soft); padding: 4px 9px; border-radius: 6px; margin-bottom: 11px; }
.fp-landing .mcard .macts { display: flex; gap: 8px; }
.fp-landing .mbtn { flex: 1; text-align: center; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; padding: 9px; border-radius: var(--r-sm); border: none; }
.fp-landing .mbtn.keep { background: var(--olive-soft); color: var(--olive-d); }
.fp-landing .mbtn.disc { background: var(--terra-tint); color: var(--terra-d); }
.fp-landing .mbtn.cal  { background: var(--gold-soft); color: #8a6a16; }

/* sections */
.fp-landing .section { padding: 96px 0; }
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
.fp-landing .steps4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; }
.fp-landing .stp { padding: 8px 30px; border-left: 1px solid var(--line); }
.fp-landing .stp:first-child { padding-left: 0; border-left: none; }
.fp-landing .stp:last-child { padding-right: 0; }
.fp-landing .stp .sico { width: 30px; height: 30px; color: var(--ink); margin-bottom: 26px; }
.fp-landing .stp .snum { font-family: var(--display); font-size: 52px; font-weight: 600; color: var(--terra-soft); line-height: 1; margin-bottom: 14px; }
.fp-landing .stp h3 { font-size: 23px; margin-bottom: 12px; }
.fp-landing .stp p { font-size: 15.5px; color: var(--ink-2); line-height: 1.6; margin: 0; }

/* who it's for */
.fp-landing .audgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.fp-landing .aud { background: var(--paper-card); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 34px 34px 36px; transition: transform .2s, box-shadow .25s, border-color .2s; }
.fp-landing .aud:hover { transform: translateY(-3px); box-shadow: var(--shadow); border-color: var(--line-2); }
.fp-landing .aud .aico { width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center; margin-bottom: 22px; background: var(--terra-tint); color: var(--terra-d); border: 1px solid var(--terra-soft); }
.fp-landing .aud:nth-child(2) .aico { background: var(--gold-soft); color: #8a6a16; border-color: #e6d29a; }
.fp-landing .aud:nth-child(3) .aico { background: var(--olive-tint); color: var(--olive-d); border-color: var(--olive-soft); }
.fp-landing .aud:nth-child(4) .aico { background: var(--paper-3); color: var(--ink-2); border-color: var(--line-2); }
.fp-landing .aud h3 { font-size: 25px; margin-bottom: 12px; }
.fp-landing .aud p { font-size: 16px; color: var(--ink-2); margin: 0; line-height: 1.62; }

/* privacy band */
.fp-landing .band-olive { background: linear-gradient(135deg, var(--olive), #525E2F); color: #fff; }
.fp-landing .privacy { text-align: center; max-width: 880px; margin: 0 auto; }
.fp-landing .privacy p { font-family: var(--display); font-size: 32px; line-height: 1.35; margin: 0; font-weight: 500; }
.fp-landing .privacy em { font-style: italic; color: #F2E7C9; }

/* pricing */
.fp-landing .pricewrap { background: var(--cream); border: 1px solid var(--line); border-radius: var(--r-xl); padding: 18px; box-shadow: var(--shadow); margin-top: 8px; }
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
.fp-landing .feats { list-style: none; padding: 0; margin: 0 0 28px; display: flex; flex-direction: column; gap: 13px; flex: 1; }
.fp-landing .feats li { display: flex; gap: 11px; font-size: 15px; line-height: 1.4; color: var(--ink-2); }
.fp-landing .tier.pop .feats li { color: rgba(255,255,255,.94); }
.fp-landing .feats li .far { color: var(--terra); flex: none; margin-top: 3px; }
.fp-landing .tier.pop .feats li .far { color: #F2E7C9; }
.fp-landing .pricefoot { text-align: center; margin-top: 26px; }

/* live demo — try it now */
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
.fp-landing .finalcta { text-align: center; position: relative; overflow: hidden; }
.fp-landing .finalcta::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(700px 380px at 50% 0%, var(--terra-tint), transparent 65%); }
.fp-landing .finalcta .wrap { position: relative; }
.fp-landing .finalcta h2 { font-size: 64px; line-height: 1.04; letter-spacing: -.02em; max-width: 880px; margin: 0 auto 24px; }
.fp-landing .finalcta h2 em { color: var(--terra); display: block; }
.fp-landing .finalcta p { font-size: 19px; color: var(--ink-2); max-width: 560px; margin: 0 auto 34px; }
.fp-landing .finalcta .fineprint { margin-top: 22px; }

/* footer */
.fp-landing .foot { border-top: 1px solid var(--line); padding: 54px 0 60px; }
.fp-landing .foot .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 30px; flex-wrap: wrap; }
.fp-landing .foot .word { font-family: var(--display); font-size: 26px; font-weight: 600; }
.fp-landing .foot .word b { color: var(--terra); }
.fp-landing .foot .tag { color: var(--ink-3); font-size: 15px; margin-top: 6px; }
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
  .fp-landing .navlinks { display: none; }
  .fp-landing .shead h2, .fp-landing .finalcta h2 { font-size: 40px; }
  .fp-landing .quote blockquote { font-size: 30px; }
  .fp-landing .privacy p { font-size: 26px; }
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
  .fp-landing .steps4 { grid-template-columns: 1fr; }
  .fp-landing .foot .fcols { gap: 36px; flex-wrap: wrap; }
}
@media (max-width: 480px) {
  /* Nav: give Sign in its own breathing room, shrink CTA label */
  .fp-landing .nav .row { height: 64px; }
  .fp-landing .navcta { gap: 10px; }
  .fp-landing .navcta .signin {
    white-space: nowrap;
    padding: 8px 10px;
    flex-shrink: 0;
  }
  .fp-landing .navcta .btn {
    padding: 10px 14px;
    font-size: 11px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .fp-landing .navcta .btn .long-label { display: none; }
  .fp-landing .navcta .btn .short-label { display: inline; }
}
`;

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

export default function Landing({ onSignIn = () => {}, onStart = () => {} }) {
  const [scrolled, setScrolled] = useState(false);
  const [familyBilling, setFamilyBilling] = useState("annual");
  const rootRef = useRef(null);

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

  return (
    <div className="fp-landing" ref={rootRef}>
      <style>{css}</style>

      {/* NAV */}
      <header className={"nav" + (scrolled ? " scrolled" : "")}>
        <div className="wrap row">
          <a className="logo" href="#top">
            <img src="/uploads/Logo_4.png" alt="FamilyPause" style={{ height: 36, width: 36, borderRadius: 8, display: "block" }} />
            <span className="word"><b>Family</b>Pause</span>
          </a>
          <nav className="navlinks">
            <a href="#how">How it works</a>
            <a href="#try">Try It Now</a>
            <a href="#who">Who it's for</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="navcta">
            <button className="signin" onClick={onSignIn}>Sign in</button>
            <button className="btn btn-primary" onClick={onStart}>
              <span className="long-label">Start Free Week</span>
              <span className="short-label">Start Free</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div className="wrap">
            <div className="herogrid">
              <div className="herocopy">
                <span className="eyebrow">Family Meeting Intelligence</span>
                <h1>We did a FamilyPause<br />and <em>got back on track.</em></h1>
                <p className="sub">Record your weekly family meeting. AI extracts every action, appointment, and decision. Review in minutes. <b>Your week, planned before Sunday ends.</b></p>
                <div className="ctas">
                  <button className="btn btn-primary btn-lg" onClick={onStart}>Start Your Free Week</button>
                  <a className="linktext" href="#try">See how it works
                    <svg width="15" height="15" viewBox="0 0 24 24" {...stroke} strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </a>
                </div>
                <p className="fineprint">7-day free trial · No credit card · Works on any device</p>
              </div>

              {/* live review mockup */}
              <div className="mock mock-live" aria-hidden="true">
                <span className="extracted">
                  <svg width="13" height="13" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}><path d="M5 12.5 10 17.5 19.5 6.5" /></svg>
                  6 items extracted
                </span>
                <div className="mbar"><i /><i /><i /><span className="mtitle">FamilyPause · Review</span></div>
                <div className="review-eyebrow">This week's review</div>

                <div className="mcard mock-card mock-card-1">
                  <div className="mtags"><span className="mtag spence">Spence</span><span className="mtag cat">Finance</span></div>
                  <div className="mt">Call the accountant re: Q2 filing</div>
                  <div className="mq">"we need to call the accountant before month end"</div>
                  <div className="mwhen">
                    <svg width="12" height="12" viewBox="0 0 24 24" {...stroke} strokeWidth={2}><path d="M7 3v3M17 3v3M4 8h16" /><path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></svg>
                    Due · Fri, Jun 6
                  </div>
                  <div className="macts"><button type="button" tabIndex={-1} className="mbtn keep">Keep</button><button type="button" tabIndex={-1} className="mbtn disc">Discard</button></div>
                </div>

                <div className="mcard olive mock-card mock-card-2">
                  <div className="mtags"><span className="mtag amanda">Amanda</span><span className="mtag cat">Kids</span></div>
                  <div className="mt">Take Jordan to the dentist</div>
                  <div className="mwhen">
                    <svg width="12" height="12" viewBox="0 0 24 24" {...stroke} strokeWidth={2}><path d="M7 3v3M17 3v3M4 8h16" /><path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></svg>
                    Thu, Jun 11 · 3:00 PM
                  </div>
                  <div className="macts"><button type="button" tabIndex={-1} className="mbtn keep">Keep</button><button type="button" tabIndex={-1} className="mbtn cal">+ Calendar</button></div>
                </div>

                <div className="mcard gold mock-card mock-card-3">
                  <div className="mtags"><span className="mtag both">Both</span><span className="mtag cat">Finance</span></div>
                  <div className="mt">Review Q2 household budget together</div>
                  <div className="mq">"can we block 30 minutes Tuesday night?"</div>
                  <div className="mwhen">
                    <svg width="12" height="12" viewBox="0 0 24 24" {...stroke} strokeWidth={2}><path d="M7 3v3M17 3v3M4 8h16" /><path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></svg>
                    Due · Tue, Jun 10 · 7:30 PM
                  </div>
                  <div className="macts"><button type="button" tabIndex={-1} className="mbtn keep">Keep</button><button type="button" tabIndex={-1} className="mbtn disc">Discard</button></div>
                </div>

                <span className="mfoot">~ 2 min to review</span>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIAL BAND */}
        <section className="band band-terra">
          <div className="wrap quote reveal">
            <span className="qmark">&ldquo;</span>
            <blockquote>We did a FamilyPause this weekend and it got us back on track with everything.</blockquote>
            <div className="qby">— Spence, Founder &amp; First User</div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="section" id="how">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">How it works</span>
              <h2>Talk like humans.<br /><em>Plan like a team.</em></h2>
              <p>No templates to fill. No agenda to pre-build. Just have your conversation, and FamilyPause handles the structure.</p>
            </div>
            <div className="steps4 reveal">
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></svg>
                <div className="snum">01</div>
                <h3>Have your meeting</h3>
                <p>Record live in the app or paste a transcript from Otter or Apple Dictation. Talk about whatever needs talking about: kids, money, work, the week ahead.</p>
              </div>
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>
                <div className="snum">02</div>
                <h3>AI distills it</h3>
                <p>Hit Distill. The AI reads your full conversation and extracts every action, appointment, and decision, organized by person and category. About 10 seconds.</p>
              </div>
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M5 12.5 10 17.5 19.5 6.5" /></svg>
                <div className="snum">03</div>
                <h3>Keep or discard</h3>
                <p>Review each card. Keep what matters, discard what doesn't, send appointments straight to Google Calendar. The AI flags anything it's uncertain about.</p>
              </div>
              <div className="stp">
                <svg className="sico" viewBox="0 0 24 24" {...stroke}><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 16.5h4" /></svg>
                <div className="snum">04</div>
                <h3>Your week is built</h3>
                <p>A clean weekly plan organized by person: Spence's actions, Amanda's actions, shared items, kids by name. Ready before Sunday ends.</p>
              </div>
            </div>
          </div>
        </section>

        <LandingDemo onStart={onStart} />

        {/* WHO IT'S FOR */}
        <section className="section" id="who" style={{ paddingTop: 30 }}>
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">Who it's for</span>
              <h2>Built for families<br /><em>running real lives.</em></h2>
            </div>
            <div className="audgrid reveal">
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9h14v-9" /><path d="M10 19v-5h4v5" /></svg></div>
                <h3>Married couples</h3>
                <p>Two schedules, shared goals, constant chaos. FamilyPause is the one hour a week that keeps you both on the same page before the week runs away from you.</p>
              </div>
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg></div>
                <h3>Entrepreneur households</h3>
                <p>When both of you are building something, the household needs its own operating system. FamilyPause is your weekly stand-up for the family business called home.</p>
              </div>
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" {...stroke} strokeWidth={1.8}><path d="M12 3v18M7 8h10" /></svg></div>
                <h3>Faith-driven families</h3>
                <p>The Sabbath principle is built into the name. A weekly pause to align, reflect, and plan is an act of stewardship. FamilyPause gives that intention a structure.</p>
              </div>
              <div className="aud">
                <div className="aico"><svg width="24" height="24" viewBox="0 0 24 24" {...stroke}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2.5z" /></svg></div>
                <h3>Homeschool families</h3>
                <p>Curriculum, appointments, activities, finances, all managed from home. The weekly sync isn't optional when home is also school and office. FamilyPause makes it fast.</p>
              </div>
            </div>
          </div>
        </section>

        {/* PRIVACY BAND */}
        <section className="band band-olive">
          <div className="wrap privacy reveal">
            <p>FamilyPause is <em>ad-free and will always be ad-free.</em> Your family's conversations are not data. They never will be.</p>
          </div>
        </section>

        {/* PRICING */}
        <section className="section" id="pricing">
          <div className="wrap">
            <div className="shead reveal">
              <span className="eyebrow">Pricing</span>
              <h2>Start free.<br /><em>Stay because it works.</em></h2>
              <p>7 days free, full access, no card required. After that, stay free with manual use, or unlock AI for less than a coffee a month.</p>
            </div>
            <div className="pricewrap reveal">
              <div className="pricegrid">
                <div className="tier">
                  <div className="plabel">Free</div>
                  <div className="price"><span className="amt">$0</span></div>
                  <div className="subprice">Always free</div>
                  <ul className="feats">
                    <li><span className="far">→</span> 7-day full trial on signup</li>
                    <li><span className="far">→</span> Unlimited manual card review</li>
                    <li><span className="far">→</span> Record and paste transcripts</li>
                    <li><span className="far">→</span> Keep / Discard / Calendar flow</li>
                    <li><span className="far">→</span> 1 free AI session per month</li>
                  </ul>
                  <button className="btn btn-ghost btn-block" onClick={onStart}>Get Started Free</button>
                </div>

                <div className="tier pop">
                  <span className="popbadge">Most Popular</span>
                  <div className="plabel">Family Plan</div>
                  <div className="billing-toggle" role="group" aria-label="Billing period">
                    <button
                      type="button"
                      className={`billing-pill${familyBilling === "annual" ? " on" : ""}`}
                      aria-pressed={familyBilling === "annual"}
                      onClick={() => setFamilyBilling("annual")}
                    >
                      Annual · Best Value
                    </button>
                    <button
                      type="button"
                      className={`billing-pill${familyBilling === "monthly" ? " on" : ""}`}
                      aria-pressed={familyBilling === "monthly"}
                      onClick={() => setFamilyBilling("monthly")}
                    >
                      Monthly
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
                        Save $25 with annual
                      </button>
                    ) : (
                      "Less than $5 a month"
                    )}
                  </p>
                  <ul className="feats">
                    <li><span className="far">→</span> Unlimited AI sessions</li>
                    <li><span className="far">→</span> Full meeting history</li>
                    <li><span className="far">→</span> Invite your spouse for real-time sync</li>
                    <li><span className="far">→</span> Kids routed by name</li>
                    <li><span className="far">→</span> Export sessions as PDF</li>
                    <li><span className="far">→</span> Custom categories</li>
                  </ul>
                  <button className="btn btn-cream btn-block" onClick={onStart}>Start 7-Day Trial</button>
                </div>

                <div className="tier">
                  <div className="plabel">Church &amp; Ministry</div>
                  <div className="price"><span className="amt">$39</span><span className="per">/ month</span></div>
                  <div className="subprice">For teams &amp; congregations</div>
                  <ul className="feats">
                    <li><span className="far">→</span> Up to 10 family workspaces</li>
                    <li><span className="far">→</span> Pastoral staff &amp; elder teams</li>
                    <li><span className="far">→</span> All Family Plan features</li>
                    <li><span className="far">→</span> Ministry billing &amp; invoicing</li>
                    <li><span className="far">→</span> Priority support</li>
                  </ul>
                  <button className="btn btn-primary btn-block" onClick={onStart}>Start 7-Day Trial</button>
                </div>
              </div>
              <div className="pricefoot fineprint">All plans include a 7-day free trial · Cancel anytime · No contracts</div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="section finalcta">
          <div className="wrap">
            <h2>Your family deserves<em>one good pause.</em></h2>
            <p>Start this Sunday. 7 days free. No credit card. Works on iPhone, iPad, Mac, or any browser.</p>
            <button className="btn btn-primary btn-lg" onClick={onStart}>Start Your FamilyPause</button>
            <p className="fineprint">7-day free trial · No card required · Cancel anytime</p>
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
              <div className="tag">The weekly reset every family needs.</div>
            </div>
            <div className="fcols">
              <div className="fcol">
                <h4>Product</h4>
                <a href="#how">How it works</a>
                <a href="#who">Who it's for</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div className="fcol">
                <h4>Company</h4>
                <a href="/privacy.html">Privacy</a>
                <a href="/terms.html">Terms</a>
                <a href="mailto:hello@familypause.com">Contact</a>
              </div>
              <div className="fcol">
                <h4>Get started</h4>
                <button className="fp-footer-link" onClick={onSignIn}>Sign in</button>
                <button className="fp-footer-link" onClick={onStart}>Start free week</button>
              </div>
            </div>
          </div>
          <div className="legal fineprint">© 2026 FamilyPause · Built with intention · <a href="https://www.biblegateway.com/passage/?search=Ecclesiastes%204%3A9-12&version=NASB" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Ecclesiastes 4:9</a></div>
        </div>
      </footer>
    </div>
  );
}
