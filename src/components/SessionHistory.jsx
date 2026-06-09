// ─────────────────────────────────────────────────────────────────────────────
// SessionHistory.jsx - FamilyPause
// Visual source of truth: project/app design bundle (src/styles/tokens.css).
// Lists past weekly sessions newest-first; a row expands to its full card list.
//
// Props:
//   workspace  { id, name }
//   onClose()  optional, returns to the main app
//
// Reads from the `sessions` table: { meeting_date, cards[], input_mode, status }.
// Each saved card: { category, person, task, source, date, time, type, status }
//   type   ∈ action | event | decision | note
//   status ∈ pending | kept | discarded | calendared
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const css = `
  .sh-row {
    width: 100%; text-align: left; cursor: pointer;
    background: var(--paper-card); border: 1px solid var(--line);
    border-left: 3px solid var(--terra); border-radius: var(--r-lg);
    padding: 18px 22px; margin-bottom: 12px;
    display: flex; align-items: center; gap: 20px;
    transition: box-shadow .2s, transform .15s, border-color .2s;
  }
  .sh-row:hover { box-shadow: var(--shadow); transform: translateX(2px); }
  .sh-row.open { box-shadow: var(--shadow); }
  .sh-date { min-width: 92px; }
  .sh-date .d { font-family: var(--display); font-size: 26px; font-weight: 600; color: var(--ink); line-height: 1; }
  .sh-date .dow { font-family: var(--mono); font-size: 10.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); margin-top: 5px; }
  .sh-counts { display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto; }
  .sh-count {
    font-family: var(--mono); font-size: 11px; letter-spacing: .05em; text-transform: uppercase;
    padding: 6px 11px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;
    border: 1px solid transparent;
  }
  .sh-count.keep { background: var(--olive-tint); color: var(--olive-d); border-color: var(--olive-soft); }
  .sh-count.act  { background: var(--terra-tint); color: var(--terra-d); border-color: var(--terra-soft); }
  .sh-count.evt  { background: var(--gold-soft);  color: #8a6a16; }
  .sh-chev { color: var(--ink-3); font-size: 13px; transition: transform .2s; }
  .sh-row.open .sh-chev { transform: rotate(90deg); }

  .sh-body { padding: 4px 4px 8px; margin: -4px 0 18px; }
  .sh-card {
    background: var(--paper-card); border: 1px solid var(--line);
    border-left: 3px solid var(--terra); border-radius: var(--r);
    padding: 13px 16px; margin-bottom: 10px;
  }
  .sh-card.amanda { border-left-color: var(--olive); }
  .sh-card.both   { border-left-color: var(--gold); }
  .sh-card.discarded { opacity: .5; }
  .sh-card .top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .sh-card .task { font-size: 15.5px; color: var(--ink); line-height: 1.35; }
  .sh-card .meta { font-family: var(--mono); font-size: 11px; letter-spacing: .03em; color: var(--ink-3); margin-top: 6px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .sh-card .meta .when { color: var(--terra-d); }
  .sh-statebadge { margin-left: auto; font-family: var(--mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
  .sh-statebadge.kept { color: var(--olive-d); }
  .sh-statebadge.cal  { color: #8a6a16; }
  .sh-statebadge.disc { color: var(--ink-3); }

  .sh-empty { text-align: center; padding: 60px 20px; }
  .sh-empty h2 { font-size: 32px; margin-bottom: 12px; }
  .sh-empty p { color: var(--ink-2); font-size: 16px; line-height: 1.55; max-width: 420px; margin: 0 auto; }
  .sh-spin { width: 28px; height: 28px; border: 2px solid var(--line); border-top-color: var(--terra); border-radius: 50%; animation: fpspin .8s linear infinite; margin: 50px auto; }
`;

// person → tone class + dot color
function tone(person) {
  const p = (person || "").toLowerCase();
  if (p === "both" || p === "family") return "both";
  if (p === "amanda") return "amanda";
  return "spence";
}

function statusBadge(status) {
  if (status === "kept") return { cls: "kept", label: "Kept" };
  if (status === "calendared") return { cls: "cal", label: "On calendar" };
  if (status === "discarded") return { cls: "disc", label: "Discarded" };
  return null;
}

