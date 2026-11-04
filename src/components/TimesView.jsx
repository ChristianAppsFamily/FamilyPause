import { useCallback, useEffect, useRef, useState } from "react";
import {
  coerceReminderFields,
  defaultReminderForType,
} from "../lib/planReminders";
import {
  BYDAY_LABELS,
  BYDAY_ORDER,
  TIMES_REMINDER_CHIPS,
  TYPE_MENU,
  applyTimePreset,
  applyWhenPreset,
  buildMonthGrid,
  formatChipDate,
  formatLongDate,
  formatMonthTitle,
  formatTimeLabel,
  inferTimeChip,
  inferWhenChip,
  timeTogetherSummary,
  timesTypeArticle,
  timesTypeLabel,
  todayYmd,
  typeBadgeKey,
} from "../lib/timesPresets";

function Ico({ d, size = 16, fill = false, sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const IC = {
  check: "M5 12.5 10 17.5 19.5 6.5",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  cal: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"],
  clock: ["M12 7v5l3 2", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"],
  bell: ["M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7", "M10 19a2 2 0 0 0 4 0"],
  pencil: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"],
  msg: ["M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"],
  spark: ["M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"],
  pin: ["M12 17v5", "M9 2h6l-1 7h3l-5 6-5-6h3L9 2z"],
  plus: "M12 5v14M5 12h14",
  heart: "M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1z",
  lock: ["M7 11V8a5 5 0 0 1 10 0v3", "M6 11h12v10H6z"],
  repeat: ["M17 1l4 4-4 4", "M3 11V9a4 4 0 0 1 4-4h14", "M7 23l-4-4 4-4", "M21 13v2a4 4 0 0 1-4 4H3"],
  todo: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  scale: ["M12 3v18", "M5 7h14", "M5 7l-2 6h6L5 7z", "M19 7l-2 6h6l-4-6z"],
  note: ["M9 3h7l4 4v14H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M16 3v5h5"],
};

function typeIcon(type) {
  switch (type) {
    case "event": return IC.cal;
    case "action": return IC.todo;
    case "decision": return IC.scale;
    case "note": return IC.note;
    case "time_together": return IC.heart;
    default: return IC.todo;
  }
}

function whoColor(who) {
  if (who === "person1") return "var(--blue)";
  if (who === "person2") return "var(--violet)";
  if (who === "kid") return "var(--coral)";
  return "var(--amber)";
}

function draftFromCard(card) {
  const type = card?.type || "action";
  return {
    date: card?.date || null,
    time: card?.time || null,
    date_only: !!card?.date_only,
    date_precision: card?.date_precision || null,
    time_period: card?.time_period || null,
    calendar_reminder: card?.calendar_reminder || defaultReminderForType(type),
    location: card?.location || "",
    task: card?.task || "",
    recurring: !!card?.recurring,
    byday: Array.isArray(card?.byday) ? [...card.byday] : [],
    checkin_enabled: card?.checkin_enabled !== false && type === "time_together",
  };
}

function MonthCalendar({ selectedYmd, onSelect, today }) {
  const seed = selectedYmd && /^\d{4}-\d{2}-\d{2}$/.test(selectedYmd)
    ? selectedYmd
    : today;
  const [y, m] = seed.split("-").map(Number);
  const [cursor, setCursor] = useState({ year: y, month0: m - 1 });

  useEffect(() => {
    if (!selectedYmd) return;
    const [yy, mm] = selectedYmd.split("-").map(Number);
    setCursor({ year: yy, month0: mm - 1 });
  }, [selectedYmd]);

  const cells = buildMonthGrid(cursor.year, cursor.month0, today);

  return (
    <div className="times-cal">
      <div className="times-calh">
        <b>{formatMonthTitle(cursor.year, cursor.month0)}</b>
        <div>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setCursor((c) => {
              const d = new Date(c.year, c.month0 - 1, 1);
              return { year: d.getFullYear(), month0: d.getMonth() };
            })}
          >
            <Ico d={IC.chevL} size={18} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setCursor((c) => {
              const d = new Date(c.year, c.month0 + 1, 1);
              return { year: d.getFullYear(), month0: d.getMonth() };
            })}
          >
            <Ico d={IC.chevR} size={18} />
          </button>
        </div>
      </div>
      <div className="times-grid7">
        {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
          <div key={d + "h"} className="times-dow">{d}</div>
        ))}
        {cells.map((cell, i) => (
          cell.day == null ? (
            <span key={`e-${i}`} className="times-d times-d--empty" />
          ) : (
            <button
              key={cell.ymd}
              type="button"
              className={
                "times-d"
                + (cell.past ? " past" : "")
                + (cell.today ? " today" : "")
                + (cell.ymd === selectedYmd ? " sel" : "")
              }
              disabled={cell.past}
              onClick={() => onSelect(cell.ymd)}
            >
              {cell.day}
            </button>
          )
        ))}
      </div>
      <div className="times-calf">
        <span>
          Selected:{" "}
          <strong>{selectedYmd ? formatLongDate(selectedYmd) : "—"}</strong>
        </span>
        <span>Today is {formatChipDate(today)}</span>
      </div>
    </div>
  );
}

