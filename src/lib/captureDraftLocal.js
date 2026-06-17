/** Browser-local capture draft — survives refresh and closing the tab. */

const KEY_PREFIX = "fp-capture-draft:";

export function loadCaptureDraft(workspaceId) {
  if (!workspaceId || typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${workspaceId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.transcript?.trim()) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveCaptureDraft(workspaceId, { transcript, inputMode, meetingDate }) {
  if (!workspaceId || typeof localStorage === "undefined") return;
  const text = transcript ?? "";
  if (!text.trim()) {
    clearCaptureDraft(workspaceId);
    return;
  }
  try {
    localStorage.setItem(
      `${KEY_PREFIX}${workspaceId}`,
      JSON.stringify({
        transcript: text,
        input_mode: inputMode === "dictate" ? "record" : "paste",
        meeting_date: meetingDate,
        updated_at: new Date().toISOString(),
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearCaptureDraft(workspaceId) {
  if (!workspaceId || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(`${KEY_PREFIX}${workspaceId}`);
  } catch {
    /* ignore */
  }
}
