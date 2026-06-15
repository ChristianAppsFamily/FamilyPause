/** In-progress capture drafts — status `input` only; deleted after plan confirmation. */

export function dbInputMode(mode) {
  return mode === "dictate" ? "record" : "paste";
}

export function uiInputMode(mode) {
  return mode === "record" ? "dictate" : "paste";
}

export async function fetchInputDraft(supabase, workspaceId) {
  if (!workspaceId) return null;
  const { data, error } = await supabase
    .from("sessions")
    .select("id, transcript, input_mode, meeting_date, updated_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "input")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveInputDraft(supabase, {
  workspaceId,
  userId,
  sessionId,
  transcript,
  inputMode,
  meetingDate,
}) {
  if (!workspaceId) return null;
  const text = transcript ?? "";
  if (!text.trim() && !sessionId) return null;

  const payload = {
    workspace_id: workspaceId,
    transcript: text,
    input_mode: dbInputMode(inputMode),
    meeting_date: meetingDate,
    status: "input",
    cards: [],
  };

  if (sessionId) {
    const { data, error } = await supabase
      .from("sessions")
      .update(payload)
      .eq("id", sessionId)
      .select("id")
      .single();
    if (error) throw error;
    return data?.id ?? sessionId;
  }

  const { data, error } = await supabase
    .from("sessions")
    .insert({ ...payload, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id ?? null;
}

export async function deleteSessionRow(supabase, sessionId) {
  if (!sessionId) return;
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw error;
}
