/* global React, Ico, I */
const { useState, useEffect, useMemo } = React;

/* ============================================================
   VIEW 4 — Review (keep / discard)
   ============================================================ */
function ReviewView({ data, onBack, onBuild }) {
  // status: "open" | "kept" | "discarded"
  const [items, setItems] = useState(data.extracted.map((e) => ({ ...e, status: "open" })));

  const decide = (id, status) =>
    setItems((arr) => arr.map((it) => (it.id === id ? { ...it, status } : it)));

  const total = items.length;
  const decided = items.filter((i) => i.status !== "open").length;
  const kept = items.filter((i) => i.status === "kept").length;
  const allDecided = decided === total;
  const pct = Math.round((decided / total) * 100);

  const keepAll = () => setItems((arr) => arr.map((it) => (it.status === "open" ? { ...it, status: "kept" } : it)));

  return (
    <div className="view">
      <div className="revhead">
        <div>
          <div className="eyebrow" style={{ marginBottom: 9 }}>Step 2 · This week's review</div>
          <h1>Keep what matters.<br /><em>Discard the rest.</em></h1>
        </div>
        <div className="progresswrap">
          <span className="chip chip-soft fw">{decided}/{total} reviewed</span>
          <div className="minibar"><i style={{ width: pct + "%" }}></i></div>
        </div>
      </div>

      <div className="revmeta">
        <span className="chip chip-ok"><Ico d={I.check} size={13} /> {total} items extracted</span>
        <span className="chip chip-soft"><Ico d={I.clock} size={13} /> ~2 min to review</span>
        <button className="linkish" style={{ marginLeft: "auto" }} onClick={keepAll}>Keep all remaining →</button>
      </div>

      <div>
        {items.map((it) => (
          <div key={it.id} className={`revcard ${it.who} ${it.status === "kept" ? "kept" : ""} ${it.status === "discarded" ? "discarded" : ""}`}>
            <span className="checkpop"><Ico d={I.check} size={13} /></span>
            <div className="ctop">
              <span className={"pdot " + it.who}></span>
              <span className={"tag tag-" + it.who}>{it.whoLabel}</span>
              <span className="tag tag-cat">{it.cat}</span>
              <span className="ktype">{it.kind}</span>
            </div>
            <h3>{it.title}</h3>
            <div className="cq">"{it.quote}"</div>
            {(it.when || it.due) && (
              <div className="cwhen">
                <Ico d={it.due ? I.clock : I.cal} size={13} /> {it.when || ("Due · " + it.due)}
              </div>
            )}
            <div className="cact">
              <button className="keepbtn" onClick={() => decide(it.id, "kept")}>
                <Ico d={I.check} size={14} /> Keep
              </button>
              {it.calendar && (
                <button className="calbtn" onClick={() => decide(it.id, "kept")}>
                  <Ico d={I.cal} size={14} /> + Calendar
                </button>
              )}
              <button className="discbtn" onClick={() => decide(it.id, "discarded")}>
                <Ico d={I.x} size={14} /> Discard
              </button>
            </div>
            <div className="decided keep">
              <Ico d={I.check} size={13} /> Kept{it.calendar ? " · added to calendar" : ""}
            </div>
          </div>
        ))}
      </div>

      <div className="revdone">
        <button className="linkish" onClick={onBack}>← Re-distill</button>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span className="summ">
            {allDecided ? <span><b>{kept} kept</b> · {total - kept} discarded</span> : `${total - decided} left to review`}
          </span>
          <button className="btn btn-primary btn-lg" disabled={!allDecided} onClick={() => onBuild(items.filter((i) => i.status === "kept"))}>
            <Ico d={I.arrow} size={16} /> Build my week
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   VIEW 5 — Your week is built
   ============================================================ */
function Confetti() {
  const cols = ["#BE5A37", "#5E6B37", "#C09740", "#D08049", "#7b6cae"];
  const bits = useMemo(
    () =>
      Array.from({ length: 70 }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 2.4 + Math.random() * 1.8,
        col: cols[i % cols.length],
        rot: Math.random() * 360,
      })),
    []
  );
  return (
    <div className="confetti">
      {bits.map((b, i) => (
        <i key={i} style={{ left: b.left + "%", background: b.col, animationDuration: b.dur + "s", animationDelay: b.delay + "s", transform: `rotate(${b.rot}deg)` }} />
      ))}
    </div>
  );
}

function PlanView({ data, kept, onRestart }) {
  const [added, setAdded] = useState(false);
  const [confetti, setConfetti] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setConfetti(false), 4200);
    return () => clearTimeout(t);
  }, []);

  const items = kept && kept.length ? kept : data.extracted;

  // group by person, with "both" duplicated into a Shared column
  const cols = [
    { key: "spence", name: "Spence", role: "spence" },
    { key: "amanda", name: "Amanda", role: "amanda" },
  ];
  const byPerson = (k) => items.filter((i) => i.who === k);
  const shared = items.filter((i) => i.who === "both");

  const Item = ({ it }) => (
    <div className="planitem">
      <span className="pmark"><Ico d={I.check} size={11} /></span>
      <div className="pbody">
        <div className="pt">{it.title}</div>
        <div className="pmeta">
          <span className="ct">{it.cat}</span>
          {(it.when || it.due) && <span>· {it.when || ("Due " + it.due)}</span>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="view">
      {confetti && <Confetti />}
      <div className="planhero">
        <div className="seal"><Ico d={I.check} size={28} /></div>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Step 3 · Your week is built</div>
        <h1>Your week, <em>planned before Sunday ends.</em></h1>
        <p>A clean plan, organized by person. {items.length} items routed where they belong — appointments timed, actions owned, nothing forgotten.</p>
      </div>

      <div className="plangrid">
        {cols.map((c) => {
          const list = byPerson(c.key);
          return (
            <div className="plancol" key={c.key}>
              <div className="pch">
                <span className={"pdot " + c.role}></span>
                <span className="pname">{c.name}</span>
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
            <span className="pdot both"></span>
            <span className="pname">Shared &amp; Family</span>
            <span className="pcount">{shared.length} {shared.length === 1 ? "item" : "items"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
            {shared.map((it) => <Item key={it.id} it={it} />)}
          </div>
        </div>
      )}

      <button className={"gcalbar " + (added ? "added" : "")} onClick={() => setAdded(true)}>
        <Ico d={added ? I.check : I.cal} size={17} />
        {added ? "Synced to Google Calendar" : "Add this week + recurring sync to Google Calendar"}
      </button>
      <div className="gcalnote">Appointments drop in at their times · A repeating weekly pause is set for Sunday</div>

      <div className="planfoot">
        <button className="linkish" onClick={onRestart}>↺ Start a new sync</button>
      </div>
    </div>
  );
}

Object.assign(window, { ReviewView, PlanView, Confetti });
