// ─────────────────────────────────────────────────────────────────────────────
// App.jsx - FamilyPause main weekly-sync app
// Ported from the design bundle (project/app: app.jsx, views.jsx, review.jsx,
// screens.css) into a single React component, wired to real data:
//   • Anthropic distillation (claude-haiku-4-5)
//   • Supabase session save (on "Build my week") + realtime sync
//   • Live speech capture (MediaRecorder + Whisper, ChatGPT-style)
//   • workspace.family_context for people / categories / person routing
//
// Flow (StepRail): Agenda → Capture → Distill(processing) → Review → Plan
// Styling comes from src/styles/tokens.css + src/styles/screens.css.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { callFamilyPauseAI, buildSystemPrompt } from "./lib/ai";
import Settings from "./components/Settings.jsx";
import SessionHistory from "./components/SessionHistory.jsx";
import CardSystem from "./components/CardSystem.jsx";
import Paywall from "./components/Paywall.jsx";
import { paywallReason } from "./lib/subscription";
import { parseAppLocation, syncPath, SYNC_VIEWS } from "./lib/routes";
import { canRecordAudio, pickRecordingMimeType, transcribeAudioBlob } from "./lib/transcribe";
import { speechPreviewSupported, startSpeechPreview } from "./lib/speechPreview";

// ── DEFAULT CONTEXT (fallback when workspace has none) ───────────────────────
const DEFAULT_CONTEXT = {
  people: ["Spence", "Amanda"],
  kids: [],
  businesses: [],
  categories: ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health"],
};

const SAMPLE_TRANSCRIPT = `Amanda: Okay, before the week runs away from us again — let's actually do this.
Spence: Agreed. Start with money? The accountant emailed about Q2.
Amanda: Yeah, we need to call the accountant before month end, it's getting tight.
Spence: I'll own that. And we still haven't looked at the Q2 household budget together — can we block 30 minutes Tuesday night?
Amanda: Tuesday works. Put it on the shared calendar.
Spence: Done. Kids — Jordan has the dentist, right?
Amanda: Take Jordan to the dentist, Thursday at 3pm. I can do the pickup.
Spence: And Maya's swim lessons start back up. First one is Saturday morning, 9am at the rec center.
Amanda: Got it. I'll handle Maya's swim.
Spence: On the business — launch week. I think we're blocked on the new payment links.
Amanda: Right, you need to replace the placeholder Stripe links in the app before Friday.
Spence: Yep, that's on me. Friday at the latest.
Amanda: One more — let's protect a real Sabbath this week. No screens after dinner Saturday, just us and the kids.
Spence: Love that. Let's make it the default, not the exception.
Amanda: Good sync. That felt like ten minutes.`;

