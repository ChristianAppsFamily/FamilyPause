import { useState, useRef, useEffect, useCallback } from "react";

// ── TERRA & CREAM PALETTE ─────────────────────────────────────────────────────
const T = {
  bg:        "#FAF7F2",   // cream base
  surface:   "#F0EAE0",   // warm card surface
  surface2:  "#E8E0D0",   // deeper surface / hover
  border:    "#D8CFC0",   // borders
  borderSoft:"#E8E0D0",   // soft borders
  text:      "#2E2820",   // near-black warm
  textMid:   "#6A5A40",   // mid text
  textMuted: "#A09070",   // muted text
  terra:     "#B85C38",   // terracotta primary
  terraLight:"#F5D8CC",   // terracotta light bg
  terraDark: "#7A2E14",   // terracotta dark text
  olive:     "#4A6741",   // olive green (keep / success)
  oliveLight:"#D8E8D4",   // olive light bg
  oliveDark: "#1E3A18",   // olive dark text
  gold:      "#C49A3C",   // gold (dates / events)
  goldLight: "#FAF0D4",   // gold light bg
  goldDark:  "#6A4A10",   // gold dark text
  brown:     "#8B7355",   // warm brown (muted accents)
  brownLight:"#EDE8E0",   // brown light bg
  red:       "#C04030",   // discard / error
  redLight:  "#FAE0DA",   // red light bg
};

// ── KNOWN CONTEXT ─────────────────────────────────────────────────────────────
const DEFAULT_CONTEXT = {
  people: ["Spence", "Amanda", "Child 1", "Child 2", "Child 3"],
  businesses: ["Christian App Empire", "One73 Entertainment", "High Noon Films", "CrewSheetz", "OvernightWriter"],
  categories: ["Family", "Kids", "Business", "Finance", "Home", "Faith", "Health", "Dates"],
};

// ── AI CALL ───────────────────────────────────────────────────────────────────
async function callAI(prompt, system) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function gcalLink(title, date, time) {
  const base = date ? `${date}T${time || "10:00"}:00` : null;
  const dt = base ? new Date(base) : new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const end = new Date(dt.getTime() + 60 * 60 * 1000);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(dt)}%2F${fmt(end)}`;
}

function todayStr() { return new Date().toISOString().split("T")[0]; }
function formatDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

const PHASE = { HOME: "home", INPUT: "input", PROCESSING: "processing", REVIEW: "review", PLAN: "plan" };
const STATUS = { PENDING: "pending", KEPT: "kept", DISCARDED: "discarded", CALENDARED: "calendared" };

// ── PERSON COLORS ─────────────────────────────────────────────────────────────
function personColor(p) {
  const map = {
    Spence:   { border: T.terra,  bg: T.terraLight, text: T.terraDark },
    Amanda:   { border: T.olive,  bg: T.oliveLight, text: T.oliveDark },
    Both:     { border: T.gold,   bg: T.goldLight,  text: T.goldDark  },
    Family:   { border: T.brown,  bg: T.brownLight, text: T.textMid   },
  };
  return map[p] || { border: T.brown, bg: T.brownLight, text: T.textMid };
}

const typeIcon = (t) => t === "event" ? "📅" : t === "decision" ? "⚖️" : t === "note" ? "📝" : "✓";

// ── MAIN APP ──────────────────────────────────────────────────────────────────
// AppRouter imports this as App — the function name below matches that expectation
export default function App({ user, workspace, onSignOut }) {
  const [phase, setPhase] = useState(PHASE.HOME);
  const [inputMode, setInputMode] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [cards, setCards] = useState([]);
  const [processingMsg, setProcessingMsg] = useState("Reading your conversation...");
  const [meetingDate] = useState(todayStr());
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInput, setSettingsInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const recognitionRef = useRef(null);
  const accumulatedRef = useRef("");

  // ── SPEECH ─────────────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Live recording requires Chrome or Safari."); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    accumulatedRef.current = transcript;
    rec.onresult = (e) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      if (final) accumulatedRef.current += final;
      setLiveText(interim);
      setTranscript(accumulatedRef.current);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => { if (recording) rec.start(); };
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  }, [transcript, recording]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
    setLiveText("");
  }, []);

  // ── PROCESS ────────────────────────────────────────────────────────────────
  const processTranscript = async (text) => {
    setPhase(PHASE.PROCESSING);
    const msgs = ["Reading your conversation...", "Identifying people and topics...", "Extracting action items...", "Detecting dates and deadlines...", "Building your weekly plan..."];
    let mi = 0;
    const ticker = setInterval(() => { mi = (mi + 1) % msgs.length; setProcessingMsg(msgs[mi]); }, 1800);

    const system = `You are FamilyPause, a family meeting intelligence assistant for Spence and Amanda.
