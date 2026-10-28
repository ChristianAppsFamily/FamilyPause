import { useEffect, useMemo, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/motion";
import { eventDayIndices, getPlanningWeekDates, weekStripLabels } from "../lib/planWeek";
import { calendarTitle } from "../lib/googleCalendar";
import { reminderScheduleOutcome, reminderLabelFromCard } from "../lib/planReminders";
import { buildPlanMarkdown } from "../lib/planExport";
import {
  buildItinerary,
  buildItineraryText,
  formatItineraryTime,
} from "../lib/planItinerary";
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

function formatWhen(cardOrDate, time) {
  const date = typeof cardOrDate === "object" ? cardOrDate?.date : cardOrDate;
  const clock = typeof cardOrDate === "object" ? cardOrDate?.time : time;
  const dateOnly = typeof cardOrDate === "object" ? !!cardOrDate?.date_only : false;
  if (!date) return "";
  const dt = new Date(date + "T" + (clock || "00:00") + ":00");
  const day = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (dateOnly) return `${day} · All day`;
  if (!clock) return `${day} · Choose a start time`;
  const t = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}

function FamilyMark() {
  return (
    <div className="plan-interstitial-mark">
      <img src="/fp-mark.svg" alt="" width={56} height={56} />
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
      col: ["#14805E", "#0F6A4D", "#F59E0B"][i % 3],
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

  const empty = !itinerary.days.length && !itinerary.recurring.length && !itinerary.unscheduled.length;

  return (
    <div className="itinerary">
      <div className="itinerary-print-root">
        <header className="itinerary-head">
          <img className="itinerary-mark" src="/fp-mark.svg" alt="" width={28} height={28} />
          <h2 className="itinerary-week">Week of {itinerary.weekRange}</h2>
          <div className="itinerary-wordmark print-only" aria-hidden="true">
            <b>Family</b><span>Pause</span>
          </div>
        </header>

        {empty ? (
          <p className="itinerary-empty">No kept items this week yet. Keep cards on Review to build your itinerary.</p>
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
                        <span className="itinerary-time">{formatItineraryTime(it)}</span>
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
                        <span className="itinerary-time">{formatItineraryTime(it)}</span>
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

            {itinerary.unscheduled.length > 0 && (
              <section className="itinerary-day itinerary-unscheduled">
                <h3 className="itinerary-day-h itinerary-day-h--muted">Unscheduled</h3>
                <ul className="itinerary-list">
                  {itinerary.unscheduled.map((it) => {
                    const who = roleOf?.(it.person) || "both";
                    return (
                      <li className="itinerary-row" key={`unsched-${it.id}`}>
                        <span className="itinerary-time">—</span>
                        <span className="itinerary-task">{calendarTitle(it)}</span>
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
  onEditReminders,
  meetingDate,
  arrivalPhase = "done",
  arrivalMode = "static",
  showFirstConfetti = false,
  hasFamilyFeatures = false,
  onUpgrade,
  reminderNotice = null,
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
    () => reminderScheduleOutcome(keptCards),
    [keptCards],
  );

  const syncCopy = (() => {
    if (outcome.state === "succeeded") {
      const n = outcome.scheduled;
      return {
        seal: "ok",
        eyebrow: "Step 5 · Reminders scheduled",
        sub: n === 1
          ? "1 reminder scheduled. We’ll email you with an Add to Calendar link."
          : `${n} reminders scheduled. We’ll email you with Add to Calendar links.`,
        interstitial: "Reminders scheduled.",
      };
    }
    if (outcome.state === "partial") {
      return {
        seal: "partial",
        eyebrow: "Step 5 · Needs attention",
        sub: reminderNotice
          || `${outcome.scheduled} reminder${outcome.scheduled === 1 ? "" : "s"} scheduled. ${outcome.failed || outcome.needsSet} still need a reminder.`,
        interstitial: "Your week is built — some reminders need attention.",
      };
    }
    if (outcome.state === "failed") {
      return {
        seal: "failed",
        eyebrow: "Step 5 · Reminders didn’t finish",
        sub: reminderNotice || "Reminders could not be scheduled. Go back to review and try again.",
        interstitial: "Your week is built — reminders were not scheduled.",
      };
    }
    if (outcome.state === "needs_set") {
      return {
        seal: "pending",
        eyebrow: "Step 5 · Your week is built",
        sub: `${outcome.needsSet} ${outcome.needsSet === 1 ? "item has" : "items have"} no reminder. Use Set reminder below if you want an email.`,
        interstitial: "Your week is built.",
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
      who: i === 0 ? "person1" : "person2",
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
    const scheduled = !!it.reminder_scheduled;
    const label = reminderLabelFromCard(it);
    const needsSet = !!it.reminder_needs_set || it.calendar_reminder === "none" || !scheduled;
    const badgeAnim = showBadge && scheduled && badgeDrawn && !staticLayout;
    return (
      <div
        className={
          "planitem"
          + (scheduled ? " synced" : "")
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
            {formatWhen(it) && <span>· {formatWhen(it)}</span>}
            {scheduled && label && (
              <span className={"synced-badge-wrap" + (badgeAnim ? " synced-badge-wrap--pop" : "")}>
                <span className={"synced-badge" + (badgeAnim ? " synced-badge--in" : "")}>
                  <SyncedCheckIcon draw={badgeAnim} />
                  {label}
                </span>
              </span>
            )}
            {needsSet && !scheduled && (
              <button
                type="button"
                className="plan-cal-retry"
                onClick={() => onEditReminders?.()}
              >
                Set reminder
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
          {(outcome.state === "failed" || outcome.state === "partial" || outcome.state === "needs_set") && onEditReminders && (
            <button
              type="button"
              className="btn btn-primary plan-sync-retry-all"
              onClick={onEditReminders}
            >
              Set reminders
            </button>
          )}
        </div>

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
                <div style={{ color: "var(--ink-3)", fontSize: 14, padding: "8px 0" }}>All clear this week.</div>
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
              className="plan-btn-ghost"
              onClick={() => onEditReminders?.()}
            >
              Edit reminders
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
