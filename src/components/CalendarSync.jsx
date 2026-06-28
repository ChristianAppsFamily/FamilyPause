import { useState, useCallback } from "react";
import { cardToCalendarEvent, syncCalendarEvents } from "../lib/googleCalendar";

function formatWhen(date, time) {
  if (!date) return "";
  const dt = new Date(date + "T" + (time || "00:00") + ":00");
  const day = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!time) return day;
  const t = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}

export default function CalendarSync({
  workspaceId,
  events,
  roleOf,
  onClose,
  onCardSynced,
}) {
  const [queue, setQueue] = useState(() => [...events]);
  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const total = events.length;
  const current = queue[index];

  const advance = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      setIndex((i) => {
        const next = i + 1;
        if (next >= total) setDone(true);
        return next;
      });
    }, 280);
  }, [total]);

  const handleSkip = () => {
    if (busy || done) return;
    setSkipped((s) => s + 1);
    advance();
  };

  const handleAdd = async () => {
    if (busy || done || !current) return;
    setBusy(true);
    setError("");
    try {
      const payload = cardToCalendarEvent(current);
      const { results } = await syncCalendarEvents(workspaceId, [payload]);
      const result = results?.[0];
      if (result?.success) {
        onCardSynced?.(current.id, result.googleEventId);
        setAdded((a) => a + 1);
        advance();
      } else {
        setError(result?.error || "Could not add to calendar");
      }
    } catch (e) {
      setError(e?.message || "Calendar sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cal-sync">
      <div className="cal-sync-head">
        <button type="button" className="btn btn-ghost" onClick={onClose}>← Back</button>
        {!done && total > 0 && (
          <div className="cal-sync-progress">
            Event {Math.min(index + 1, total)} of {total}
          </div>
        )}
      </div>

      {done ? (
        <div className="cal-sync-summary">
          <div className="cal-sync-summary-inner">
            <div className="cal-sync-summary-icon">✓</div>
            <h2>Calendar updated</h2>
            <p>{added} added · {skipped} skipped</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      ) : current ? (
        <div className="cal-sync-body">
          <div className={`cal-sync-card ${exiting ? "exit" : ""}`}>
            <div className="cal-sync-card-top">
              <span className={`tag tag-${roleOf(current.person)}`}>{current.person}</span>
              {current.recurring && <span className="cal-sync-recurring">Recurring</span>}
            </div>
            <h3 className="cal-sync-title">{current.task}</h3>
            <div className="cal-sync-when">{formatWhen(current.date, current.time)}</div>
            {error && <div className="cal-sync-error">{error}</div>}
            <div className="cal-sync-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={busy || exiting}
                onClick={handleAdd}
              >
                {busy ? "Adding…" : "Add to Calendar"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy || exiting}
                onClick={handleSkip}
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="cal-sync-body">
          <p className="cal-sync-empty">No dated events to sync.</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      )}
    </div>
  );
}
