/** Fold "set reminder for …" satellite cards onto their appointment events. */

const PRESET_MINUTES = new Set([0, 5, 15, 30, 60, 1440]);

/**
 * @param {number} minutes
 * @returns {{ calendar_reminder: string, calendar_reminder_minutes: number|null } | null}
 */
export function reminderChoiceFromMinutes(minutes) {
  const mins = Math.round(Number(minutes));
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (PRESET_MINUTES.has(mins)) {
    return { calendar_reminder: String(mins), calendar_reminder_minutes: null };
  }
  return { calendar_reminder: "custom", calendar_reminder_minutes: mins };
}

/** Parse "1 day before" / "30 minutes before" / "remind me at hour 1 before". */
export function parseReminderOffset(text) {
  const raw = String(text || "").toLowerCase();
  if (!raw.trim()) return null;
  if (/\b(at time of event|when it (?:starts|begins)|at the time)\b/.test(raw)) {
    return reminderChoiceFromMinutes(0);
  }
  const day = raw.match(/(\d+(?:\.\d+)?)\s*days?/);
  if (day) return reminderChoiceFromMinutes(Number(day[1]) * 1440);
  if (/\b(?:a|one)\s+day\s+before\b/.test(raw)) return reminderChoiceFromMinutes(1440);
  const hourFlip = raw.match(/\bhour\s+(\d+)\b/);
  if (hourFlip) return reminderChoiceFromMinutes(Number(hourFlip[1]) * 60);
  const hour = raw.match(/(\d+(?:\.\d+)?)\s*hours?/);
  if (hour) return reminderChoiceFromMinutes(Number(hour[1]) * 60);
  if (/\b(?:an|one)\s+hour\s+before\b/.test(raw)) return reminderChoiceFromMinutes(60);
  const min = raw.match(/(\d+(?:\.\d+)?)\s*min(?:ute)?s?/);
  if (min) return reminderChoiceFromMinutes(Number(min[1]));
  return null;
}

function personKey(card) {
  return String(card?.person || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
}

function isAppointmentEvent(card) {
  return card?.type === "event";
}

export function isReminderSatellite(card) {
  if (!card) return false;
  const task = String(card.task || "").trim();
  const source = String(card.source || "").trim();
  if (/^reminder\s*:/i.test(task)) return true;
  if (/\b(set reminder|remind me|reminder for)\b/i.test(source)) return true;
  if (card.type !== "event" && /\b(set reminder|remind me)\b/i.test(task)) return true;
  return false;
}

function attachReminder(event, satellite) {
  if (event?.calendar_reminder) return event;
  const choice = parseReminderOffset(`${satellite?.source || ""} ${satellite?.task || ""}`);
  if (!choice) return event;
  return { ...event, ...choice };
}

function normalizeReminderFields(card) {
  if (!card) return card;
  const choice = card.calendar_reminder;
  if (choice == null || choice === "") return card;
  if (typeof choice === "number") {
    const mapped = reminderChoiceFromMinutes(choice);
    return mapped ? { ...card, ...mapped } : card;
  }
  const asStr = String(choice);
  if (PRESET_MINUTES.has(Number(asStr)) || asStr === "none" || asStr === "custom") {
    return { ...card, calendar_reminder: asStr };
  }
  const parsed = parseReminderOffset(asStr);
  return parsed ? { ...card, ...parsed } : card;
}

/**
 * Distill often emits the appointment AND a separate "Reminder:" note.
 * Times only lists cards missing a clock time, so those notes hide the real events.
 * Merge reminder offsets onto the appointment and drop the extra cards.
 * @param {object[]} cards
 */
export function foldCalendarReminders(cards) {
  if (!Array.isArray(cards) || !cards.length) return cards || [];
  const list = cards.map(normalizeReminderFields);
  const out = [];
  const used = new Set();

  for (let i = 0; i < list.length; i++) {
    if (used.has(i)) continue;
    const card = list[i];
    const next = list[i + 1];

    if (
      isAppointmentEvent(card)
      && next
      && isReminderSatellite(next)
      && personKey(card)
      && personKey(card) === personKey(next)
    ) {
      out.push(attachReminder(card, next));
      used.add(i + 1);
      continue;
    }

    if (
      isReminderSatellite(card)
      && next
      && isAppointmentEvent(next)
      && personKey(card)
      && personKey(card) === personKey(next)
    ) {
      out.push(attachReminder(next, card));
      used.add(i + 1);
      continue;
    }

    if (isReminderSatellite(card)) {
      let idx = -1;
      for (let j = out.length - 1; j >= 0; j--) {
        const c = out[j];
        if (isAppointmentEvent(c) && personKey(c) === personKey(card) && !c.calendar_reminder) {
          idx = j;
          break;
        }
      }
      if (idx >= 0) {
        out[idx] = attachReminder(out[idx], card);
        continue;
      }
      continue;
    }

    out.push(card);
  }

  return out;
}
