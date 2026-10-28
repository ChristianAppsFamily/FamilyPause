// Prototype homepage — ported from FamilyPause_ProtoType as React, with real routes.
// Styles: src/styles/site.css (scoped .fp-site).

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ExitIntentModal from "./ExitIntentModal.jsx";
import { FpMark, SiteFooter, SiteNav } from "./SiteChrome.jsx";
import Seo from "./Seo.jsx";
import { isValidEmail, requestFamilyPauseGuide } from "../lib/sendGuide";
import "../styles/site.css";

const LANDING_SECTION_IDS = new Set([
  "how-it-works",
  "conversation-cards",
  "concierge",
  "pricing",
  "shop",
  "guide",
  "for-you",
]);

const QUESTIONS = {
  Kids: [
    ["What would make this week feel lighter for you?", "What is one thing we can take off each other’s plate?"],
    ["What does each of our kids need a little more of this week?", "Choose one small moment to give them your full attention."],
    ["Where could we make a little more room for fun?", "Pick something simple enough to actually happen."],
  ],
  Finances: [
    ["Is there anything coming up that we should plan for together?", "Name the expense, choose a next step, and decide who owns it."],
    ["What money decision have we been putting off?", "What would help us talk about it with less pressure?"],
    ["What small change would make our budget feel easier?", "Agree on one thing to try for the week."],
  ],
  Marriage: [
    ["When did you feel most like a team this week?", "What can we repeat in the week ahead?"],
    ["What is one way I can show up for you this week?", "Make it small, specific, and easy to say yes to."],
    ["What would a good moment for just us look like?", "Give it a time and protect it together."],
  ],
  Faith: [
    ["Where did you notice something to be grateful for this week?", "Share one moment you want to remember."],
    ["What could we pray about together this week?", "Make space to listen before you make a plan."],
    ["How can we live our values in a small way this week?", "Choose one thoughtful action to take together."],
  ],
};

const CATEGORIES = Object.keys(QUESTIONS);

const TASKS = [
  { id: "dentist", type: "Appointment", title: "Take Jordan to the dentist", date: "2026-11-05", time: "15:00", owner: "Amanda" },
  { id: "form", type: "To-do", title: "Sign the field trip form", date: "", time: "", owner: "Spence" },
  { id: "date", type: "Decision", title: "Friday is our date night", date: "2026-11-06", time: "19:00", owner: "Both" },
  { id: "trip", type: "Note", title: "Ask about the school trip", date: "", time: "", owner: "Both" },
  { id: "groceries", type: "To-do", title: "Order the groceries", date: "2026-11-04", time: "17:00", owner: "Spence", done: true },
];

const PAUSE_LABEL = { "Tue 8pm": "Tuesday at 8", "Thu 8pm": "Thursday at 8", "Sat 9am": "Saturday at 9" };
const PAUSE_TIMES = ["Tue 8pm", "Thu 8pm", "Sat 9am"];
const HOW_TABS = ["Lock the Pause", "Start the Pause", "Build the Plan", "Live the Week"];
const HOW_STEPS = [
  [
    ["Choose a time you can protect", "Pick a moment when you can both be present."],
    ["Make it a weekly rhythm", "A little consistency goes a long way."],
    ["Let us take care of the nudge", "An invitation and a reminder for you both."],
  ],
  [
    ["Start with a good question", "Make space for what is on each other’s mind."],
    ["Talk about your real week", "Kids, plans, money, and the things in between."],
    ["Be present with each other", "Your conversation can become your shared plan."],
  ],
  [
    ["Review what came up", "We organize your conversation into a draft plan."],
    ["Choose dates and owners", "Share the work in a way that feels fair."],
    ["Approve your shared plan", "Nothing reaches your calendar until you say so."],
  ],
  [
    ["See the same week", "One plan, wherever life takes you both."],
    ["Check things off together", "Share the follow-through, not just the planning."],
    ["Make room to come back", "Your next Pause is already waiting for you."],
  ],
];