// ── AI CALL ──────────────────────────────────────────────────────────────────
// Thin wrapper — delegates to src/lib/ai.js which handles prompt caching,
// faithMode, and cache-usage logging. systemOverride lets the distill flow
// pass its own structured-extraction prompt; faithMode/familyName come from
// the workspace profile loaded in the main App component.
async function callAI(prompt, systemOverride, { faithMode = false, familyName = null } = {}) {
  return callFamilyPauseAI({ prompt, systemOverride, faithMode, familyName });
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function prettyDate(d) {
  const dt = d ? new Date(d + "T00:00:00") : new Date();
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function formatWhen(date, time) {
  if (!date) return "";
  const dt = new Date(date + "T" + (time || "00:00") + ":00");
  const day = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!time) return day;
  const t = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}
function gcalLink(title, date, time) {
  const base = date ? `${date}T${time || "10:00"}:00` : null;
  const dt = base ? new Date(base) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const end = new Date(dt.getTime() + 60 * 60 * 1000);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(dt)}%2F${fmt(end)}`;
}

const STATUS = { OPEN: "pending", KEPT: "kept", DISCARDED: "discarded", CALENDARED: "calendared" };

// ── INLINE ICONS (stroke, on-brand) ──────────────────────────────────────────
function Ico({ d, size = 16, fill = false, sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}
const I = {
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8z",
  cal: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"],
  check: "M5 12.5 10 17.5 19.5 6.5",
  plus: "M12 5v14M5 12h14",
  chevD: "M6 9l6 6 6-6",
  mic: ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z", "M5 11a7 7 0 0 0 14 0", "M12 18v3"],
  doc: ["M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M14 3v4h4"],
  arrow: "M5 12h14M13 6l6 6-6 6",
  wave: ["M4 10v4M8 8v8M12 6v12M16 8v8M20 10v4"],
  x: "M6 6l12 12M18 6 6 18",
  clock: ["M12 7v5l3 2", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"],
  gear: ["M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"],
  out: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  cards: ["M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z", "M8 5V3h8v2", "M8 10h8M8 14h5"],
  menu: ["M4 7h16M4 12h16M4 17h16"],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
};

const START_TOPICS = [
  "Kids", "Finances", "Marriage", "Faith", "Health",
  "Work & Business", "Home & Chores", "Travel & Plans", "Friends & Family", "Rest & Sabbath",
];

// ── STEP RAIL ─────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "agenda", label: "Agenda" },
  { key: "capture", label: "Capture" },
  { key: "processing", label: "Distill" },
  { key: "review", label: "Review" },
  { key: "plan", label: "Plan" },
];
function StepRail({ view, vertical = false }) {
  const cur = STEPS.findIndex((s) => s.key === view);
  return (
    <div className={"steps" + (vertical ? " steps-vertical" : "")}>
      {STEPS.map((s, i) => (
        <span key={s.key} style={{ display: "contents" }}>
          {i > 0 && <span className="sep" />}
          <span className={"step " + (i < cur ? "done" : i === cur ? "active" : "")}>
            <span className="dot">{i < cur ? <Ico d={I.check} size={11} /> : i + 1}</span>
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}

function BrandBar({ view, onOpenCards, onOpenHistory, onOpenSettings, onSignOut }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") closeMenu(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  useEffect(() => { closeMenu(); }, [view, closeMenu]);

  const run = (fn) => () => { fn(); closeMenu(); };

  return (
    <>
      <div className="brandbar">
        <div className="brand">
          <div className="mark"><img src="/uploads/Logo_4.png" alt="FamilyPause" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} /></div>
          <div className="word"><b>Family</b><span>Pause</span></div>
        </div>
        <div className="brandbar-actions">
          <div className="brandbar-desktop">
            <StepRail view={view} />
            <div className="brandbar-tools">
              <button className="linkish" title="Card deck" onClick={onOpenCards} style={{ display: "inline-flex", padding: 8 }}><Ico d={I.cards} size={16} /></button>
              <button className="linkish" title="Session history" onClick={onOpenHistory} style={{ display: "inline-flex", padding: 8 }}><Ico d={I.clock} size={16} /></button>
              <button className="linkish" title="Settings" onClick={onOpenSettings} style={{ display: "inline-flex", padding: 8 }}><Ico d={I.gear} size={16} /></button>
              <button className="linkish" title="Sign out" onClick={onSignOut} style={{ display: "inline-flex", padding: 8 }}><Ico d={I.out} size={16} /></button>
            </div>
          </div>
          <button
            type="button"
            className="brandbar-menu-btn linkish"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Ico d={menuOpen ? I.x : I.menu} size={20} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <>
          <button type="button" className="brandbar-backdrop" aria-label="Close menu" onClick={closeMenu} />
          <nav className="brandbar-drawer" aria-label="App menu">
            <div className="brandbar-drawer-label">Weekly sync</div>
            <StepRail view={view} vertical />
            <div className="brandbar-drawer-links">
              <button type="button" className="brandbar-drawer-link" onClick={run(onOpenCards)}><Ico d={I.cards} size={16} /> Card deck</button>
              <button type="button" className="brandbar-drawer-link" onClick={run(onOpenHistory)}><Ico d={I.clock} size={16} /> Session history</button>
              <button type="button" className="brandbar-drawer-link" onClick={run(onOpenSettings)}><Ico d={I.gear} size={16} /> Settings</button>
              <button type="button" className="brandbar-drawer-link brandbar-drawer-link-danger" onClick={run(onSignOut)}><Ico d={I.out} size={16} /> Sign out</button>
            </div>
          </nav>
        </>
      )}
    </>
  );
}

const AGENDA_TOPIC_OPTIONS = START_TOPICS;

function SyncHeader({ family, right }) {
  return (
    <div className="synchead">
      <div className="who">
        <div className="eyebrow">Weekly Sync</div>
        <h1>{family.title}</h1>
        <div className="when">
          <span className="datepill"><Ico d={I.cal} size={14} /> {family.date}</span>
          <span className="faded">A good pause, every week.</span>
        </div>
      </div>
      {right}
    </div>
  );
}

function ApproachChoice({ onStartSync, onJump }) {
  const [expanded, setExpanded] = useState(false);
  const [topics, setTopics] = useState(AGENDA_TOPIC_OPTIONS);
  const [selected, setSelected] = useState([]);
  const [draft, setDraft] = useState("");
  const panelRef = useRef(null);

  const toggle = (name) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const addOwn = () => {
    const v = draft.trim();
    if (!v) return;
    if (!topics.some((t) => t.toLowerCase() === v.toLowerCase())) setTopics((t) => [...t, v]);
    setSelected((s) => (s.includes(v) ? s : [...s, v]));
    setDraft("");
  };

  const openTopics = () => {
    setExpanded(true);
    requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  };

  const startWeeklySync = () => {
    if (selected.length === 0) return;
    onStartSync(selected);
  };

  return (
    <div className="view choicewrap">
      <div className="choicehead rise">
        <div className="eyebrow">How would you like to begin</div>
        <h1 className="choicetitle">Choose your approach.</h1>
      </div>

      <div className="choicecards rise">
        <div
          className="choicecard"
          onClick={openTopics}
          onKeyDown={(e) => e.key === "Enter" && openTopics()}
          role="button"
          tabIndex={0}
        >
          <div className="cico"><Ico d={I.grid} size={22} /></div>
          <h3>Guide your conversation.</h3>
          <p>Choose topics before you record. Helps the AI organize your week more accurately and gives you a structure to follow together.</p>
          <div className="egrow">
            <span className="egpill">Kids</span>
            <span className="egpill">Finances</span>
            <span className="egpill">Marriage</span>
          </div>
          <div className="cardfoot">
            <button type="button" className="choicebtn outline" onClick={(e) => { e.stopPropagation(); openTopics(); }}>
              Choose Topics <Ico d={I.arrow} size={15} />
            </button>
          </div>
        </div>

        <div
          className="choicecard rec"
          onClick={onJump}
          onKeyDown={(e) => e.key === "Enter" && onJump()}
          role="button"
          tabIndex={0}
        >
          <span className="poppop">Most Popular</span>
          <div className="cico"><Ico d={I.mic} size={22} /></div>
          <h3>Jump straight in.</h3>
          <p>Hit record and talk freely. FamilyPause listens to everything and organizes your week automatically when you&apos;re done.</p>
          <div className="cardfoot">
            <button type="button" className="choicebtn solid" onClick={(e) => { e.stopPropagation(); onJump(); }}>
              Start Recording <Ico d={I.arrow} size={15} />
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="topicspanel rise" ref={panelRef}>
          <div className="tphead">
            <div className="eyebrow">Pick the topics for this week</div>
            <span className="tpcount">{selected.length ? `${selected.length} selected` : "None yet"}</span>
          </div>

          <div className="topicgrid">
            {topics.map((name) => (
              <button
                key={name}
                type="button"
                className={"topicpill " + (selected.includes(name) ? "on" : "")}
                onClick={() => toggle(name)}
              >
                {selected.includes(name) && <Ico d={I.check} size={13} />}
                {name}
              </button>
            ))}
          </div>

          <div className="addown">
            <input
              className="addinput"
              placeholder="Add your own topic…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOwn(); } }}
            />
            <button type="button" className="btn btn-soft" onClick={addOwn}><Ico d={I.plus} size={14} /> Add</button>
          </div>

          {selected.length > 0 && (
            <div className="controw rise">
              <button type="button" className="btn btn-primary btn-lg btn-block" onClick={startWeeklySync}>
                <Ico d={I.cal} size={16} /> Start your weekly sync
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildAgendaRowsFromTopics(topicNames = []) {
  if (!topicNames.length) {
    return [{ id: "t1", cat: AGENDA_TOPIC_OPTIONS[0], topic: "" }];
  }
  return topicNames.map((cat, i) => ({
    id: "t" + (i + 1),
    cat: AGENDA_TOPIC_OPTIONS.includes(cat) ? cat : AGENDA_TOPIC_OPTIONS[0],
    topic: AGENDA_TOPIC_OPTIONS.includes(cat) ? "" : cat,
  }));
}

function AgendaBuilder({ family, workspaceId, initialTopics = [], onDistill, onBackToChoice }) {
  const [tab, setTab] = useState("agenda");
  const [showAssistant, setShowAssistant] = useState(true);
  const rowIdRef = useRef(Math.max(1, initialTopics.length));
  const [rows, setRows] = useState(() => buildAgendaRowsFromTopics(initialTopics));

  const addTopic = () => {
    rowIdRef.current += 1;
    setRows((r) => [...r, { id: "t" + rowIdRef.current, cat: AGENDA_TOPIC_OPTIONS[0], topic: "" }]);
  };

  const updateRow = (id, patch) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const deleteRow = (id) =>
    setRows((r) => (r.length <= 1 ? r : r.filter((row) => row.id !== id)));

  const agendaTopicsForDistill = () =>
    rows.map((r) => {
      const detail = r.topic.trim();
      return detail ? `${r.cat}: ${detail}` : r.cat;
    });

  return (
    <div className="view">
      <SyncHeader
        family={family}
        right={
          <button type="button" className={"btn " + (showAssistant ? "btn-soft" : "btn-ghost")} onClick={() => setShowAssistant((v) => !v)}>
            <Ico d={I.spark} size={15} /> {showAssistant ? "Hide Assistant" : "AI Assistant"}
          </button>
        }
      />

      <div className="tabs">
        <button type="button" className={"tab " + (tab === "agenda" ? "on" : "")} onClick={() => setTab("agenda")}>Agenda</button>
        <button type="button" className={"tab " + (tab === "actions" ? "on" : "")} onClick={() => setTab("actions")}>
          Actions <span className="count">(0)</span>
        </button>
        <button type="button" className={"tab " + (tab === "log" ? "on" : "")} onClick={() => setTab("log")}>Log</button>
      </div>

      <div className={"worksplit " + (showAssistant ? "with-rail" : "")}>
        <div>
          {tab === "agenda" && (
            <div className="rise">
              <div className="rowhead">
                <span className="ct">{rows.length} Topic{rows.length === 1 ? "" : "s"}</span>
                <button type="button" className="btn btn-soft" onClick={addTopic} style={{ padding: "9px 15px" }}>
                  <Ico d={I.plus} size={14} /> Add Topic
                </button>
              </div>
              {rows.map((r, i) => (
                <div className="agrow" key={r.id}>
                  <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                  <select
                    className="agcat"
                    value={r.cat}
                    aria-label="Topic category"
                    onChange={(e) => updateRow(r.id, { cat: e.target.value })}
                  >
                    {AGENDA_TOPIC_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    className="agtopic"
                    value={r.topic}
                    placeholder="What do you want to cover?"
                    aria-label="Topic detail"
                    onChange={(e) => updateRow(r.id, { topic: e.target.value })}
                  />
                  <button
                    type="button"
                    className="agdel"
                    onClick={() => deleteRow(r.id)}
                    disabled={rows.length <= 1}
                    aria-label="Remove topic"
                    title={rows.length <= 1 ? "Keep at least one topic" : "Remove topic"}
                  >
                    <Ico d={I.x} size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="addtopic" onClick={addTopic}>
                <Ico d={I.plus} size={14} /> Add another topic
              </button>
            </div>
          )}

          {tab === "actions" && (
            <div className="rise" style={{ textAlign: "center", padding: "70px 20px", color: "var(--ink-3)" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--ink-2)", marginBottom: 8 }}>
                No open actions yet.
              </div>
              <div style={{ fontSize: 15 }}>Distill your conversation and your actions appear here — sorted by person.</div>
            </div>
          )}

          {tab === "log" && (
            <div className="rise" style={{ textAlign: "center", padding: "70px 20px", color: "var(--ink-3)" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--ink-2)", marginBottom: 8 }}>
                Your past syncs live here.
              </div>
              <div style={{ fontSize: 15 }}>Every meeting, summarized and searchable.</div>
            </div>
          )}

          {tab === "agenda" && (
            <div className="ctabar">
              <div className="copy">
                <h3>Ready when you are.</h3>
                <p>Record live or paste your conversation — FamilyPause turns it into a plan in about ten seconds.</p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => onDistill({ mode: "dictate", topics: agendaTopicsForDistill() })}
              >
                <Ico d={I.bolt} size={16} fill /> Distill this week
              </button>
            </div>
          )}

          {onBackToChoice && (
            <p style={{ marginTop: 16 }}>
              <button type="button" className="linkish" onClick={onBackToChoice}>← Back to approach</button>
            </p>
          )}
        </div>

        {showAssistant && (
          <aside className="assist rise">
            <div className="ahead">
              <div className="aico"><Ico d={I.spark} size={17} /></div>
              <div>
                <div className="at">Meeting Assistant</div>
                <div className="as">Reads &amp; writes your agenda</div>
              </div>
            </div>
            <div className="assbubble">
              Hi — I&apos;m here while you talk. I can add notes, draft action items, and tell you what you&apos;re forgetting.
            </div>
            <div className="suggs">
              <span className="sugg">Summarize our agenda</span>
              <span className="sugg">What are we forgetting?</span>
              <span className="sugg">Add a note to Finance</span>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function SyncView({ family, workspaceId, onDistill }) {
  const [phase, setPhase] = useState("choice");
  const [pickedTopics, setPickedTopics] = useState([]);

  if (phase === "choice") {
    return (
      <ApproachChoice
        onStartSync={(topics) => {
          setPickedTopics(topics);
          setPhase("builder");
        }}
        onJump={() => onDistill({ mode: "dictate", topics: [] })}
      />
    );
  }

  return (
    <AgendaBuilder
      key={pickedTopics.join("|")}
      family={family}
      workspaceId={workspaceId}
      initialTopics={pickedTopics}
      onDistill={onDistill}
      onBackToChoice={() => setPhase("choice")}
    />
  );
}

// ── CAPTURE (View 2) ──────────────────────────────────────────────────────────
function CaptureView({ text, setText, initialMode = "paste", onBack, onProcess }) {
  const [mode, setMode] = useState(initialMode);
  const [modeSwitchAsk, setModeSwitchAsk] = useState(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [dictating, setDictating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [dictStatus, setDictStatus] = useState("");
  const [dictNotice, setDictNotice] = useState("");
  const [livePreview, setLivePreview] = useState("");
  const [recordSecs, setRecordSecs] = useState(0);
  const [waveLevels, setWaveLevels] = useState(() => Array.from({ length: 9 }, () => 0.35));
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef("");
  const baseRef = useRef("");
  const previewRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const meterRafRef = useRef(null);
  const timerRef = useRef(null);

  const stopMeter = () => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const stopPreview = () => {
    previewRef.current?.stop();
    previewRef.current = null;
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stopRecorder = () => new Promise((resolve) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") {
      releaseStream();
      recorderRef.current = null;
      resolve(null);
      return;
    }
    rec.onstop = () => {
      // Brave needs extra time to flush the final webm/opus chunk after stop().
      setTimeout(() => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" })
          : null;
        chunksRef.current = [];
        releaseStream();
        recorderRef.current = null;
        resolve(blob);
      }, 320);
    };
    if (rec.state === "recording") {
      try { rec.requestData(); } catch { /* ignore */ }
    }
    try { rec.stop(); } catch { resolve(null); }
  });

  const modeLabel = (m) => (m === "paste" ? "Write or paste" : "Speech to text");

  const applyModeSwitch = (next) => {
    if (dictating) cancelDictation();
    setDictNotice("");
    setDictStatus("");
    setMode(next);
    setModeSwitchAsk(null);
  };

  const requestModeSwitch = (next) => {
    if (next === mode || transcribing) return;
    if (dictating) {
      setModeSwitchAsk(next);
      return;
    }
    applyModeSwitch(next);
  };

  const modeSwitchMessage = () => {
    if (!modeSwitchAsk) return "";
    const target = modeLabel(modeSwitchAsk);
    const hasText = text.trim().length > 0;
    if (hasText) {
      return `Your saved transcript stays in the box. Switching to ${target} will cancel your in-progress recording unless you tap ✓ to save first.`;
    }
    return `You're still recording. Switching to ${target} will discard this recording unless you tap ✓ to save first.`;
  };

  const cancelDictation = () => {
    if (transcribing) return;
    stopPreview();
    stopMeter();
    setLivePreview("");
    setRecordSecs(0);
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        chunksRef.current = [];
        releaseStream();
        recorderRef.current = null;
      };
      try { rec.stop(); } catch { /* ignore */ }
    } else {
      releaseStream();
      recorderRef.current = null;
      chunksRef.current = [];
    }
    setDictating(false);
    setDictStatus("");
    setText(baseRef.current);
  };

  const confirmDictation = async () => {
    if (transcribing) return text;
    const previewFallback = livePreview.trim();
    setTranscribing(true);
    setDictStatus("Transcribing…");
    setLivePreview("");
    try {
      stopPreview();
      const blob = await stopRecorder();
      stopMeter();
      setDictating(false);
      if (!blob || blob.size < 200) {
        setDictNotice("Recording too short. Speak for at least 2–3 seconds, then tap the check mark.");
        return baseRef.current;
      }
      const spoken = await transcribeAudioBlob(blob, mimeRef.current, {
        previewFallback,
        onStatus: setDictStatus,
      });
      if (!spoken) {
        setDictNotice("Couldn't pick up any speech. Check your mic, speak a little longer, and try again.");
        return baseRef.current;
      }
      const merged = baseRef.current
        ? `${baseRef.current.trim()} ${spoken}`.trim()
        : spoken;
      setText(merged);
      setDictNotice("");
      return merged;
    } catch (err) {
      setDictNotice(err.message || "Transcription failed. Try again or use Write or paste.");
      return baseRef.current;
    } finally {
      setTranscribing(false);
      setDictStatus("");
      setRecordSecs(0);
    }
  };

  const startDictation = async () => {
    setDictNotice("");
    setLivePreview("");
    setRecordSecs(0);
    if (!canRecordAudio()) {
      setDictNotice("Recording isn't supported in this browser. Use Write or paste instead.");
      return;
    }

    try {
      const mime = pickRecordingMimeType();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      mimeRef.current = mime;
      chunksRef.current = [];
      baseRef.current = text.trim();

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const tickMeter = () => {
        const a = analyserRef.current;
        if (!a) return;
        const buf = new Uint8Array(a.frequencyBinCount);
        a.getByteFrequencyData(buf);
        setWaveLevels(Array.from({ length: 9 }, (_, i) => {
          const idx = Math.min(buf.length - 1, Math.floor((i / 9) * buf.length));
          return 0.18 + (buf[idx] / 255) * 0.82;
        }));
        meterRafRef.current = requestAnimationFrame(tickMeter);
      };
      meterRafRef.current = requestAnimationFrame(tickMeter);
      timerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000);

      if (speechPreviewSupported()) {
        previewRef.current = startSpeechPreview({
          onInterim: (spoken) => setLivePreview(spoken),
          onError: () => { /* optional preview — Whisper on save */ },
        });
      }

      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = rec;
      // Single blob on stop — more reliable in Brave than small timeslices.
      rec.start();
      setDictating(true);
      setDictStatus(speechPreviewSupported()
        ? "Listening… words appear below as you speak"
        : "Recording… tap ✓ when done — words appear after save");
    } catch {
      stopPreview();
      stopMeter();
      releaseStream();
      setDictNotice("Microphone access denied. Allow the mic in your browser settings and try again.");
    }
  };

  useEffect(() => () => {
    stopPreview();
    stopMeter();
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch { /* ignore */ }
    }
    releaseStream();
  }, []);

  const ready = text.trim().length > 30;
  const wordCount = text.trim() ? `${text.trim().split(/\s+/).length} words` : null;
  const dictBusy = dictating || transcribing;

  return (
    <div className="view capwrap">
      {modeSwitchAsk && (
        <div className="capmodal-backdrop" role="presentation" onClick={() => setModeSwitchAsk(null)}>
          <div
            className="capmodal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capmodal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="capmodal-title">Switch to {modeLabel(modeSwitchAsk)}?</h3>
            <p>{modeSwitchMessage()}</p>
            <div className="capmodal-actions">
              <button type="button" className="btn btn-soft capmodal-btn" onClick={() => setModeSwitchAsk(null)}>
                Keep recording
              </button>
              <button type="button" className="btn btn-primary capmodal-btn" onClick={() => applyModeSwitch(modeSwitchAsk)}>
                Switch anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lead">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Step 2 · Have your meeting</div>
        <h1>Talk like humans.<br /><em>We&apos;ll handle the structure.</em></h1>
        <p>Type or paste a transcript, or dictate with speech-to-text. Kids, money, work, the week ahead — whatever needs talking about.</p>
      </div>

      <div className="panel capcard">
        <div className="captoggle">
          <button type="button" className={"seg " + (mode === "paste" ? "on" : "")} onClick={() => requestModeSwitch("paste")} disabled={transcribing}>
            <Ico d={I.doc} size={15} /> Write or paste
          </button>
          <button type="button" className={"seg " + (mode === "dictate" ? "on" : "")} onClick={() => requestModeSwitch("dictate")} disabled={transcribing}>
            <Ico d={I.wave} size={15} /> Speech to text
          </button>
        </div>

        {mode === "paste" && (
          <div style={{ padding: "4px 10px 10px" }}>
            <textarea className="capta" placeholder="Write or paste your conversation here…" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="caprow">
              <span className="caphint">{wordCount || "Nothing entered yet"}</span>
              <button type="button" className="usesample" onClick={() => setText(SAMPLE_TRANSCRIPT)}>
                ✦ Use sample conversation
              </button>
            </div>
          </div>
        )}

        {mode === "dictate" && (
          <div style={{ padding: "4px 10px 10px" }}>
            {dictNotice && !dictBusy && (
              <p className="dictnotice dictnotice-warn">{dictNotice}</p>
            )}
            <textarea
              className="capta"
              placeholder="Your transcript appears here after you save a dictation. You can edit anytime."
              value={text}
              readOnly={dictBusy}
              onChange={(e) => { if (!dictBusy) setText(e.target.value); }}
            />

            {dictBusy ? (
              <div className="dictpanel">
                <div className="dictlive" aria-live="polite">
                  {transcribing
                    ? dictStatus
                    : livePreview || (
                      <span className="dictlive-hint">
                        {speechPreviewSupported()
                          ? "Start speaking…"
                          : `Recording ${Math.floor(recordSecs / 60)}:${String(recordSecs % 60).padStart(2, "0")} — tap ✓ when done`}
                      </span>
                    )}
                </div>
                <div className="dictwave" aria-hidden="true">
                  {waveLevels.map((level, i) => (
                    <i key={i} style={{ height: `${Math.round(level * 22)}px`, animation: "none" }} />
                  ))}
                </div>
                <p className="dictstatus">{dictStatus}</p>
                <div className="dictactions">
                  <button type="button" className="dictbtn dictbtn-cancel" onClick={cancelDictation} disabled={transcribing} aria-label="Cancel dictation">
                    <Ico d={I.x} size={20} />
                  </button>
                  <span className="caphint">{transcribing ? "Turning speech into text…" : "Cancel or save to the box"}</span>
                  <button type="button" className="dictbtn dictbtn-save" onClick={confirmDictation} disabled={transcribing} aria-label="Save dictation">
                    <Ico d={I.check} size={20} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="caprow">
                <span className="caphint">{wordCount || "Tap the mic, speak, then save or cancel"}</span>
                <button type="button" className="dictmic" onClick={startDictation}>
                  <Ico d={I.mic} size={14} /> Start dictation
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
        <button type="button" className="linkish" onClick={() => { if (dictating && !transcribing) cancelDictation(); onBack(); }}>← Back to agenda</button>
        <button type="button" className="btn btn-primary btn-lg" disabled={dictBusy || !ready} onClick={async () => {
          const payload = dictating ? await confirmDictation() : text;
          if ((payload || "").trim().length > 30) onProcess(payload, mode);
        }}>
          <Ico d={I.bolt} size={16} fill /> Distill it
        </button>
      </div>
    </div>
  );
}

// ── PROCESSING (View 3) ───────────────────────────────────────────────────────
function ProcessingView({ done, familyNames = "Everyone" }) {
  const stepLabels = ["Reading your conversation", "Finding actions & appointments", "Sorting by person and category", "Building this week's review"];
  const subs = [
    "Listening to every voice in the room…",
    `${familyNames} — nobody gets dropped.`,
    "Finance, Kids, Business, Family.",
    "Almost there.",
  ];
  const [active, setActive] = useState(0);
  const [pct, setPct] = useState(6);

  useEffect(() => {
    const times = [900, 1700, 2600, 3500];
    const timers = times.map((t, i) => setTimeout(() => { setActive(i + 1); setPct(Math.min(95, 18 + i * 24)); }, t));
    const grow = setInterval(() => setPct((p) => Math.min(96, p + Math.random() * 3)), 260);
    return () => { timers.forEach(clearTimeout); clearInterval(grow); };
  }, []);
  useEffect(() => { if (done) { setActive(4); setPct(100); } }, [done]);

  return (
    <div className="view proc">
      <div className="procorb"><span className="ring" /><span className="ring r2" /><Ico d={I.bolt} size={46} fill /></div>
      <h1>Distilling your sync…</h1>
      <div className="psub">{done ? "Done. Opening your review." : subs[Math.min(active, subs.length - 1)]}</div>
      <div className="procsteps">
        {stepLabels.map((s, i) => (
          <div key={i} className={"procstep " + (i < active ? "done" : i === active ? "active" : "")}>
            <span className="pmk">{i < active ? <Ico d={I.check} size={13} /> : i + 1}</span>{s}
          </div>
        ))}
      </div>
      <div className="procbar"><i style={{ width: pct + "%" }} /></div>
    </div>
  );
}

// ── REVIEW (View 4) ───────────────────────────────────────────────────────────
function ReviewView({ cards, setCards, roleOf, onBack, onBuild, distillError }) {
  const decide = (id, status) => setCards((arr) => arr.map((it) => (it.id === id ? { ...it, status } : it)));
  const total = cards.length;
  const decided = cards.filter((c) => c.status !== STATUS.OPEN).length;
  const kept = cards.filter((c) => c.status === STATUS.KEPT || c.status === STATUS.CALENDARED).length;
  const allDecided = total > 0 && decided === total;
  const pct = total ? Math.round((decided / total) * 100) : 0;
  const keepAll = () => setCards((arr) => arr.map((it) => (it.status === STATUS.OPEN ? { ...it, status: STATUS.KEPT } : it)));

  return (
    <div className="view">
      <div className="revhead">
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>Step 4 · This week's review</div>
          <h1 className="revtitle">Keep what matters. <em>Discard the rest.</em></h1>
        </div>
        <div className="progresswrap">
          <span className="chip chip-soft fw">{decided}/{total} reviewed</span>
          <div className="minibar"><i style={{ width: pct + "%" }} /></div>
        </div>
      </div>

      <div className="revmeta">
        <span className="chip chip-ok"><Ico d={I.check} size={13} /> {total} items extracted</span>
        <span className="chip chip-soft"><Ico d={I.clock} size={13} /> ~2 min to review</span>
        {total > 0 && <button className="linkish" style={{ marginLeft: "auto" }} onClick={keepAll}>Keep all remaining →</button>}
      </div>

      {total === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--ink-3)" }}>
          {distillError ? (
            <>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--red)", marginBottom: 8 }}>AI unavailable.</div>
              <div style={{ fontSize: 15, color: "var(--red)", maxWidth: 480, margin: "0 auto" }}>{distillError}</div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--ink-2)", marginBottom: 8 }}>Nothing to review.</div>
              <div style={{ fontSize: 15 }}>We couldn't extract items. Try a longer or clearer transcript.</div>
            </>
          )}
        </div>
      ) : (
        <div>
          {cards.map((it) => {
            const who = roleOf(it.person);
            const isEvent = it.type === "event";
            const when = formatWhen(it.date, it.time);
            const decidedState = it.status === STATUS.KEPT || it.status === STATUS.CALENDARED ? "kept" : it.status === STATUS.DISCARDED ? "discarded" : "";
            return (
              <div key={it.id} className={`revcard ${who} ${decidedState}`}>
                <span className="checkpop"><Ico d={I.check} size={13} /></span>
                <div className="ctop">
                  <span className={"pdot " + who} />
                  <span className={"tag tag-" + who}>{it.person}</span>
                  <span className="tag tag-cat">{it.category}</span>
                  <span className="ktype">{it.type}</span>
                </div>
                <h3>{it.task}</h3>
                {it.source && <div className="cq">"{it.source}"</div>}
                {when && <div className="cwhen"><Ico d={isEvent ? I.cal : I.clock} size={13} /> {isEvent ? when : "Due · " + when}</div>}
                <div className="cact">
                  <button className="keepbtn" onClick={() => decide(it.id, STATUS.KEPT)}><Ico d={I.check} size={14} /> Keep</button>
                  {isEvent && <button className="calbtn" onClick={() => decide(it.id, STATUS.CALENDARED)}><Ico d={I.cal} size={14} /> + Calendar</button>}
                  <button className="discbtn" onClick={() => decide(it.id, STATUS.DISCARDED)}><Ico d={I.x} size={14} /> Discard</button>
                </div>
                <div className="decided keep"><Ico d={I.check} size={13} /> Kept{it.status === STATUS.CALENDARED ? " · added to calendar" : ""}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="revdone">
        <button className="linkish" onClick={onBack}>← Re-distill</button>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span className="summ">{allDecided ? <span><b>{kept} kept</b> · {total - kept} discarded</span> : `${total - decided} left to review`}</span>
          <button className="btn btn-primary btn-lg" disabled={!allDecided} onClick={onBuild}><Ico d={I.arrow} size={16} /> Build my week</button>
        </div>
      </div>
    </div>
  );
}

// ── CONFETTI + PLAN (View 5) ──────────────────────────────────────────────────
function Confetti() {
  const cols = ["#BE5A37", "#5E6B37", "#C09740", "#D08049", "#7b6cae"];
  const bits = useRef(Array.from({ length: 70 }).map((_, i) => ({
    left: (i * 37 % 100), delay: (i % 7) * 0.08, dur: 2.4 + (i % 5) * 0.4, col: cols[i % cols.length], rot: (i * 53) % 360,
  }))).current;
  return (
    <div className="confetti">
      {bits.map((b, i) => <i key={i} style={{ left: b.left + "%", background: b.col, animationDuration: b.dur + "s", animationDelay: b.delay + "s", transform: `rotate(${b.rot}deg)` }} />)}
    </div>
  );
}

function PlanView({ keptCards, adults, roleOf, onRestart }) {
  const [added, setAdded] = useState(false);
  const [confetti, setConfetti] = useState(true);
  useEffect(() => { const t = setTimeout(() => setConfetti(false), 4200); return () => clearTimeout(t); }, []);

  const isAdult = (p) => adults.some((a) => a.toLowerCase() === (p || "").toLowerCase());
  const byPerson = (name) => keptCards.filter((c) => (c.person || "").toLowerCase() === name.toLowerCase());
  const shared = keptCards.filter((c) => !isAdult(c.person));

  const Item = ({ it }) => (
    <div className="planitem">
      <span className="pmark"><Ico d={I.check} size={11} /></span>
      <div className="pbody">
        <div className="pt">{it.task}</div>
        <div className="pmeta">
          <span className="ct">{it.category}</span>
          {formatWhen(it.date, it.time) && <span>· {formatWhen(it.date, it.time)}</span>}
        </div>
      </div>
    </div>
  );

  const openCalendar = () => {
    setAdded(true);
    const events = keptCards.filter((c) => c.type === "event" || c.status === STATUS.CALENDARED);
    if (events[0]) window.open(gcalLink(events[0].task, events[0].date, events[0].time), "_blank");
  };

  return (
    <div className="view">
      {confetti && <Confetti />}
      <div className="planhero">
        <div className="seal"><Ico d={I.check} size={28} /></div>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Step 5 · Your week is built</div>
        <h1>Your week, <em>planned before Sunday ends.</em></h1>
        <p>A clean plan, organized by person. {keptCards.length} items routed where they belong: appointments timed, actions owned, nothing forgotten.</p>
      </div>

      <div className="plangrid">
        {adults.slice(0, 2).map((name, i) => {
          const list = byPerson(name);
          return (
            <div className="plancol" key={name}>
              <div className="pch">
                <span className={"pdot " + (i === 0 ? "spence" : "amanda")} />
                <span className="pname">{name}</span>
                <span className="pcount">{list.length} {list.length === 1 ? "item" : "items"}</span>
              </div>
              {list.length ? list.map((it) => <Item key={it.id} it={it} />) : (
                <div style={{ color: "var(--ink-3)", fontStyle: "italic", fontSize: 14, padding: "8px 0" }}>All clear this week.</div>
              )}
            </div>
          );
        })}
      </div>

      {shared.length > 0 && (
        <div className="plancol" style={{ marginBottom: 16 }}>
          <div className="pch">
            <span className="pdot both" />
            <span className="pname">Shared &amp; Family</span>
            <span className="pcount">{shared.length} {shared.length === 1 ? "item" : "items"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
            {shared.map((it) => <Item key={it.id} it={it} />)}
          </div>
        </div>
      )}

      <button className={"gcalbar " + (added ? "added" : "")} onClick={openCalendar}>
        <Ico d={added ? I.check : I.cal} size={17} />
        {added ? "Synced to Google Calendar" : "Add this week + recurring sync to Google Calendar"}
      </button>
      <div className="gcalnote">Appointments drop in at their times · A repeating weekly pause is set for Sunday</div>

      <div className="planfoot"><button className="linkish" onClick={onRestart}>↺ Start a new sync</button></div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App({ user, workspace, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();

  const viewFromLocation = () => {
    const parsed = parseAppLocation(location.pathname, location.search);
    if (parsed.area === "sync" && SYNC_VIEWS.includes(parsed.view)) return parsed.view;
    return "agenda";
  };

  const overlayFromLocation = () => {
    const parsed = parseAppLocation(location.pathname, location.search);
    return parsed.area === "overlay" ? parsed.overlay : null;
  };

  const [view, setView] = useState(viewFromLocation);
  const [overlay, setOverlay] = useState(overlayFromLocation);
  const [paywallBlock, setPaywallBlock] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0);
  const [inputMode, setInputMode] = useState("paste");
  const [cards, setCards] = useState([]);
  const [distillError, setDistillError] = useState(null);
  const [distillDone, setDistillDone] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [captureMode, setCaptureMode] = useState("paste");
  const [agendaTopics, setAgendaTopics] = useState([]);
  const [meetingDate] = useState(todayStr());
  const [ws, setWs] = useState(workspace);

  const sessionIdRef = useRef(null);
  const savedRef = useRef(false);

  useEffect(() => { setWs(workspace); }, [workspace]);

  useEffect(() => {
    const parsed = parseAppLocation(location.pathname, location.search);
    if (parsed.area === "sync" && SYNC_VIEWS.includes(parsed.view)) {
      setView(parsed.view);
      setOverlay(null);
    } else if (parsed.area === "overlay") {
      setOverlay(parsed.overlay);
    }
  }, [location.pathname, location.search]);

  const go = (v, { replace = false } = {}) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate(syncPath(v), { replace });
  };

  const openOverlay = (name) => {
    const paths = {
      settings: "/app/settings",
      history: "/app/history",
      decks: "/app/cards",
      paywall: "/app/paywall",
    };
    navigate(paths[name] || syncPath(view));
  };

  const closeOverlay = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(syncPath(view));
  };

  const openCardDeck = () => {
    if (!ws?.cards_unlocked) navigate("/app/cards?setup=1");
    else navigate("/app/cards");
  };

  const cardDeckInitialView = () => {
    const wantsSetup = new URLSearchParams(location.search).get("setup") === "1";
    return wantsSetup ? "unlock" : "draw";
  };

  useEffect(() => {
    if (!ws?.id) return;
    let active = true;
    (async () => {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("workspace_id", ws.id)
        .maybeSingle();
      if (active) setSubscription(sub);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", ws.id)
        .gte("created_at", startOfMonth.toISOString());
      if (active) setSessionsThisMonth(count || 0);
    })();
    return () => { active = false; };
  }, [ws?.id]);

  const context = ws?.family_context || DEFAULT_CONTEXT;
  const kids = Array.isArray(context.kids) ? context.kids : [];
  const adults = (Array.isArray(context.people) ? context.people : DEFAULT_CONTEXT.people).filter((p) => !kids.includes(p));

  const roleOf = useCallback((person) => {
    const p = (person || "").toLowerCase();
    if (p === "both" || p === "family" || p === "shared") return "both";
    if (adults[0] && p === adults[0].toLowerCase()) return "spence";
    if (adults[1] && p === adults[1].toLowerCase()) return "amanda";
    return "both";
  }, [adults]);

  const processingFamilyLabel = [...adults, ...(kids.length ? ["the kids"] : [])].join(", ") || "Everyone";
  const family = { title: adults.length ? adults.join(" & ") : (ws?.name || "Your Family"), date: prettyDate(meetingDate) };

  // ── Realtime sync (Step 12) ──────────────────────────────────────────────
  useEffect(() => {
    if (!ws?.id) return;
    const channel = supabase
      .channel("session-sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `workspace_id=eq.${ws.id}` },
        (payload) => { if (payload.new?.cards) setCards(payload.new.cards); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ws?.id]);

  // ── Distill (real AI) ────────────────────────────────────────────────────
  const runDistill = async (text, mode = "paste") => {
    const block = paywallReason(subscription, sessionsThisMonth);
    if (block) {
      setPaywallBlock(block);
      openOverlay("paywall");
      return;
    }

    setInputMode(mode);
    setDistillDone(false);
    setDistillError(null);
    setCards([]);
    go("processing");
    savedRef.current = false;
    sessionIdRef.current = null;

    const topicHint = agendaTopics.length
      ? `\nFocus topics for this sync: ${agendaTopics.join(", ")}. Prioritize items related to these topics when present in the transcript.`
      : "";

    const system = `You are FamilyPause, a family meeting intelligence assistant.
Known people: ${(context.people || []).join(", ")}
Known businesses: ${(context.businesses || []).join(", ")}
Categories: ${(context.categories || []).join(", ")}${topicHint}

Extract EVERY actionable item, appointment, decision, task, or commitment. Return ONLY a valid JSON array, no markdown, no backticks.

Each item:
{
  "id": (unique number from 1),
  "category": (from categories above or create one),
  "person": (specific person name, "Both", or "Family"),
  "task": (clear one-sentence description),
  "source": (exact phrase from transcript, under 15 words),
  "date": (YYYY-MM-DD if mentioned, else null),
  "time": (HH:MM 24h if mentioned, else null),
  "type": ("action", "event", "decision", or "note")
}

Rules: extract everything actionable, use person names when mentioned, return only the JSON array.`;

    let parsed = [];
    let errorMsg = null;
    try {
      const faithMode = ws?.faith_mode ?? false;
      const familyName = ws?.family_name ?? null;
      const raw = await callAI(`Extract all action items from this family meeting transcript:\n\n${text}`, system, { faithMode, familyName });
      try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
      catch { const m = raw.match(/\[[\s\S]*\]/); if (m) parsed = JSON.parse(m[0]); }
    } catch (err) {
      errorMsg = err?.message || String(err);
      parsed = [];
    }

    const newCards = parsed.map((c, i) => ({ ...c, id: c.id ?? i + 1, status: STATUS.OPEN }));
    setCards(newCards);
    setDistillError(errorMsg);
    setDistillDone(true);

    if (!errorMsg && ws?.id && newCards.length > 0) {
      try {
        const { data, error } = await supabase.from("sessions").insert({
          workspace_id: ws.id,
          meeting_date: meetingDate,
          transcript: text,
          input_mode: mode,
          cards: newCards,
          status: "review",
          created_by: user?.id,
        }).select().single();
        if (!error && data) {
          sessionIdRef.current = data.id;
          setSessionsThisMonth((n) => n + 1);
        }
      } catch { /* session insert is best-effort */ }
    }

    setTimeout(() => go("review", { replace: true }), 650); // let the orb finish
  };

  // Persist review decisions for spouse realtime sync
  useEffect(() => {
    if (!sessionIdRef.current || view !== "review") return;
    const t = setTimeout(() => {
      supabase.from("sessions").update({ cards }).eq("id", sessionIdRef.current);
    }, 400);
    return () => clearTimeout(t);
  }, [cards, view]);

  // ── Build my week → save session (Step 11) ───────────────────────────────
  const buildWeek = () => {
    go("plan");
    if (!ws?.id || savedRef.current) return;
    savedRef.current = true;
    (async () => {
      try {
        if (sessionIdRef.current) {
          const { error } = await supabase.from("sessions").update({
            cards,
            status: "complete",
            transcript: captureText,
            input_mode: inputMode,
          }).eq("id", sessionIdRef.current);
          if (error) savedRef.current = false;
          return;
        }
        const { data, error } = await supabase.from("sessions").insert({
          workspace_id: ws.id,
          meeting_date: meetingDate,
          transcript: captureText,
          input_mode: inputMode,
          cards,
          status: "complete",
          created_by: user?.id,
        }).select().single();
        if (error) { savedRef.current = false; return; }
        if (data) sessionIdRef.current = data.id;
      } catch { savedRef.current = false; }
    })();
  };

  const restart = () => {
    setCards([]);
    setDistillDone(false);
    savedRef.current = false;
    sessionIdRef.current = null;
    go("agenda");
  };

  const keptCards = cards.filter((c) => c.status === STATUS.KEPT || c.status === STATUS.CALENDARED);
  const keptActions = keptCards.filter((c) => c.type === "action");

  // ── Overlays ─────────────────────────────────────────────────────────────
  if (overlay === "paywall") {
    return (
      <div className="stage" style={{ padding: "48px 24px 80px" }}>
        <Paywall reason={paywallBlock || "trial"} onClose={() => { closeOverlay(); setPaywallBlock(null); }} />
      </div>
    );
  }
  if (overlay === "settings") {
    return (
      <Settings
        workspace={ws}
        user={user}
        onSignOut={onSignOut}
        onClose={closeOverlay}
        onOpenDecks={() => navigate("/app/cards")}
        onOpenHistory={() => navigate("/app/history")}
        onWorkspaceUpdate={setWs}
      />
    );
  }
  if (overlay === "history") {
    return <SessionHistory workspace={ws} onClose={closeOverlay} />;
  }
  if (overlay === "decks") {
    return (
      <CardSystem
        workspace={ws}
        initialView={cardDeckInitialView()}
        onClose={closeOverlay}
        onStartSession={closeOverlay}
        onWorkspaceUpdate={setWs}
      />
    );
  }

  return (
    <div className="stage">
      <BrandBar
        view={view}
        onOpenCards={openCardDeck}
        onOpenHistory={() => openOverlay("history")}
        onOpenSettings={() => openOverlay("settings")}
        onSignOut={onSignOut}
      />

      {view === "agenda" && (
        <SyncView
          family={family}
          workspaceId={ws?.id}
          onDistill={({ mode = "paste", topics } = {}) => {
            if (topics?.length) setAgendaTopics(topics);
            else setAgendaTopics([]);
            setCaptureMode(mode);
            go("capture");
          }}
        />
      )}
      {view === "capture" && (
        <CaptureView
          text={captureText}
          setText={setCaptureText}
          initialMode={captureMode}
          onBack={() => go("agenda")}
          onProcess={runDistill}
        />
      )}
      {view === "processing" && <ProcessingView done={distillDone} familyNames={processingFamilyLabel} />}
      {view === "review" && <ReviewView cards={cards} setCards={setCards} roleOf={roleOf} onBack={() => go("capture")} onBuild={buildWeek} distillError={distillError} />}
      {view === "plan" && <PlanView keptCards={keptCards} adults={adults} roleOf={roleOf} onRestart={restart} />}
    </div>
  );
}
