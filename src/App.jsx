// ─────────────────────────────────────────────────────────────────────────────
// App.jsx - FamilyPause main weekly-sync app
// Ported from the design bundle (project/app: app.jsx, views.jsx, review.jsx,
// screens.css) into a single React component, wired to real data:
//   • Anthropic distillation (claude-haiku-4-5)
//   • Supabase session save (on "Build my week") + realtime sync
//   • Live speech capture (MediaRecorder + Whisper, ChatGPT-style)
//   • workspace.family_context for people / categories / person routing
//
// Flow (StepRail): Agenda → Capture → Distill → Resolve → Review → Plan
// Styling comes from src/styles/tokens.css + src/styles/screens.css.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { callDistillExtraction, callFamilyPauseAI, buildSystemPrompt } from "./lib/ai";
import Settings from "./components/Settings.jsx";
import CardSystem from "./components/CardSystem.jsx";
import Paywall from "./components/Paywall.jsx";
import PlanView from "./components/PlanView.jsx";
import { paywallReason } from "./lib/subscription";
import { loadDistillsToday, recordDistillUsage } from "./lib/distillUsage";
import { parseAppLocation, syncPath, SYNC_VIEWS, cardsPath } from "./lib/routes";
import { normalizeCardPeople } from "./lib/familyContext";
import {
  applySyncResults,
  clearCardCalendarSync,
  getCalendarConnection,
  isSyncEligible,
  needsDateTime,
  startGoogleCalendarConnect,
  syncCalendarEvents,
  syncCardsToCalendar,
  unsyncCalendarEvent,
  cardToCalendarEvent,
} from "./lib/googleCalendar";
import { canRecordAudio, pickRecordingMimeType, transcribeAudioBlob } from "./lib/transcribe";
import { speechPreviewSupported, startSpeechPreview } from "./lib/speechPreview";
import {
  clearCaptureDraft,
  loadCaptureDraft,
  saveCaptureDraft,
} from "./lib/captureDraftLocal";
import { deleteSessionRow, uiInputMode } from "./lib/sessionDraft";
import { prefersReducedMotion } from "./lib/motion";
import { playPlanChime, soundsEnabledForWorkspace } from "./lib/sounds";
import FamilySetupForm from "./parked/onboarding-steps/FamilySetupForm.jsx";
import InviteSpouseForm from "./parked/onboarding-steps/InviteSpouseForm.jsx";
import { formatDigitalPrice, PHYSICAL_DECK_PRICE } from "./lib/deckPricing";

// ── DEFAULT CONTEXT (fallback when workspace has none) ───────────────────────
const DEFAULT_CONTEXT = {
  people: [],
  kids: [],
  businesses: [],
  categories: ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health"],
};

