import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { eventDayIndices, getPlanningWeekDates, weekStripLabels } from "../lib/planWeek";
import { isSyncEligible } from "../lib/googleCalendar";
import CalendarAccountChooser from "./CalendarAccountChooser";

function Ico({ d, size = 16, fill = false, sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const I = {
  check: "M5 12.5 10 17.5 19.5 6.5",
  cal: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"],
};

function formatWhen(date, time) {
  if (!date) return "";
  const dt = new Date(date + "T" + (time || "00:00") + ":00");
  const day = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (!time) return day;
  const t = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}

function FamilyMark() {
  return (
    <div className="plan-interstitial-mark">
      <img src="/uploads/Logo_4.png" alt="" width={56} height={56} />
    </div>
  );
}

export function PlanInterstitial({ active, exiting }) {
  if (!active && !exiting) return null;
  return (
    <div
      className={"plan-interstitial" + (exiting ? " plan-interstitial--exit" : "")}
      role="status"
      aria-live="polite"
      aria-label="Your week is built"
    >
      <FamilyMark />
      <p className="plan-interstitial-line">Your week is built.</p>
    </div>
  );
}

function LeafConfetti({ active }) {
  const leaves = useRef(
    Array.from({ length: 28 }).map((_, i) => ({
      left: 4 + ((i * 37) % 92),
      delay: (i % 9) * 0.12,
      dur: 1.2 + (i % 3) * 0.1,
      rot: (i * 47) % 360,
      drift: ((i % 5) - 2) * 18,
      col: ["#B85C38", "#4A6741", "#C49A3C"][i % 3],
      w: 6 + (i % 3) * 2,
      h: 10 + (i % 4) * 2,
    })),
  ).current;

  if (!active) return null;
  return (
    <div className="plan-leaf-confetti" aria-hidden="true">
      {leaves.map((b, i) => (
        <i
          key={i}
          style={{
            left: `${b.left}%`,
            width: b.w,
            height: b.h,
            background: b.col,
            animationDuration: `${b.dur}s`,
            animationDelay: `${b.delay}s`,
            transform: `rotate(${b.rot}deg)`,
            "--leaf-drift": `${b.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

function AnimatedCount({ target, animate, duration = 800 }) {
  const [n, setN] = useState(animate ? 0 : target);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (!animate || reduced) {
      setN(target);
      return;
    }
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * target));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, animate, duration, reduced]);

  return <span className="plan-summary-count">{n}</span>;
}

function WeekStrip({ meetingDate, cards, reveal, quick }) {
  const labels = weekStripLabels();
  const eventDays = useMemo(() => eventDayIndices(cards, meetingDate), [cards, meetingDate]);
  const weekDates = useMemo(() => getPlanningWeekDates(meetingDate), [meetingDate]);
  const reduced = prefersReducedMotion();
  const showDots = reveal && !reduced;

  return (
    <div className="plan-week-strip" aria-label="This week's event days">
      {labels.map((label, i) => {
        const hasEvent = eventDays.includes(i);
        const dotDelay = quick ? i * 25 : i * 55;
        return (
          <div className="plan-week-day" key={`${label}-${weekDates[i]}`}>
            <span className="plan-week-label">{label}</span>
            <span
              className={
                "plan-week-dot"
                + (hasEvent ? " plan-week-dot--on" : "")
                + (hasEvent && showDots ? " plan-week-dot--pop" : "")
              }
              style={hasEvent && showDots ? { animationDelay: `${dotDelay}ms` } : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

function SyncedCheckIcon({ draw }) {
  return (
    <svg className={"synced-check-icon" + (draw ? " synced-check-icon--draw" : "")} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d="M1.5 5.2 3.8 7.5 8.5 2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PlanView({
  keptCards,
  adults,
  roleOf,
  onRestart,
  calendarConnected,
  calendarBusy,
  unsyncingCardId,
  showCalendarConnect,
  onConfirmCalendarConnect,
  onCancelCalendarConnect,
  familyPauseEmail,
  onRetrySync,
  onAddToCal,
  onUnsync,
  meetingDate,
  arrivalPhase = "done",
  arrivalMode = "static",
  showFirstConfetti = false,
}) {
  const reduced = prefersReducedMotion();
  const staticLayout = arrivalMode === "static" || reduced;
  const quick = arrivalMode === "quick";
  const revealing = arrivalPhase === "revealing" || (arrivalPhase === "done" && !staticLayout);
  const showContent = arrivalPhase !== "interstitial";
  const interstitialActive = arrivalPhase === "interstitial";
  const interstitialExiting = arrivalPhase === "revealing" && arrivalMode === "full";

  const [badgeDrawn, setBadgeDrawn] = useState(staticLayout);
  const [summaryVisible, setSummaryVisible] = useState(staticLayout);
  const [sectionsVisible, setSectionsVisible] = useState(staticLayout);
  const [countAnim, setCountAnim] = useState(!staticLayout && arrivalMode === "full");

  const isAdult = (p) => adults.some((a) => a.toLowerCase() === (p || "").toLowerCase());
  const byPerson = (name) => keptCards.filter((c) => (c.person || "").toLowerCase() === name.toLowerCase());
  const shared = keptCards.filter((c) => !isAdult(c.person));

  const personSections = useMemo(() => {
    const cols = adults.slice(0, 2).map((name, i) => ({
      key: name,
      name,
      who: i === 0 ? "spence" : "amanda",
      items: byPerson(name),
    }));
    if (shared.length) {
      cols.push({ key: "shared", name: "Shared & Family", who: "both", items: shared, wide: true });
    }
    return cols;
  }, [adults, keptCards, shared]);

  const flatItems = useMemo(() => {
    const list = [];
    personSections.forEach((sec, si) => {
      sec.items.forEach((it, ii) => list.push({ it, si, ii, id: it.id }));
    });
    return list;
  }, [personSections]);

  useEffect(() => {
    if (staticLayout || arrivalPhase === "interstitial") return;

    if (arrivalPhase === "revealing") {
      setSummaryVisible(true);
      setCountAnim(true);
      const t1 = setTimeout(() => setSectionsVisible(true), quick ? 80 : 280);
      const t2 = setTimeout(() => setBadgeDrawn(true), quick ? 320 : 900);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (arrivalPhase === "done") {
      setSummaryVisible(true);
      setSectionsVisible(true);
      setBadgeDrawn(true);
    }
  }, [arrivalPhase, staticLayout, quick]);

  const staggerMs = quick ? 28 : 60;
  const sectionDelay = quick ? 40 : 120;

  const Item = ({ it, index, showBadge }) => {
    const synced = it.calendar_synced;
    const badgeAnim = showBadge && synced && badgeDrawn && !staticLayout;
    return (
      <div
        className={
          "planitem"
          + (synced ? " synced" : "")
          + (sectionsVisible && !staticLayout ? " planitem--in" : "")
          + (staticLayout ? " planitem--static" : "")
        }
        style={!staticLayout && sectionsVisible ? { animationDelay: `${index * staggerMs}ms` } : undefined}
      >
        <span className="pmark"><Ico d={I.check} size={11} /></span>
        <div className="pbody">
          <div className="pt">{it.task}</div>
          <div className="pmeta">
            <span className="ct">{it.category}</span>
            {formatWhen(it.date, it.time) && <span>· {formatWhen(it.date, it.time)}</span>}
            {synced && (
              <span className={"synced-badge-wrap" + (badgeAnim ? " synced-badge-wrap--pop" : "")}>
                <span className={"synced-badge" + (unsyncingCardId === it.id ? " synced-badge--busy" : "") + (badgeAnim ? " synced-badge--in" : "")}>
                  <SyncedCheckIcon draw={badgeAnim} />
                  {unsyncingCardId === it.id ? "Removing…" : "Synced"}
                </span>
                <button
                  type="button"
                  className="plan-cal-unsync"
                  disabled={unsyncingCardId === it.id || calendarBusy}
                  onClick={() => onUnsync(it.id)}
                  aria-label="Unsync from Google Calendar"
                >
                  ×
                </button>
              </span>
            )}
            {!synced && it.calendar_sync_failed && isSyncEligible(it) && (
              <button type="button" className="plan-cal-retry" disabled={calendarBusy} onClick={() => onRetrySync(it.id)}>
                Retry
              </button>
            )}
            {!synced && !it.calendar_sync_failed && isSyncEligible(it) && (
              <button
                type="button"
                className="plan-cal-add"
                disabled={calendarBusy || unsyncingCardId === it.id}
                onClick={() => (calendarConnected ? onRetrySync(it.id) : onAddToCal(it.id))}
              >
                Add to Cal
              </button>
            )}
            {!isSyncEligible(it) && (it.date || it.time || it.type === "event" || it.recurring) && (
              <span className="plan-cal-hint">Add date &amp; time to sync</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  let flatIndex = 0;

  return (
    <>
      <PlanInterstitial active={interstitialActive} exiting={interstitialExiting} />
      {showFirstConfetti && !reduced && revealing && <LeafConfetti active />}

      <div
        className={
          "view plan-view"
          + (showContent ? " plan-view--visible" : "")
          + (interstitialExiting ? " plan-view--crossfade" : "")
          + (staticLayout ? " plan-view--static" : "")
        }
      >
        {calendarConnected && (
          <div className="plan-cal-status">
            <span className="plan-cal-dot" aria-hidden="true" />
            Google Calendar connected
          </div>
        )}

        <WeekStrip
          meetingDate={meetingDate}
          cards={keptCards}
          reveal={revealing || staticLayout}
          quick={quick}
        />

        <div
          className={
            "plan-summary-card"
            + (summaryVisible || staticLayout ? " plan-summary-card--in" : "")
          }
        >
          <div className="plan-summary-seal"><Ico d={I.check} size={22} /></div>
          <p className="plan-summary-eyebrow">Step 5 · Your week is built</p>
          <h1 className="plan-summary-title">
            <AnimatedCount target={keptCards.length} animate={countAnim && !staticLayout} duration={quick ? 500 : 800} />
            {" "}
            {keptCards.length === 1 ? "item" : "items"} routed for your family
          </h1>
          <p className="plan-summary-sub">
            A clean plan, organized by person. Appointments timed, actions owned, nothing forgotten.
          </p>
        </div>

        {showCalendarConnect && (
          <div style={{ marginBottom: 20 }}>
            <CalendarAccountChooser
              familyPauseEmail={familyPauseEmail}
              onConfirm={onConfirmCalendarConnect}
              onCancel={onCancelCalendarConnect}
              busy={calendarBusy}
              compact
            />
          </div>
        )}

        <div className="plangrid">
          {personSections.filter((s) => !s.wide).map((sec, si) => (
            <div
              className={
                "plancol"
                + (sectionsVisible || staticLayout ? " plancol--in" : "")
              }
              key={sec.key}
              style={!staticLayout && sectionsVisible ? { animationDelay: `${si * sectionDelay}ms` } : undefined}
            >
              <div className="pch">
                <span className={"pdot " + sec.who} />
                <span className="pname">{sec.name}</span>
                <span className="pcount">{sec.items.length} {sec.items.length === 1 ? "item" : "items"}</span>
              </div>
              {sec.items.length ? sec.items.map((it) => {
                const idx = flatIndex++;
                return <Item key={it.id} it={it} index={idx} showBadge />;
              }) : (
                <div style={{ color: "var(--ink-3)", fontStyle: "italic", fontSize: 14, padding: "8px 0" }}>All clear this week.</div>
              )}
            </div>
          ))}
        </div>

        {personSections.filter((s) => s.wide).map((sec) => (
          <div
            className={"plancol" + (sectionsVisible || staticLayout ? " plancol--in" : "")}
            style={{ marginBottom: 16, ...(sectionsVisible && !staticLayout ? { animationDelay: `${2 * sectionDelay}ms` } : {}) }}
            key={sec.key}
          >
            <div className="pch">
              <span className="pdot both" />
              <span className="pname">{sec.name}</span>
              <span className="pcount">{sec.items.length} {sec.items.length === 1 ? "item" : "items"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 28px" }}>
              {sec.items.map((it) => {
                const idx = flatIndex++;
                return <Item key={it.id} it={it} index={idx} showBadge />;
              })}
            </div>
          </div>
        ))}

        <div className="planfoot">
          <div className="planfoot-actions">
            <button type="button" className="plan-btn-ghost" onClick={onRestart}>
              Start New Sync
            </button>
            <button
              type="button"
              className="plan-btn-primary"
              onClick={() => window.open("https://calendar.google.com", "_blank", "noopener,noreferrer")}
            >
              Open Calendar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
