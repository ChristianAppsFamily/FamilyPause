import { useEffect, useMemo, useRef, useState } from "react";
import UpgradePrompt from "./UpgradePrompt.jsx";
import {
  coerceReminderFields,
  defaultReminderForType,
  reminderChoiceLabel,
} from "../lib/planReminders";
import {
  buildReviewGroups,
  REVIEW_TYPE_TABS,
} from "../lib/reviewGroups";
import {
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
  timesTypeLabel,
  todayYmd,
  typeBadgeKey,
} from "../lib/timesPresets";

const STATUS = {
  OPEN: "pending",
  KEPT: "kept",
  DISCARDED: "discarded",
  CALENDARED: "calendared",
};

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
  checkCheck: ["M18 6 7 17l-5-5", "M22 10 12 20l-2-2"],
  chevD: "M6 9l6 6 6-6",
  chevL: "M15 6l-6 6 6 6",
  chevR: "M9 6l6 6-6 6",
  cal: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"],
  clock: ["M12 7v5l3 2", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"],
  bell: ["M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7", "M10 19a2 2 0 0 0 4 0"],
  pencil: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"],
  msg: ["M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6"],
  undo: ["M3 7v6h6", "M3 13a9 9 0 1 0 3-7.7L3 7"],
  heart: "M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1z",
  todo: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  scale: ["M12 3v18", "M5 7h14", "M5 7l-2 6h6L5 7z", "M19 7l-2 6h6l-4-6z"],
  note: ["M9 3h7l4 4v14H9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z", "M16 3v5h5"],
  users: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  more: ["M12 12h.01", "M19 12h.01", "M5 12h.01"],
  x: "M6 6l12 12M18 6 6 18",
  arrow: "M5 12h14M13 6l6 6-6 6",
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

function isKept(status) {
  return status === STATUS.KEPT || status === STATUS.CALENDARED || status === STATUS.OPEN || !status;
}

function isRemoved(status) {
  return status === STATUS.DISCARDED;
}

function KeptRing({ kept, total, size = 60 }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const ratio = total ? kept / total : 0;
  return (
    <div className="rv-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#14805E"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
        />
      </svg>
      <b>{kept}</b>
    </div>
  );
}

function MonthCalendar({ selectedYmd, onSelect, today }) {
  const seed = selectedYmd && /^\d{4}-\d{2}-\d{2}$/.test(selectedYmd) ? selectedYmd : today;
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
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`} className="times-dow">{d}</div>
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
        <span>Selected: <strong>{selectedYmd ? formatLongDate(selectedYmd) : "—"}</strong></span>
        <span>Today is {formatChipDate(today)}</span>
      </div>
    </div>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      className={"rv-chip" + (selected ? " sel" : "")}
      onClick={onClick}
    >
      {selected ? <Ico d={IC.check} size={14} /> : null}
      {children}
    </button>
  );
}

function personMatchesFilter(card, whoFilter, roleOf) {
  if (whoFilter === "all") return true;
  if (whoFilter === "shared") {
    const who = roleOf?.(card.person) || "both";
    return who === "both" || who === "family" || /^(shared|family|both)$/i.test(card.person || "");
  }
  return String(card.person || "").toLowerCase() === String(whoFilter).toLowerCase();
}

function metaWhenLabel(card) {
  if (!card?.date) return "No date";
  if (card.date_precision === "month") {
    const d = new Date(`${card.date}T12:00:00`);
    return d.toLocaleDateString("en-US", { month: "long" });
  }
  if (card.recurring && Array.isArray(card.byday) && card.byday.length) {
    return formatChipDate(card.date) || "Recurring";
  }
  return formatChipDate(card.date);
}

function metaTimeLabel(card) {
  if (card?.date_only || (!card?.time && card?.date)) return "All day";
  if (!card?.time) return null;
  if (card.time_period === "morning") return "Morning";
  if (card.time_period === "afternoon") return "Afternoon";
  if (card.time_period === "evening") return "Evening";
  return formatTimeLabel(card.time);
}

function EditDrawer({
  card,
  adults,
  kids,
  hasFamilyFeatures,
  onUpgrade,
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() => ({
    task: card.task || "",
    type: card.type || "action",
    person: card.person || "Family",
    date: card.date || null,
    time: card.time || null,
    date_only: !!card.date_only,
    date_precision: card.date_precision || null,
    time_period: card.time_period || null,
    calendar_reminder: card.calendar_reminder || defaultReminderForType(card.type),
  }));
  const [calOpen, setCalOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const today = todayYmd();
  const whenChip = inferWhenChip(draft);
  const timeChip = inferTimeChip(draft);

  const whoOptions = useMemo(() => {
    const opts = [];
    (adults || []).forEach((n) => opts.push({ key: n, label: n, color: null }));
    (kids || []).forEach((n) => opts.push({ key: n, label: n, color: "var(--coral)" }));
    opts.push({ key: "Shared", label: "Shared" });
    opts.push({ key: "Family", label: "Family" });
    return opts;
  }, [adults, kids]);

  const lockEdit = !hasFamilyFeatures;

  const setWhen = (preset) => {
    if (preset === "pick_date") {
      setCalOpen(true);
      return;
    }
    setCalOpen(false);
    const patch = applyWhenPreset(preset);
    if (!patch) return;
    if (patch.clear) {
      setDraft((d) => ({ ...d, date: null, date_precision: null, date_only: false }));
      return;
    }
    setDraft((d) => ({
      ...d,
      date: patch.date,
      date_precision: patch.date_precision || "day",
      date_only: patch.date_only ?? d.date_only,
      ...(patch.date_only ? { time: null, time_period: null } : {}),
    }));
  };

  const setTime = (preset) => {
    const next = applyTimePreset(preset, draft.time || "12:00");
    if (next) setDraft((d) => ({ ...d, ...next }));
  };

  return (
    <>
      <button type="button" className="rv-scrim" aria-label="Close" onClick={onClose} />
      <aside className="rv-drawer" role="dialog" aria-label="Edit item">
        <div className="rv-dh">
          <h2>Edit item</h2>
          <button type="button" className="rv-ib" aria-label="Close" onClick={onClose}>
            <Ico d={IC.x} size={18} />
          </button>
        </div>
        <div className="rv-db">
          <label className="rv-fl" htmlFor="rv-edit-title">Title</label>
          <textarea
            id="rv-edit-title"
            className="rv-inp"
            rows={1}
            value={draft.task}
            disabled={lockEdit}
            onChange={(e) => {
              if (lockEdit) { setShowUpgrade(true); return; }
              setDraft((d) => ({ ...d, task: e.target.value }));
            }}
            onClick={() => { if (lockEdit) setShowUpgrade(true); }}
          />

          <label className="rv-fl">Type</label>
          <div className="rv-chips">
            {TYPE_MENU.map((t) => (
              <Chip
                key={t.value}
                selected={draft.type === t.value}
                onClick={() => {
                  if (lockEdit) { setShowUpgrade(true); return; }
                  setDraft((d) => ({
                    ...d,
                    type: t.value,
                    calendar_reminder: defaultReminderForType(t.value),
                  }));
                }}
              >
                <Ico d={typeIcon(t.value)} size={14} />
                {t.label}
              </Chip>
            ))}
          </div>

          <label className="rv-fl">Who</label>
          <div className="rv-chips">
            {whoOptions.map((o, i) => {
              const selected = String(draft.person || "").toLowerCase() === String(o.key).toLowerCase();
              const color = o.color
                || (adults[0] && o.key === adults[0] ? whoColor("person1")
                  : adults[1] && o.key === adults[1] ? whoColor("person2")
                    : whoColor("kid"));
              return (
                <Chip
                  key={o.key + i}
                  selected={selected}
                  onClick={() => {
                    if (lockEdit) { setShowUpgrade(true); return; }
                    setDraft((d) => ({ ...d, person: o.key }));
                  }}
                >
                  {(o.key !== "Shared" && o.key !== "Family") ? (
                    <i className="rv-dot" style={{ background: color }} />
                  ) : null}
                  {o.label}
                </Chip>
              );
            })}
          </div>

          <label className="rv-fl">When</label>
          <div className="rv-chips">
            {draft.date && !["today", "tomorrow", "this_weekend", "next_week", "no_date", "this_month"].includes(whenChip) && (
              <Chip selected onClick={() => setCalOpen(true)}>
                <Ico d={IC.cal} size={14} />
                {formatChipDate(draft.date)}
              </Chip>
            )}
            <Chip selected={whenChip === "today"} onClick={() => setWhen("today")}>Today</Chip>
            <Chip selected={whenChip === "tomorrow"} onClick={() => setWhen("tomorrow")}>Tomorrow</Chip>
            <Chip selected={whenChip === "this_weekend"} onClick={() => setWhen("this_weekend")}>This weekend</Chip>
            <Chip selected={whenChip === "next_week"} onClick={() => setWhen("next_week")}>Next week</Chip>
            <Chip selected={whenChip === "pick_date" || calOpen} onClick={() => setWhen("pick_date")}>
              <Ico d={IC.cal} size={14} /> Pick a date
            </Chip>
            <Chip selected={whenChip === "no_date"} onClick={() => setWhen("no_date")}>No date</Chip>
          </div>
          {(calOpen || whenChip === "pick_date") && (
            <div style={{ marginBottom: 26 }}>
              <MonthCalendar
                selectedYmd={draft.date}
                today={today}
                onSelect={(ymd) => {
                  setDraft((d) => ({ ...d, date: ymd, date_precision: "day" }));
                  setCalOpen(true);
                }}
              />
            </div>
          )}

          <label className="rv-fl">Time</label>
          <div className="rv-chips">
            {draft.time && timeChip === "exact" && (
              <Chip selected onClick={() => setTime("exact")}>
                <Ico d={IC.clock} size={14} />
                {formatTimeLabel(draft.time)}
              </Chip>
            )}
            <Chip selected={timeChip === "morning"} onClick={() => setTime("morning")}>Morning</Chip>
            <Chip selected={timeChip === "afternoon"} onClick={() => setTime("afternoon")}>Afternoon</Chip>
            <Chip selected={timeChip === "evening"} onClick={() => setTime("evening")}>Evening</Chip>
            <Chip selected={timeChip === "all_day"} onClick={() => setTime("all_day")}>All day</Chip>
            <Chip selected={timeChip === "exact"} onClick={() => setTime("exact")}>Exact time</Chip>
          </div>
          {timeChip === "exact" && (
            <div className="times-exact" style={{ marginBottom: 26 }}>
              <input
                type="time"
                value={draft.time || "12:00"}
                onChange={(e) => setDraft((d) => ({
                  ...d,
                  time: e.target.value,
                  date_only: false,
                  time_period: null,
                }))}
              />
            </div>
          )}

          <label className="rv-fl">Remind me</label>
          <div className="rv-chips">
            {TIMES_REMINDER_CHIPS.map((r) => (
              <Chip
                key={r.value}
                selected={(draft.calendar_reminder || "none") === r.value}
                onClick={() => setDraft((d) => ({ ...d, calendar_reminder: r.value }))}
              >
                {r.label}
              </Chip>
            ))}
          </div>

          {card.source ? (
            <p className="rv-src">
              <Ico d={IC.msg} size={14} />
              From your conversation: “{card.source}”
            </p>
          ) : null}
        </div>
        <div className="rv-df">
          <button type="button" className="rv-txtb" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="rv-btn"
            onClick={() => {
              const reminder = coerceReminderFields({
                type: draft.type,
                calendar_reminder: draft.calendar_reminder,
              });
              onSave({
                task: (draft.task || "").trim() || card.task,
                titleEditedByUser: (draft.task || "").trim() !== (card.task || "").trim(),
                type: draft.type,
                person: draft.person,
                date: draft.date || null,
                time: draft.date_only ? null : (draft.time || null),
                date_only: !!draft.date_only,
                date_precision: draft.date_precision || null,
                time_period: draft.time_period || null,
                ...reminder,
              });
            }}
          >
            Save
          </button>
        </div>
      </aside>
      {showUpgrade && (
        <UpgradePrompt
          title="Editing is a Family Plan feature"
          body="Fix titles, people, and item types in one tap instead of starting over."
          onUpgrade={onUpgrade}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  );
}

function ReviewRow({
  card,
  roleOf,
  adults,
  expanded,
  onToggleExpand,
  onEdit,
  onRemove,
  onUndo,
  onKeep,
}) {
  const removed = isRemoved(card.status);
  const who = roleOf?.(card.person) || "both";
  const personLabel = (() => {
    if (who === "both" || who === "family") {
      if (/^(shared|family|both)$/i.test(card.person || "")) return card.person;
      if (adults?.[0] && adults?.[1]) return `${adults[0]} and ${adults[1]}`;
      return card.person || "Shared";
    }
    return card.person || "Family";
  })();
  const when = metaWhenLabel(card);
  const time = metaTimeLabel(card);
  const remind = reminderChoiceLabel(card.calendar_reminder || defaultReminderForType(card.type));
  const showRemind = remind && remind !== "None";

  return (
    <div className={"rv-rw" + (removed ? " off" : "") + (expanded ? " open" : "")} data-id={card.id}>
      <span className={`rv-ic t-${typeBadgeKey(card.type)}`}>
        <Ico d={typeIcon(card.type)} size={18} />
      </span>
      <div className="rv-tx">
        <b>{card.task || "Untitled"}</b>
        <div className="rv-mt">
          <span>
            {who === "both" || who === "family" ? (
              <span className="rv-dots">
                <i className="rv-dot" style={{ background: whoColor("person1") }} />
                <i className="rv-dot" style={{ background: whoColor("person2") }} />
              </span>
            ) : (
              <i className="rv-dot" style={{ background: whoColor(who) }} />
            )}
            {personLabel}
          </span>
          <span>
            <Ico d={IC.cal} size={14} />
            {when}{time && time !== "All day" ? ` · ${time}` : ""}
          </span>
          {showRemind ? (
            <span><Ico d={IC.bell} size={14} />{remind.replace(/\s*\(.*\)$/, "")}</span>
          ) : null}
        </div>
        {card.source ? (
          <p className="rv-q">
            <Ico d={IC.msg} size={14} />
            “{card.source}”
          </p>
        ) : null}
      </div>
      <div className="rv-acts">
        {removed ? (
          <>
            <span className="rv-tag">Removed</span>
            <button type="button" className="rv-undo" onClick={() => onUndo(card.id)}>
              <Ico d={IC.undo} size={15} /> Undo
            </button>
          </>
        ) : (
          <>
            <button type="button" className="rv-ib" title="Edit" onClick={() => onEdit(card.id)}>
              <Ico d={IC.pencil} size={17} />
            </button>
            <button type="button" className="rv-ib rm" title="Remove" onClick={() => onRemove(card.id)}>
              <Ico d={IC.trash} size={17} />
            </button>
            <button
              type="button"
              className="rv-keep"
              aria-pressed="true"
              onClick={() => onKeep(card.id)}
            >
              <Ico d={IC.check} size={16} /> Keep
            </button>
            {card.source ? (
              <button
                type="button"
                className="rv-ib chev"
                title="Show source"
                aria-expanded={expanded}
                onClick={() => onToggleExpand(card.id)}
              >
                <Ico d={IC.chevD} size={17} />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Desktop Review prune list.
 */
export default function ReviewView({
  cards = [],
  setCards,
  roleOf,
  adults = [],
  kids = [],
  meetingDate,
  onBack,
  onBuild,
  distillError,
  calendarSyncing,
  hasFamilyFeatures,
  onUpgrade,
}) {
  const [tab, setTab] = useState("all");
  const [whoFilter, setWhoFilter] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set());
  const [drawerId, setDrawerId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const promotedRef = useRef(false);

  useEffect(() => {
    if (promotedRef.current) return;
    promotedRef.current = true;
    setCards((arr) => {
      if (!arr.some((c) => c.status === STATUS.OPEN || !c.status)) return arr;
      return arr.map((c) => (
        (c.status === STATUS.OPEN || !c.status)
          ? { ...c, status: STATUS.KEPT }
          : c
      ));
    });
  }, [setCards]);

  const list = Array.isArray(cards) ? cards : [];
  const total = list.length;
  const kept = list.filter((c) => isKept(c.status) && !isRemoved(c.status)).length;
  const removed = list.filter((c) => isRemoved(c.status)).length;

  const filtered = useMemo(() => {
    return list.filter((c) => {
      if (tab !== "all" && c.type !== tab) return false;
      if (!personMatchesFilter(c, whoFilter, roleOf)) return false;
      return true;
    });
  }, [list, tab, whoFilter, roleOf]);

  const { timeTogether, groups } = useMemo(
    () => buildReviewGroups(filtered, meetingDate),
    [filtered, meetingDate],
  );

  const typeCounts = useMemo(() => {
    const counts = { all: list.length };
    for (const t of REVIEW_TYPE_TABS) {
      if (t.key === "all") continue;
      counts[t.key] = list.filter((c) => c.type === t.key).length;
    }
    return counts;
  }, [list]);

  const peoplePills = useMemo(() => {
    const pills = [{ key: "all", label: "Everyone" }];
    (adults || []).forEach((n) => pills.push({ key: n, label: n }));
    (kids || []).forEach((n) => pills.push({ key: n, label: n }));
    return pills;
  }, [adults, kids]);

  const setStatus = (id, status) => {
    setCards((arr) => arr.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const drawerCard = drawerId ? list.find((c) => c.id === drawerId) : null;

  if (total === 0) {
    return (
      <div className="view review-view">
        <div className="rv-page">
          <div className="rv-empty">
            {distillError ? (
              <>
                <h1>AI unavailable.</h1>
                <p>{distillError}</p>
              </>
            ) : (
              <>
                <h1>Nothing to review.</h1>
                <p>We couldn&apos;t extract items. Try a longer or clearer transcript.</p>
              </>
            )}
            <button type="button" className="linkish" onClick={onBack}>← Rebuild</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view review-view">
      <div className="rv-scroll">
        <div className="rv-page">
          <div className="rv-head">
            <div>
              <h1>Look over your week</h1>
              <p>
                {total} item{total === 1 ? "" : "s"} from your conversation. Remove anything you don&apos;t need.
              </p>
            </div>
            <div className="rv-kept">
              <KeptRing kept={kept} total={total} />
              <div>
                <strong>{kept} of {total} kept</strong>
                <span>{removed} removed</span>
              </div>
            </div>
          </div>

          <div className="rv-tabs">
            {REVIEW_TYPE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={"rv-tab" + (tab === t.key ? " sel" : "")}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <em>{typeCounts[t.key] || 0}</em>
              </button>
            ))}
          </div>

          <div className="rv-people">
            {peoplePills.map((p) => (
              <button
                key={p.key}
                type="button"
                className={"rv-pc" + (whoFilter === p.key ? " sel" : "")}
                onClick={() => setWhoFilter(p.key)}
              >
                {p.key === "all" ? (
                  <Ico d={IC.users} size={15} />
                ) : (
                  <i
                    className="rv-dot"
                    style={{
                      background: adults[0] && p.key === adults[0]
                        ? whoColor("person1")
                        : adults[1] && p.key === adults[1]
                          ? whoColor("person2")
                          : whoColor("kid"),
                    }}
                  />
                )}
                {p.label}
              </button>
            ))}
          </div>

          {timeTogether.length > 0 && (
            <div className="rv-tt">
              <div className="rv-tth">
                <span className="rv-hi"><Ico d={IC.heart} size={16} fill /></span>
                <h2>Your time together this week</h2>
              </div>
              {timeTogether.map((card) => (
                <ReviewRow
                  key={card.id}
                  card={card}
                  roleOf={roleOf}
                  adults={adults}
                  expanded={expanded.has(card.id)}
                  onToggleExpand={(id) => setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })}
                  onEdit={setDrawerId}
                  onRemove={(id) => setStatus(id, STATUS.DISCARDED)}
                  onUndo={(id) => setStatus(id, STATUS.KEPT)}
                  onKeep={(id) => setStatus(id, STATUS.DISCARDED)}
                />
              ))}
            </div>
          )}

          {groups.map((g) => (
            <div key={g.key}>
              <div className="rv-gh">
                <h3>{g.label}</h3>
                <span>{g.items.length} item{g.items.length === 1 ? "" : "s"}</span>
              </div>
              <div className="rv-gl">
                {g.items.map((card) => (
                  <ReviewRow
                    key={card.id}
                    card={card}
                    roleOf={roleOf}
                    adults={adults}
                    expanded={expanded.has(card.id)}
                    onToggleExpand={(id) => setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })}
                    onEdit={setDrawerId}
                    onRemove={(id) => setStatus(id, STATUS.DISCARDED)}
                    onUndo={(id) => setStatus(id, STATUS.KEPT)}
                    onKeep={(id) => setStatus(id, STATUS.DISCARDED)}
                  />
                ))}
              </div>
            </div>
          ))}

          {!timeTogether.length && !groups.length && (
            <p className="rv-filter-empty">Nothing here for this filter.</p>
          )}
        </div>
      </div>

      <div className="rv-bbar">
        <p>
          <b>{kept} item{kept === 1 ? "" : "s"}</b> will be added to your plan, {removed} removed
        </p>
        <div className="rv-bact">
          <button
            type="button"
            className="rv-more"
            aria-label="More actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Ico d={IC.more} size={18} />
          </button>
          {menuOpen && (
            <div className="rv-menu">
              <button
                type="button"
                onClick={() => {
                  setCards((arr) => arr.map((c) => (
                    isRemoved(c.status) ? { ...c, status: STATUS.KEPT } : c
                  )));
                  setMenuOpen(false);
                }}
              >
                <Ico d={IC.undo} size={15} /> Restore removed items
              </button>
              <button
                type="button"
                className="dang"
                onClick={() => {
                  setCards((arr) => arr.map((c) => ({ ...c, status: STATUS.DISCARDED })));
                  setMenuOpen(false);
                }}
              >
                <Ico d={IC.trash} size={15} /> Remove all remaining
              </button>
            </div>
          )}
          <button
            type="button"
            className="rv-btn2"
            onClick={() => setCards((arr) => arr.map((c) => (
              isRemoved(c.status) ? c : { ...c, status: STATUS.KEPT }
            )))}
          >
            <Ico d={IC.checkCheck} size={16} /> Keep all
          </button>
          <button
            type="button"
            className={"rv-btn" + (calendarSyncing ? " breathing" : "")}
            disabled={calendarSyncing || kept === 0}
            onClick={onBuild}
          >
            {calendarSyncing ? (
              "Scheduling reminders…"
            ) : (
              <>Looks good, build my plan <Ico d={IC.arrow} size={16} /></>
            )}
          </button>
        </div>
      </div>

      {drawerCard && (
        <EditDrawer
          card={drawerCard}
          adults={adults}
          kids={kids}
          hasFamilyFeatures={hasFamilyFeatures}
          onUpgrade={onUpgrade}
          onClose={() => setDrawerId(null)}
          onSave={(patch) => {
            setCards((arr) => arr.map((c) => (
              c.id === drawerCard.id ? { ...c, ...patch } : c
            )));
            setDrawerId(null);
          }}
        />
      )}
    </div>
  );
}