function Chip({ selected, onClick, children, reveal }) {
  return (
    <button
      type="button"
      className={"times-chip" + (selected ? " sel" : "")}
      data-reveal={reveal || undefined}
      onClick={onClick}
    >
      {selected ? <Ico d={IC.check} size={15} /> : null}
      {children}
    </button>
  );
}

/**
 * Desktop Times step — one card at a time.
 * Props: cards, setCards, onBack, onContinue, roleOf, adults
 */
export default function TimesView({
  cards = [],
  setCards,
  onBack,
  onContinue,
  roleOf,
  adults = [],
}) {
  const list = Array.isArray(cards) ? cards : [];
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState(() => {
    const init = {};
    list.forEach((c) => { init[c.id] = draftFromCard(c); });
    return init;
  });
  const [foundMap] = useState(() => {
    const m = {};
    list.forEach((c) => {
      m[c.id] = { date: !!c.date, time: !!(c.time || c.date_only) };
    });
    return m;
  });
  const [calOpen, setCalOpen] = useState(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [titleEditing, setTitleEditing] = useState(false);
  const [showTimeRow, setShowTimeRow] = useState(false);
  const [showRemindRow, setShowRemindRow] = useState(false);
  const titleRef = useRef(null);
  const today = todayYmd();

  const safeIndex = list.length ? Math.min(index, list.length - 1) : 0;
  const card = list[safeIndex] || null;
  const draft = card ? (drafts[card.id] || draftFromCard(card)) : null;

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      list.forEach((c) => {
        if (!next[c.id]) next[c.id] = draftFromCard(c);
      });
      return next;
    });
  }, [list.map((c) => c.id).join("|")]);

  useEffect(() => {
    setCalOpen(false);
    setTypeMenuOpen(false);
    setTitleEditing(false);
    setShowTimeRow(false);
    setShowRemindRow(false);
  }, [card?.id]);

  const patchDraft = useCallback((id, patch) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  }, []);

  const commitCard = useCallback((id, extra = {}) => {
    const d = { ...(drafts[id] || {}), ...extra };
    setCards((arr) => arr.map((c) => {
      if (c.id !== id) return c;
      const reminder = coerceReminderFields({
        ...c,
        type: c.type,
        calendar_reminder: d.calendar_reminder,
      });
      return {
        ...c,
        task: (d.task || c.task || "").trim() || c.task,
        titleEditedByUser: d.task && d.task !== c.task ? true : c.titleEditedByUser,
        date: d.date || null,
        time: d.date_only ? null : (d.time || null),
        date_only: !!d.date_only,
        date_precision: d.date_precision || null,
        time_period: d.time_period || null,
        location: d.location || null,
        recurring: !!d.recurring,
        byday: d.recurring && d.byday?.length ? d.byday : null,
        checkin_enabled: !!d.checkin_enabled,
        datetime_confirmed: true,
        ...reminder,
      };
    }));
  }, [drafts, setCards]);

  const goNext = useCallback(() => {
    if (safeIndex >= list.length - 1) {
      onContinue?.();
      return;
    }
    setIndex((i) => Math.min(i + 1, list.length - 1));
  }, [safeIndex, list.length, onContinue]);

  const goPrev = useCallback(() => {
    if (safeIndex <= 0) return;
    setIndex((i) => Math.max(i - 1, 0));
  }, [safeIndex]);

  const confirmAndNext = useCallback(() => {
    if (!card) {
      onContinue?.();
      return;
    }
    commitCard(card.id);
    goNext();
  }, [card, commitCard, goNext, onContinue]);

  const skipAndNext = useCallback(() => {
    goNext();
  }, [goNext]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target?.closest?.("input, textarea, [contenteditable=true]")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      if (e.key === "Enter") { e.preventDefault(); confirmAndNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, confirmAndNext]);

  useEffect(() => {
    if (!titleEditing || !titleRef.current) return;
    titleRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(titleRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }, [titleEditing]);

  if (!card || !draft) {
    return (
      <div className="view times-view">
        <div className="times-empty">
          <p>Nothing to schedule — continue to review.</p>
          <button type="button" className="btn btn-primary" onClick={() => onContinue?.()}>
            Continue to review
          </button>
        </div>
      </div>
    );
  }

  const type = card.type || "action";
  const isDecision = type === "decision";
  const isTT = type === "time_together";
  const who = roleOf?.(card.person) || "both";
  const whenChip = inferWhenChip(draft);
  const timeChip = inferTimeChip(draft);
  const found = foundMap[card.id] || {};
  const showFoundWhen = found.date && draft.date && whenChip !== "no_date" && whenChip !== "no_date_needed";
  const showFoundTime = found.time && (draft.time || draft.date_only);
  const progressPct = ((safeIndex + 1) / list.length) * 100;
  const remaining = Math.max(0, list.length - safeIndex - 1);

  const personLabel = (() => {
    if (who === "both" || who === "family") {
      if (adults[0] && adults[1]) return `${adults[0]} and ${adults[1]}`;
      return card.person || "Shared";
    }
    return card.person || "Family";
  })();

  const setWhen = (preset) => {
    if (preset === "pick_date") {
      setCalOpen(true);
      return;
    }
    setCalOpen(false);
    const patch = applyWhenPreset(preset);
    if (!patch) return;
    if (patch.clear) {
      patchDraft(card.id, {
        date: null,
        time: isDecision ? null : draft.time,
        date_only: false,
        date_precision: null,
      });
      return;
    }
    patchDraft(card.id, {
      date: patch.date,
      date_precision: patch.date_precision || "day",
      date_only: patch.date_only ?? draft.date_only,
      ...(patch.date_only ? { time: null, time_period: null } : {}),
    });
  };

  const setTime = (preset) => {
    if (preset === "exact") {
      const next = applyTimePreset("exact", draft.time || "12:00");
      patchDraft(card.id, next);
      return;
    }
    const next = applyTimePreset(preset);
    if (next) patchDraft(card.id, next);
  };

  const changeType = (nextType) => {
    setCards((arr) => arr.map((c) => (c.id === card.id ? { ...c, type: nextType } : c)));
    patchDraft(card.id, {
      calendar_reminder: defaultReminderForType(nextType),
      checkin_enabled: nextType === "time_together",
      ...(nextType === "decision"
        ? { date: null, time: null, date_only: false, date_precision: null }
        : {}),
    });
    setTypeMenuOpen(false);
  };

  const commitTitle = () => {
    const text = (titleRef.current?.textContent || "").trim();
    setTitleEditing(false);
    if (!text) {
      if (titleRef.current) titleRef.current.textContent = draft.task || card.task || "Untitled";
      return;
    }
    patchDraft(card.id, { task: text });
    setCards((arr) => arr.map((c) => (
      c.id === card.id ? { ...c, task: text, titleEditedByUser: true } : c
    )));
  };

  const whenChipButtons = [
    ...(draft.date && !["today", "tomorrow", "this_weekend", "next_week", "no_date"].includes(whenChip)
      ? [{ key: "picked", label: formatChipDate(draft.date), icon: IC.cal, preset: "pick_date" }]
      : []),
    { key: "today", label: "Today", preset: "today" },
    { key: "tomorrow", label: "Tomorrow", preset: "tomorrow" },
    { key: "this_weekend", label: "This weekend", preset: "this_weekend" },
    { key: "next_week", label: "Next week", preset: "next_week" },
    { key: "pick_date", label: "Pick a date", icon: IC.cal, preset: "pick_date" },
    { key: "no_date", label: "No date", preset: "no_date" },
  ];

  const decisionCollapsed = isDecision && !showTimeRow && !showRemindRow
    && (whenChip === "no_date" || whenChip === "no_date_needed" || !draft.date);

  const renderStandardBody = () => (
    <>
      <div className="times-meta">
        <span className={`times-badge t-${typeBadgeKey(type)}`}>
          <Ico d={typeIcon(type)} size={15} />
          {timesTypeLabel(type)}
        </span>
        <span className="times-who">
          {who === "both" || who === "family" ? (
            <span className="times-dots">
              <i className="times-dot" style={{ background: whoColor("person1") }} />
              <i className="times-dot" style={{ background: whoColor("person2") }} />
            </span>
          ) : (
            <i className="times-dot" style={{ background: whoColor(who) }} />
          )}
          {personLabel}
        </span>
      </div>

      <div className="times-title">
        <h1
          ref={titleRef}
          contentEditable={titleEditing}
          suppressContentEditableWarning
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
            if (e.key === "Escape") {
              e.preventDefault();
              if (titleRef.current) titleRef.current.textContent = draft.task || card.task || "";
              setTitleEditing(false);
            }
          }}
        >
          {draft.task || card.task || "Untitled"}
        </h1>
        <button
          type="button"
          className="times-pen"
          title="Edit title"
          onClick={() => setTitleEditing(true)}
        >
          <Ico d={IC.pencil} size={16} />
        </button>
      </div>

      {card.source ? (
        <p className="times-quote">
          <Ico d={IC.msg} size={15} />
          From your conversation: “{card.source}”
        </p>
      ) : null}

      <div className="times-row">
        <div className="times-rh">
          <h3>When</h3>
          {showFoundWhen ? (
            <span className="times-found"><Ico d={IC.spark} size={13} /> Found in your conversation</span>
          ) : null}
        </div>
        <div className="times-chips">
          {isDecision ? (
            <>
              <Chip selected={whenChip === "no_date" || whenChip === "no_date_needed"} onClick={() => setWhen("no_date_needed")}>
                No date needed
              </Chip>
              <Chip selected={whenChip === "this_month"} onClick={() => setWhen("this_month")}>This month</Chip>
              <Chip selected={whenChip === "this_week"} onClick={() => setWhen("this_week")}>This week</Chip>
              <Chip selected={whenChip === "pick_date" || calOpen} onClick={() => setWhen("pick_date")}>
                <Ico d={IC.cal} size={15} />
                {whenChip === "pick_date" && draft.date ? formatChipDate(draft.date) : "Pick a date"}
              </Chip>
            </>
          ) : (
            whenChipButtons.map((c) => {
              const preset = c.preset || c.key;
              const selected = c.key === "picked"
                ? whenChip === "pick_date"
                : whenChip === preset || (preset === "pick_date" && calOpen && whenChip !== "today");
              return (
                <Chip
                  key={c.key}
                  selected={!!selected}
                  onClick={() => setWhen(preset)}
                >
                  {c.icon ? <Ico d={c.icon} size={15} /> : null}
                  {c.label}
                </Chip>
              );
            })
          )}
        </div>
        {(calOpen || whenChip === "pick_date") && (
          <div className="times-panel">
            <MonthCalendar
              selectedYmd={draft.date}
              today={today}
              onSelect={(ymd) => {
                patchDraft(card.id, { date: ymd, date_precision: "day" });
                setCalOpen(true);
              }}
            />
          </div>
        )}
        {isDecision && (whenChip === "no_date" || whenChip === "no_date_needed" || !draft.date) && (
          <div className="times-note">
            <Ico d={IC.pin} size={16} />
            Decisions stay pinned to your plan. Nothing to schedule.
          </div>
        )}
      </div>

      {decisionCollapsed ? (
        <div className="times-coll">
          <div>
            <span><Ico d={IC.clock} size={15} /> Time <b>Not needed</b></span>
            <button type="button" className="times-add" onClick={() => setShowTimeRow(true)}>
              <Ico d={IC.plus} size={14} /> Add
            </button>
          </div>
          <div>
            <span><Ico d={IC.bell} size={15} /> Remind me <b>None</b></span>
            <button type="button" className="times-add" onClick={() => setShowRemindRow(true)}>
              <Ico d={IC.plus} size={14} /> Add
            </button>
          </div>
        </div>
      ) : (
        <>
          {(showTimeRow || !isDecision) && (
            <div className="times-row">
              <div className="times-rh">
                <h3>Time</h3>
                {showFoundTime ? (
                  <span className="times-found"><Ico d={IC.spark} size={13} /> Found in your conversation</span>
                ) : null}
              </div>
              <div className="times-chips">
                {draft.time && timeChip === "exact" ? (
                  <Chip selected onClick={() => setTime("exact")}>
                    <Ico d={IC.clock} size={15} />
                    {formatTimeLabel(draft.time)}
                  </Chip>
                ) : null}
                <Chip selected={timeChip === "morning"} onClick={() => setTime("morning")}>Morning</Chip>
                <Chip selected={timeChip === "afternoon"} onClick={() => setTime("afternoon")}>Afternoon</Chip>
                <Chip selected={timeChip === "evening"} onClick={() => setTime("evening")}>Evening</Chip>
                <Chip selected={timeChip === "all_day"} onClick={() => setTime("all_day")}>All day</Chip>
                <Chip selected={timeChip === "exact"} onClick={() => setTime("exact")}>Exact time</Chip>
              </div>
              {timeChip === "exact" && (
                <div className="times-exact">
                  <label htmlFor={`times-exact-${card.id}`}>Exact time</label>
                  <input
                    id={`times-exact-${card.id}`}
                    type="time"
                    value={draft.time || "12:00"}
                    onChange={(e) => patchDraft(card.id, {
                      time: e.target.value,
                      date_only: false,
                      time_period: null,
                    })}
                  />
                </div>
              )}
            </div>
          )}

          {(showRemindRow || !isDecision) && (
            <div className="times-row">
              <div className="times-rh"><h3>Remind me</h3></div>
              <div className="times-chips">
                {TIMES_REMINDER_CHIPS.map((r) => (
                  <Chip
                    key={r.value}
                    selected={(draft.calendar_reminder || "none") === r.value}
                    onClick={() => patchDraft(card.id, { calendar_reminder: r.value })}
                  >
                    {r.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="times-ctype">
        Not {timesTypeArticle(type)}?{" "}
        <button type="button" className="times-ctype-link" onClick={() => setTypeMenuOpen((v) => !v)}>
          Change type
        </button>
        {typeMenuOpen && (
          <div className="times-menu" role="menu">
            {TYPE_MENU.map((t) => (
              <button
                key={t.value}
                type="button"
                className={type === t.value ? "cur" : ""}
                role="menuitem"
                onClick={() => changeType(t.value)}
              >
                <span className={`times-sw t-${typeBadgeKey(t.value)}`}>
                  <Ico d={typeIcon(t.value)} size={14} />
                </span>
                {t.label}
                <span className="times-ck" aria-hidden="true">
                  {type === t.value ? <Ico d={IC.check} size={14} /> : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="times-btn" onClick={confirmAndNext}>
        Confirm and next <kbd>Enter</kbd>
      </button>
      <button type="button" className="times-skip" onClick={skipAndNext}>Skip for now</button>
    </>
  );

  const renderTimeTogether = () => (
    <>
      <div className="times-tthead">
        <span className="times-hi"><Ico d={IC.heart} size={20} fill /></span>
        <div>
          <h2>Time Together</h2>
          <p>Just the two of you. Protect it on the calendar.</p>
        </div>
      </div>

      <div className="times-fld">
        <label htmlFor={`tt-what-${card.id}`}>What</label>
        <input
          id={`tt-what-${card.id}`}
          className="times-inp"
          value={draft.task || ""}
          onChange={(e) => patchDraft(card.id, { task: e.target.value })}
        />
      </div>
      <div className="times-fld">
        <label htmlFor={`tt-where-${card.id}`}>
          Where <span>Optional</span>
        </label>
        <input
          id={`tt-where-${card.id}`}
          className="times-inp"
          placeholder="Around the neighborhood"
          value={draft.location || ""}
          onChange={(e) => patchDraft(card.id, { location: e.target.value })}
        />
      </div>

      <div className="times-fld" style={{ marginBottom: 12 }}>
        <label>When</label>
      </div>
      <div className="times-box">
        <div className="times-trow">
          <div><b>Repeat weekly</b></div>
          <button
            type="button"
            className={"times-tg" + (draft.recurring ? " on" : "")}
            aria-label="Repeat weekly"
            aria-pressed={!!draft.recurring}
            onClick={() => patchDraft(card.id, {
              recurring: !draft.recurring,
              byday: !draft.recurring && !draft.byday?.length
                ? [BYDAY_ORDER[new Date().getDay()]]
                : draft.byday,
            })}
          />
        </div>
        {draft.recurring && (
          <div className="times-days">
            {BYDAY_ORDER.map((code, i) => {
              const on = (draft.byday || []).includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  className={"times-day" + (on ? " sel" : "")}
                  onClick={() => {
                    const cur = new Set(draft.byday || []);
                    if (cur.has(code)) cur.delete(code);
                    else cur.add(code);
                    patchDraft(card.id, { byday: [...cur] });
                  }}
                >
                  {BYDAY_LABELS[i]}
                </button>
              );
            })}
          </div>
        )}
        <div className="times-chips" style={{ paddingBottom: 14 }}>
          <Chip selected={timeChip === "morning"} onClick={() => setTime("morning")}>Morning</Chip>
          <Chip selected={timeChip === "afternoon"} onClick={() => setTime("afternoon")}>Afternoon</Chip>
          <Chip selected={timeChip === "evening"} onClick={() => setTime("evening")}>Evening</Chip>
          <Chip selected={timeChip === "exact"} onClick={() => setTime("exact")}>
            {draft.time && timeChip === "exact" ? (
              <><Ico d={IC.clock} size={15} />{formatTimeLabel(draft.time)}</>
            ) : "Exact time"}
          </Chip>
        </div>
        {timeChip === "exact" && (
          <div className="times-exact" style={{ marginBottom: 12 }}>
            <input
              type="time"
              value={draft.time || "19:30"}
              onChange={(e) => patchDraft(card.id, {
                time: e.target.value,
                date_only: false,
                time_period: null,
              })}
            />
          </div>
        )}
        {!draft.date && (
          <div className="times-chips" style={{ paddingBottom: 10 }}>
            <Chip selected={false} onClick={() => setWhen("today")}>Today</Chip>
            <Chip selected={false} onClick={() => setWhen("tomorrow")}>Tomorrow</Chip>
            <Chip selected={calOpen} onClick={() => setWhen("pick_date")}>
              <Ico d={IC.cal} size={15} /> Pick a start date
            </Chip>
          </div>
        )}
        {draft.date && (
          <div className="times-chips" style={{ paddingBottom: 10 }}>
            <Chip selected onClick={() => setCalOpen(true)}>
              <Ico d={IC.cal} size={15} /> Starts {formatChipDate(draft.date)}
            </Chip>
          </div>
        )}
        {calOpen && (
          <MonthCalendar
            selectedYmd={draft.date}
            today={today}
            onSelect={(ymd) => {
              patchDraft(card.id, { date: ymd, date_precision: "day" });
            }}
          />
        )}
        <p className="times-sum">
          <Ico d={IC.repeat} size={15} />
          {timeTogetherSummary(draft)}
        </p>
      </div>

      <div className="times-fld" style={{ marginBottom: 12 }}>
        <label>Reminders</label>
      </div>
      <div className="times-box">
        <div className="times-trow">
          <div>
            <b>Day before</b>
            <small>A heads-up the evening before</small>
          </div>
          <button
            type="button"
            className={"times-tg" + (draft.calendar_reminder === "day_before" ? " on" : "")}
            aria-label="Day before"
            aria-pressed={draft.calendar_reminder === "day_before"}
            onClick={() => patchDraft(card.id, {
              calendar_reminder: draft.calendar_reminder === "day_before" ? "none" : "day_before",
            })}
          />
        </div>
        <div className="times-trow">
          <div>
            <b>Check-in the day of</b>
            <small>Asks you both if it happened</small>
          </div>
          <button
            type="button"
            className={"times-tg" + (draft.checkin_enabled ? " on" : "")}
            aria-label="Check-in"
            aria-pressed={!!draft.checkin_enabled}
            onClick={() => patchDraft(card.id, { checkin_enabled: !draft.checkin_enabled })}
          />
        </div>
      </div>

      <div className="times-ctype">
        Not Time Together?{" "}
        <button type="button" className="times-ctype-link" onClick={() => setTypeMenuOpen((v) => !v)}>
          Change type
        </button>
        {typeMenuOpen && (
          <div className="times-menu" role="menu">
            {TYPE_MENU.map((t) => (
              <button
                key={t.value}
                type="button"
                className={type === t.value ? "cur" : ""}
                role="menuitem"
                onClick={() => changeType(t.value)}
              >
                <span className={`times-sw t-${typeBadgeKey(t.value)}`}>
                  <Ico d={typeIcon(t.value)} size={14} />
                </span>
                {t.label}
                <span className="times-ck" aria-hidden="true">
                  {type === t.value ? <Ico d={IC.check} size={14} /> : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className="times-btn" onClick={confirmAndNext}>
        <Ico d={IC.lock} size={16} /> Lock it in
      </button>
      <button type="button" className="times-skip" onClick={skipAndNext}>Skip for now</button>
    </>
  );

  return (
    <div className="view times-view">
      <div className="times-stage">
        <button
          type="button"
          className="times-nav"
          disabled={safeIndex === 0}
          aria-label="Previous item"
          onClick={goPrev}
        >
          <Ico d={IC.chevL} size={22} />
        </button>

        <div className="times-main">
          <div className="times-prog">
            Item {safeIndex + 1} of {list.length}
            <span>{remaining} to go</span>
          </div>
          <div className="times-bar"><i style={{ width: `${progressPct}%` }} /></div>

          <div className={"times-card" + (isTT ? " tt" : "")}>
            {isTT ? renderTimeTogether() : renderStandardBody()}
          </div>

          <div className="times-hint">
            <span><kbd>←</kbd><kbd>→</kbd> Move between items</span>
            <span><kbd>Enter</kbd> Confirm</span>
          </div>
        </div>

        <button
          type="button"
          className="times-nav"
          aria-label="Next item"
          onClick={goNext}
        >
          <Ico d={IC.chevR} size={22} />
        </button>
      </div>
    </div>
  );
}
