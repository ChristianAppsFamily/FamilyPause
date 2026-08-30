/** Pure calendar sync eligibility + aggregate outcome (no Supabase). */

export function isScheduleResolved(card) {
  if (!card?.date) return false;
  if (card.time) return true;
  return !!card.date_only;
}

/**
 * Kept/calendared card can sync — timed if complete, else all-day via meetingDate.
 * @param {object} card
 * @param {{ meetingDate?: string, requireResolved?: boolean }} [opts]
 */
export function isSyncEligible(card, opts = {}) {
  if (!(card.status === "kept" || card.status === "calendared")) return false;
  if (opts.requireResolved) return isScheduleResolved(card);
  if (card.date && card.time) return true;
  if (card.date && card.date_only) return true;
  const fallbackDate = card.date || opts.meetingDate;
  return !!fallbackDate;
}

/**
 * Aggregate calendar sync state for the Plan page.
 * @param {object[]} cards
 * @param {{ meetingDate?: string, syncing?: boolean, requireResolved?: boolean }} [opts]
 */
export function calendarSyncOutcome(cards, opts = {}) {
  const eligible = (cards || []).filter(
    (c) => (c.status === "kept" || c.status === "calendared") && isSyncEligible(c, opts),
  );
  const synced = eligible.filter((c) => c.calendar_synced).length;
  const failed = eligible.filter((c) => !c.calendar_synced && c.calendar_sync_failed).length;
  const pending = Math.max(0, eligible.length - synced - failed);
  let state = "idle";
  if (opts.syncing) state = "syncing";
  else if (!eligible.length) state = "idle";
  else if (synced === eligible.length) state = "succeeded";
  else if (failed > 0 && synced === 0) state = "failed";
  else if (failed > 0) state = "partial";
  else if (pending > 0) state = "pending";
  return { state, synced, failed, pending, eligible: eligible.length };
}