Known people: ${context.people.join(", ")}
Known businesses: ${context.businesses.join(", ")}
Categories: ${context.categories.join(", ")}

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
  "confidence": ("high", "medium", or "low"),
  "type": ("action", "event", "decision", or "note")
}

Rules: extract everything actionable, use person names when mentioned, flag low confidence if conversational not actionable, return only the JSON array.`;

    try {
      const raw = await callAI(`Extract all action items from this family meeting transcript:\n\n${text}`, system);
      let parsed = [];
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      } catch {
        const match = raw.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      }
      clearInterval(ticker);
      setCards(parsed.map((c) => ({ ...c, status: STATUS.PENDING })));
    } catch {
      clearInterval(ticker);
      setCards([]);
    }
    setPhase(PHASE.REVIEW);
  };

  const handleProcess = () => {
    const text = inputMode === "record" ? transcript : pasteText;
    if (text.trim()) processTranscript(text);
  };

  // ── CARD MUTATIONS ─────────────────────────────────────────────────────────
  const setCardStatus = (id, status) => setCards((p) => p.map((c) => c.id === id ? { ...c, status } : c));
  const updateCard = (id, field, val) => setCards((p) => p.map((c) => c.id === id ? { ...c, [field]: val } : c));

  const allActions = cards.flatMap((c) => ({ ...c }));
  const pendingCards = cards.filter((c) => c.status === STATUS.PENDING);
  const keptCards = cards.filter((c) => c.status === STATUS.KEPT || c.status === STATUS.CALENDARED);
  const openActions = allActions.filter((a) => !a.done);
  const allCategories = ["All", ...new Set(cards.map((c) => c.category))];
  const visibleCards = cards.filter((c) => c.status === STATUS.PENDING && (filterCat === "All" || c.category === filterCat));

  const keepAll = () => setCards((p) => p.map((c) => c.status === STATUS.PENDING ? { ...c, status: STATUS.KEPT } : c));
  const discardAll = () => setCards((p) => p.map((c) => c.status === STATUS.PENDING ? { ...c, status: STATUS.DISCARDED } : c));

  const saveSettings = () => {
    const lines = settingsInput.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length) setContext((p) => ({ ...p, people: lines }));
    setShowSettings(false);
  };

  const resetApp = () => { setPhase(PHASE.HOME); setCards([]); setTranscript(""); setPasteText(""); setInputMode(null); setFilterCat("All"); };

  // ── SHARED STYLES ──────────────────────────────────────────────────────────
  const base = { fontFamily: "'Georgia', serif", minHeight: "100vh", background: T.bg, color: T.text };

  const btn = (variant = "primary", extra = {}) => ({
    border: "none", borderRadius: 8, cursor: "pointer",
    fontFamily: "'Georgia', serif", fontSize: 15, fontWeight: "normal",
    padding: "10px 20px", transition: "all 0.15s",
    ...(variant === "primary" ? { background: T.terra, color: T.bg } :
        variant === "olive"   ? { background: T.olive, color: T.bg } :
        variant === "ghost"   ? { background: "transparent", border: `1px solid ${T.border}`, color: T.textMid } :
        variant === "danger"  ? { background: T.redLight, color: T.red, border: `1px solid ${T.red}22` } : {}),
    ...extra,
  });

  const tag = (bg, color) => ({ display: "inline-block", background: bg, color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", letterSpacing: "0.03em" });

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=JetBrains+Mono:wght@300;400&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    @keyframes recordPulse { 0%,100% { box-shadow:0 0 0 0 rgba(184,92,56,0.4); } 50% { box-shadow:0 0 0 14px rgba(184,92,56,0); } }
    .fade { animation: fadeUp 0.35s ease both; }
    input, textarea, select { font-family: 'Georgia', serif; }
    textarea:focus, input:focus { outline: 2px solid ${T.terra}44; outline-offset: 0; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
  `;

  // ── HOME ───────────────────────────────────────────────────────────────────
  if (phase === PHASE.HOME) return (
    <div style={base}>
      <style>{css}</style>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "64px 24px 48px", textAlign: "center" }}>

        <div style={{ marginBottom: 36, animation: "fadeUp 0.5s ease both" }}>
          <div style={{
            width: 68, height: 68, borderRadius: "50%", margin: "0 auto 20px",
            background: T.terra, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, boxShadow: `0 4px 24px ${T.terra}44`,
          }}>⁋</div>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", marginBottom: 10 }}>
            Your weekly pause
          </div>
          <h1 style={{ fontSize: 54, fontWeight: 400, color: T.text, lineHeight: 1, fontFamily: "'Playfair Display', Georgia, serif" }}>
            Selah<span style={{ color: T.terra }}>on7</span>
          </h1>
          <p style={{ fontSize: 16, color: T.textMid, marginTop: 12, fontStyle: "italic" }}>
            Every 7 days, everything gets clearer.
          </p>
        </div>

        <div style={{ fontSize: 12, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", marginBottom: 44, animation: "fadeUp 0.5s 0.1s ease both" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}
        </div>

        <div style={{ animation: "fadeUp 0.5s 0.15s ease both" }}>
          <button onClick={() => setPhase(PHASE.INPUT)} style={{
            ...btn("primary"),
            width: "100%", maxWidth: 320, padding: "16px 24px",
            fontSize: 18, borderRadius: 12,
            boxShadow: `0 4px 24px ${T.terra}33`,
          }}>
            Begin This Week's Sync
          </button>
        </div>

        <div style={{ marginTop: 44, animation: "fadeUp 0.5s 0.2s ease both" }}>
          {[
            ["①", "Record your conversation or paste a transcript"],
            ["②", "AI extracts every action, event, and decision"],
            ["③", "Keep, discard, or add each item to your calendar"],
            ["④", "Your week is organized by person and category"],
          ].map(([n, t]) => (
            <div key={n} style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14, textAlign: "left" }}>
              <span style={{ color: T.terra, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, minWidth: 22, marginTop: 2 }}>{n}</span>
              <span style={{ color: T.textMid, fontSize: 15, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, animation: "fadeUp 0.5s 0.3s ease both" }}>
          <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>
            ⚙ FAMILY SETTINGS
          </button>
        </div>
      </div>

      {showSettings && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(46,40,32,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 32, width: "100%", maxWidth: 400 }}>
            <div style={{ fontSize: 20, color: T.text, marginBottom: 6, fontFamily: "'Playfair Display', serif" }}>Family Settings</div>
            <div style={{ fontSize: 12, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 18, lineHeight: 1.5 }}>One name per line. The AI will recognize these people and route items to them automatically.</div>
            <textarea defaultValue={context.people.join("\n")} onChange={(e) => setSettingsInput(e.target.value)} rows={8}
              placeholder={"Spence\nAmanda\nChild 1\nChild 2"}
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: "10px 12px", fontSize: 14, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={saveSettings} style={{ ...btn("primary"), flex: 1 }}>Save</button>
              <button onClick={() => setShowSettings(false)} style={{ ...btn("ghost"), flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── INPUT ──────────────────────────────────────────────────────────────────
  if (phase === PHASE.INPUT) return (
    <div style={base}>
      <style>{css}</style>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, background: T.bg }}>
        <button onClick={() => setPhase(PHASE.HOME)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>←</button>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>FAMILYPAUSE</div>
          <div style={{ fontSize: 20, color: T.text, fontFamily: "'Playfair Display', serif" }}>This Week's Sync</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
          {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 100px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
          {[
            { id: "record", icon: "🎙", label: "Live Recording", sub: "Speak freely — transcribes as you talk" },
            { id: "paste",  icon: "📋", label: "Paste Transcript", sub: "From Otter, Dictation, or typed notes" },
          ].map((m) => (
            <button key={m.id} onClick={() => setInputMode(inputMode === m.id ? null : m.id)} style={{
              background: inputMode === m.id ? T.terraLight : T.surface,
              border: `1px solid ${inputMode === m.id ? T.terra : T.border}`,
              borderRadius: 12, padding: "18px 16px", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
            }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{m.icon}</div>
              <div style={{ fontSize: 16, color: inputMode === m.id ? T.terraDark : T.text, marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.4 }}>{m.sub}</div>
            </button>
          ))}
        </div>

        {inputMode === "record" && (
          <div className="fade">
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <button onClick={recording ? stopRecording : startRecording} style={{
                width: 76, height: 76, borderRadius: "50%",
                background: recording ? T.red : T.terra,
                border: "none", cursor: "pointer", fontSize: 26,
                animation: recording ? "recordPulse 1.5s infinite" : "none",
                boxShadow: recording ? "none" : `0 4px 20px ${T.terra}44`,
                transition: "all 0.2s",
              }}>{recording ? "⏹" : "🎙"}</button>
              <div style={{ marginTop: 10, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: recording ? T.red : T.textMuted, letterSpacing: "0.1em" }}>
                {recording ? "● RECORDING — tap to stop" : "TAP TO START RECORDING"}
              </div>
            </div>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 16, minHeight: 180, position: "relative" }}>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: T.textMuted, letterSpacing: "0.1em", marginBottom: 10 }}>LIVE TRANSCRIPT</div>
              <div style={{ fontSize: 14, color: T.textMid, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {transcript}
                {liveText && <span style={{ color: T.border, fontStyle: "italic" }}>{liveText}</span>}
              </div>
              {!transcript && !liveText && (
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: T.border, fontStyle: "italic", fontSize: 14, textAlign: "center" }}>
                  Your words will appear here...
                </div>
              )}
            </div>
            {transcript && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{transcript.split(" ").filter(Boolean).length} words</span>
                <button onClick={() => setTranscript("")} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>Clear</button>
              </div>
            )}
          </div>
        )}

        {inputMode === "paste" && (
          <div className="fade">
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: T.textMuted, letterSpacing: "0.1em", marginBottom: 8 }}>PASTE YOUR TRANSCRIPT OR NOTES</div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={14}
              placeholder={`Paste your conversation here. For example:\n\n"Spence: We need to take Child 2 to the dentist this Thursday at 3pm.\nAmanda: And I want to follow up with the accountant about Q2.\nSpence: Right, and we should talk about the CrewSheetz launch..."`}
              style={{ width: "100%", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, color: T.text, padding: 16, fontSize: 14, lineHeight: 1.7, resize: "vertical" }} />
            {pasteText && <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{pasteText.split(" ").filter(Boolean).length} words</div>}
          </div>
        )}

        {((inputMode === "record" && transcript.trim()) || (inputMode === "paste" && pasteText.trim())) && (
          <div style={{ marginTop: 28 }} className="fade">
            <button onClick={handleProcess} style={{ ...btn("primary"), width: "100%", padding: 18, fontSize: 18, borderRadius: 12, boxShadow: `0 4px 24px ${T.terra}33` }}>
              Distill This Conversation →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ── PROCESSING ─────────────────────────────────────────────────────────────
  if (phase === PHASE.PROCESSING) return (
    <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <style>{css}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 56, height: 56, border: `2px solid ${T.terra}`, borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 28px", animation: "spin 1s linear infinite" }} />
        <div style={{ fontSize: 11, letterSpacing: "0.25em", color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", marginBottom: 14 }}>FAMILYPAUSE</div>
        <div style={{ fontSize: 22, color: T.text, fontStyle: "italic", fontFamily: "'Playfair Display', serif" }}>{processingMsg}</div>
        <div style={{ marginTop: 10, fontSize: 13, color: T.textMuted }}>About 10 seconds...</div>
      </div>
    </div>
  );

  // ── REVIEW ─────────────────────────────────────────────────────────────────
  if (phase === PHASE.REVIEW) return (
    <div style={base}>
      <style>{css}</style>
      <div style={{ borderBottom: `1px solid ${T.border}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, background: T.bg, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>REVIEW</div>
          <div style={{ fontSize: 20, color: T.text, fontFamily: "'Playfair Display', serif" }}>
            {pendingCards.length > 0 ? `${pendingCards.length} items to review` : "All reviewed"}
          </div>
        </div>
        {pendingCards.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={keepAll} style={{ background: T.oliveLight, border: `1px solid ${T.olive}44`, borderRadius: 6, color: T.oliveDark, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>Keep All</button>
            <button onClick={discardAll} style={{ background: T.redLight, border: `1px solid ${T.red}44`, borderRadius: 6, color: T.red, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>Discard All</button>
          </div>
        )}
        {keptCards.length > 0 && (
          <button onClick={() => setPhase(PHASE.PLAN)} style={{ ...btn("primary"), padding: "8px 18px", fontSize: 14, borderRadius: 8 }}>
            See Plan →
          </button>
        )}
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 24px 100px" }}>
        {allCategories.length > 2 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
            {allCategories.map((cat) => (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{
                background: filterCat === cat ? T.terraLight : "transparent",
                border: `1px solid ${filterCat === cat ? T.terra : T.border}`,
                borderRadius: 20, color: filterCat === cat ? T.terraDark : T.textMuted,
                padding: "5px 14px", cursor: "pointer", fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace", transition: "all 0.15s",
              }}>{cat}</button>
            ))}
          </div>
        )}

        {visibleCards.length === 0 && pendingCards.length === 0 && (
          <div style={{ textAlign: "center", padding: "56px 0", color: T.textMuted, fontStyle: "italic" }}>
            {cards.length === 0 ? "No items extracted. Try with a longer or clearer transcript." : "All items reviewed. Tap 'See Plan' to view your week."}
          </div>
        )}

        {visibleCards.map((card, i) => {
          const pc = personColor(card.person);
          return (
            <div key={card.id} className="fade" style={{
              background: T.surface, border: `1px solid ${T.borderSoft}`,
              borderLeft: `3px solid ${pc.border}`,
              borderRadius: 12, padding: "18px 20px", marginBottom: 14,
              animationDelay: `${i * 0.04}s`,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 15, marginTop: 2 }}>{typeIcon(card.type)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={tag(pc.bg, pc.text)}>{card.person}</span>
                    <span style={tag(T.brownLight, T.textMid)}>{card.category}</span>
                    {card.confidence === "medium" && <span style={tag(T.goldLight, T.goldDark)}>⚠ review</span>}
                    {card.confidence === "low" && <span style={tag(T.redLight, T.red)}>? uncertain</span>}
                  </div>
                  <input value={card.task} onChange={(e) => updateCard(card.id, "task", e.target.value)}
                    style={{ width: "100%", background: "none", border: "none", color: T.text, fontSize: 17, outline: "none", lineHeight: 1.4 }} />
                  {card.date && (
                    <div style={{ fontSize: 12, color: T.gold, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                      📅 {card.date}{card.time ? ` at ${card.time}` : ""}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: T.textMuted, fontStyle: "italic", marginTop: 6, lineHeight: 1.4 }}>
                    "{card.source}"
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setCardStatus(card.id, STATUS.KEPT)} style={{ flex: 1, background: T.oliveLight, border: `1px solid ${T.olive}44`, borderRadius: 8, color: T.oliveDark, padding: "10px", cursor: "pointer", fontSize: 14, transition: "all 0.15s" }}>Keep</button>
                <button onClick={() => setCardStatus(card.id, STATUS.DISCARDED)} style={{ flex: 1, background: T.redLight, border: `1px solid ${T.red}33`, borderRadius: 8, color: T.red, padding: "10px", cursor: "pointer", fontSize: 14, transition: "all 0.15s" }}>Discard</button>
                {(card.type === "event" || card.date) && (
                  <a href={gcalLink(card.task, card.date, card.time)} target="_blank" rel="noreferrer"
                    onClick={() => setCardStatus(card.id, STATUS.CALENDARED)}
                    style={{ flex: 1, background: T.goldLight, border: `1px solid ${T.gold}44`, borderRadius: 8, color: T.goldDark, padding: "10px", cursor: "pointer", fontSize: 14, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                    + Calendar
                  </a>
                )}
              </div>
            </div>
          );
        })}

        {cards.filter(c => c.status !== STATUS.PENDING).length > 0 && (
          <div style={{ marginTop: 28, borderTop: `1px solid ${T.border}`, paddingTop: 20 }}>
            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", marginBottom: 10 }}>REVIEWED</div>
            {cards.filter(c => c.status !== STATUS.PENDING).map((card) => (
              <div key={card.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: T.surface, borderRadius: 8, marginBottom: 6, opacity: 0.55 }}>
                <span style={{ fontSize: 13, color: card.status === STATUS.DISCARDED ? T.red : T.olive }}>{card.status === STATUS.DISCARDED ? "×" : "✓"}</span>
                <span style={{ flex: 1, fontSize: 14, color: T.textMid, textDecoration: card.status === STATUS.DISCARDED ? "line-through" : "none" }}>{card.task}</span>
                <button onClick={() => setCardStatus(card.id, STATUS.PENDING)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>undo</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── PLAN ───────────────────────────────────────────────────────────────────
  if (phase === PHASE.PLAN) {
    const grouped = {};
    keptCards.forEach((c) => {
      const key = c.person || "Family";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });

    return (
      <div style={base}>
        <style>{css}</style>
        <div style={{ borderBottom: `1px solid ${T.border}`, padding: "18px 24px", display: "flex", alignItems: "center", gap: 14, background: T.bg }}>
          <button onClick={() => setPhase(PHASE.REVIEW)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 20 }}>←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>FAMILYPAUSE</div>
            <div style={{ fontSize: 20, color: T.text, fontFamily: "'Playfair Display', serif" }}>This Week's Plan</div>
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
          </div>
        </div>

        <div style={{ maxWidth: 680, margin: "0 auto", padding: "28px 24px 100px" }}>
          <div style={{ background: T.terraLight, border: `1px solid ${T.terra}33`, borderRadius: 16, padding: "22px", marginBottom: 28, textAlign: "center" }}>
            <div style={{ fontSize: 44, color: T.terra, fontFamily: "'Playfair Display', serif", fontWeight: 400 }}>{keptCards.length}</div>
            <div style={{ fontSize: 14, color: T.terraDark }}>items kept this week</div>
            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", marginTop: 8 }}>
              {keptCards.filter(c => c.status === STATUS.CALENDARED).length} on calendar · {keptCards.filter(c => c.type === "action").length} actions · {keptCards.filter(c => c.type === "event").length} events
            </div>
          </div>

          {Object.entries(grouped).map(([person, items]) => {
            const pc = personColor(person);
            return (
              <div key={person} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: pc.border }} />
                  <div style={{ fontSize: 12, color: pc.border, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.12em", textTransform: "uppercase" }}>{person}</div>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{items.length}</div>
                </div>
                {items.map((card) => (
                  <div key={card.id} style={{ display: "flex", gap: 12, padding: "13px 16px", background: T.surface, border: `1px solid ${T.borderSoft}`, borderRadius: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 14, marginTop: 2 }}>{typeIcon(card.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, color: T.text, lineHeight: 1.4 }}>{card.task}</div>
                      <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{card.category}</span>
                        {card.date && <span style={{ fontSize: 11, color: T.gold, fontFamily: "'JetBrains Mono', monospace" }}>{card.date}{card.time ? ` · ${card.time}` : ""}</span>}
                        {card.status === STATUS.CALENDARED && <span style={{ fontSize: 11, color: T.olive, fontFamily: "'JetBrains Mono', monospace" }}>✓ On calendar</span>}
                      </div>
                    </div>
                    {(card.type === "event" || card.date) && card.status !== STATUS.CALENDARED && (
                      <a href={gcalLink(card.task, card.date, card.time)} target="_blank" rel="noreferrer"
                        onClick={() => setCardStatus(card.id, STATUS.CALENDARED)}
                        style={{ fontSize: 11, color: T.gold, fontFamily: "'JetBrains Mono', monospace", textDecoration: "none", alignSelf: "center", whiteSpace: "nowrap" }}>
                        + Cal
                      </a>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          <div style={{ textAlign: "center", marginTop: 48 }}>
            <button onClick={resetApp} style={{ ...btn("ghost"), padding: "12px 32px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
              ← START NEXT WEEK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
