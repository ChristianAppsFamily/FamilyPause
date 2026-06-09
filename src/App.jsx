// ─────────────────────────────────────────────────────────────────────────────
// App.jsx - FamilyPause main weekly-sync app
// Ported from the design bundle (project/app: app.jsx, views.jsx, review.jsx,
// screens.css) into a single React component, wired to real data:
//   • Anthropic distillation (claude-haiku-4-5)
//   • Supabase session save (on "Build my week") + realtime sync
//   • Live speech capture (record mode)
//   • workspace.family_context for people / categories / person routing
//
// Flow (StepRail): Agenda → Capture → Distill(processing) → Review → Plan
// Styling comes from src/styles/tokens.css + src/styles/screens.css.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import Settings from "./components/Settings.jsx";
import SessionHistory from "./components/SessionHistory.jsx";

// ── DEFAULT CONTEXT (fallback when workspace has none) ───────────────────────
const DEFAULT_CONTEXT = {
  people: ["Spence", "Amanda"],
  kids: [],
  businesses: [],
  categories: ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health"],
};

// ── AI CALL ──────────────────────────────────────────────────────────────────
// The Anthropic call runs in the `distill` Supabase Edge Function so the API key
// stays server-side (never shipped in the browser bundle). supabase.functions.invoke
// forwards the signed-in user's JWT; the function verifies it before spending tokens.
async function callAI(prompt, system) {
  const { data, error } = await supabase.functions.invoke("distill", {
    body: { prompt, system },
  });
  if (error) throw error;
  return data?.text || "";
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split("T")[0]; }
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
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z",
  x: "M6 6l12 12M18 6 6 18",
  clock: ["M12 7v5l3 2", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"],
  gear: ["M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", "M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"],
  out: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
};

