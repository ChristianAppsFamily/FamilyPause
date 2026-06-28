/* global React */
const { useState, useEffect, useRef } = React;

/* ---------- tiny inline glyphs (stroke, on-brand, no emoji) ---------- */
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
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
};

/* ---------- shared sync header ---------- */
function SyncHeader({ data, right }) {
  return (
    <div className="synchead">
      <div className="who">
        <div className="eyebrow">Weekly Sync</div>
        <h1>{data.family.title}</h1>
        <div className="when">
          <span className="datepill"><Ico d={I.cal} size={14} /> {data.family.date}</span>
          <span className="faded">A good pause, every week.</span>
        </div>
      </div>
      {right}
    </div>
  );
}

/* ============================================================
   VIEW 1 — Choose your approach (two-card start)
   ============================================================ */
const START_TOPICS = [
  "Kids", "Finances", "Marriage", "Faith", "Health",
  "Work & Business", "Home & Chores", "Travel & Plans", "Friends & Family", "Rest & Sabbath",
];

function SyncView({ data, onDistill }) {
  const [expanded, setExpanded] = useState(false);
  const [topics, setTopics] = useState(START_TOPICS);
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
      panelRef.current && panelRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
    );
  };

  return (
    <div className="view choicewrap">
      <div className="choicehead rise">
        <div className="eyebrow">How would you like to begin</div>
        <h1 className="choicetitle">Choose your approach.</h1>
      </div>

      <div className="choicecards rise">
        {/* LEFT — Topics */}
        <div className="choicecard" onClick={openTopics} role="button" tabIndex={0}>
          <div className="cico"><Ico d={I.grid} size={22} /></div>
          <h3>Guide your conversation.</h3>
          <p>Choose topics before you record. Helps the AI organize your week more accurately and gives you a structure to follow together.</p>
          <div className="egrow">
            <span className="egpill">Kids</span>
            <span className="egpill">Finances</span>
            <span className="egpill">Marriage</span>
          </div>
          <div className="cardfoot">
            <button className="choicebtn outline" onClick={(e) => { e.stopPropagation(); openTopics(); }}>
              Choose Topics <Ico d={I.arrow} size={15} />
            </button>
          </div>
        </div>

        {/* RIGHT — Record (recommended) */}
        <div className="choicecard rec" onClick={onDistill} role="button" tabIndex={0}>
          <span className="poppop">Most Popular</span>
          <div className="cico"><Ico d={I.mic} size={22} /></div>
          <h3>Jump straight in.</h3>
          <p>Hit record and talk freely. FamilyPause listens to everything and organizes your week automatically when you're done.</p>
          <div className="cardfoot">
            <button className="choicebtn solid" onClick={(e) => { e.stopPropagation(); onDistill(); }}>
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
            <button className="btn btn-soft" onClick={addOwn}><Ico d={I.plus} size={14} /> Add</button>
          </div>

          {selected.length > 0 && (
            <div className="controw rise">
              <button className="btn btn-primary btn-lg btn-block" onClick={onDistill}>
                <Ico d={I.mic} size={16} /> Continue to Record
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VIEW 2 — Capture
   ============================================================ */
function CaptureView({ data, onBack, onProcess }) {
  const [mode, setMode] = useState("paste");
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const taRef = useRef(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const ready = mode === "paste" ? text.trim().length > 30 : secs > 2;

  return (
    <div className="view capwrap">
      <div className="lead">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Step 1 · Have your meeting</div>
        <h1>Talk like humans.<br /><em>We'll handle the structure.</em></h1>
        <p>Paste a transcript from Otter or Apple Dictation, or record live. Talk about whatever needs talking about — kids, money, work, the week ahead.</p>
      </div>

      <div className="panel capcard">
        <div className="captoggle">
          <button className={"seg " + (mode === "paste" ? "on" : "")} onClick={() => setMode("paste")}>
            <Ico d={I.doc} size={15} /> Paste transcript
          </button>
          <button className={"seg " + (mode === "record" ? "on" : "")} onClick={() => setMode("record")}>
            <Ico d={I.mic} size={15} /> Record live
          </button>
        </div>

        {mode === "paste" ? (
          <div style={{ padding: "4px 10px 10px" }}>
            <textarea
              ref={taRef}
              className="capta"
              placeholder="Paste your conversation here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="caprow">
              <button className="usesample" onClick={() => setText(data.transcript)}>
                ✦ Use sample conversation
              </button>
              <span className="caphint">{text.trim() ? `${text.trim().split(/\s+/).length} words` : "Nothing pasted yet"}</span>
            </div>
          </div>
        ) : (
          <div className="recbox">
            <button className={"recbtn " + (recording ? "live" : "")} onClick={() => setRecording((r) => !r)}>
              <Ico d={recording ? I.x : I.mic} size={30} />
            </button>
            <div className="rectime">{fmt(secs)}</div>
            {recording ? (
              <div className="recwave">
                {Array.from({ length: 13 }).map((_, i) => (
                  <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s`, height: 8 }} />
                ))}
              </div>
            ) : (
              <div className="caphint" style={{ marginTop: 14 }}>
                {secs > 2 ? "Recording captured · ready to distill" : "Tap to start recording your sync"}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22 }}>
        <button className="linkish" onClick={onBack}>← Back to agenda</button>
        <button className="btn btn-primary btn-lg" disabled={!ready} onClick={() => onProcess(mode === "paste" ? text : data.transcript)}>
          <Ico d={I.bolt} size={16} fill /> Distill it
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   VIEW 3 — Processing
   ============================================================ */
function ProcessingView({ onDone }) {
  const stepLabels = [
    "Reading your conversation",
    "Finding actions & appointments",
    "Sorting by person and category",
    "Building this week's review",
  ];
  const subs = [
    "Listening to every voice in the room…",
    "Spence, Amanda, the kids — nobody gets dropped.",
    "Finance, Kids, Business, Family.",
    "Almost there.",
  ];
  const [active, setActive] = useState(0);
  const [pct, setPct] = useState(6);

  useEffect(() => {
    const times = [900, 1700, 2600, 3500];
    const timers = times.map((t, i) => setTimeout(() => { setActive(i + 1); setPct(Math.min(100, 18 + i * 27)); }, t));
    const fin = setTimeout(onDone, 4350);
    const grow = setInterval(() => setPct((p) => Math.min(99, p + Math.random() * 4)), 240);
    return () => { timers.forEach(clearTimeout); clearTimeout(fin); clearInterval(grow); };
  }, []);

  return (
    <div className="view proc">
      <div className="procorb">
        <span className="ring"></span>
        <span className="ring r2"></span>
        <Ico d={I.bolt} size={46} fill />
      </div>
      <h1>Distilling your sync…</h1>
      <div className="psub">{subs[Math.min(active, subs.length - 1)]}</div>

      <div className="procsteps">
        {stepLabels.map((s, i) => (
          <div key={i} className={"procstep " + (i < active ? "done" : i === active ? "active" : "")}>
            <span className="pmk">{i < active ? <Ico d={I.check} size={13} /> : i + 1}</span>
            {s}
          </div>
        ))}
      </div>
      <div className="procbar"><i style={{ width: pct + "%" }}></i></div>
    </div>
  );
}

Object.assign(window, { Ico, I, SyncHeader, SyncView, CaptureView, ProcessingView });
