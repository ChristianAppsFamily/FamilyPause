// Homepage v2 — ported from familypause-RE-2/project/FamilyPause Homepage v2.html
// Styles: src/styles/home2.css (scoped .fp-home2). App Terra & Cream is untouched.

import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ExitIntentModal from "./ExitIntentModal.jsx";
import AuthHeaderCta from "./AuthHeaderCta.jsx";
import Seo from "./Seo.jsx";
import { isValidEmail, requestFamilyPauseGuide } from "../lib/sendGuide";
import "../styles/home2.css";

const LANDING_SECTION_IDS = new Set(["how", "together", "pricing", "concierge", "shop"]);

const CARD_TAGS = [
  { t: "Kids", q: "What's one thing each kid needs more of from us this week?", cls: "t-todo" },
  { t: "Finances", q: "Is there anything we're spending on that we'd rather not be?", cls: "t-appt" },
  { t: "Marriage", q: "When did you feel most like a team this past week?", cls: "t-dec" },
  { t: "Faith", q: "Where do we want to make room for rest this Sunday?", cls: "t-note" },
];

const HOW_TABS = [
  { title: "Lock the Pause", body: "Pick one 20-minute slot. It repeats on both calendars." },
  { title: "Talk It Through", body: "Pull a card, hit record, and talk like you normally would." },
  { title: "Get Your Plan", body: "Your talk becomes a sorted plan with owners and dates." },
  { title: "Make Time Together", body: "Choose this week's date night. We remind you both." },
];

const FOR_CARDS = [
  { img: "/images/blog-underrated-marriage-habit.jpg", title: "Married couples", body: "Stay on the same page without it becoming a chore." },
  { img: "/images/fp-how-capture.png", title: "Busy parents", body: "Pickups, practices, and permission slips in one place." },
  { img: "/images/blog-ai-family-walk.jpg", title: "Families who pause together", body: "A weekly rhythm with room for rest and faith." },
  { img: "/images/fp-wall-display.png", title: "Entrepreneur households", body: "Keep business weeks from swallowing family time." },
  { img: "/images/blog-how-to-run-a-family-meeting.jpg", title: "Homeschool families", body: "Lessons, co-ops, and field trips, planned together." },
];

const SHOP = [
  { title: "Conversation Starter Card Deck" },
  { title: "Guided Journal" },
  { title: "Weekly Planner Pad" },
  { title: "Bundle" },
];

function scrollToLandingSection(id, { smooth = true } = {}) {
  if (!id || !LANDING_SECTION_IDS.has(id)) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  return true;
}

function FpLogo({ white = false, size = 30 }) {
  return (
    <>
      <svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
        <circle cx="10" cy="4.5" r="3.5" fill="#FFB547" />
        <circle cx="20" cy="4.5" r="3.5" fill="#FFB547" />
        <rect x="6" y="11" width="8" height="18" rx="4" fill={white ? "#fff" : "#14805E"} />
        <rect x="16" y="11" width="8" height="18" rx="4" fill={white ? "#fff" : "#14805E"} />
      </svg>
      <span>Family<b>Pause</b></span>
    </>
  );
}