// ── ONE SESSION ROW ───────────────────────────────────────────────────────────
function SessionRow({ session }) {
  const [open, setOpen] = useState(false);
  const cards = Array.isArray(session.cards) ? session.cards : [];

  const kept = cards.filter((c) => c.status === "kept" || c.status === "calendared").length;
  const actions = cards.filter((c) => c.type === "action").length;
  const events = cards.filter((c) => c.type === "event").length;

  // Parse meeting_date (YYYY-MM-DD) as local, not UTC, to avoid off-by-one.
  const d = (() => {
    const [y, m, day] = (session.meeting_date || "").split("-").map(Number);
    return y ? new Date(y, m - 1, day) : new Date(session.meeting_date);
  })();
  const dayNum = d.getDate();
  const monthShort = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const dow = d.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();

  return (
    <div className="rise">
      <button className={`sh-row${open ? " open" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="sh-date">
          <div className="d">{dayNum} <span style={{ fontSize: 15, color: "var(--ink-3)" }}>{monthShort}</span></div>
          <div className="dow">{dow}</div>
        </div>
        <div className="sh-counts">
          <span className="sh-count keep">{kept} kept</span>
          <span className="sh-count act">{actions} action{actions === 1 ? "" : "s"}</span>
          <span className="sh-count evt">{events} event{events === 1 ? "" : "s"}</span>
        </div>
        <span className="sh-chev">▸</span>
      </button>

      {open && (
        <div className="sh-body view">
          {cards.length === 0 ? (
            <p style={{ fontFamily: "var(--serif)", color: "var(--ink-3)", fontStyle: "italic", padding: "0 4px 8px" }}>
              No items were saved for this session.
            </p>
          ) : (
            cards.map((c, i) => {
              const badge = statusBadge(c.status);
              const when = [c.date, c.time].filter(Boolean).join(" · ");
              return (
                <div key={c.id ?? i} className={`sh-card ${tone(c.person)}${c.status === "discarded" ? " discarded" : ""}`}>
                  <div className="top">
                    <span className={`pdot ${tone(c.person)}`} />
                    {c.category && <span className="tag tag-cat">{c.category}</span>}
                    {badge && <span className={`sh-statebadge ${badge.cls}`}>{badge.label}</span>}
                  </div>
                  <div className="task">{c.task}</div>
                  <div className="meta">
                    <span>{c.person || "Family"}</span>
                    <span className="mono" style={{ color: "var(--ink-3)" }}>· {c.type || "item"}</span>
                    {when && <span className="when">· {when}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function SessionHistory({ workspace, onClose, initialSessions }) {
  const [sessions, setSessions] = useState(initialSessions || []);
  const [loading, setLoading] = useState(!initialSessions);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialSessions) return; // caller pre-provided data, skip the fetch
    let active = true;
    const load = async () => {
      if (!workspace?.id) { setLoading(false); return; }
      try {
        const { data, error: err } = await supabase
          .from("sessions")
          .select("id, meeting_date, cards, input_mode, status, created_at")
          .eq("workspace_id", workspace.id)
          .eq("status", "complete")
          .order("meeting_date", { ascending: false });
        if (err) throw err;
        if (active) setSessions(data || []);
      } catch (e) {
        if (active) setError(e.message || "Couldn't load your history.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [workspace?.id, initialSessions]);

  return (
    <div className="stage view">
      <style>{css}</style>

      <div className="brandbar">
        <div className="brand">
          <div className="mark">
            <img src="/uploads/Logo_4.png" alt="FamilyPause"
                 style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit", display: "block" }} />
          </div>
          <div className="word"><b>Family</b><span>Pause</span></div>
        </div>
        {onClose && <button className="btn btn-ghost" onClick={onClose}>Done</button>}
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Your history</div>
        <h1 style={{ fontSize: 40, lineHeight: 1.02, marginBottom: 26 }}>Past syncs</h1>

        {loading ? (
          <div className="sh-spin" />
        ) : error ? (
          <div className="panel" style={{ padding: "16px 20px", color: "var(--red)", fontFamily: "var(--serif)" }}>{error}</div>
        ) : sessions.length === 0 ? (
          <div className="panel sh-empty">
            <h2>Your history starts this Sunday</h2>
            <p>
              Once you run your first FamilyPause, every weekly sync lands here,
              organized by date, so you can look back on what your family decided together.
            </p>
          </div>
        ) : (
          sessions.map((s) => <SessionRow key={s.id} session={s} />)
        )}
      </div>
    </div>
  );
}
