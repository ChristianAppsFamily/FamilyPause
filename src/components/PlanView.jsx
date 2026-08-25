import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { eventDayIndices, getPlanningWeekDates, weekStripLabels } from "../lib/planWeek";
import { calendarTitle, calendarSyncOutcome, isSyncEligible, userMessageForSyncCode } from "../lib/googleCalendar";
import { buildPlanMarkdown } from "../lib/planExport";
import {
  buildItinerary,
  buildItineraryText,
  formatItineraryTime,
} from "../lib/planItinerary";
import CalendarAccountChooser from "./CalendarAccountChooser";
import UpgradePrompt from "./UpgradePrompt";

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
  lock: ["M7 11V8a5 5 0 0 1 10 0v3", "M6 11h12v10H6z"],
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

export function PlanInterstitial({ active, exiting, line = "Your week is built.", ariaLabel }) {
  if (!active && !exiting) return null;
  return (
    <div
      className={"plan-interstitial" + (exiting ? " plan-interstitial--exit" : "")}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel || line}
    >
      <FamilyMark />
      <p className="plan-interstitial-line">{line}</p>
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

function PlanViewToggle({ view, onChange }) {
  return (
    <div className="plan-view-toggle" role="tablist" aria-label="Plan view">
      <button
        type="button"
        role="tab"
        aria-selected={view === "plan"}
        className={"plan-view-pill" + (view === "plan" ? " is-active" : "")}
        onClick={() => onChange("plan")}
      >
        Plan
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "itinerary"}
        className={"plan-view-pill" + (view === "itinerary" ? " is-active" : "")}
        onClick={() => onChange("itinerary")}
      >
        Itinerary
      </button>
    </div>
  );
}

