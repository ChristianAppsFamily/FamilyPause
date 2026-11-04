import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { FpMark } from "./SiteChrome.jsx";
import {
  buildGoogleTemplateUrl,
  buildIcsCalendar,
  downloadIcs,
  safeIcsFilename,
} from "../lib/calendarLinks.js";
import { scheduleItemReminders, applyReminderScheduleToCards } from "../lib/planReminders.js";
import { DEFAULT_TIME_ZONE } from "../lib/remindAt.js";
import { todayYmd } from "../lib/timesPresets.js";
import {
  buildHistoryRows,
  buildHomeWeekDays,
  coupleLabel,
  filterHomeItems,
  formatWeekRange,
  homeTypeMeta,
  itemsForWeek,
  mapSessionCardsToHomeItems,
  planningSinceLabel,
  weekOffsetForStart,
  weekStartForOffset,
} from "../lib/homeWeek.js";
import "../styles/home.css";

function Icon({ d, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

const IC = {
  check: "M5 12.5 10 17.5 19.5 6.5",
  cal: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"],
  calPlus: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M12 11v6M9 14h6"],
  days: ["M7 3v3M17 3v3", "M4 8h16", "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"],
  history: ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5"],
  users: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  bellPlus: ["M19.4 14.9A8 8 0 0 1 6 8c0 7-3 9-3 9h12", "M10.3 21a1.94 1.94 0 0 0 3.4 0", "M16 6h6M19 3v6"],
  bellOff: ["M8.7 3.4A6 6 0 0 1 18 8c0 2.6.7 4.5 1.5 6", "M17 17H3s3-2 3-9a6 6 0 0 1 .4-2.1", "M10.3 21a1.94 1.94 0 0 0 3.4 0", "M2 2l20 20"],
  alert: ["M12 9v4", "M12 17h.01", "M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"],
  x: "M18 6 6 18M6 6l12 12",
  chevL: "M15 18l-6-6 6-6",
  chevR: "M9 18l6-6-6-6",
  spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "M5.6 5.6l2.8 2.8", "M15.6 15.6l2.8 2.8", "M18.4 5.6l-2.8 2.8", "M8.4 15.6l-2.8 2.8"],
  heart: ["M8 2v4", "M16 2v4", "M3 8h18", "M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z", "M12 12v4"],
  note: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z", "M14 2v4a2 2 0 0 0 2 2h4"],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "M22 6l-10 7L2 6"],
};

function Av({ who, adults, size = 18 }) {
  if (who === "both") {
    return (
      <span className="dk-avp">
        <Av who="p1" adults={adults} size={size} />
        <Av who="p2" adults={adults} size={size} />
      </span>
    );
  }
  const name = who === "p2" ? (adults[1] || adults[0] || "Y") : (adults[0] || "Y");
  const init = String(name).trim().charAt(0).toUpperCase() || "?";
  return (
    <span className={`dk-av dk-av-${who === "p2" ? "p2" : "p1"}`} style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {init}
    </span>
  );
}

function HomeCard({ item, missed, adults, onToggle, onCal, onRemind, onMove }) {
  const note = item.type === "note";
  const meta = homeTypeMeta(item.type);
  return (
    <div className={`dk-card${item.done ? " done" : ""}${missed ? " missed" : ""}`}>
      <div className="dk-card-top">
        {note ? (
          <span className="dk-chk" aria-hidden="true"><Icon d={IC.note} size={15} /></span>
        ) : (
          <button className="dk-chk" aria-label={item.done ? "Mark not done" : "Mark done"} onClick={() => onToggle(item)}>
            <span className={`dk-chk-c${item.done ? " on" : ""}`}>{item.done && <Icon d={IC.check} size={12} />}</span>
          </button>
        )}
        <div className="dk-card-t">{item.title}</div>
        {!item.done && !note && (
          <button className="dk-ico" aria-label="Add to calendar" title="Add to calendar" onClick={() => onCal(item)}>
            <Icon d={IC.calPlus} size={15} />
          </button>
        )}
      </div>
      <div className="dk-card-m">
        {missed ? <span className="dk-od">{missed}</span> : item.timeLabel && <span className="dk-time">{item.timeLabel}</span>}
        <Av who={item.who} adults={adults} size={16} />
        {!item.done && item.rem && (
          <span className="dk-card-act"><Icon d={IC.bell} size={13} /></span>
        )}
      </div>
      {!item.done && (
        <div className="dk-type">
          {item.cat && <span className="dk-cat">{item.cat}</span>}
          {item.type !== "event" && (
            <>
              {item.cat && <i>·</i>}
              {meta.label}
            </>
          )}
        </div>
      )}
      {!item.done && !item.rem && !note && !missed && (
        <button className="dk-norem" onClick={() => onRemind(item)}>
          <Icon d={IC.bellPlus} size={13} />Set reminder
        </button>
      )}
      {missed && !item.done && (
        <div className="dk-od-act">
          <button className="dk-btn dark" onClick={() => onMove(item)}>Move to today</button>
          <button className="dk-btn" onClick={() => onRemind(item)}>Remind later</button>
        </div>
      )}
    </div>
  );
}

function HomeModal({ title, sub, onClose, children }) {
  return (
    <div className="dk-modal-wrap">
      <div className="dk-backdrop" onClick={onClose} />
      <div className="dk-modal" role="dialog" aria-label={title}>
        <div className="dk-modal-h">
          <div>
            <div className="dk-modal-t">{title}</div>
            {sub && <div className="dk-modal-s">{sub}</div>}
          </div>
          <button className="dk-ico lg" aria-label="Close" onClick={onClose}><Icon d={IC.x} size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function reminderChoiceFromLabel(label, hasTime) {
  if (!hasTime) {
    if (/tonight/i.test(label)) return "day_before";
    return "morning_of";
  }
  if (/morning/i.test(label)) return "morning_of";
  if (/15\s*min|hour/i.test(label)) return "1_hour";
  if (/at time/i.test(label)) return "1_hour";
  return "morning_of";
}

export default function HomeView({
  workspace,
  user,
  adults = [],
  roleOf,
  onStartSync,
  onOpenSettings,
}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState("all");
  const [week, setWeek] = useState(0);
  const [tab, setTab] = useState("week");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState({});
  const toastTimer = useRef(null);
  const today = todayYmd();

  const flash = useCallback((msg, undo) => {
    setToast({ msg, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const loadSessions = useCallback(async () => {
    if (!workspace?.id) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, meeting_date, cards, status, created_at")
      .eq("workspace_id", workspace.id)
      .order("meeting_date", { ascending: false })
      .limit(40);
    if (error) {
      console.error("Home sessions load failed:", error);
      setSessions([]);
    } else {
      setSessions(data || []);
    }
    setLoading(false);
  }, [workspace?.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const patchCard = useCallback(async (sessionId, cardId, patch) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    const nextCards = (session.cards || []).map((c) => (
      c.id === cardId ? { ...c, ...patch } : c
    ));
    setSessions((prev) => prev.map((s) => (
      s.id === sessionId ? { ...s, cards: nextCards } : s
    )));
    const { error } = await supabase
      .from("sessions")
      .update({ cards: nextCards })
      .eq("id", sessionId);
    if (error) {
      console.error("Home card patch failed:", error);
      await loadSessions();
      return null;
    }
    return nextCards;
  }, [sessions, loadSessions]);

  const allItems = useMemo(
    () => mapSessionCardsToHomeItems(sessions, roleOf),
    [sessions, roleOf],
  );

  const weekStart = weekStartForOffset(week);
  const weekDays = useMemo(() => buildHomeWeekDays(weekStart), [weekStart]);
  const weekItems = useMemo(
    () => filterHomeItems(itemsForWeek(allItems, weekDays), who),
    [allItems, weekDays, who],
  );

  const firstTime = !loading && sessions.length === 0;
  const todayIdx = weekDays.findIndex((d) => d.ymd === today);
  const isMissed = (x) => week === 0 && todayIdx >= 0 && x.day < todayIdx && !x.done && x.type !== "note";
  const missed = weekItems.filter(isMissed);
  const openLeft = weekItems.filter((x) => !x.done && x.type !== "note").length;
  const needRem = weekItems.filter((x) => !x.done && !x.rem && x.type !== "note" && !isMissed(x)).length;
  const showEmptyOverlay = firstTime || (week === 1 && weekItems.length === 0);

  const historyRows = useMemo(() => buildHistoryRows(sessions), [sessions]);
  const couple = coupleLabel(adults);
  const since = planningSinceLabel(workspace);

  const weekLabel = week === 0 ? "This week" : week === -1 ? "Last week" : week > 0 ? "Next week" : "This week";
  const range = formatWeekRange(weekStart);
  const ctaLabel = firstTime
    ? "Start your first FamilyPause"
    : week === 1
      ? "Plan next week"
      : "Start this week's FamilyPause";

  const startSync = () => {
    onStartSync?.();
  };

  const toggle = async (item) => {
    if (week !== 0) return;
    const nextDone = !item.done;
    await patchCard(item.sessionId, item.cardId, { done: nextDone });
    if (nextDone) {
      flash("Marked done", async () => {
        await patchCard(item.sessionId, item.cardId, { done: false });
      });
    }
  };

  const moveToToday = async (item) => {
    await patchCard(item.sessionId, item.cardId, { date: today, date_precision: "day" });
    flash("Moved to today");
  };

  const setReminder = async (item, label) => {
    const choice = reminderChoiceFromLabel(label, !!item.time);
    const nextCards = await patchCard(item.sessionId, item.cardId, {
      calendar_reminder: choice,
      rem: true,
    });
    setModal(null);
    flash(`Reminder set · ${label}`);
    if (!workspace?.id || !nextCards) return;
    try {
      const result = await scheduleItemReminders({
        workspaceId: workspace.id,
        sessionId: item.sessionId,
        meetingDate: item.meetingDate || weekStart,
        cards: nextCards,
      });
      const merged = applyReminderScheduleToCards(nextCards, result);
      setSessions((prev) => prev.map((s) => (
        s.id === item.sessionId ? { ...s, cards: merged } : s
      )));
      await supabase.from("sessions").update({ cards: merged }).eq("id", item.sessionId);
    } catch (err) {
      console.warn("Home reminder schedule failed:", err);
    }
  };

  const openCal = (item) => setModal({ k: "cal", item });
  const openRem = (item) => setModal({ k: "rem", item });

  const addToCalendar = (kind, item) => {
    const card = {
      ...item.card,
      task: item.title,
      date: item.date,
      time: item.time,
      type: item.rawType,
    };
    const tz = workspace?.timezone || DEFAULT_TIME_ZONE;
    if (kind === "google") {
      const url = buildGoogleTemplateUrl(card, tz);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      flash("Opening Google Calendar");
    } else {
      const ics = buildIcsCalendar([card], { timeZone: tz, workspaceId: workspace?.id });
      downloadIcs(safeIcsFilename(item.title), ics);
      flash(kind === "ics" ? "Downloaded .ics file" : `Added to ${kind}`);
    }
    setModal(null);
  };

  const openHistoryWeek = (row) => {
    if (!row?.weekStart) return;
    const offset = weekOffsetForStart(row.weekStart);
    setWeek(Math.max(-1, Math.min(1, offset)));
    setTab("week");
  };

  const whoOptions = useMemo(() => {
    const opts = [{ key: "all", label: adults[1] ? "Both of us" : "Everyone" }];
    if (adults[0]) opts.push({ key: "p1", label: adults[0] });
    if (adults[1]) opts.push({ key: "p2", label: adults[1] });
    return opts;
  }, [adults]);

  const remLabels = (item) => {
    if (item.time) return ["At time of event", "15 min before", "1 hour before", "Morning of"];
    const day = weekDays[item.day];
    return ["Tonight, 8 PM", "Tomorrow, 9 AM", `${day?.short || "Day"}, 9 AM`, "Pick a time"];
  };

  const cardProps = {
    adults,
    onToggle: toggle,
    onCal: openCal,
    onRemind: openRem,
    onMove: moveToToday,
  };

  return (
    <div className="home-view">
      <aside className="dk-side">
        <div className="dk-brand">
          <FpMark size={28} />
          <span>Family<span className="dk-brand-pause">Pause</span></span>
        </div>
        <nav className="dk-nav">
          {[
            ["week", IC.days, "Week"],
            ["history", IC.history, "Past weeks"],
            ["us", IC.users, "Us"],
          ].map(([k, ic, l]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "on" : ""}
              onClick={() => {
                if (k === "us") {
                  onOpenSettings?.();
                  return;
                }
                setTab(k);
                if (k === "week") setWeek(0);
              }}
            >
              <Icon d={ic} size={18} />{l}
            </button>
          ))}
        </nav>
        {!firstTime && tab === "week" && whoOptions.length > 1 && (
          <div className="dk-side-sec">
            <div className="dk-over">Show</div>
            {whoOptions.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`dk-who${who === opt.key ? " on" : ""}`}
                onClick={() => setWho(opt.key)}
              >
                {opt.key === "all"
                  ? <Av who="both" adults={adults} size={20} />
                  : <Av who={opt.key} adults={adults} size={20} />}
                <span className="dk-who-l">{opt.label}</span>
                {who === opt.key && <Icon d={IC.check} size={16} />}
              </button>
            ))}
          </div>
        )}
        <div className="dk-side-foot">
          <div className="dk-couple">
            <Av who="both" adults={adults.length ? adults : [user?.email || "Y"]} size={28} />
            <div>
              <div className="dk-couple-n">{couple}</div>
              <div className="dk-couple-s">{since}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="dk-main">
        {loading ? (
          <div className="dk-loading">Loading your week…</div>
        ) : tab === "history" ? (
          <div className="dk-main-in">
            <div className="dk-h1">Past weeks</div>
            <div className="dk-sum" style={{ marginBottom: 24 }}>
              <span>Every plan you&apos;ve made together</span>
            </div>
            <div className="dk-hist">
              {historyRows.length === 0 ? (
                <div className="dk-hist-empty">Your history starts with your first FamilyPause.</div>
              ) : historyRows.map((row) => (
                <button key={row.id} type="button" className="dk-hist-row" onClick={() => openHistoryWeek(row)}>
                  <span className="dk-hist-l">{row.label}</span>
                  <span className="dk-hist-s">{row.session}</span>
                  <span className="dk-hist-bar">
                    <b style={{ width: `${Math.round((row.done / row.total) * 100)}%` }} />
                  </span>
                  <span className="dk-hist-n">{row.done} of {row.total} done</span>
                  <Icon d={IC.chevR} size={18} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="dk-main-in">
            <header className="dk-head">
              <div>
                <div className="dk-h1">{weekLabel}</div>
                <div className="dk-sum">
                  <span>{range}</span>
                  {firstTime ? (
                    <><i>·</i><span>No plan yet</span></>
                  ) : week === 1 && weekItems.length === 0 ? (
                    <><i>·</i><span>Not planned yet</span></>
                  ) : week === -1 ? (
                    <><i>·</i><span>{weekItems.filter((x) => x.done).length} of {weekItems.length || 0} done</span></>
                  ) : (
                    <>
                      <i>·</i><span>{openLeft} to do</span>
                      {needRem > 0 && (
                        <><i>·</i><span className="dk-warn"><Icon d={IC.bellOff} size={14} />{needRem} without reminders</span></>
                      )}
                      {missed.length > 0 && (
                        <><i>·</i><span className="dk-err">{missed.length} missed</span></>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="dk-head-r">
                {!firstTime && (
                  <div className="dk-wnav">
                    <button type="button" aria-label="Previous week" disabled={week <= -1} onClick={() => setWeek((w) => w - 1)}>
                      <Icon d={IC.chevL} size={18} />
                    </button>
                    <button type="button" className="dk-wnav-t" disabled={week === 0} onClick={() => setWeek(0)}>Today</button>
                    <button type="button" aria-label="Next week" disabled={week >= 1} onClick={() => setWeek((w) => w + 1)}>
                      <Icon d={IC.chevR} size={18} />
                    </button>
                  </div>
                )}
                {week !== -1 && !firstTime && (
                  <button type="button" className="dk-cta" onClick={startSync}>
                    <Icon d={IC.spark} size={16} />{ctaLabel}
                  </button>
                )}
              </div>
            </header>

            {missed.length > 0 && (
              <section className="dk-missed">
                <div className="dk-missed-h">
                  <Icon d={IC.alert} size={16} />
                  <span className="dk-missed-t">Missed</span>
                  <span className="dk-missed-s">Still open from earlier this week</span>
                </div>
                <div className="dk-missed-row">
                  {missed.map((x) => (
                    <HomeCard
                      key={x.id}
                      item={x}
                      missed={`${weekDays[x.day]?.short || ""}${x.timeLabel ? `, ${x.timeLabel}` : ""}`}
                      {...cardProps}
                    />
                  ))}
                </div>
              </section>
            )}

            <div className={`dk-board${showEmptyOverlay ? " empty" : ""}`}>
              {weekDays.map((d) => {
                const list = weekItems.filter((x) => x.day === d.index && !isMissed(x));
                const isToday = week === 0 && d.ymd === today;
                const past = week < 0 || (week === 0 && todayIdx >= 0 && d.index < todayIdx);
                const shown = expanded[d.index] ? list : list.slice(0, 5);
                return (
                  <section key={d.ymd} className={`dk-col${isToday ? " today" : ""}${past ? " past" : ""}`}>
                    <div className="dk-col-h">
                      <span className="dk-col-d">{isToday ? "Today" : d.short}</span>
                      <span className="dk-col-n">{d.n}</span>
                    </div>
                    <div className="dk-col-list">
                      {shown.map((x) => <HomeCard key={x.id} item={x} {...cardProps} />)}
                      {list.length > shown.length && (
                        <button type="button" className="dk-more" onClick={() => setExpanded((e) => ({ ...e, [d.index]: true }))}>
                          {list.length - shown.length} more
                        </button>
                      )}
                      {!list.length && !showEmptyOverlay && (
                        <div className="dk-free">Nothing planned</div>
                      )}
                    </div>
                  </section>
                );
              })}

              {showEmptyOverlay && (
                <div className="dk-empty">
                  <div className="dk-empty-ic">
                    <Icon d={firstTime ? IC.heart : IC.cal} size={28} />
                  </div>
                  <div className="dk-empty-t">
                    {firstTime
                      ? "Your week starts with one conversation"
                      : "Next week isn’t planned yet"}
                  </div>
                  <div className="dk-empty-d">
                    {firstTime
                      ? "Sit down together for about 20 minutes. FamilyPause turns what you talk through into a plan for the week."
                      : "Run a FamilyPause together and it fills in here."}
                  </div>
                  {firstTime && (
                    <ol className="dk-steps">
                      <li><b>1</b>Talk through the week ahead</li>
                      <li><b>2</b>Pick times and reminders</li>
                      <li><b>3</b>Your plan shows up here</li>
                    </ol>
                  )}
                  <button type="button" className="dk-cta lg" onClick={startSync}>
                    <Icon d={IC.spark} size={18} />{ctaLabel}
                  </button>
                  <div className="dk-empty-n">About 20 minutes, together</div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div className="dk-toast">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button type="button" onClick={() => { toast.undo(); setToast(null); }}>Undo</button>
          )}
        </div>
      )}

      {modal?.k === "cal" && (
        <HomeModal
          title="Add to calendar"
          sub={`${modal.item.title} · ${weekDays[modal.item.day]?.short || ""}${modal.item.timeLabel ? `, ${modal.item.timeLabel}` : ""}`}
          onClose={() => setModal(null)}
        >
          <div className="dk-opts">
            {[
              ["Google Calendar", "google", IC.cal],
              ["Apple Calendar", "Apple Calendar", IC.days],
              ["Outlook", "Outlook", IC.mail],
              ["Download .ics file", "ics", IC.download],
            ].map(([label, kind, ic]) => (
              <button key={label} type="button" className="dk-opt" onClick={() => addToCalendar(kind, modal.item)}>
                <Icon d={ic} size={18} />
                <span>{label}</span>
                <Icon d={IC.chevR} size={16} />
              </button>
            ))}
          </div>
          <div className="dk-modal-note">
            FamilyPause doesn&apos;t sync automatically. Adding it here puts a copy on your calendar.
          </div>
        </HomeModal>
      )}

      {modal?.k === "rem" && (
        <HomeModal title="Set a reminder" sub={modal.item.title} onClose={() => setModal(null)}>
          <div className="dk-remgrid">
            {remLabels(modal.item).map((label) => (
              <button key={label} type="button" className="dk-remchip" onClick={() => setReminder(modal.item, label)}>
                {label}
              </button>
            ))}
          </div>
          <div className="dk-modal-note">
            Reminders are how plans reach you during the week. Both of you get one if it&apos;s shared.
          </div>
        </HomeModal>
      )}
    </div>
  );
}