async function patchFamilyContext(workspaceId, prev, patch) {
  const family_context = { ...(prev && typeof prev === "object" ? prev : {}), ...patch };
  const { data, error } = await supabase
    .from("workspaces")
    .update({ family_context })
    .eq("id", workspaceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

const SAMPLE_TRANSCRIPT = `Amanda: Okay, before the week runs away from us again, let's actually do this.
Spence: Agreed. Start with money? The accountant emailed about Q2.
Amanda: Yeah, we need to call the accountant before month end, it's getting tight.
Spence: I'll own that. And we still haven't looked at the Q2 household budget together. Can we block 30 minutes Tuesday night?
Amanda: Tuesday works. Put it on the shared calendar.
Spence: Done. Kids: Jordan has the dentist, right?
Amanda: Take Jordan to the dentist, Thursday at 3pm. I can do the pickup.
Spence: And Maya's swim lessons start back up. First one is Saturday morning, 9am at the rec center.
Amanda: Got it. I'll handle Maya's swim.
Spence: On the business side, launch week. I think we're blocked on the new payment links.
Amanda: Right, you need to replace the placeholder Stripe links in the app before Friday.
Spence: Yep, that's on me. Friday at the latest.
Amanda: One more thing. Let's protect a real Sabbath this week. No screens after dinner Saturday, just us and the kids.
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

async function callDistillAI(prompt, extraction) {
  return callDistillExtraction({ prompt, extraction });
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function formatWeekdayReference(meetingDate) {
  const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const start = new Date(`${meetingDate}T12:00:00`);
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    parts.push(`${WEEKDAYS[d.getDay()]}=${y}-${m}-${day}`);
  }
  return parts.join(", ");
}
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
  { key: "resolve", label: "Times" },
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

function BrandBar({ view, onOpenCards, onOpenSettings, onSignOut }) {
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

function ResumeBanner({ draft, onResume, onDiscard }) {
  const words = draft.transcript?.trim() ? draft.transcript.trim().split(/\s+/).length : 0;
  const when = draft.updated_at
    ? new Date(draft.updated_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";

  return (
    <div className="resume-banner rise">
      <div className="resume-banner-copy">
        <div className="eyebrow" style={{ marginBottom: 6 }}>Interrupted sync</div>
        <p>
          {words > 0
            ? `You left a draft in progress (${words} word${words === 1 ? "" : "s"}).`
            : "You left a sync in progress."}
          {when ? ` Last saved ${when}.` : ""}
        </p>
      </div>
      <div className="resume-banner-actions">
        <button type="button" className="btn btn-soft" onClick={onDiscard}>Discard</button>
        <button type="button" className="btn btn-primary" onClick={onResume}>Resume</button>
      </div>
    </div>
  );
}

function SyncHeader({ family }) {
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
    </div>
  );
}

function DeckOncePrompt({ onUnlock, onDismiss }) {
  return (
    <div className="deck-once rise" style={{
      background: "var(--paper-card)",
      border: "1px solid var(--line)",
      borderRadius: "var(--r-lg)",
      padding: "22px 24px",
      marginBottom: 28,
      boxShadow: "var(--shadow-sm)",
    }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Card deck · Optional</div>
      <h3 style={{ fontFamily: "var(--display)", fontSize: 22, margin: "0 0 8px" }}>
        Want a question before you record?
      </h3>
      <p style={{ margin: "0 0 18px", color: "var(--ink-2)", fontSize: 15, lineHeight: 1.55 }}>
        52 weekly prompts that go deeper than the to-do list. Unlock with a code, buy digital for {formatDigitalPrice()}, or skip and start your sync.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" className="btn btn-primary" onClick={onUnlock}>See the deck</button>
        <button type="button" className="btn btn-ghost" onClick={onDismiss}>Skip for now</button>
      </div>
      <p style={{ margin: "14px 0 0", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: ".04em", color: "var(--ink-3)" }}>
        Physical deck ${PHYSICAL_DECK_PRICE} · We won&apos;t ask again if you skip
      </p>
    </div>
  );
}

function ApproachChoice({ onStartSync, onJump, showDeckPrompt, onUnlockDeck, onDismissDeck }) {
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

      {showDeckPrompt && (
        <DeckOncePrompt onUnlock={onUnlockDeck} onDismiss={onDismissDeck} />
      )}

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
      <SyncHeader family={family} />

      <div className="tabs">
        <button type="button" className={"tab " + (tab === "agenda" ? "on" : "")} onClick={() => setTab("agenda")}>Agenda</button>
        <button type="button" className={"tab " + (tab === "actions" ? "on" : "")} onClick={() => setTab("actions")}>
          Actions <span className="count">(0)</span>
        </button>
        <button type="button" className={"tab " + (tab === "log" ? "on" : "")} onClick={() => setTab("log")}>Log</button>
      </div>

      <div className="worksplit">
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
              <div style={{ fontSize: 15 }}>Distill your conversation and your actions appear here, sorted by person.</div>
            </div>
          )}

          {tab === "log" && (
            <div className="rise" style={{ textAlign: "center", padding: "70px 20px", color: "var(--ink-3)" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--ink-2)", marginBottom: 8 }}>
                No meeting log yet.
              </div>
              <div style={{ fontSize: 15 }}>FamilyPause organizes this week. It does not keep a searchable history of past syncs.</div>
            </div>
          )}

          {tab === "agenda" && (
            <div className="ctabar">
              <div className="copy">
                <h3>Ready when you are.</h3>
                <p>Record live or paste your conversation. FamilyPause turns it into a plan in about ten seconds.</p>
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
      </div>
    </div>
  );
}

function SyncView({ family, workspaceId, onDistill, showDeckPrompt, onUnlockDeck, onDismissDeck }) {
  const [phase, setPhase] = useState("choice");
  const [pickedTopics, setPickedTopics] = useState([]);

  if (phase === "choice") {
    return (
      <ApproachChoice
        showDeckPrompt={showDeckPrompt}
        onUnlockDeck={onUnlockDeck}
        onDismissDeck={onDismissDeck}
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
function CaptureView({ text, setText, mode, setMode, onBack, onProcess }) {
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

  const pickMode = (next) => {
    if (next === mode || transcribing) return;
    if (dictating) cancelDictation();
    setDictNotice("");
    setDictStatus("");
    setMode(next);
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
        setDictNotice("Recording too short. Speak for at least 2-3 seconds, then tap the check mark.");
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
        : "Recording… tap ✓ when done. Words appear after save");
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
      <div className="lead">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Step 2 · Have your meeting</div>
        <h1>Talk like humans.<br /><em>We&apos;ll handle the structure.</em></h1>
        <p>Type or paste a transcript, or dictate with speech-to-text. Kids, money, work, the week ahead: whatever needs talking about.</p>
      </div>

      <div className="panel capcard">
        <div className="captoggle">
          <button type="button" className={"seg " + (mode === "paste" ? "on" : "")} onClick={() => pickMode("paste")} disabled={transcribing}>
            <Ico d={I.doc} size={15} /> Write or paste
          </button>
          <button type="button" className={"seg " + (mode === "dictate" ? "on" : "")} onClick={() => pickMode("dictate")} disabled={transcribing}>
            <Ico d={I.wave} size={15} /> Speech to text to transcribe your meeting
          </button>
        </div>

        {mode === "paste" && (
          <div style={{ padding: "4px 10px 10px" }}>
            <p className="caphint" style={{ margin: "0 0 8px", padding: "0 4px" }}>
              Paste transcript from your written notes or other apps
            </p>
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
                          : `Recording ${Math.floor(recordSecs / 60)}:${String(recordSecs % 60).padStart(2, "0")}. Tap ✓ when done`}
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
    `${familyNames}: nobody gets dropped.`,
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

// ── RESOLVE TIMES (between Distill and Review) ───────────────────────────────
function ResolveTimesView({ cards, setCards, onBack, onContinue }) {
  const [snapshot] = useState(() =>
    cards.filter(needsDateTime).map((c) => ({
      id: c.id,
      task: c.task,
      person: c.person,
      category: c.category,
    })),
  );
  const [drafts, setDrafts] = useState(() => {
    const initial = {};
    cards.filter(needsDateTime).forEach((c) => {
      initial[c.id] = { date: c.date || "", time: c.time || "" };
    });
    return initial;
  });
  const [confirmedIds, setConfirmedIds] = useState(() => new Set());

  const total = snapshot.length;
  const resolvedCount = confirmedIds.size;
  const allResolved = total > 0 && resolvedCount === total;

  const patchDraft = (id, patch) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const confirmItem = (id) => {
    const draft = drafts[id];
    if (!draft?.date || !draft?.time) return;
    setCards((arr) => arr.map((c) => (
      c.id === id ? { ...c, date: draft.date, time: draft.time, datetime_confirmed: true } : c
    )));
    setConfirmedIds((prev) => new Set(prev).add(id));
  };

  return (
    <div className="view resolve-view">
      <div className="resolve-intro">
        <div className="eyebrow" style={{ marginBottom: 9 }}>Step 3b · Fill in the times</div>
        <h1>A few items need a <em>date and time</em> before they can land on your calendar.</h1>
        <p style={{ color: "var(--ink-2)", marginTop: 10 }}>
          {total} {total === 1 ? "item needs" : "items need"} scheduling details. Enter both fields, then confirm each item.
        </p>
        <p className="resolve-progress">{resolvedCount} of {total} resolved</p>
      </div>

      <div className="resolve-list">
        {snapshot.map((item) => {
          const draft = drafts[item.id] || { date: "", time: "" };
          const done = confirmedIds.has(item.id);
          const canConfirm = !!draft.date && !!draft.time;
          return (
            <div className={"resolve-row" + (done ? " resolve-row--done" : "")} key={item.id}>
              <div className="resolve-row-head">
                {done && (
                  <span className="resolve-done-mark" aria-hidden="true">
                    <Ico d={I.check} size={12} />
                  </span>
                )}
                <div>
                  <p className="resolve-row-task">{item.task}</p>
                  <div className="resolve-row-meta">
                    <span>{item.person}</span>
                    {item.category && <span>· {item.category}</span>}
                  </div>
                </div>
              </div>
              <div className="resolve-row-fields">
                <div className="resolve-field">
                  <label htmlFor={`resolve-date-${item.id}`}>Date</label>
                  <input
                    id={`resolve-date-${item.id}`}
                    type="date"
                    value={draft.date}
                    disabled={done}
                    onChange={(e) => patchDraft(item.id, { date: e.target.value })}
                  />
                </div>
                <div className="resolve-field">
                  <label htmlFor={`resolve-time-${item.id}`}>Time</label>
                  <input
                    id={`resolve-time-${item.id}`}
                    type="time"
                    value={draft.time}
                    disabled={done}
                    onChange={(e) => patchDraft(item.id, { time: e.target.value })}
                  />
                </div>
              </div>
              {!done && (
                <button
                  type="button"
                  className="btn btn-soft resolve-confirm"
                  disabled={!canConfirm}
                  onClick={() => confirmItem(item.id)}
                >
                  Confirm
                </button>
              )}
              {done && (
                <p className="resolve-confirmed-label">
                  <Ico d={I.check} size={12} /> Confirmed · {formatWhen(draft.date, draft.time)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="resolve-foot">
        <button type="button" className="linkish" onClick={onBack}>← Back to capture</button>
        <button
          type="button"
          className={"btn btn-primary btn-lg" + (!allResolved ? " btn-disabled" : "")}
          disabled={!allResolved}
          onClick={onContinue}
        >
          {allResolved ? "Continue to review" : "Resolve all items to continue"}
        </button>
      </div>
    </div>
  );
}

// ── REVIEW (View 4) ───────────────────────────────────────────────────────────
function ReviewView({ cards, setCards, roleOf, onBack, onBuild, distillError, calendarSyncing }) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [lastAction, setLastAction] = useState(null);

  const decide = (id, status) => {
    const item = cards.find((c) => c.id === id);
    if (item && item.status !== status) setLastAction({ id, previousStatus: item.status });
    setCards((arr) => arr.map((it) => (it.id === id ? { ...it, status } : it)));
  };

  const undoLast = () => {
    if (!lastAction) return;
    setCards((arr) => arr.map((it) => (it.id === lastAction.id ? { ...it, status: lastAction.previousStatus } : it)));
    setLastAction(null);
  };

  const categories = ["all", ...new Set(cards.map((c) => c.category).filter(Boolean))];
  const visible = activeCategory === "all" ? cards : cards.filter((c) => c.category === activeCategory);
  const total = cards.length;
  const decided = cards.filter((c) => c.status !== STATUS.OPEN).length;
  const kept = cards.filter((c) => c.status === STATUS.KEPT || c.status === STATUS.CALENDARED).length;
  const openCount = cards.filter((c) => c.status === STATUS.OPEN).length;
  const allDecided = total > 0 && decided === total;
  const pct = total ? Math.round((decided / total) * 100) : 0;
  const keepAll = () => setCards((arr) => arr.map((it) => (it.status === STATUS.OPEN ? { ...it, status: STATUS.KEPT } : it)));
  const discardAll = () => setCards((arr) => arr.map((it) => (it.status === STATUS.OPEN ? { ...it, status: STATUS.DISCARDED } : it)));

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
        {lastAction && (
          <button className="linkish" onClick={undoLast}>Undo last</button>
        )}
        {openCount > 0 && (
          <>
            <button className="linkish" style={{ marginLeft: "auto" }} onClick={keepAll}>Keep all remaining →</button>
            <button className="linkish" onClick={discardAll}>Discard all remaining</button>
          </>
        )}
      </div>

      {categories.length > 2 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={"chip " + (activeCategory === cat ? "chip-terra" : "chip-soft")}
              onClick={() => setActiveCategory(cat)}
              style={{ cursor: "pointer", border: "none" }}
            >
              {cat === "all" ? "All" : cat}
            </button>
          ))}
        </div>
      )}

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
          {visible.map((it) => {
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
          <button
            type="button"
            className={"btn btn-primary btn-lg" + (calendarSyncing ? " btn-breathing" : "")}
            disabled={!allDecided || calendarSyncing}
            onClick={onBuild}
          >
            {calendarSyncing ? (
              <em>Building your week…</em>
            ) : (
              <><Ico d={I.arrow} size={16} /> Build my week</>
            )}
          </button>
        </div>
      </div>
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
  const [distillsToday, setDistillsToday] = useState(0);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [unsyncingCardId, setUnsyncingCardId] = useState(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [planArrivalPhase, setPlanArrivalPhase] = useState("done");
  const [planArrivalMode, setPlanArrivalMode] = useState("static");
  const [showPlanConfetti, setShowPlanConfetti] = useState(false);
  const [calendarConnectPrompt, setCalendarConnectPrompt] = useState(false);
  const [inputMode, setInputMode] = useState("paste");
  const [cards, setCards] = useState([]);
  const [distillError, setDistillError] = useState(null);
  const [distillDone, setDistillDone] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [captureMode, setCaptureMode] = useState("paste");
  const [agendaTopics, setAgendaTopics] = useState([]);
  const [captureDraft, setCaptureDraft] = useState(null);
  const [meetingDate] = useState(todayStr());
  const [ws, setWs] = useState(workspace);
  const [showFamilyNudge, setShowFamilyNudge] = useState(false);
  const [showInviteNudge, setShowInviteNudge] = useState(false);

  const sessionIdRef = useRef(null);
  const savedRef = useRef(false);
  const postConnectSyncRef = useRef(false);
  const familyNudgeShownRef = useRef(false);
  const inviteNudgeShownRef = useRef(false);
  const cardsRef = useRef(cards);
  useEffect(() => { cardsRef.current = cards; }, [cards]);

  useEffect(() => {
    if (view !== "plan" || planArrivalPhase !== "interstitial") return;
    const t = setTimeout(() => setPlanArrivalPhase("revealing"), 2000);
    return () => clearTimeout(t);
  }, [view, planArrivalPhase]);

  useEffect(() => {
    if (view !== "plan" || planArrivalPhase !== "revealing") return;
    const ms = planArrivalMode === "quick" ? 600 : 1000;
    const t = setTimeout(() => {
      setPlanArrivalPhase("done");
      setShowPlanConfetti(false);
    }, ms);
    return () => clearTimeout(t);
  }, [view, planArrivalPhase, planArrivalMode]);

  useEffect(() => { setWs(workspace); }, [workspace]);

  // Refresh workspace after digital-offer return to agenda
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("checkout") !== "digital_ok" || !ws?.id) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("workspaces").select("*").eq("id", ws.id).maybeSingle();
      if (active && data) setWs(data);
      navigate(syncPath(viewFromLocation()), { replace: true });
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, ws?.id]);

  const loadCaptureDraftState = useCallback(() => {
    if (!ws?.id) return;
    const draft = loadCaptureDraft(ws.id);
    setCaptureDraft(draft?.transcript?.trim() ? draft : null);
  }, [ws?.id]);

  useEffect(() => {
    if (!ws?.id) return;
    loadCaptureDraftState();
  }, [ws?.id, loadCaptureDraftState]);

  useEffect(() => {
    const parsed = parseAppLocation(location.pathname, location.search);
    if (parsed.area === "sync" && SYNC_VIEWS.includes(parsed.view)) {
      setView(parsed.view);
      setOverlay(null);
    } else if (parsed.area === "overlay") {
      setOverlay(parsed.overlay);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (view === "agenda" || overlay === "decks") loadCaptureDraftState();
  }, [view, overlay, loadCaptureDraftState]);

  const go = (v, { replace = false } = {}) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate(syncPath(v), { replace });
  };

  const openOverlay = (name) => {
    const paths = {
      settings: "/app/settings",
      decks: "/app/cards",
      paywall: "/app/paywall",
    };
    navigate(paths[name] || syncPath(view));
  };

  const closeOverlay = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(syncPath(view));
  };

  const openCardDeck = () => openOverlay("decks");

  const startWeeklySync = () => {
    navigate(syncPath("agenda"));
  };

  const leaveCards = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(syncPath(view));
  };

  const cardDeckInitialView = () => {
    const parsed = parseAppLocation(location.pathname, location.search);
    return parsed.cardsView || "draw";
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

      const todayCount = await loadDistillsToday(ws.id);
      if (active) setDistillsToday(todayCount);
    })();
    return () => { active = false; };
  }, [ws?.id]);

  useEffect(() => {
    if (!ws?.id || !user?.id) {
      setCalendarConnected(false);
      return;
    }
    let active = true;
    getCalendarConnection(ws.id, user.id).then((conn) => {
      if (!active) return;
      setCalendarConnected(conn.connected);
    });
    return () => { active = false; };
  }, [ws?.id, user?.id, overlay, location.search]);

  const context = ws?.family_context || DEFAULT_CONTEXT;
  const kids = Array.isArray(context.kids) ? context.kids : [];
  const adults = (Array.isArray(context.people) ? context.people : DEFAULT_CONTEXT.people).filter((p) => !kids.includes(p));
  const displayName = adults[0] || user?.user_metadata?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "Friend";
  const spouseName = adults[1] || "";
  const showDeckPrompt = Boolean(
    ws?.id
    && !ws.cards_unlocked
    && !(Array.isArray(ws.unlocked_deck_years) && ws.unlocked_deck_years.length > 0)
    && !context.deck_prompt_dismissed_at
  );

  useEffect(() => {
    if (view !== "review") return;
    if (familyNudgeShownRef.current || showFamilyNudge) return;
    if (context.family_names_nudge_dismissed_at) return;
    if (adults.length >= 2) return;
    familyNudgeShownRef.current = true;
    setShowFamilyNudge(true);
  }, [view, adults.length, context.family_names_nudge_dismissed_at, showFamilyNudge]);

  useEffect(() => {
    if (view !== "plan" || planArrivalPhase !== "done") return;
    if (inviteNudgeShownRef.current || showInviteNudge) return;
    if (context.invite_nudge_dismissed_at) return;
    inviteNudgeShownRef.current = true;
    setShowInviteNudge(true);
  }, [view, planArrivalPhase, context.invite_nudge_dismissed_at, showInviteNudge]);

  const dismissDeckPrompt = async () => {
    if (!ws?.id) return;
    try {
      const data = await patchFamilyContext(ws.id, context, {
        deck_prompt_dismissed_at: new Date().toISOString(),
      });
      setWs(data);
    } catch (e) {
      console.error("[Deck prompt] dismiss", e);
    }
  };

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

  // Auto-save capture transcript locally every 30s (safety net for refresh/close).
  useEffect(() => {
    if (!ws?.id || view !== "capture") return undefined;

    const persist = () => {
      if (!captureText.trim()) {
        clearCaptureDraft(ws.id);
        setCaptureDraft(null);
        return;
      }
      saveCaptureDraft(ws.id, {
        transcript: captureText,
        inputMode: captureMode,
        meetingDate,
      });
    };

    const debounce = setTimeout(persist, 400);
    persist();
    const timer = setInterval(persist, 30000);
    const onUnload = () => persist();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearTimeout(debounce);
      clearInterval(timer);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [ws?.id, view, captureText, captureMode, meetingDate]);

  const resumeCaptureDraft = () => {
    if (!captureDraft) return;
    setCaptureText(captureDraft.transcript || "");
    setCaptureMode(uiInputMode(captureDraft.input_mode));
    navigate(syncPath("capture"));
  };

  const discardCaptureDraft = () => {
    if (ws?.id) clearCaptureDraft(ws.id);
    setCaptureDraft(null);
  };

  const clearLocalCaptureDraft = () => {
    if (ws?.id) clearCaptureDraft(ws.id);
    setCaptureDraft(null);
  };

  const clearActiveSession = async () => {
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    clearLocalCaptureDraft();
    if (!id) return;
    try {
      await deleteSessionRow(supabase, id);
    } catch {
      /* ignore */
    }
  };

  // ── Distill (real AI) ────────────────────────────────────────────────────
  const runDistill = async (text, mode = "paste") => {
    const block = paywallReason(subscription, { distillsToday });
    if (block) {
      setPaywallBlock(block);
      openOverlay("paywall");
      return;
    }

    setInputMode(mode);
    setDistillDone(false);
    setDistillError(null);
    setCards([]);
    clearLocalCaptureDraft();
    sessionIdRef.current = null;
    go("processing");
    savedRef.current = false;

    const topicHint = agendaTopics.length
      ? `\nFocus topics for this sync: ${agendaTopics.join(", ")}. Prioritize items related to these topics when present in the transcript.`
      : "";

    let parsed = [];
    let errorMsg = null;
    try {
      const userPrompt = `Extract all action items from this family meeting transcript.

Meeting date (anchor for relative days): ${meetingDate}
Weekday dates this planning week: ${formatWeekdayReference(meetingDate)}

Transcript:
${text}`;

      const raw = await callDistillAI(userPrompt, {
        meeting_date: meetingDate,
        people: context.people || [],
        businesses: context.businesses || [],
        categories: context.categories || [],
        topic_hint: topicHint,
      });
      try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
      catch { const m = raw.match(/\[[\s\S]*\]/); if (m) parsed = JSON.parse(m[0]); }
    } catch (err) {
      errorMsg = err?.message || String(err);
      parsed = [];
    }

    const newCards = normalizeCardPeople(
      parsed.map((c, i) => ({ ...c, id: c.id ?? i + 1, status: STATUS.OPEN })),
      context
    );
    setCards(newCards);
    setDistillError(errorMsg);
    setDistillDone(true);

    if (!errorMsg && ws?.id && newCards.length > 0) {
      try {
        await recordDistillUsage(ws.id);
        setDistillsToday((n) => n + 1);
        const reviewPayload = {
          transcript: text,
          input_mode: mode === "dictate" ? "record" : "paste",
          cards: newCards,
          status: "review",
        };
        if (sessionIdRef.current) {
          const { error } = await supabase
            .from("sessions")
            .update(reviewPayload)
            .eq("id", sessionIdRef.current);
          if (!error) { /* session updated */ }
        } else {
          const { data, error } = await supabase.from("sessions").insert({
            workspace_id: ws.id,
            meeting_date: meetingDate,
            created_by: user?.id,
            ...reviewPayload,
          }).select().single();
          if (!error && data) {
            sessionIdRef.current = data.id;
          }
        }
      } catch { /* session update is best-effort */ }
    }

    const nextView = newCards.some(needsDateTime) ? "resolve" : "review";
    setTimeout(() => go(nextView, { replace: true }), 650); // let the orb finish
  };

  // Persist review / resolve card edits for spouse realtime sync
  useEffect(() => {
    if (!sessionIdRef.current || (view !== "review" && view !== "resolve")) return;
    const t = setTimeout(() => {
      supabase.from("sessions").update({ cards }).eq("id", sessionIdRef.current);
    }, 400);
    return () => clearTimeout(t);
  }, [cards, view]);

  const markFirstSessionComplete = async () => {
    if (!ws?.id || ws.first_session_completed) return;
    const { error } = await supabase
      .from("workspaces")
      .update({ first_session_completed: true })
      .eq("id", ws.id);
    if (!error) setWs((prev) => ({ ...prev, first_session_completed: true }));
  };

  const finishBuildSession = async () => {
    if (!ws?.id || savedRef.current) return;
    savedRef.current = true;
    try {
      await clearActiveSession();
    } catch {
      savedRef.current = false;
    }
  };

  const buildWeek = async () => {
    const reduced = prefersReducedMotion();
    const isFirstCelebration = !ws?.first_session_completed;
    const arrivalMode = reduced ? "static" : isFirstCelebration ? "full" : "quick";

    if (calendarConnected && ws?.id) {
      const kept = cards.filter((c) => c.status === STATUS.KEPT || c.status === STATUS.CALENDARED);
      const syncable = kept.filter((c) => isSyncEligible(c) && !c.calendar_synced);
      if (syncable.length > 0) {
        setCalendarSyncing(true);
        try {
          const { updatedCards } = await syncCardsToCalendar(ws.id, cards, {
            sessionId: sessionIdRef.current ?? undefined,
          });
          setCards(updatedCards);
        } catch (e) {
          console.error("[Build week] calendar sync", e);
          setCards((prev) => prev.map((c) => (
            isSyncEligible(c)
            && (c.status === STATUS.KEPT || c.status === STATUS.CALENDARED)
            && !c.calendar_synced
              ? { ...c, calendar_sync_failed: true }
              : c
          )));
        } finally {
          setCalendarSyncing(false);
        }
      }
    }

    if (!reduced) playPlanChime(soundsEnabledForWorkspace(ws));

    setPlanArrivalMode(arrivalMode);
    setShowPlanConfetti(isFirstCelebration && !reduced);
    setPlanArrivalPhase(arrivalMode === "full" ? "interstitial" : arrivalMode === "quick" ? "revealing" : "done");

    go("plan");
    await markFirstSessionComplete();
    await finishBuildSession();
  };

  const restart = async () => {
    setCards([]);
    setDistillDone(false);
    savedRef.current = false;
    setPlanArrivalPhase("done");
    setPlanArrivalMode("static");
    setShowPlanConfetti(false);
    await clearActiveSession();
    setCaptureText("");
    setCaptureMode("paste");
    go("agenda");
    loadCaptureDraftState();
  };

  const keptCards = cards.filter((c) => c.status === STATUS.KEPT || c.status === STATUS.CALENDARED);

  const retryCardSync = async (cardId) => {
    if (!ws?.id) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card || !isSyncEligible(card)) return;
    setCalendarBusy(true);
    try {
      const { results } = await syncCalendarEvents(ws.id, [cardToCalendarEvent(card)], {
        sessionId: sessionIdRef.current ?? undefined,
      });
      setCards((prev) => applySyncResults(prev, results));
    } catch (e) {
      console.error("[Plan] retry sync", e);
      setCards((prev) => prev.map((c) => (
        c.id === cardId ? { ...c, calendar_sync_failed: true } : c
      )));
    } finally {
      setCalendarBusy(false);
    }
  };

  const handlePlanAddToCal = () => {
    if (!ws?.id) return;
    setCalendarConnectPrompt(true);
  };

  const unsyncCard = async (cardId) => {
    if (!ws?.id) return;
    const card = cards.find((c) => c.id === cardId);
    if (!card?.calendar_synced) return;
    setUnsyncingCardId(cardId);
    try {
      if (card.google_event_id) {
        await unsyncCalendarEvent(ws.id, card.google_event_id, {
          sessionId: sessionIdRef.current ?? undefined,
          cardId,
        });
      }
      setCards((prev) => clearCardCalendarSync(prev, cardId));
    } catch (e) {
      console.error("[Plan] unsync", e);
      if (/404|not found|notFound/i.test(e?.message || "")) {
        setCards((prev) => clearCardCalendarSync(prev, cardId));
      }
    } finally {
      setUnsyncingCardId(null);
    }
  };

  const confirmCalendarConnect = async () => {
    if (!ws?.id) return;
    setCalendarBusy(true);
    try {
      await startGoogleCalendarConnect(ws.id, "/app/sync/plan?calendar=connect");
    } catch (e) {
      console.error("[Plan] calendar connect", e);
      setCalendarConnectPrompt(false);
    } finally {
      setCalendarBusy(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("calendar") !== "connect") {
      postConnectSyncRef.current = false;
      return;
    }
    if (!ws?.id || !user?.id || postConnectSyncRef.current) return;
    postConnectSyncRef.current = true;
    let active = true;
    (async () => {
      navigate(syncPath("plan"), { replace: true });
      const conn = await getCalendarConnection(ws.id, user.id);
      if (!active || !conn.connected) return;
      setCalendarConnected(true);
      setCalendarConnectPrompt(false);
      const snapshot = cardsRef.current;
      const pending = snapshot.filter(
        (c) => (c.status === STATUS.KEPT || c.status === STATUS.CALENDARED) && isSyncEligible(c) && !c.calendar_synced,
      );
      if (!pending.length) return;
      setCalendarBusy(true);
      try {
        const { updatedCards } = await syncCardsToCalendar(ws.id, snapshot, {
          sessionId: sessionIdRef.current ?? undefined,
        });
        if (active) setCards(updatedCards);
      } catch (e) {
        console.error("[Plan] post-connect sync", e);
      } finally {
        if (active) setCalendarBusy(false);
      }
    })();
    return () => { active = false; };
  }, [location.search, ws?.id, user?.id, navigate]);

  // ── Overlays ─────────────────────────────────────────────────────────────
  if (overlay === "paywall") {
    const resolvedReason = paywallBlock || paywallReason(subscription, { distillsToday }) || "upgrade";
    return (
      <div className="stage" style={{ padding: "48px 24px 80px" }}>
        <Paywall reason={resolvedReason} onClose={() => { closeOverlay(); setPaywallBlock(null); }} />
      </div>
    );
  }
  if (overlay === "settings") {
    const decksUnlocked = ws?.cards_unlocked || (Array.isArray(ws?.unlocked_deck_years) && ws.unlocked_deck_years.length > 0);
    return (
      <Settings
        workspace={ws}
        user={user}
        onSignOut={onSignOut}
        onClose={closeOverlay}
        onOpenDecks={() => navigate(decksUnlocked ? cardsPath("library") : cardsPath("unlock"))}
        onWorkspaceUpdate={setWs}
      />
    );
  }
  if (overlay === "decks") {
    const showResume = captureDraft && overlay === "decks";
    return (
      <div className="stage">
        {showResume && (
          <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
            <ResumeBanner draft={captureDraft} onResume={resumeCaptureDraft} onDiscard={discardCaptureDraft} />
          </div>
        )}
        <CardSystem
          workspace={ws}
          meetingDate={meetingDate}
          initialView={cardDeckInitialView()}
          onClose={leaveCards}
          onStartSession={startWeeklySync}
          onSkip={async () => {
            await dismissDeckPrompt();
            startWeeklySync();
          }}
          onWorkspaceUpdate={setWs}
        />
      </div>
    );
  }

  return (
    <div className="stage">
      {(showFamilyNudge || showInviteNudge) && ws?.id && (
        <div
          className="nudge-scrim"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(42, 37, 29, 0.45)",
            overflowY: "auto",
            padding: "24px 16px 48px",
          }}
        >
          <div style={{
            maxWidth: 520,
            margin: "32px auto",
            background: "var(--paper)",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-lg)",
            padding: "8px 20px 28px",
          }}>
            {showFamilyNudge && (
              <FamilySetupForm
                workspaceId={ws.id}
                displayName={displayName}
                onSaved={(data) => {
                  if (data) setWs((prev) => ({ ...prev, ...data }));
                  setShowFamilyNudge(false);
                }}
                onSkip={(data) => {
                  if (data) setWs((prev) => ({ ...prev, ...data }));
                  setShowFamilyNudge(false);
                }}
              />
            )}
            {!showFamilyNudge && showInviteNudge && (
              <InviteSpouseForm
                workspaceId={ws.id}
                spouseName={spouseName}
                inviteCode={ws.invite_code}
                onDone={(data) => {
                  if (data) setWs((prev) => ({ ...prev, ...data }));
                  setShowInviteNudge(false);
                }}
              />
            )}
          </div>
        </div>
      )}

      <BrandBar
        view={view}
        onOpenCards={openCardDeck}
        onOpenSettings={() => openOverlay("settings")}
        onSignOut={onSignOut}
      />

      {captureDraft && view !== "capture" && view !== "processing" && view !== "resolve" && view !== "review" && view !== "plan" && (
        <ResumeBanner draft={captureDraft} onResume={resumeCaptureDraft} onDiscard={discardCaptureDraft} />
      )}

      {view === "agenda" && (
        <SyncView
          family={family}
          workspaceId={ws?.id}
          showDeckPrompt={showDeckPrompt}
          onUnlockDeck={() => openOverlay("decks")}
          onDismissDeck={dismissDeckPrompt}
          onDistill={async ({ mode = "paste", topics } = {}) => {
            if (topics?.length) setAgendaTopics(topics);
            else setAgendaTopics([]);
            setCaptureMode(mode);
            setCaptureText("");
            clearLocalCaptureDraft();
            go("capture");
          }}
        />
      )}
      {view === "capture" && (
        <CaptureView
          text={captureText}
          setText={setCaptureText}
          mode={captureMode}
          setMode={setCaptureMode}
          onBack={() => {
            loadCaptureDraftState();
            go("agenda");
          }}
          onProcess={runDistill}
        />
      )}
      {view === "processing" && <ProcessingView done={distillDone} familyNames={processingFamilyLabel} />}
      {view === "resolve" && (
        <ResolveTimesView
          cards={cards}
          setCards={setCards}
          onBack={() => go("capture")}
          onContinue={() => go("review")}
        />
      )}
      {view === "review" && (
        <ReviewView
          cards={cards}
          setCards={setCards}
          roleOf={roleOf}
          onBack={() => go("capture")}
          onBuild={buildWeek}
          distillError={distillError}
          calendarSyncing={calendarSyncing}
        />
      )}
      {view === "plan" && (
        <PlanView
          keptCards={keptCards}
          adults={adults}
          roleOf={roleOf}
          onRestart={restart}
          calendarConnected={calendarConnected}
          calendarBusy={calendarBusy}
          unsyncingCardId={unsyncingCardId}
          showCalendarConnect={calendarConnectPrompt}
          onConfirmCalendarConnect={confirmCalendarConnect}
          onCancelCalendarConnect={() => setCalendarConnectPrompt(false)}
          familyPauseEmail={user?.email}
          onRetrySync={retryCardSync}
          onAddToCal={handlePlanAddToCal}
          onUnsync={unsyncCard}
          meetingDate={meetingDate}
          arrivalPhase={planArrivalPhase}
          arrivalMode={planArrivalMode}
          showFirstConfetti={showPlanConfetti}
        />
      )}
    </div>
  );
}