const PRODUCTS = [
  { id: "deck", name: "Conversation Starter Card Deck", price: 29, type: "deck" },
  { id: "journal", name: "Guided Journal", price: 24, type: "journal" },
  { id: "pad", name: "Weekly Planner Pad", price: 18, type: "pad" },
  { id: "bundle", name: "The FamilyPause Bundle", price: 59, type: "bundle" },
];

const WHO = [
  ["heart", "Married couples", "Stay on the same page, and close to each other."],
  ["baby", "Busy parents", "Keep your family organized without the mental load."],
  ["home", "Families who pause together", "Build stronger rhythms, as a family."],
  ["briefcase", "Entrepreneur households", "Make room for work, and what matters most."],
  ["book", "Homeschool families", "Plan with intention. Leave space for life."],
];

const ICONS = {
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  check: <path d="m5 12 4 4L20 5" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  users: <><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-3a7 7 0 0 1 14 0v3M17 4a3 3 0 0 1 0 6m1 4a6 6 0 0 1 4 5v2" /></>,
  heart: <path d="M20.5 5.5a5.2 5.2 0 0 0-7.3 0L12 6.7l-1.2-1.2a5.2 5.2 0 0 0-7.3 7.3L12 21l8.5-8.2a5.2 5.2 0 0 0 0-7.3Z" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 10h18m-14 4h3m4 0h3m-10 3h3" /></>,
  list: <><rect x="4" y="3" width="16" height="19" rx="3" /><path d="m8 8 1 1 2-2m2 1h3m-8 6h8m-8 4h5" /></>,
  message: <><path d="M21 11a9 9 0 0 1-9 9H4l-2 2V11a9 9 0 0 1 19 0Z" /><path d="M7 9h10m-10 4h6" /></>,
  flip: <path d="M4 8h12l-4-4m4 4-4 4M20 16H8l4-4m-4 4 4 4" />,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></>,
  spark: <path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6ZM20 2v4m-2-2h4" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m3 6 9 7 9-7" /></>,
  flame: <path d="M12 2c1 6 7 7 7 13a7 7 0 1 1-14 0c0-3 2-6 4-8-1 5 2 6 3 7 2-3 2-7 0-12Z" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6Z" /><path d="m8 12 3 3 5-6" /></>,
  play: <path d="m8 5 11 7-11 7Z" />,
  baby: <><path d="M9 4a3 3 0 0 1 6 0M4 9a9 9 0 1 1 0 8 3 3 0 0 1 0-8Z" /><path d="M9 12h.01M15 12h.01m-6 4q3 3 6 0" /></>,
  book: <path d="M12 5v16M12 5C8 2 4 3 2 4v16c3-1 6-1 10 1 4-2 7-2 10-1V4c-2-1-6-2-10 1Z" />,
  home: <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="3" /><path d="M8 7V4h8v3M3 12c6 4 12 4 18 0M10 13h4" /></>,
};

