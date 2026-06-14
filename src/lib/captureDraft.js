const PREFIX = "familypause:capture-draft:";

function key(workspaceId) {
  return `${PREFIX}${workspaceId || "anon"}`;
}

/** Load in-progress capture transcript for this workspace (survives page refresh). */
export function loadCaptureDraft(workspaceId) {
  try {
    const raw = sessionStorage.getItem(key(workspaceId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.text !== "string") return null;
    return {
      text: data.text,
      mode: data.mode === "dictate" ? "dictate" : "paste",
    };
  } catch {
    return null;
  }
}

export function saveCaptureDraft(workspaceId, { text, mode }) {
  try {
    const trimmed = (text || "").trim();
    if (!trimmed) {
      sessionStorage.removeItem(key(workspaceId));
      return;
    }
    sessionStorage.setItem(
      key(workspaceId),
      JSON.stringify({ text, mode: mode === "dictate" ? "dictate" : "paste", updatedAt: Date.now() })
    );
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearCaptureDraft(workspaceId) {
  try {
    sessionStorage.removeItem(key(workspaceId));
  } catch {
    /* ignore */
  }
}
