/**
 * Map AI-extracted person names to workspace family_context people.
 */

const SHARED = new Set(["both", "family", "shared", "everyone", "us", "we"]);

function firstName(name) {
  return (name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
}

/** @param {string} rawPerson @param {{ people?: string[], kids?: string[] }} context */
export function normalizePersonField(rawPerson, context = {}) {
  const raw = (rawPerson || "").trim();
  if (!raw) return "Family";

  const lower = raw.toLowerCase();
  if (lower === "both") return "Both";
  if (SHARED.has(lower)) return "Family";

  const known = [...(context.people || []), ...(context.kids || [])].filter(Boolean);
  if (!known.length) return raw;

  const exact = known.find((p) => p.toLowerCase() === lower);
  if (exact) return exact;

  const rawFirst = firstName(raw);
  const firstMatches = known.filter((p) => firstName(p) === rawFirst);
  if (firstMatches.length === 1) return firstMatches[0];

  return "Family";
}

/** @param {object[]} cards @param {{ people?: string[], kids?: string[] }} context */
export function normalizeCardPeople(cards, context) {
  if (!Array.isArray(cards) || !cards.length) return cards;
  return cards.map((c) => ({
    ...c,
    person: normalizePersonField(c.person, context),
  }));
}