// ── STEP RAIL ─────────────────────────────────────────────────────────────────
const STEPS = [
  { key: "agenda", label: "Agenda" },
  { key: "capture", label: "Capture" },
  { key: "processing", label: "Distill" },
  { key: "review", label: "Review" },
  { key: "plan", label: "Plan" },
];
function StepRail({ view }) {
  const cur = STEPS.findIndex((s) => s.key === view);
  return (
    <div className="steps">
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

// ── AGENDA (View 1) ───────────────────────────────────────────────────────────
function AgendaView({ family, keptActions, onDistill, onOpenLog }) {
  const [tab, setTab] = useState("agenda");
  const [assist, setAssist] = useState(true);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState("");

  const addTopic = () => { const v = draft.trim(); if (v) setRows((r) => [...r, { id: "t" + Date.now(), cat: "Family", topic: v }]); setDraft(""); };

  return (
    <div className="view">
      <div className="synchead">
        <div className="who">
          <div className="eyebrow">Weekly Sync</div>
          <h1>{family.title}</h1>
          <div className="when">
            <span className="datepill"><Ico d={I.cal} size={14} /> {family.date}</span>
            <span className="faded">A good pause, every week.</span>
          </div>
        </div>
        <button className={"btn " + (assist ? "btn-soft" : "btn-ghost")} onClick={() => setAssist((a) => !a)}>
          <Ico d={I.spark} size={15} /> {assist ? "Hide Assistant" : "AI Assistant"}
        </button>
      </div>

      <div className="tabs">
        <button className={"tab " + (tab === "agenda" ? "on" : "")} onClick={() => setTab("agenda")}>Agenda</button>
        <button className={"tab " + (tab === "actions" ? "on" : "")} onClick={() => setTab("actions")}>
          Actions <span className="count">({keptActions.length})</span>
        </button>
        <button className={"tab " + (tab === "log" ? "on" : "")} onClick={() => setTab("log")}>Log</button>
      </div>

      <div className={"worksplit " + (assist ? "with-rail" : "")}>
        <div>
          {tab === "agenda" && (
            <div className="rise">
              <div className="rowhead">
                <span className="ct">{rows.length} {rows.length === 1 ? "Topic" : "Topics"}</span>
              </div>
              {rows.map((r, i) => (
                <div className="agrow" key={r.id}>
                  <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="catsel">{r.cat} ▾</span>
                  <span className={"tp " + (r.topic ? "" : "ph")}>{r.topic || "Topic…"}</span>
                  <span className="chev"><Ico d={I.chevD} size={14} /></span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input className="field" placeholder="Add a topic for this week…" value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} />
                <button className="btn btn-soft" onClick={addTopic}><Ico d={I.plus} size={14} /> Add</button>
              </div>

              <div className="ctabar" style={{ marginTop: 26 }}>
                <div className="copy">
                  <h3>Ready when you are.</h3>
                  <p>Record live or paste your conversation, and FamilyPause turns it into a plan in about ten seconds.</p>
                </div>
                <button className="btn btn-primary btn-lg" onClick={onDistill}>
                  <Ico d={I.bolt} size={16} fill /> Distill this week
                </button>
              </div>
            </div>
          )}

          {tab === "actions" && (
            keptActions.length === 0 ? (
              <div className="rise" style={{ textAlign: "center", padding: "70px 20px", color: "var(--ink-3)" }}>
                <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--ink-2)", marginBottom: 8 }}>No open actions yet.</div>
                <div style={{ fontSize: 15 }}>Distill your conversation and your actions appear here, sorted by person.</div>
              </div>
            ) : (
              <div className="rise">
                {keptActions.map((c) => (
                  <div className="agrow" key={c.id}>
                    <span className="catsel">{c.category}</span>
                    <span className="tp">{c.task}</span>
                    <span className="ktype" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>{c.person}</span>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "log" && (
            <div className="rise" style={{ textAlign: "center", padding: "70px 20px", color: "var(--ink-3)" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--ink-2)", marginBottom: 8 }}>Your past syncs live here.</div>
              <div style={{ fontSize: 15, marginBottom: 18 }}>Every meeting, summarized and searchable.</div>
              <button className="btn btn-ghost" onClick={onOpenLog}>Open full history</button>
            </div>
          )}
        </div>

        {assist && (
          <aside className="assist rise">
            <div className="ahead">
              <div className="aico"><Ico d={I.spark} size={17} /></div>
              <div>
                <div className="at">Meeting Assistant</div>
                <div className="as">Reads &amp; writes your agenda</div>
              </div>
            </div>
            <div className="assbubble">Hi, I'm here while you talk. I can add notes, draft action items, and tell you what you're forgetting.</div>
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

// ── CAPTURE (View 2) ──────────────────────────────────────────────────────────
function CaptureView({ onBack, onProcess }) {
  const [mode, setMode] = useState("paste");
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const recRef = useRef(null);
  const accRef = useRef("");

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const startRec = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Live recording requires Chrome or Safari."); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    accRef.current = text ? text + " " : "";
    rec.onresult = (e) => {
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
      if (final) { accRef.current += final; setText(accRef.current.trim()); }
    };
    rec.onerror = () => setRecording(false);
    recRef.current = rec; rec.start(); setRecording(true);
  };
  const stopRec = () => { recRef.current?.stop(); setRecording(false); };
  const toggleRec = () => (recording ? stopRec() : startRec());

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const ready = text.trim().length > 30;

  return (
    <div className="view capwrap">
      <div className="lead">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Step 1 · Have your meeting</div>
        <h1>Talk like humans.<br /><em>We'll handle the structure.</em></h1>
        <p>Paste a transcript from Otter or Apple Dictation, or record live. Talk about whatever needs talking about: kids, money, work, the week ahead.</p>
      </div>

      <div className="panel capcard">
        <div className="captoggle">
          <button className={"seg " + (mode === "paste" ? "on" : "")} onClick={() => setMode("paste")}><Ico d={I.doc} size={15} /> Paste transcript</button>
          <button className={"seg " + (mode === "record" ? "on" : "")} onClick={() => setMode("record")}><Ico d={I.mic} size={15} /> Record live</button>
        </div>

        {mode === "paste" ? (
          <div style={{ padding: "4px 10px 10px" }}>
            <textarea className="capta" placeholder="Paste your conversation here…" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="caprow">
              <span className="caphint">{text.trim() ? `${text.trim().split(/\s+/).length} words` : "Nothing pasted yet"}</span>
            </div>
          </div>
        ) : (
          <div className="recbox">
            <button className={"recbtn " + (recording ? "live" : "")} onClick={toggleRec}><Ico d={recording ? I.x : I.mic} size={30} /></button>
            <div className="rectime">{fmt(secs)}</div>
            {recording ? (
              <div className="recwave">{Array.from({ length: 13 }).map((_, i) => <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s`, height: 8 }} />)}</div>
            ) : (
              <div className="caphint" style={{ marginTop: 14 }}>{text.trim() ? "Recording captured · ready to distill" : "Tap to start recording your sync"}</div>
            )}
            {recording && text && <div style={{ marginTop: 14, fontSize: 14, color: "var(--ink-2)", maxWidth: 520, marginInline: "auto" }}>{text}</div>}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
        <button className="linkish" onClick={onBack}>← Back to agenda</button>
        <button className="btn btn-primary btn-lg" disabled={!ready} onClick={() => { stopRec(); onProcess(text); }}>
          <Ico d={I.bolt} size={16} fill /> Distill it
        </button>
      </div>
    </div>
  );
}

// ── PROCESSING (View 3) ───────────────────────────────────────────────────────
function ProcessingView({ done }) {
  const stepLabels = ["Reading your conversation", "Finding actions & appointments", "Sorting by person and category", "Building this week's review"];
  const subs = ["Listening to every voice in the room…", "Nobody gets dropped.", "Finance, Kids, Business, Family.", "Almost there."];
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
function ReviewView({ cards, setCards, roleOf, onBack, onBuild }) {
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
          <div className="eyebrow" style={{ marginBottom: 9 }}>Step 2 · This week's review</div>
          <h1>Keep what matters.<br /><em>Discard the rest.</em></h1>
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
          <div style={{ fontFamily: "var(--display)", fontSize: 22, fontStyle: "italic", color: "var(--ink-2)", marginBottom: 8 }}>Nothing to review.</div>
          <div style={{ fontSize: 15 }}>We couldn't extract items. Try a longer or clearer transcript.</div>
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
        <div className="eyebrow" style={{ marginBottom: 12 }}>Step 3 · Your week is built</div>
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
  const [view, setView] = useState("agenda");
  const [overlay, setOverlay] = useState(null); // "settings" | "history" | null
  const [cards, setCards] = useState([]);
  const [distillDone, setDistillDone] = useState(false);
  const [meetingDate] = useState(todayStr());
  const [ws, setWs] = useState(workspace);

  const sessionIdRef = useRef(null);
  const savedRef = useRef(false);

  useEffect(() => { setWs(workspace); }, [workspace]);

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

  const go = (v) => { window.scrollTo({ top: 0, behavior: "smooth" }); setView(v); };

  // ── Distill (real AI) ────────────────────────────────────────────────────
  const runDistill = async (text) => {
    setDistillDone(false);
    setCards([]);
    go("processing");
    savedRef.current = false; sessionIdRef.current = null;

    const system = `You are FamilyPause, a family meeting intelligence assistant.
Known people: ${(context.people || []).join(", ")}
Known businesses: ${(context.businesses || []).join(", ")}
Categories: ${(context.categories || []).join(", ")}

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
    try {
      const raw = await callAI(`Extract all action items from this family meeting transcript:\n\n${text}`, system);
      try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
      catch { const m = raw.match(/\[[\s\S]*\]/); if (m) parsed = JSON.parse(m[0]); }
    } catch { parsed = []; }

    setCards(parsed.map((c, i) => ({ ...c, id: c.id ?? i + 1, status: STATUS.OPEN })));
    setDistillDone(true);
    setTimeout(() => go("review"), 650); // let the orb finish
  };

  // ── Build my week → save session (Step 11) ───────────────────────────────
  const buildWeek = () => {
    go("plan");
    if (!ws?.id || savedRef.current) return;
    savedRef.current = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("sessions").insert({
          workspace_id: ws.id,
          meeting_date: meetingDate,
          transcript: null,
          input_mode: "paste",
          cards,
          status: "complete",
          created_by: user?.id,
        }).select().single();
        if (error) { savedRef.current = false; return; }
        if (data) sessionIdRef.current = data.id;
      } catch { savedRef.current = false; }
    })();
  };

  const restart = () => { setCards([]); setDistillDone(false); savedRef.current = false; go("agenda"); };

  const keptCards = cards.filter((c) => c.status === STATUS.KEPT || c.status === STATUS.CALENDARED);
  const keptActions = keptCards.filter((c) => c.type === "action");

  // ── Overlays ─────────────────────────────────────────────────────────────
  if (overlay === "settings") {
    return <Settings workspace={ws} user={user} onSignOut={onSignOut} onClose={() => setOverlay(null)} onWorkspaceUpdate={setWs} />;
  }
  if (overlay === "history") {
    return <SessionHistory workspace={ws} onClose={() => setOverlay(null)} />;
  }

  return (
    <div className="stage">
      <div className="brandbar">
        <div className="brand">
          <div className="mark"><img src="/uploads/Logo_4.png" alt="FamilyPause" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} /></div>
          <div className="word"><b>Family</b><span>Pause</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <StepRail view={view} />
          <div style={{ display: "flex", gap: 4 }}>
            <button className="linkish" title="Settings" onClick={() => setOverlay("settings")} style={{ display: "inline-flex", padding: 8 }}><Ico d={I.gear} size={16} /></button>
            <button className="linkish" title="Sign out" onClick={onSignOut} style={{ display: "inline-flex", padding: 8 }}><Ico d={I.out} size={16} /></button>
          </div>
        </div>
      </div>

      {view === "agenda" && <AgendaView family={family} keptActions={keptActions} onDistill={() => go("capture")} onOpenLog={() => setOverlay("history")} />}
      {view === "capture" && <CaptureView onBack={() => go("agenda")} onProcess={runDistill} />}
      {view === "processing" && <ProcessingView done={distillDone} />}
      {view === "review" && <ReviewView cards={cards} setCards={setCards} roleOf={roleOf} onBack={() => go("capture")} onBuild={buildWeek} />}
      {view === "plan" && <PlanView keptCards={keptCards} adults={adults} roleOf={roleOf} onRestart={restart} />}
    </div>
  );
}