function ItineraryView({ keptCards, meetingDate, roleOf, hasFamilyFeatures = false, onUpgrade }) {
  const [copied, setCopied] = useState(false);
  const [showPdfUpgrade, setShowPdfUpgrade] = useState(false);
  const itinerary = useMemo(
    () => buildItinerary(keptCards, meetingDate),
    [keptCards, meetingDate],
  );

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(buildItineraryText(keptCards, meetingDate));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const printItinerary = () => {
    document.body.classList.add("printing-itinerary");
    const cleanup = () => {
      document.body.classList.remove("printing-itinerary");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    // Fallback if afterprint never fires
    setTimeout(cleanup, 1000);
  };

  const empty = !itinerary.days.length && !itinerary.recurring.length;

  return (
    <div className="itinerary">
      <div className="itinerary-print-root">
        <header className="itinerary-head">
          <img className="itinerary-mark" src="/uploads/Logo_4.png" alt="" width={28} height={28} />
          <h2 className="itinerary-week">Week of {itinerary.weekRange}</h2>
          <div className="itinerary-wordmark print-only" aria-hidden="true">
            <b>Family</b><span>Pause</span>
          </div>
        </header>

        {empty ? (
          <p className="itinerary-empty">No timed items this week yet. Add times on Review to build your itinerary.</p>
        ) : (
          <>
            {itinerary.days.map((day) => (
              <section className="itinerary-day" key={day.date}>
                <h3 className="itinerary-day-h">{day.header}</h3>
                <ul className="itinerary-list">
                  {day.items.map((it) => {
                    const who = roleOf?.(it.person) || "both";
                    return (
                      <li className="itinerary-row" key={it.id}>
                        <span className="itinerary-time">{formatItineraryTime(it.time)}</span>
                        <span className="itinerary-task">{calendarTitle(it)}</span>
                        {it.person ? (
                          <span className={"itinerary-who itinerary-who--" + who}>{it.person}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {itinerary.recurring.length > 0 && (
              <section className="itinerary-day itinerary-recurring">
                <h3 className="itinerary-day-h itinerary-day-h--muted">Recurring</h3>
                <ul className="itinerary-list">
                  {itinerary.recurring.map((it) => {
                    const who = roleOf?.(it.person) || "both";
                    return (
                      <li className="itinerary-row" key={`rec-${it.id}`}>
                        <span className="itinerary-time">{formatItineraryTime(it.time)}</span>
                        <span className="itinerary-task">
                          <span className="itinerary-pattern">Weekly</span>
                          {" · "}
                          {calendarTitle(it)}
                        </span>
                        {it.person ? (
                          <span className={"itinerary-who itinerary-who--" + who}>{it.person}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <div className="itinerary-actions no-print">
        <button
          type="button"
          className={
            "plan-btn-primary"
            + (!hasFamilyFeatures ? " plan-btn-primary--locked" : "")
          }
          onClick={hasFamilyFeatures ? printItinerary : () => setShowPdfUpgrade(true)}
          disabled={hasFamilyFeatures && empty}
        >
          {!hasFamilyFeatures && <Ico d={I.lock} size={13} />}
          Print / Save as PDF
        </button>
        <button
          type="button"
          className={"plan-btn-ghost" + (copied ? " plan-btn-ghost--ok" : "")}
          onClick={copyText}
          disabled={empty}
        >
          {copied ? "Copied!" : "Copy as Text"}
        </button>
      </div>

      {showPdfUpgrade && (
        <UpgradePrompt
          title="Print and save your family plan as a PDF with Family Plan."
          onUpgrade={onUpgrade}
          onClose={() => setShowPdfUpgrade(false)}
        />
      )}
    </div>
  );
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
  retryingCardId,
  unsyncingCardId,
  showCalendarConnect,
  onConfirmCalendarConnect,
  onCancelCalendarConnect,
  familyPauseEmail,
  onRetrySync,
  onRetryFailed,
  onAddToCal,
  onUnsync,
  meetingDate,
  arrivalPhase = "done",
  arrivalMode = "static",
  showFirstConfetti = false,
  hasFamilyFeatures = false,
  onUpgrade,
  calendarSyncNotice = null,
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
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [showExportUpgrade, setShowExportUpgrade] = useState(false);
  const [planMode, setPlanMode] = useState("plan"); // "plan" | "itinerary"

  const outcome = useMemo(
    () => calendarSyncOutcome(keptCards, { meetingDate, syncing: calendarBusy }),
    [keptCards, meetingDate, calendarBusy],
  );

  const syncCopy = (() => {
    if (!calendarConnected) {
      return {
        seal: "ok",
        eyebrow: "Step 5 · Your week is built",
        sub: "A clean plan, organized by person. Appointments timed, actions owned, nothing forgotten.",
        interstitial: "Your week is built.",
      };
    }
    if (outcome.state === "syncing") {
      return {
        seal: "ok",
        eyebrow: "Step 5 · Adding to calendar",
        sub: "Adding your kept items to Google Calendar…",
        interstitial: "Adding to your calendar.",
      };
    }
    if (outcome.state === "succeeded") {
      return {
        seal: "ok",
        eyebrow: "Step 5 · Your week is built",
        sub: "A clean plan, organized by person. Appointments timed, actions owned, nothing forgotten.",
        interstitial: "Your week is built.",
      };
    }
    if (outcome.state === "partial") {
      return {
        seal: "partial",
        eyebrow: "Step 5 · Needs attention",
        sub: `${outcome.synced} added to Google Calendar. ${outcome.failed} ${outcome.failed === 1 ? "needs" : "need"} another try.`,
        interstitial: "Your week is built — some calendar items need attention.",
      };
    }
    if (outcome.state === "failed") {
      return {
        seal: "failed",
        eyebrow: "Step 5 · Calendar sync didn't finish",
        sub: calendarSyncNotice || userMessageForSyncCode(null),
        interstitial: "Your week is built — calendar items were not added.",
      };
    }
    return {
      seal: "ok",
      eyebrow: "Step 5 · Your week is built",
      sub: "A clean plan, organized by person. Appointments timed, actions owned, nothing forgotten.",
      interstitial: "Your week is built.",
    };
  })();


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
    const syncOpts = { meetingDate };
    const canSync = isSyncEligible(it, syncOpts);
    const adding = !synced && canSync && (
      retryingCardId === it.id
      || (calendarBusy && !!it.calendar_sync_failed)
    );
    const badgeAnim = showBadge && synced && badgeDrawn && !staticLayout;
    const retryLocked = calendarBusy || retryingCardId != null;
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
          <div className="pt">{calendarTitle(it)}</div>
          <div className="pmeta">
            <span className="ct">{it.category}</span>
            {formatWhen(it.date, it.time) && <span>· {formatWhen(it.date, it.time)}</span>}
            {!it.time && it.date && <span>· All day</span>}
            {synced && (
              <span className={"synced-badge-wrap" + (badgeAnim ? " synced-badge-wrap--pop" : "")}>
                <span className={"synced-badge" + (unsyncingCardId === it.id ? " synced-badge--busy" : "") + (badgeAnim ? " synced-badge--in" : "")}>
                  <SyncedCheckIcon draw={badgeAnim} />
                  {unsyncingCardId === it.id ? "Removing…" : "Added"}
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
            {!synced && adding && canSync && (
              <span className="plan-cal-pending">Adding</span>
            )}
            {!synced && !adding && it.calendar_sync_failed && canSync && (
              <button
                type="button"
                className="plan-cal-retry"
                disabled={retryLocked}
                onClick={() => onRetrySync(it.id)}
              >
                Retry
              </button>
            )}
            {!synced && !adding && !it.calendar_sync_failed && canSync && (
              <button
                type="button"
                className="plan-cal-add"
                disabled={retryLocked || unsyncingCardId === it.id}
                onClick={() => (calendarConnected ? onRetrySync(it.id) : onAddToCal(it.id))}
              >
                {calendarConnected ? "Pending" : "Add to Cal"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  let flatIndex = 0;

  const copyAsList = async () => {
    const md = buildPlanMarkdown(personSections, meetingDate);
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const exportPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const { downloadPlanPdf } = await import("../lib/planPdf");
      await downloadPlanPdf(personSections, meetingDate);
    } catch (e) {
      console.error("[Plan] PDF export", e);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <>
      <PlanInterstitial
        active={interstitialActive}
        exiting={interstitialExiting}
        line={syncCopy.interstitial}
      />
      {showFirstConfetti && !reduced && revealing && outcome.state === "succeeded" && <LeafConfetti active />}

      <div
        className={
          "view plan-view"
          + (showContent ? " plan-view--visible" : "")
          + (interstitialExiting ? " plan-view--crossfade" : "")
          + (staticLayout ? " plan-view--static" : "")
        }
      >
        <PlanViewToggle view={planMode} onChange={setPlanMode} />

        {planMode === "itinerary" ? (
          <ItineraryView
            keptCards={keptCards}
            meetingDate={meetingDate}
            roleOf={roleOf}
            hasFamilyFeatures={hasFamilyFeatures}
            onUpgrade={onUpgrade}
          />
        ) : (
          <>
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
          <div className={"plan-summary-seal" + (syncCopy.seal !== "ok" ? ` plan-summary-seal--${syncCopy.seal}` : "")}>
            {syncCopy.seal === "ok" ? <Ico d={I.check} size={22} /> : <span aria-hidden="true">!</span>}
          </div>
          <p className="plan-summary-eyebrow">{syncCopy.eyebrow}</p>
          <h1 className="plan-summary-title">
            <AnimatedCount target={keptCards.length} animate={countAnim && !staticLayout} duration={quick ? 500 : 800} />
            {" "}
            {keptCards.length === 1 ? "item" : "items"} routed for your family
          </h1>
          <p className="plan-summary-sub">
            {syncCopy.sub}
          </p>
          {(outcome.state === "partial" || outcome.state === "failed") && onRetryFailed && (
            <button
              type="button"
              className="btn btn-primary plan-sync-retry-all"
              disabled={calendarBusy || retryingCardId != null}
              onClick={onRetryFailed}
            >
              {calendarBusy ? "Retrying…" : outcome.state === "partial" ? "Retry failed items" : "Retry calendar sync"}
            </button>
          )}
        </div>

        {showCalendarConnect && (
          <div style={{ marginBottom: 20 }}>
            <CalendarAccountChooser
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
              className={"plan-btn-ghost" + (copied ? " plan-btn-ghost--ok" : "")}
              onClick={copyAsList}
              disabled={!keptCards.length}
            >
              {copied ? "Copied!" : "Copy as Text"}
            </button>
            <button
              type="button"
              className={"plan-btn-ghost" + (!hasFamilyFeatures ? " plan-btn-ghost--locked" : "")}
              onClick={hasFamilyFeatures ? exportPdf : () => setShowExportUpgrade(true)}
              disabled={hasFamilyFeatures && (!keptCards.length || pdfBusy)}
            >
              {!hasFamilyFeatures && <Ico d={I.lock} size={13} />}
              {pdfBusy ? "Preparing…" : "Download PDF"}
            </button>
            <button
              type="button"
              className={outcome.synced > 0 ? "plan-btn-primary" : "plan-btn-ghost"}
              onClick={() => window.open("https://calendar.google.com", "_blank", "noopener,noreferrer")}
              aria-label={
                outcome.synced > 0
                  ? "Open Google Calendar"
                  : "Open Google Calendar. Items from this plan were not added."
              }
            >
              Open Calendar
            </button>
          </div>
        </div>
          </>
        )}
      </div>
      {showExportUpgrade && (
        <UpgradePrompt
          title="Print and save your family plan as a PDF with Family Plan."
          onUpgrade={onUpgrade}
          onClose={() => setShowExportUpgrade(false)}
        />
      )}
    </>
  );
}