function Ico({ name, size = 20 }) {
  const s = { width: size, height: size, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "check":
      return <svg {...s} viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19.5 6.5" /></svg>;
    case "clock":
      return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "users":
      return <svg {...s} viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3 2.8-5 6-5s5.4 2 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 19c.4-2 1.6-3.4 3.5-4" /></svg>;
    case "heart":
      return <svg {...s} viewBox="0 0 24 24"><path d="M19.5 12.6 12 20l-7.5-7.4A4.5 4.5 0 1 1 12 6.1a4.5 4.5 0 1 1 7.5 6.5z" /></svg>;
    case "inbox":
      return <svg {...s} viewBox="0 0 24 24"><path d="M4 13h4l2 3h4l2-3h4v6H4z" /><path d="M4 13V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7" /></svg>;
    case "flame":
      return <svg {...s} viewBox="0 0 24 24"><path d="M12 3c2 4-2 5-1 9 3-1 6-4 6-8 3 3 4 7 2 11a7 7 0 1 1-13-1c1-3 3-5 6-11z" /></svg>;
    case "list":
      return <svg {...s} viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
    case "circle-check":
      return <svg {...s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>;
    case "calendar-clock":
      return <svg {...s} viewBox="0 0 24 24"><path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="M15 15.5V14l1-.5" /><circle cx="15" cy="16" r="3" /></svg>;
    case "bell":
      return <svg {...s} viewBox="0 0 24 24"><path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>;
    case "footprints":
      return <svg {...s} viewBox="0 0 24 24"><path d="M8 4c1.5 0 2.5 1.2 2.5 2.7S8.8 10 7.5 10 5 8.6 5 7.1 6.5 4 8 4z" /><path d="M16 10c1.5 0 2.5 1.2 2.5 2.7S16.8 16 15.5 16 13 14.6 13 13.1 14.5 10 16 10z" /></svg>;
    case "repeat":
      return <svg {...s} viewBox="0 0 24 24"><path d="M17 2v4h-4" /><path d="M7 22v-4h4" /><path d="M7 8a7 7 0 0 1 10-1l3 3" /><path d="M17 16a7 7 0 0 1-10 1l-3-3" /></svg>;
    case "calendar-check":
      return <svg {...s} viewBox="0 0 24 24"><path d="M8 3v3M16 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /><path d="m9 15 2 2 4-4" /></svg>;
    case "user-check":
      return <svg {...s} viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3 2.8-5 6-5s5.4 2 6 5" /><path d="m16 11 2 2 4-4" /></svg>;
    case "lock":
      return <svg {...s} viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
    case "shield":
      return <svg {...s} viewBox="0 0 24 24"><path d="M12 3 5 6v6c0 5 3.2 8.4 7 9.5 3.8-1.1 7-4.5 7-9.5V6z" /><path d="m9 12 2 2 4-4" /></svg>;
    default:
      return null;
  }
}

function LandingHead() {
  return (
    <>
      <Seo
        title="FamilyPause — Plan your week. Make time for each other."
        description="A 20-minute weekly sit-down for married couples, plus reminders and check-ins that keep date night on the calendar."
        canonical="https://www.familypause.com/"
      />
      <Helmet>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Helmet>
    </>
  );
}

export default function Landing({ onSignIn = () => {}, onStart = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [cardFlip, setCardFlip] = useState(false);
  const [cardTag, setCardTag] = useState(CARD_TAGS[0]);
  const [checkin, setCheckin] = useState("ask");
  const [howTab, setHowTab] = useState(0);
  const [annual, setAnnual] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState("idle");
  const [leadError, setLeadError] = useState("");

  useEffect(() => {
    document.body.classList.add("fp-home2-page");
    return () => document.body.classList.remove("fp-home2-page");
  }, []);

  useEffect(() => {
    const id = (location.hash || "").replace(/^#/, "");
    if (!id) return undefined;
    let cancelled = false;
    const run = () => { if (!cancelled) scrollToLandingSection(id, { smooth: true }); };
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
    if (location.hash === `#${id}`) {
      scrollToLandingSection(id, { smooth: true });
      return;
    }
    navigate(`/#${id}`);
  };

  const submitGuide = async (event) => {
    event.preventDefault();
    if (leadStatus === "loading") return;
    const email = leadEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setLeadError("Enter a valid email address.");
      return;
    }
    setLeadError("");
    setLeadStatus("loading");
    const result = await requestFamilyPauseGuide({ email });
    if (result.error) {
      setLeadStatus("idle");
      setLeadError(result.error);
      return;
    }
    setLeadStatus("success");
  };

  return (
    <div className="fp-home2">
      <LandingHead />

      <nav className="top">
        <div className="wrap">
          <a href="/" className="logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <FpLogo />
          </a>
          <div className="nav-l">
            <a href="#how" onClick={goToSection("how")}>How It Works</a>
            <a href="#together" onClick={goToSection("together")}>Time Together</a>
            <a href="#pricing" onClick={goToSection("pricing")}>Pricing</a>
            <a href="#concierge" onClick={goToSection("concierge")}>Concierge</a>
            <Link to="/blog">Blog</Link>
          </div>
          <div className="nav-r">
            <AuthHeaderCta onSignIn={onSignIn} className="lk" signInLabel="Log in" />
            <button type="button" className="btn btn-p btn-sm" onClick={onStart}>Start Free</button>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap">
          <h1>Plan your week together. <span>Then actually show up for each other.</span></h1>
          <p className="hero-sub">A 20-minute weekly sit-down for married couples, plus reminders and check-ins that keep date night on the calendar.</p>
          <div className="row">
            <button type="button" className="btn btn-p" onClick={onStart}>Start Free</button>
            <a href="#how" className="btn btn-s" onClick={goToSection("how")}>See How It Works</a>
          </div>
          <div className="row chips">
            <span><span className="chip-ico"><Ico name="check" size={13} /></span>Free to start</span>
            <span><span className="chip-ico"><Ico name="check" size={13} /></span>Built for couples</span>
            <span><span className="chip-ico"><Ico name="check" size={13} /></span>20 minutes a week</span>
          </div>
          <div className="hero-vis">
            <div className="hero-photo">
              <img src="/images/fp-hero.jpg" alt="Couple planning the week together" />
            </div>
            <div className="phone">
              <div className="phone-in">
                <div className="notch" />
                <div className="ps">
                  <div className="ps-top">
                    <h4>This week</h4>
                    <span className="dots">
                      <span className="dot d-blue">S</span>
                      <span className="dot d-violet">A</span>
                    </span>
                  </div>
                  <div className="wk">Oct 26 – Nov 1 · 9 items</div>
                  <div className="day">MONDAY</div>
                  <div className="it"><span className="dot d-amber" /><span className="t">Ella dentist<br /><small>3:30 pm · Spence drives</small></span></div>
                  <div className="day">WEDNESDAY</div>
                  <div className="it"><span className="dot d-coral" /><span className="t">Noah co-op project due</span></div>
                  <div className="it"><span className="dot d-violet" /><span className="t">Pay water bill</span></div>
                  <div className="day">FRIDAY</div>
                  <div className="it tt"><Ico name="heart" size={16} /><span className="t">Date night<br /><small>7:00 pm · Luigi&apos;s</small></span></div>
                  <div className="day">SUNDAY</div>
                  <div className="it"><span className="dot d-blue" /><span className="t">Weekly Pause<br /><small>8:00 pm · Living room</small></span></div>
                </div>
              </div>
            </div>
            <div className="float f-streak">
              <div className="ic"><Ico name="flame" /></div>
              <div><b>12 week streak</b><small>Every Sunday since August</small></div>
            </div>
            <div className="float f-date">
              <div className="ic"><Ico name="heart" /></div>
              <div><b>Date night, Fri 7pm</b><small>Luigi&apos;s · Sitter confirmed</small></div>
            </div>
          </div>
        </div>
      </header>

      <div className="benefits">
        <div className="wrap grid">
          <div className="ben"><div className="ic"><Ico name="clock" /></div><div><h3>20 minutes a week</h3><p>One sit-down replaces a week of scattered texts.</p></div></div>
          <div className="ben"><div className="ic"><Ico name="users" /></div><div><h3>Plan together</h3><p>One shared plan, so nobody carries it alone.</p></div></div>
          <div className="ben"><div className="ic"><Ico name="heart" /></div><div><h3>Make time for each other</h3><p>Date nights and walks go on the calendar.</p></div></div>
          <div className="ben"><div className="ic"><Ico name="inbox" /></div><div><h3>Nothing gets lost</h3><p>Every decision from the talk lands in your plan.</p></div></div>
        </div>
      </div>

      <section>
        <div className="wrap">
          <div className="sh"><span className="label">Everything in one weekly ritual</span><h2>Talk once. Know the whole week.</h2></div>
          <div className="bento">
            <div className="tile s7">
              <span className="label">Conversation Cards</span>
              <h3>Pull a card. Start the right talk.</h3>
              <p>One question each week gets you past logistics and into what matters.</p>
              <div className="cc-tags">
                {CARD_TAGS.map((tag) => (
                  <button
                    type="button"
                    key={tag.t}
                    className={"tag" + (cardTag.t === tag.t ? " on" : "")}
                    onClick={() => { setCardTag(tag); setCardFlip(false); }}
                  >
                    {tag.t}
                  </button>
                ))}
              </div>
              <div className="vis">
                <div className={"cc-wrap" + (cardFlip ? " flip" : "")} onClick={() => setCardFlip((v) => !v)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCardFlip((v) => !v); } }}>
                  <div className="cc-back" />
                  <div className="cc">
                    <div className="cc-f cc-front">
                      <span className={"tag " + cardTag.cls} style={{ alignSelf: "flex-start" }}>{cardTag.t}</span>
                      <div className="q">{cardTag.q}</div>
                      <div className="ft"><span>Card 14 of 52</span><span>Tap to flip</span></div>
                    </div>
                    <div className="cc-f cc-cover">
                      <span className="logo"><FpLogo white /></span>
                      <span style={{ fontWeight: 600 }}>Conversation Card</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="tile s5">
              <span className="label">Capture</span>
              <h3>Just talk. We&apos;ll take notes.</h3>
              <p>Record your talk. FamilyPause pulls out who&apos;s doing what.</p>
              <div className="vis">
                <div className="card tr">
                  <div className="tr-h"><span className="rec" /><b>Sunday Pause</b><span style={{ color: "var(--ink-2)" }}>14:32</span></div>
                  <div className="ln"><span className="sp"><span className="dot d-blue" />Spence</span><p>Ella&apos;s dentist moved to <mark>Monday at 3:30</mark>. I&apos;ll take her.</p></div>
                  <div className="ln"><span className="sp"><span className="dot d-violet" />Amanda</span><p>Then I&apos;ll <mark>pay the water bill</mark> by Wednesday.</p></div>
                  <div className="ln"><span className="sp"><span className="dot d-blue" />Spence</span><p><mark>Date night Friday</mark>. Luigi&apos;s again?</p></div>
                  <div className="tr-x"><Ico name="list" size={16} />3 items added to your plan</div>
                </div>
              </div>
            </div>

            <div className="tile s5">
              <span className="label">Your weekly plan</span>
              <h3>One plan you both trust.</h3>
              <p>Sorted, assigned, and flagged if it still needs a time.</p>
              <div className="vis">
                <div className="stack">
                  <div className="card pi"><div className="bd"><b>Ella dentist, Mon 3:30 pm</b><div className="meta"><span className="tag t-appt">Appointment</span><span className="st st-ready"><Ico name="circle-check" size={14} />Ready</span></div></div><span className="dots"><span className="dot d-blue">S</span><span className="dot d-amber">E</span></span></div>
                  <div className="card pi"><div className="bd"><b>Pay water bill</b><div className="meta"><span className="tag t-todo">To-do</span><span className="st st-ready"><Ico name="circle-check" size={14} />Ready</span></div></div><span className="dots"><span className="dot d-violet">A</span></span></div>
                  <div className="card pi"><div className="bd"><b>Noah&apos;s swim lessons: keep going?</b><div className="meta"><span className="tag t-dec">Decision</span><span className="st st-need"><Ico name="calendar-clock" size={14} />Needs a date</span></div></div><span className="dots"><span className="dot d-blue">S</span><span className="dot d-violet">A</span></span></div>
                  <div className="card pi"><div className="bd"><b>Grandma visits Nov 14</b><div className="meta"><span className="tag t-note">Note</span></div></div></div>
                </div>
              </div>
            </div>

            <div className="tile s7" id="together">
              <span className="label">Time Together</span>
              <h3>Protect the time that&apos;s just for you two.</h3>
              <p>Pick your thing. It goes on the calendar, with a reminder and a check-in the day of.</p>
              <div className="vis">
                <div className="stack" style={{ maxWidth: 440 }}>
                  <div className="card tt-main"><div className="ic"><Ico name="heart" /></div><div><b>Date night, Fri 7pm</b><small>Luigi&apos;s · Table for two · Sitter confirmed</small></div></div>
                  <div className="card chk">
                    {checkin === "ask" ? (
                      <>
                        <div className="q"><Ico name="bell" size={18} />Still on for tonight?</div>
                        <div className="row">
                          <button type="button" className="btn btn-p btn-sm" onClick={() => setCheckin("yes")}>Yes</button>
                          <button type="button" className="btn btn-s btn-sm" onClick={() => setCheckin("re")}>Reschedule</button>
                        </div>
                      </>
                    ) : checkin === "yes" ? (
                      <div className="q"><Ico name="circle-check" size={18} />Confirmed. See you at 7.</div>
                    ) : (
                      <div className="q"><Ico name="calendar-clock" size={18} />Moved to Saturday, 7:00 pm</div>
                    )}
                  </div>
                  <div className="card rec-it"><div className="ic"><Ico name="footprints" /></div><div style={{ flex: 1 }}>Thursday walk after dinner<small>Every Thursday · 7:30 pm</small></div><Ico name="repeat" size={20} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mint" id="how">
        <div className="wrap">
          <div className="sh"><span className="label">How It Works</span><h2>Four steps, every week.</h2></div>
          <div className="how">
            <div className="how-tabs">
              {HOW_TABS.map((tab, i) => (
                <button key={tab.title} type="button" className={"how-tab" + (howTab === i ? " on" : "")} onClick={() => setHowTab(i)}>
                  <span className="n">{i + 1}</span>
                  <span><b>{tab.title}</b><p>{tab.body}</p></span>
                </button>
              ))}
            </div>
            <div className="how-vis">
              <div className={"how-p" + (howTab === 0 ? " on" : "")}>
                <div className="card inv">
                  <div className="inv-h"><div className="ic"><Ico name="calendar-check" /></div><div><b>Weekly Pause</b><small>Sundays · 8:00 pm · 20 min</small></div></div>
                  <div className="inv-p"><span style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="dot d-blue" />Spence</span><span className="ok"><Ico name="check" size={16} />Accepted</span></div>
                  <div className="inv-p"><span style={{ display: "flex", gap: 10, alignItems: "center" }}><span className="dot d-violet" />Amanda</span><span className="ok"><Ico name="check" size={16} />Accepted</span></div>
                </div>
              </div>
              <div className={"how-p" + (howTab === 1 ? " on" : "")}>
                <div className="card tr">
                  <div className="tr-h"><span className="rec" /><b>Recording</b><span style={{ color: "var(--ink-2)" }}>06:12</span></div>
                  <div className="ln"><span className="sp"><span className="dot d-violet" />Amanda</span><p>Card says: when did we feel most like a team?</p></div>
                  <div className="ln"><span className="sp"><span className="dot d-blue" />Spence</span><p>Honestly, Saturday morning with the garage.</p></div>
                </div>
              </div>
              <div className={"how-p" + (howTab === 2 ? " on" : "")}>
                <div className="stack">
                  <div className="card pi"><div className="bd"><b>Ella dentist, Mon 3:30 pm</b><div className="meta"><span className="tag t-appt">Appointment</span><span className="st st-ready"><Ico name="circle-check" size={14} />Ready</span></div></div><span className="dots"><span className="dot d-blue">S</span></span></div>
                  <div className="card pi"><div className="bd"><b>Noah&apos;s swim lessons: keep going?</b><div className="meta"><span className="tag t-dec">Decision</span><span className="st st-need"><Ico name="calendar-clock" size={14} />Needs a date</span></div></div><span className="dots"><span className="dot d-blue">S</span><span className="dot d-violet">A</span></span></div>
                </div>
              </div>
              <div className={"how-p" + (howTab === 3 ? " on" : "")}>
                <div className="stack">
                  <div className="card tt-main"><div className="ic"><Ico name="heart" /></div><div><b>Date night, Fri 7pm</b><small>Luigi&apos;s · Reminder Fri at 5:00 pm</small></div></div>
                  <div className="card rec-it"><div className="ic"><Ico name="footprints" /></div><div style={{ flex: 1 }}>Thursday walk after dinner<small>Every Thursday · 7:30 pm</small></div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="conc" id="concierge">
        <div className="wrap">
          <div>
            <span className="badge-sun"><Ico name="user-check" size={16} />A real person, every week</span>
            <h2 style={{ marginTop: 24 }}>Never be the one who has to bring it up.</h2>
            <p className="lead-p">Your Concierge emails you both, finds a time, handles the back-and-forth, and locks it in.</p>
            <ul>
              <li><Ico name="circle-check" size={20} />Schedules your Pause and date night weekly</li>
              <li><Ico name="circle-check" size={20} />Books reservations and reminds the sitter</li>
              <li><Ico name="circle-check" size={20} />Works over email. No app needed for your spouse</li>
            </ul>
            <a href="#pricing" className="btn btn-p" onClick={goToSection("pricing")}>Add Concierge</a>
          </div>
          <div className="em-thread">
            <div className="card em">
              <div className="em-h"><div className="av" style={{ background: "var(--em)" }}>M</div><div><b>Megan at FamilyPause</b><small>to Spence, Amanda</small></div><span className="tm">Mon 9:02 am</span></div>
              <p>Hi Spence and Amanda, here are three times for this week&apos;s Pause. Reply with the one that works.</p>
              <div className="opts"><span className="pick">Sun 8:00 pm</span><span>Mon 8:30 pm</span><span>Tue 7:45 pm</span></div>
            </div>
            <div className="card em re">
              <div className="em-h" style={{ marginBottom: 4 }}><div className="av" style={{ background: "var(--blue)" }}>S</div><div><b>Spence</b></div><span className="tm">9:14 am</span></div>
              <p>Sunday works for me.</p>
            </div>
            <div className="card em re">
              <div className="em-h" style={{ marginBottom: 4 }}><div className="av" style={{ background: "var(--violet)" }}>A</div><div><b>Amanda</b></div><span className="tm">10:41 am</span></div>
              <p>Sunday for me too.</p>
            </div>
            <div className="card locked"><div className="ic"><Ico name="lock" /></div><div><b>Locked in</b><small>Sunday, Nov 1 · 8:00 pm · On both calendars</small></div></div>
            <div className="card mini"><div className="ic" style={{ background: "var(--sun)", color: "var(--ink)" }}><Ico name="heart" /></div><div><b>Date night confirmed</b><small>Fri 7:00 pm · Luigi&apos;s</small></div></div>
          </div>
        </div>
      </section>

      <section className="testi">
        <div className="wrap">
          <div className="testi-av">
            <img src="/images/fp-final-cta.png" alt="Spence, founder of FamilyPause" />
            <span className="badge-sun"><Ico name="flame" size={14} />12 weeks in a row</span>
          </div>
          <blockquote>We used to plan our week in the car and in text threads at 11pm. Now it&apos;s twenty minutes on Sunday, and Friday nights are ours again.</blockquote>
          <p className="who"><b>Spence</b> · Founder and First User</p>
        </div>
      </section>

      <section className="mint">
        <div className="wrap">
          <div className="sh"><span className="label">Who it&apos;s for</span><h2>Made for households with a lot going on.</h2></div>
          <div className="for-row">
            {FOR_CARDS.map((card) => (
              <div className="card for" key={card.title}>
                <div className="ph"><img src={card.img} alt="" /></div>
                <div className="bd"><h3>{card.title}</h3><p>{card.body}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing">
        <div className="wrap">
          <div className="price-h">
            <div className="sh"><span className="label">Pricing</span><h2>Start free. Upgrade when you&apos;re ready.</h2></div>
            <div className="toggle">
              <button type="button" className={annual ? "" : "on"} onClick={() => setAnnual(false)}>Monthly</button>
              <button type="button" className={annual ? "on" : ""} onClick={() => setAnnual(true)}>Annual <span className="save">Save 27%</span></button>
            </div>
          </div>
          <div className="price-grid">
            <div className="card pc">
              <div className="top"><h3>Free</h3></div>
              <div className="pr"><b>$0</b><span>forever</span></div>
              <p className="desc">Everything you need to try your first weekly Pause.</p>
              <ul>
                <li><Ico name="check" size={18} />One plan per week</li>
                <li><Ico name="check" size={18} />Weekly Conversation Card</li>
                <li><Ico name="check" size={18} />Shared plan for two</li>
              </ul>
              <button type="button" className="btn btn-s btn-block" onClick={onStart}>Start Free</button>
            </div>
            <div className="card pc pop">
              <div className="top"><h3>Family Plan</h3><span className="badge-sun">Most Popular</span></div>
              <div className="pr"><b>{annual ? "$79" : "$9"}</b><span>{annual ? "/year" : "/month"}</span></div>
              <p className="desc">The full weekly ritual, plus time together that actually happens.</p>
              <ul>
                <li><Ico name="check" size={18} />Unlimited plans and captures</li>
                <li><Ico name="check" size={18} />Full Conversation Card library</li>
                <li><Ico name="check" size={18} />Time Together reminders and check-ins</li>
                <li><Ico name="check" size={18} />Calendar sync and spouse emails</li>
              </ul>
              <button type="button" className="btn btn-p btn-block" onClick={onStart}>Start Free Trial</button>
              <p className="note">{annual ? "Billed yearly. About $6.58 a month." : "Billed monthly. Cancel anytime."}</p>
            </div>
            <div className="card pc">
              <div className="top"><h3>Family Plan + Concierge</h3></div>
              <div className="pr"><b>$38</b><span>/month</span></div>
              <p className="desc">A real person locks in your weekly Pause and time together.</p>
              <ul>
                <li><Ico name="check" size={18} />Everything in Family Plan</li>
                <li><Ico name="check" size={18} />Weekly scheduling by email</li>
                <li><Ico name="check" size={18} />Date night reservations</li>
                <li><Ico name="check" size={18} />Sitter and reminder handling</li>
              </ul>
              <a href="#pricing" className="btn btn-s btn-block" onClick={goToSection("pricing")}>Add Concierge</a>
            </div>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 0 }} id="shop">
        <div className="wrap">
          <div className="price-h" style={{ marginBottom: 40 }}>
            <div className="sh"><span className="label">Shop</span><h2>Bring the Pause to the table.</h2></div>
            <a href="#shop" className="btn btn-s" onClick={goToSection("shop")}>Visit the shop</a>
          </div>
          <div className="shop">
            {SHOP.map((item) => (
              <div className="prod" key={item.title}>
                <div className="ph" aria-hidden="true" />
                <div className="meta">
                  <h3>{item.title}</h3>
                  <span className="p">Coming soon</span>
                </div>
              </div>
            ))}
          </div>

          <div className="lead" style={{ marginTop: 120 }}>
            <div>
              <h2>Get Free FamilyPause Guide</h2>
              <p>A simple but effective weekly planning system for families with too much going on.</p>
              <form onSubmit={submitGuide}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  autoComplete="email"
                />
                <button className="btn btn-p" type="submit" disabled={leadStatus === "loading"}>
                  {leadStatus === "loading" ? "Sending…" : "Send Me the Guide"}
                </button>
              </form>
              {leadError ? <p className="err">{leadError}</p> : null}
              <p className={"ok" + (leadStatus === "success" ? " on" : "")}>Check your inbox. The guide is on its way.</p>
            </div>
            <div className="pdf">
              <img className="pdf-cover" src="/images/familypause-guide-cover.jpg" alt="The FamilyPause Guide" />
            </div>
          </div>
        </div>
      </section>

      <div className="cta" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-box">
            <h2>Your first Pause is this week.</h2>
            <p>Twenty minutes. One plan. More time for each other.</p>
            <button type="button" className="btn btn-w" onClick={onStart}>Start Free</button>
          </div>
        </div>
      </div>

      <footer>
        <div className="wrap">
          <div className="ft-grid">
            <div className="ft-brand">
              <a href="/" className="logo" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <FpLogo />
              </a>
              <p>A weekly planning ritual for married couples.</p>
            </div>
            <div>
              <h5>How FamilyPause Helps</h5>
              <ul>
                <li><a href="#how" onClick={goToSection("how")}>Plan the week</a></li>
                <li><a href="#together" onClick={goToSection("together")}>Time together</a></li>
                <li><Link to="/cards">Conversation Cards</Link></li>
                <li><a href="#concierge" onClick={goToSection("concierge")}>Concierge</a></li>
              </ul>
            </div>
            <div>
              <h5>Product</h5>
              <ul>
                <li><a href="#how" onClick={goToSection("how")}>How It Works</a></li>
                <li><a href="#pricing" onClick={goToSection("pricing")}>Pricing</a></li>
                <li><a href="#shop" onClick={goToSection("shop")}>Shop</a></li>
                <li><a href="#shop" onClick={goToSection("shop")}>Free Guide</a></li>
              </ul>
            </div>
            <div>
              <h5>Company</h5>
              <ul>
                <li><Link to="/contact">About</Link></li>
                <li><Link to="/contact">Gift FamilyPause</Link></li>
                <li><Link to="/contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h5>Help</h5>
              <ul>
                <li><Link to="/contact">FAQ</Link></li>
                <li><a href="/privacy.html">Privacy</a></li>
                <li><a href="/terms.html">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="ft-b">
            <span>FamilyPause is a product of Christian App Empire LLC.</span>
            <span><Ico name="shield" size={16} />Ad-free. We never sell your family&apos;s information.</span>
          </div>
        </div>
      </footer>

      <ExitIntentModal onStarted={onStart} />
    </div>
  );
}
