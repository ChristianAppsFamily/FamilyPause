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
   VIEW 1 — Weekly Sync (agenda)
   ============================================================ */
function SyncView({ data, onDistill }) {
  const [tab, setTab] = useState("agenda");
  const [assist, setAssist] = useState(true);
  const [rows, setRows] = useState(data.agenda);

  const addTopic = () =>
    setRows((r) => [...r, { id: "t" + (r.length + 1), cat: "Family", topic: "" }]);

  return (
    <div className="view">
      <SyncHeader
        data={data}
        right={
          <button className={"btn " + (assist ? "btn-soft" : "btn-ghost")} onClick={() => setAssist((a) => !a)}>
            <Ico d={I.spark} size={15} /> {assist ? "Hide Assistant" : "AI Assistant"}
          </button>
        }
      />

      <div className="tabs">
        <button className={"tab " + (tab === "agenda" ? "on" : "")} onClick={() => setTab("agenda")}>Agenda</button>
        <button className={"tab " + (tab === "actions" ? "on" : "")} onClick={() => setTab("actions")}>
          Actions <span className="count">(0)</span>
        </button>
        <button className={"tab " + (tab === "log" ? "on" : "")} onClick={() => setTab("log")}>Log</button>
      </div>

      <div className={"worksplit " + (assist ? "with-rail" : "")}>
        <div>
          {tab === "agenda" && (
            <div className="rise">
              <div className="rowhead">
                <span className="ct">{rows.length} Topics</span>
                <button className="btn btn-soft" onClick={addTopic} style={{ padding: "9px 15px" }}>
                  <Ico d={I.plus} size={14} /> Add Topic
                </button>
              </div>
              {rows.map((r, i) => (
                <div className="agrow" key={r.id}>
                  <span className="idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="catsel">{r.cat} ▾</span>
                  <span className={"tp " + (r.topic ? "" : "ph")}>{r.topic || "Topic…"}</span>
                  <span className="chev"><Ico d={I.chevD} size={14} /></span>
                </div>
              ))}
              <button className="addtopic" onClick={addTopic}>
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
              <button className="btn btn-primary btn-lg" onClick={onDistill}>
                <Ico d={I.bolt} size={16} fill /> Distill this week
              </button>
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
            <div className="assbubble">
              Hi — I'm here while you talk. I can add notes, draft action items, and tell you what you're forgetting.
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
