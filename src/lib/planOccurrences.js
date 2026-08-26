/** Same-title occurrences this week — display grouping only. Never merge or drop by title. */

function occurrenceKey(card) {
  return `${(card?.task || "").trim().toLowerCase()}|${(card?.person || "").trim().toLowerCase()}`;
}

/**
 * @param {object[]} cards
 * @param {object} card
 * @returns {{ index: number, total: number } | null}
 */
export function occurrencePlace(cards, card) {
  if (!card?.id && card?.id !== 0) return null;
  const key = occurrenceKey(card);
  if (key === "|") return null;
  const peers = (cards || []).filter((c) => occurrenceKey(c) === key);
  if (peers.length < 2) return null;
  const sorted = [...peers].sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return da.localeCompare(db);
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });
  const index = sorted.findIndex((c) => String(c.id) === String(card.id));
  if (index < 0) return null;
  return { index: index + 1, total: sorted.length };
}

export function occurrenceLabel(cards, card) {
  const place = occurrencePlace(cards, card);
  if (!place) return null;
  return `${place.index} of ${place.total}`;
}
