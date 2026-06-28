/* global React, ReactDOM, SyncView, CaptureView, ProcessingView, ReviewView, PlanView, Ico, I,
   useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, TweakToggle */
const { useState: useStateA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#BE5A37",
  "warmth": "warm",
  "showSteps": true,
  "showAssistant": true
}/*EDITMODE-END*/;

const ACCENTS = {
  "#BE5A37": { d: "#A2481F", soft: "#F1DDCF", tint: "#FAEAE0" }, // terra
  "#5E6B37": { d: "#4C5829", soft: "#DEE4CB", tint: "#EDF0E1" }, // olive
  "#C09740": { d: "#8a6a16", soft: "#F0E3C0", tint: "#F7EFD8" }, // gold
  "#9A5B6B": { d: "#7d4150", soft: "#E9D8DD", tint: "#F6ECEF" }, // dusty rose
};

const STEPS = [
  { key: "sync", label: "Agenda" },
  { key: "capture", label: "Capture" },
  { key: "processing", label: "Distill" },
  { key: "review", label: "Review" },
  { key: "plan", label: "Plan" },
];

function StepRail({ view }) {
  const order = STEPS.map((s) => s.key);
  const cur = order.indexOf(view);
  return (
    <div className="steps">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <span className="sep"></span>}
          <span className={"step " + (i < cur ? "done" : i === cur ? "active" : "")}>
            <span className="dot">{i < cur ? <Ico d={I.check} size={11} /> : i + 1}</span>
            {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useStateA("sync");
  const [kept, setKept] = useStateA(null);
  const data = window.FP_DATA;

  // apply accent + warmth tweaks to CSS vars
  React.useEffect(() => {
    const r = document.documentElement;
    const a = ACCENTS[t.accent] || ACCENTS["#BE5A37"];
    r.style.setProperty("--terra", t.accent);
    r.style.setProperty("--terra-d", a.d);
    r.style.setProperty("--terra-soft", a.soft);
    r.style.setProperty("--terra-tint", a.tint);
    r.style.setProperty("--accent", t.accent);
    if (t.warmth === "cool") {
      r.style.setProperty("--paper", "#F6F4EE");
      r.style.setProperty("--paper-card", "#FCFBF7");
    } else if (t.warmth === "deep") {
      r.style.setProperty("--paper", "#F3E8D6");
      r.style.setProperty("--paper-card", "#FBF4E7");
    } else {
      r.style.setProperty("--paper", "#FBF6EC");
      r.style.setProperty("--paper-card", "#FCF8F0");
    }
  }, [t.accent, t.warmth]);

  const go = (v) => { window.scrollTo({ top: 0, behavior: "smooth" }); setView(v); };

  return (
    <div className="stage">
      <div className="brandbar">
        <div className="brand">
          <div className="mark"><img src="uploads/Logo_4.png" alt="FamilyPause" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"inherit",display:"block"}} /></div>
          <div className="word"><b>Family</b><span>Pause</span></div>
        </div>
        {t.showSteps && <StepRail view={view} />}
      </div>

      {view === "sync" && <SyncView data={data} onDistill={() => go("capture")} />}
      {view === "capture" && <CaptureView data={data} onBack={() => go("sync")} onProcess={() => go("processing")} />}
      {view === "processing" && <ProcessingView onDone={() => go("review")} />}
      {view === "review" && <ReviewView data={data} onBack={() => go("capture")} onBuild={(k) => { setKept(k); go("plan"); }} />}
      {view === "plan" && <PlanView data={data} kept={kept} onRestart={() => { setKept(null); go("sync"); }} />}

      <TweaksPanel>
        <TweakSection label="Brand accent" />
        <TweakColor
          label="Accent color"
          value={t.accent}
          options={Object.keys(ACCENTS)}
          onChange={(v) => setTweak("accent", v)}
        />
        <TweakRadio
          label="Paper warmth"
          value={t.warmth}
          options={["cool", "warm", "deep"]}
          onChange={(v) => setTweak("warmth", v)}
        />
        <TweakSection label="Layout" />
        <TweakToggle label="Show step rail" value={t.showSteps} onChange={(v) => setTweak("showSteps", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add("anim-on")));