function Ic({ name, className = "" }) {
  return (
    <svg className={`icon ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

function ownerColor(owner) {
  return ({ Spence: "blue", Amanda: "coral", Jordan: "amber", Nora: "violet", Both: "" })[owner] || "";
}

function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h >= 12 ? "pm" : "am"}`;
}

function shortDate(task) {
  if (!task.date) return "Needs a date";
  const d = new Date(`${task.date}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(d)
    + (task.time ? ` · ${formatTime(task.time)}` : "");
}

function scrollToLandingSection(id, { smooth = true } = {}) {
  if (!id || !LANDING_SECTION_IDS.has(id)) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  return true;
}

function MiniWeek() {
  return (
    <div className="mini-week">
      {[["Mon", 2], ["Tue", 3], ["Wed", 4], ["Thu", 5], ["Fri", 6], ["Sat", 7], ["Sun", 8]].map(([d, n]) => (
        <span key={d} className={n === 5 ? "current" : ""}>
          {d}<b>{n}</b><i style={![4, 5, 6].includes(n) ? { visibility: "hidden" } : undefined} />
        </span>
      ))}
    </div>
  );
}

function StoreBadges() {
  return (
    <div className="store-badges">
      <Link to="/mobile" className="store-badge" aria-label="FamilyPause on the App Store">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17 12c0-2 1.6-3 2-3.3-1.1-1.5-2.7-1.7-3.3-1.7-1.4-.2-2.7.8-3.5.8s-1.9-.8-3.1-.7C7.5 7.1 6 8 5.2 9.4c-1.7 3 .1 7.4 1.8 9.8.8 1.2 1.7 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8 2.1-1.2 2.9-2.4a10 10 0 0 0 1.3-2.7c-.1 0-3.6-1.3-3.6-4.5ZM14.8 5.4a4.7 4.7 0 0 0 1.1-3.3 4.8 4.8 0 0 0-3.1 1.6 4.4 4.4 0 0 0-1.1 3.2c1.2.1 2.3-.5 3.1-1.5Z" />
        </svg>
        <span><small>Download on the</small><strong>App Store</strong></span>
      </Link>
      <Link to="/mobile" className="store-badge" aria-label="FamilyPause on Google Play">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 2v20l11-10Z" />
          <path d="m5 2 11 8 4-2Z" />
          <path d="M16 14 5 22l15-8Z" />
          <path d="m17 11 4 1-4 1Z" />
        </svg>
        <span><small>GET IT ON</small><strong>Google Play</strong></span>
      </Link>
    </div>
  );
}

function ProductArt({ type }) {
  if (type === "pad") {
    return (
      <div className="planner-pad">
        <strong>FamilyPause · Our week, together</strong>
        <div className="paper-grid"><i /><i /><i /><i /></div>
      </div>
    );
  }
  if (type === "bundle") {
    return (
      <div className="bundle-art">
        <ProductArt type="journal" />
        <ProductArt type="pad" />
        <ProductArt type="deck" />
      </div>
    );
  }
  return (
    <div className={`book${type === "deck" ? " deck" : ""}`}>
      <span className="mini-logo">FamilyPause</span>
      {type !== "deck" && <span className="mini-pause"><i /><i /></span>}
      <strong>{type === "deck" ? <>Conversation<br />Starters</> : <>A calmer week,<br />together.</>}</strong>
      <small>{type === "deck" ? "One conversation at a time." : "The FamilyPause guided journal"}</small>
    </div>
  );
}

function PlanCard({ task }) {
  const tone = task.type === "To-do" ? "sun-soft" : task.type === "Decision" ? "blue" : task.type === "Note" ? "violet" : "";
  return (
    <article className="plan-item">
      <i className={`dot ${ownerColor(task.owner)}`} />
      <div className="plan-item-main">
        <div className="plan-item-top">
          <h4>{task.title}</h4>
          <span className={`pill ${tone}`}>{task.type}</span>
        </div>
        <p>{task.date ? shortDate(task) : "No date yet"} &nbsp; {task.owner}</p>
        <span className={`plan-item-status${task.date ? "" : " needs-date"}`}>
          <Ic name={task.date ? "check" : "clock"} />
          {task.date ? "Ready for calendar" : "Needs a date"}
        </span>
      </div>
    </article>
  );
}

function PlanStack() {
  return (
    <div className="plan-stack">
      {TASKS.slice(0, 4).map((task) => <PlanCard key={task.id} task={task} />)}
    </div>
  );
}

function TranscriptDemo({ played, onToggle }) {
  return (
    <div className="transcript-card card">
      <div className="ui-card-title">
        <span className="row"><Ic name="mic" />Live transcript</span>
        <span className="recording-label"><i className="dot" />Sample Pause</span>
      </div>
      <div className="transcript-line">
        <span className="tiny-avatar blue">S</span>
        <div>
          <strong>Spence <time>00:12</time></strong>
          <p>I can take Jordan to the <mark>dentist on Thursday.</mark></p>
        </div>
      </div>
      <div className="transcript-line">
        <span className="tiny-avatar coral">A</span>
        <div>
          <strong>Amanda <time>00:20</time></strong>
          <p>Perfect. Let’s make <mark>Friday a date night.</mark></p>
        </div>
      </div>
      {played && (
        <div className="transcript-line">
          <span className="tiny-avatar blue">S</span>
          <div>
            <strong>Spence <time>00:27</time></strong>
            <p>I’ll sign the field trip form, too.</p>
          </div>
        </div>
      )}
      <div className="transcript-summary">
        <Ic name="check" />Captured for your plan
        <button type="button" className="btn link" style={{ fontSize: 8, marginLeft: "auto" }} onClick={onToggle}>
          {played ? "Replay" : "Play sample"}
        </button>
      </div>
    </div>
  );
}

function ChecklistDemo({ doneIds, onToggle }) {
  return (
    <div className="checklist-card card">
      <div className="ui-card-title">
        <span>Our week</span>
        <span className="small muted" style={{ fontSize: 9 }}>Nov 2–8</span>
      </div>
      <MiniWeek />
      {["dentist", "date", "groceries"].map((id) => {
        const task = TASKS.find((item) => item.id === id);
        const done = doneIds.has(id);
        return (
          <button
            key={id}
            type="button"
            className="checklist-row"
            style={{ width: "100%", padding: 0 }}
            onClick={() => onToggle(id)}
            aria-pressed={done}
          >
            <span className={`checkmark${done ? " checked" : ""}`}>{done ? <Ic name="check" /> : null}</span>
            <span className={done ? "checked-text" : ""}>{task.title}</span>
            <i className={`dot ${ownerColor(task.owner)}`} />
          </button>
        );
      })}
      <span className="btn primary small block" style={{ fontSize: 10, marginTop: 17 }}>
        Add all to calendar<Ic name="calendar" className="sm" />
      </span>
    </div>
  );
}

function LandingHead() {
  return (
    <Seo
      title="FamilyPause — Plan your week. Make time for each other."
      description="A 20-minute weekly sit-down for married couples, plus reminders and check-ins that keep date night on the calendar."
      canonical="https://www.familypause.com/"
    />
  );
}

export default function Landing({ onSignIn = () => {}, onStart = () => {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [category, setCategory] = useState("Kids");
  const [question, setQuestion] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [transcriptPlayed, setTranscriptPlayed] = useState(false);
  const [doneIds, setDoneIds] = useState(() => new Set(["groceries"]));
  const [howTab, setHowTab] = useState(0);
  const [pauseTime, setPauseTime] = useState("Thu 8pm");
  const [annual, setAnnual] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadStatus, setLeadStatus] = useState("idle");
  const [leadError, setLeadError] = useState("");

  useEffect(() => {
    document.body.classList.add("fp-site-page");
    return () => document.body.classList.remove("fp-site-page");
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

  const scrollOrNavigate = (id) => {
    if (location.hash === `#${id}`) {
      scrollToLandingSection(id, { smooth: true });
      return;
    }
    navigate(`/#${id}`);
  };
  const goToSection = (id) => (event) => {
    event.preventDefault();
    scrollOrNavigate(id);
  };
  const scrollHome = () => window.scrollTo({ top: 0, behavior: "smooth" });

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

  const toggleDone = (id) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const prompts = QUESTIONS[category];
  const current = prompts[question % prompts.length];
  const familyAmount = annual ? "$79" : "$9";
  const familyPeriod = annual ? "/year" : "/month";
  const familySub = annual ? "One annual payment. More room for family." : "or $79/year when billed annually";
  const pauseDay = PAUSE_LABEL[pauseTime];

  const onHowKey = (event, index) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = (index + (event.key === "ArrowRight" ? 1 : 3)) % 4;
    setHowTab(next);
    document.getElementById(`step-${next}`)?.focus();
  };

  return (
    <div className="fp-site">
      <LandingHead />
      <SiteNav onSignIn={onSignIn} onStart={onStart} onSection={scrollOrNavigate} onHome={scrollHome} />

      <main id="main">
        <section className="hero" id="home">
          <div className="container hero-inner">
            <div className="hero-copy">
              <div className="eyebrow"><Ic name="spark" className="sm" />The weekly family meeting, made easy</div>
              <h1>Your family’s week,<br /><span className="green">planned together.</span></h1>
              <p>Talk it through for 20 minutes. FamilyPause turns it into a plan you can both see.</p>
              <div className="hero-actions">
                <button type="button" className="btn primary" onClick={onStart}>Start Free<Ic name="arrow" /></button>
                <a className="btn" href="#how-it-works" onClick={goToSection("how-it-works")}>See How It Works</a>
              </div>
              <div className="hero-chips">
                <span><Ic name="check" />Free to start</span>
                <span><Ic name="check" />Built for couples</span>
                <span><Ic name="check" />Nothing reaches your calendar until you approve it</span>
              </div>
              <div className="hero-rating">
                <span>A little more in sync. A lot more us.</span>
              </div>
              <StoreBadges />
            </div>
            <div className="hero-visual">
              <div className="blob green" />
              <div className="blob sun" />
              <div className="blob blue" />
              <img
                className="hero-photo"
                src="/images/fp-couple.jpg"
                alt="A couple planning their week together at a bright kitchen table"
                fetchPriority="high"
              />
              <div className="phone">
                <div className="phone-top"><span>9:41</span><span>▂▄▆ &nbsp; ▰</span></div>
                <div className="phone-brand"><FpMark size={14} />FamilyPause</div>
                <div className="row between" style={{ marginTop: 15 }}>
                  <h3>Our week</h3>
                  <span className="tiny-avatar" style={{ height: 20, width: 20, fontSize: 7 }}>S+A</span>
                </div>
                <p>November 2–8 · Together</p>
                <MiniWeek />
                <p className="phone-progress"><span>3 of 5 ready for the week</span><span>60%</span></p>
                <div className="progress-track"><i /></div>
                {TASKS.slice(0, 3).map((task) => (
                  <div className="phone-task" key={task.id}>
                    <i className={`dot ${ownerColor(task.owner)}`} />
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.date ? shortDate(task) : "Give it a date together"}</span>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn primary block" onClick={onStart}>
                  Make our plan<Ic name="arrow" />
                </button>
                <div className="phone-home" />
              </div>
              <div className="float-card dentist">
                <span className="float-icon"><Ic name="calendar" /></span>
                <div>
                  <strong>Dentist, Thu 3pm</strong>
                  <p>One less thing to remember.</p>
                </div>
              </div>
              <div className="float-card streak">
                <span className="float-icon sun"><Ic name="flame" /></span>
                <div>
                  <strong>12 week streak</strong>
                  <p>You’re building something good.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="benefits" aria-label="Benefits">
          <div className="container benefit-grid">
            {[["clock", "20 minutes a week"], ["users", "Built for busy couples"], ["heart", "Share the load"], ["list", "Nothing gets lost"]].map(([icon, label]) => (
              <div className="benefit" key={label}>
                <span className="benefit-icon"><Ic name={icon} /></span>
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="features container" aria-label="A calmer week, from conversation to plan">
          <div className="feature-row" id="conversation-cards">
            <div className="feature-copy">
              <div className="eyebrow">Conversation starters</div>
              <h2>Start with a real conversation.</h2>
              <p>A good question can get you past the to-do list and back to each other. Make room for the things that don’t always make it into the calendar.</p>
              <a className="text-link" href="#shop" onClick={goToSection("shop")}>Find your next conversation<Ic name="arrow" /></a>
            </div>
            <div className="feature-visual">
              <div className="conversation-demo">
                <div className="feature-categories" aria-label="Conversation categories">
                  {CATEGORIES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`category-tab${category === name ? " active" : ""}`}
                      aria-pressed={category === name}
                      onClick={() => { setCategory(name); setQuestion(0); setFlipped(false); }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={`flip-card${flipped ? " flipped" : ""}`}
                  onClick={() => setFlipped((value) => !value)}
                  aria-label="Flip the conversation card"
                >
                  <div className="flip-inner">
                    <div className="flip-face">
                      <Ic name="message" />
                      <p>{current[0]}</p>
                      <div className="card-foot"><span>{category} · A little room to connect</span><Ic name="flip" /></div>
                    </div>
                    <div className="flip-face back">
                      <Ic name="heart" />
                      <p>{current[1]}</p>
                      <div className="card-foot"><span>Go a little deeper</span><Ic name="flip" /></div>
                    </div>
                  </div>
                </button>
                <div className="question-controls">
                  <span>{(question % prompts.length) + 1} of {prompts.length} sample prompts</span>
                  <button type="button" onClick={() => { setQuestion((n) => n + 1); setFlipped(false); }}>
                    Next conversation<Ic name="arrow" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="feature-row reverse">
            <div className="feature-copy">
              <div className="eyebrow">Capture the important things</div>
              <h2>Be present.<br />We’ll remember.</h2>
              <p>Talk through your week naturally. FamilyPause captures the details, so you can focus on the person across the table.</p>
              <button type="button" className="text-link" onClick={() => setTranscriptPlayed((value) => !value)}>
                Try the sample conversation<Ic name="play" className="sm" />
              </button>
            </div>
            <div className="feature-visual blue-stage">
              <TranscriptDemo played={transcriptPlayed} onToggle={() => setTranscriptPlayed((value) => !value)} />
            </div>
          </div>

          <div className="feature-row">
            <div className="feature-copy">
              <div className="eyebrow">Build the plan</div>
              <h2>Turn good intentions into a shared plan.</h2>
              <p>The appointments, the little jobs, the decisions you made together. Give each one a home, a date, and someone who’s got it.</p>
              <button type="button" className="text-link" onClick={onStart}>
                Explore the weekly plan<Ic name="arrow" />
              </button>
            </div>
            <div className="feature-visual"><PlanStack /></div>
          </div>

          <div className="feature-row reverse">
            <div className="feature-copy">
              <div className="eyebrow">Live the week</div>
              <h2>A plan you can both carry.</h2>
              <p>One shared view of the week. Check things off, make space for what matters, and keep the follow-through from falling to one person.</p>
              <span className="text-link">You’re always in control<Ic name="shield" className="sm" /></span>
            </div>
            <div className="feature-visual white-stage">
              <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <ChecklistDemo doneIds={doneIds} onToggle={toggleDone} />
              </div>
              <div className="reminder-float">
                <div className="row">
                  <span className="float-icon"><Ic name="mail" /></span>
                  <div>
                    <strong>Your week, together</strong>
                    <p style={{ marginTop: 1, fontSize: 6 }}>From FamilyPause</p>
                  </div>
                </div>
                <p>Here’s the plan you made, the moments you protected, and a little nudge to follow through.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section mint" id="how-it-works">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow center">A little rhythm for real life</div>
              <h2>Give us the chaos.<br />Get back a plan, together.</h2>
              <p>No perfect routine required. Just a little time for the week, and for each other.</p>
            </div>
            <div className="timeline-tabs" role="tablist" aria-label="How FamilyPause works">
              {HOW_TABS.map((label, index) => (
                <button
                  key={label}
                  id={`step-${index}`}
                  type="button"
                  role="tab"
                  aria-controls="timeline-panel"
                  aria-selected={howTab === index}
                  tabIndex={howTab === index ? 0 : -1}
                  className={howTab === index ? "active" : ""}
                  onClick={() => setHowTab(index)}
                  onKeyDown={(event) => onHowKey(event, index)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="timeline-panel" id="timeline-panel" role="tabpanel" aria-labelledby={`step-${howTab}`}>
              <div className="timeline-steps">
                {HOW_STEPS[howTab].map(([title, body], index) => (
                  <div className="timeline-step" key={title}>
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="timeline-visual">
                {howTab === 0 && (
                  <div className="lock-demo card">
                    <span className="pill">Your weekly Pause</span>
                    <h3>A little time, just for us.</h3>
                    <p>Choose a time that feels realistic.</p>
                    {PAUSE_TIMES.map((time) => (
                      <button
                        key={time}
                        type="button"
                        className={`lock-choice${pauseTime === time ? " selected" : ""}`}
                        style={{ width: "100%" }}
                        onClick={() => setPauseTime(time)}
                      >
                        <Ic name="calendar" /> {time}
                        <strong>{pauseTime === time ? "Selected" : "Choose"}</strong>
                      </button>
                    ))}
                  </div>
                )}
                {howTab === 1 && <TranscriptDemo played={transcriptPlayed} onToggle={() => setTranscriptPlayed((value) => !value)} />}
                {howTab === 2 && <PlanStack />}
                {howTab === 3 && <ChecklistDemo doneIds={doneIds} onToggle={toggleDone} />}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="concierge">
          <div className="container concierge-grid">
            <div className="concierge-copy">
              <span className="pill sun"><Ic name="users" className="sm" />Real person, every week</span>
              <div className="eyebrow">Your FamilyPause concierge</div>
              <h2>Never be the one who has to bring it up.</h2>
              <p>You shouldn’t have to carry the planning of the planning. A real assistant finds a time that works for both of you, sends the invite, and helps you keep your Pause.</p>
              <button type="button" className="btn primary" onClick={() => navigate("/contact")}>
                Add Concierge<Ic name="arrow" />
              </button>
            </div>
            <div className="concierge-visual">
              <div className="email-card">
                <div className="email-subject">Let’s lock in your Pause</div>
                <div className="email-header">
                  <span className="assistant-avatar"><Ic name="users" /></span>
                  <div>
                    <strong>Your FamilyPause assistant</strong>
                    <span>To: Spence and Amanda</span>
                  </div>
                  <time>MON, 9:00 AM</time>
                </div>
                <p className="email-body">Hi Spence and Amanda,<br />Here are a few times for your weekly Pause. Which one works for you both?</p>
                <div className="time-options" aria-label="Choose your Pause time">
                  {PAUSE_TIMES.map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={`time-option${pauseTime === time ? " active" : ""}`}
                      aria-pressed={pauseTime === time}
                      onClick={() => setPauseTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <div className="email-reply">
                  <span className="tiny-avatar blue">S</span>
                  <div>
                    <strong>Spence</strong>
                    <p><span className="pause-day">{pauseDay}</span> works for me.</p>
                  </div>
                </div>
                <div className="email-reply">
                  <span className="tiny-avatar coral">A</span>
                  <div>
                    <strong>Amanda</strong>
                    <p>Same here. Let’s put it on the calendar.</p>
                  </div>
                </div>
              </div>
              <div className="locked-card">
                <Ic name="check" />
                <div>
                  <strong>Locked in</strong>
                  <p>{pauseDay}{pauseTime.includes("am") ? "am" : "pm"}</p>
                  <small>Your weekly FamilyPause · Both confirmed</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="testimonial-section">
          <div className="container testimonial-grid quote-only">
            <div className="founder-quote">
              <div className="quote-marks">“</div>
              <blockquote>Making the plan wasn’t the hard part. Making the time was. Now we protect twenty minutes, and the whole week feels lighter.</blockquote>
              <div className="row">
                <div className="founder-info">
                  <div className="founder-avatar initial" aria-hidden="true">S</div>
                  <div>
                    <strong>Spence</strong>
                    <span>Founder and First User</span>
                  </div>
                </div>
                <span className="pill sun"><Ic name="flame" className="sm" />12 weeks in a row</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section mint" id="for-you">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow center">Different families. A shared starting point.</div>
              <h2>For the life you’re<br />building together.</h2>
            </div>
            <div className="who-grid">
              {WHO.map(([icon, title, body]) => (
                <article className="who-card" key={title}>
                  <Ic name={icon} />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="container">
            <div className="pricing-head">
              <div>
                <div className="eyebrow">Simple plans for a shared life</div>
                <h2>A little structure.<br />A lot more together.</h2>
              </div>
              <div className="billing-toggle" role="group" aria-label="Billing period">
                <button type="button" className={annual ? "" : "active"} aria-pressed={!annual} onClick={() => setAnnual(false)}>Monthly</button>
                <button type="button" className={annual ? "active" : ""} aria-pressed={annual} onClick={() => setAnnual(true)}>
                  Annual<span className="save">Save 27%</span>
                </button>
              </div>
            </div>
            <div className="pricing-grid">
              <article className="price-card">
                <h3 className="price-label">Free</h3>
                <div className="price-amount"><strong>$0</strong><span /></div>
                <p className="price-sub">Try your first Pause, then one plan per week.</p>
                <ul>
                  {["Weekly planning Pause", "Conversation starters", "One shared weekly plan", "You approve every calendar item"].map((item) => (
                    <li key={item}><Ic name="check" />{item}</li>
                  ))}
                </ul>
                <button type="button" className="btn block" onClick={onStart}>Start Free</button>
              </article>
              <article className="price-card popular">
                <div className="popular-badge"><Ic name="spark" />Most Popular</div>
                <h3 className="price-label">Family Plan</h3>
                <div className="price-amount"><strong>{familyAmount}</strong><span>{familyPeriod}</span></div>
                <p className="price-sub">{familySub}</p>
                <ul>
                  {["Everything in Free", "Full shared planning tools", "Calendar-ready plans", "Reminders for both of you"].map((item) => (
                    <li key={item}><Ic name="check" />{item}</li>
                  ))}
                </ul>
                <button type="button" className="btn primary block" onClick={onStart}>Choose Family Plan</button>
              </article>
              <article className="price-card">
                <h3 className="price-label">Family Plan + Concierge</h3>
                <div className="price-amount"><strong>$38</strong><span>/month</span></div>
                <p className="price-sub">A real assistant locks your Pause every week.</p>
                <ul>
                  {["Everything in Family Plan", "Weekly scheduling support", "Both spouses coordinated", "Your Pause, locked in"].map((item) => (
                    <li key={item}><Ic name="check" />{item}</li>
                  ))}
                </ul>
                <button type="button" className="btn block" onClick={() => navigate("/contact")}>Add Concierge</button>
              </article>
            </div>
            <p className="pricing-note">Start free. Find your rhythm. Grow into what your family needs.<br />Concierge is billed monthly.</p>
          </div>
        </section>

        <section className="section shop-section" id="shop">
          <div className="container">
            <div className="shop-heading">
              <div>
                <div className="eyebrow">A little something for the table</div>
                <h2>Make your Pause a ritual.</h2>
              </div>
              <span className="coming">Coming soon</span>
            </div>
            <div className="shop-grid">
              {PRODUCTS.map((product) => (
                <article className="product-card" key={product.id}>
                  <div className="product-stage"><ProductArt type={product.type} /></div>
                  <div className="product-details">
                    <h3>{product.name}</h3>
                    <div className="product-bottom">
                      <strong>${product.price}</strong>
                      <span className="coming">Coming soon</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="guide-band" id="guide">
          <div className="container guide-grid">
            <div>
              <div className="eyebrow">A good place to begin</div>
              <h2>Get Free FamilyPause Guide</h2>
              <p>Your first calmer week starts with one good conversation. A simple guide to making your weekly Pause your own.</p>
              {leadStatus === "success" ? (
                <p className="guide-status">
                  Check your inbox.{" "}
                  <a href="/guide.pdf" download="FamilyPause-Guide.pdf">Download now</a>
                </p>
              ) : (
                <form className="guide-form" onSubmit={submitGuide}>
                  <label>
                    <span className="sr-only">Your email address</span>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="Your email address"
                      autoComplete="email"
                      aria-label="Your email address"
                      value={leadEmail}
                      onChange={(event) => setLeadEmail(event.target.value)}
                      disabled={leadStatus === "loading"}
                    />
                  </label>
                  <button type="submit" className="btn primary" disabled={leadStatus === "loading"}>
                    {leadStatus === "loading" ? "Sending…" : "Send my guide"}
                    <Ic name="arrow" className="sm" />
                  </button>
                </form>
              )}
              {leadError ? <p className="guide-error">{leadError}</p> : null}
            </div>
            <div className="guide-art">
              <div className="book">
                <span className="mini-logo">FamilyPause</span>
                <span className="mini-pause"><i /><i /></span>
                <strong>A calmer week,<br />together.</strong>
                <small>Your guide to the weekly family Pause.</small>
              </div>
              <div className="guide-caption">A simple conversation.<br />A shared plan.<br />A little more together.</div>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="container">
            <h2>Make this the week<br />you pause, together.</h2>
            <p>Your next good week starts with twenty minutes.</p>
            <button type="button" className="btn white" onClick={onStart}>Start Free<Ic name="arrow" /></button>
            <StoreBadges />
          </div>
        </section>
      </main>

      <SiteFooter onSection={scrollOrNavigate} onHome={scrollHome} />
      <ExitIntentModal />
    </div>
  );
}
