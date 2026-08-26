/**
 * Drop AI-invented Reminder satellite cards.
 * Reminder offsets are manual-only (Times / Review dropdown) — never auto-filled.
 */

export function isReminderSatellite(card) {
  if (!card) return false;
  const task = String(card.task || "").trim();
  const source = String(card.source || "").trim();
  if (/^reminder\s*:/i.test(task)) return true;
  if (/\b(set reminder|remind me|reminder for)\b/i.test(source)) return true;
  if (card.type !== "event" && /\b(set reminder|remind me)\b/i.test(task)) return true;
  return false;
}

/**
 * Distill often emits the appointment AND a separate "Reminder:" card.
 * Delete those satellites. Do not set calendar_reminder on the parent event.
 * @param {object[]} cards
 */
export function stripReminderSatellites(cards) {
  if (!Array.isArray(cards) || !cards.length) return cards || [];
  return cards
    .filter((c) => !isReminderSatellite(c))
    .map((c) => {
      if (!c || typeof c !== "object") return c;
      const next = { ...c };
      delete next.calendar_reminder;
      delete next.calendar_reminder_minutes;
      return next;
    });
}

/** @deprecated Use stripReminderSatellites — kept as alias for any stale imports. */
export function foldCalendarReminders(cards) {
  return stripReminderSatellites(cards);
}
