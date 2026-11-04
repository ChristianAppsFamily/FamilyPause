/** Lightweight Capture-step heuristics (display-only until distill). */

export const CAPTURE_STARTERS = [
  "This week we have...",
  "Kids need...",
  "Money...",
  "Date night...",
];

export const CAPTURE_QUESTIONS = [
  { q: "What is one thing I did this week that made you feel loved?", tag: "Marriage" },
  { q: "What are you carrying this week that I could help with?", tag: "Marriage" },
  { q: "Where do you want us to grow closer this season?", tag: "Marriage" },
  { q: "How can I pray for you this week?", tag: "Faith" },
];

export const CAPTURE_TOPIC_LIST = [
  { k: "Kids", icon: "backpack" },
  { k: "Finances", icon: "wallet" },
  { k: "Marriage", icon: "heart" },
  { k: "Faith", icon: "church" },
  { k: "Time Together", icon: "heart" },
];

export const CAPTURE_TYPE_META = {
  appt: { label: "Appointments", one: "Appointment", color: "#3B82F6" },
  todo: { label: "To-dos", one: "To-do", color: "#F59E0B" },
  dec: { label: "Decisions", one: "Decision", color: "#8B5CF6" },
  note: { label: "Notes", one: "Note", color: "#64748B" },
  tt: { label: "Time Together", one: "Time Together", color: "#14805E" },
};

export const EMPTY_COUNTS = { appt: 0, todo: 0, dec: 0, note: 0, tt: 0 };

/** @param {string} text */
export function countWords(text) {
  return (String(text || "").match(/\S+/g) || []).length;
}

/**
 * Line-level type + topic heuristics for sidebar counts.
 * @param {string} text
 * @returns {{ counts: typeof EMPTY_COUNTS, topics: string[] }}
 */
export function analyzeCaptureText(text) {
  const counts = { ...EMPTY_COUNTS };
  const topics = new Set();
  String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => x.length > 3 && !/\.\.\.$/.test(x))
    .forEach((line) => {
      const s = line.toLowerCase();
      if (/date night|our walk|just us|time together|\btogether\b/.test(s) && /date|walk|dinner|night|us/.test(s)) {
        counts.tt += 1;
      } else if (/\b(decide|should we|whether|agreed)\b/.test(s)) {
        counts.dec += 1;
      } else if (/\b(pay|buy|call|need to|order|sign|book|return|email|rsvp)\b/.test(s)) {
        counts.todo += 1;
      } else if (
        /(mon|tues|wednes|thurs|fri|satur|sun)day/.test(s)
        || /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(s)
        || /\b\d{1,2}:\d{2}\b/.test(s)
        || /\b\d{1,2}\s?(am|pm)\b/.test(s)
      ) {
        counts.appt += 1;
      } else {
        counts.note += 1;
      }

      if (/kid|school|dentist|track|picture day|field trip|swim|homework/.test(s)) topics.add("Kids");
      if (/money|bill|budget|pay|\$|finance/.test(s)) topics.add("Finances");
      if (/church|pray|faith|bible|sermon/.test(s)) topics.add("Faith");
      if (/marriage|each other|feel loved/.test(s)) topics.add("Marriage");
      if (/date night|together|our walk|time together/.test(s)) topics.add("Time Together");
    });

  return { counts, topics: [...topics] };
}

/**
 * Split text into highlightable segments for display.
 * @param {string} text
 * @returns {Array<{ text: string, type: string|null }>}
 */
export function highlightPhrases(text) {
  const raw = String(text || "");
  if (!raw.trim()) return [];
  const patterns = [
    { type: "tt", re: /(date night[^.!?\n]*|walk after dinner[^.!?\n]*|time together[^.!?\n]*)/gi },
    { type: "todo", re: /\b((?:pay|buy|call|order|sign|book|return|email|rsvp)\b[^.!?\n]{0,80})/gi },
    { type: "appt", re: /\b([^.!?\n]{0,40}(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)[^.!?\n]{0,60})/gi },
    { type: "dec", re: /\b((?:decide|should we|whether|agreed)[^.!?\n]{0,80})/gi },
  ];

  /** @type {Array<{ start: number, end: number, type: string }>} */
  const hits = [];
  for (const { type, re } of patterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (end <= start) continue;
      if (hits.some((h) => !(end <= h.start || start >= h.end))) continue;
      hits.push({ start, end, type });
    }
  }
  hits.sort((a, b) => a.start - b.start);

  const segs = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) segs.push({ text: raw.slice(cursor, h.start), type: null });
    segs.push({ text: raw.slice(h.start, h.end), type: h.type });
    cursor = h.end;
  }
  if (cursor < raw.length) segs.push({ text: raw.slice(cursor), type: null });
  return segs.length ? segs : [{ text: raw, type: null }];
}

/** @param {number} secs */
export function formatCaptureTimer(secs) {
  const n = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** @param {number} secs */
export function formatCaptureDuration(secs) {
  const n = Math.max(0, Math.floor(Number(secs) || 0));
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}
