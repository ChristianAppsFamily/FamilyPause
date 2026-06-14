import { supabase } from "./supabase";
import { transcribeLocally } from "./transcribeLocal";

/** Best supported browser recording format (ChatGPT-style MediaRecorder path). */
export function pickRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export function canRecordAudio() {
  return !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined" && pickRecordingMimeType());
}

/** Base64-encode a Blob without blowing the call stack on large files. */
async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function parseInvokeError(error) {
  let detail = error?.message || "Transcription failed";
  try {
    const ctx = error?.context;
    if (ctx?.json) {
      const body = await ctx.json();
      if (body?.error) detail = body.error;
    } else if (ctx?.body && typeof ctx.body === "string") {
      const body = JSON.parse(ctx.body);
      if (body?.error) detail = body.error;
    }
  } catch {
    /* ignore */
  }
  return detail;
}

async function invokeVercelTranscribe(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Sign in required for speech-to-text");

  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    throw new Error(payload?.error || `Transcription failed (${res.status})`);
  }
  if (payload?.error) throw new Error(payload.error);
  return (payload?.text || "").trim();
}

function modelProgressLabel(progress) {
  if (!progress || progress.status !== "progress") return null;
  const pct = progress.progress != null ? Math.round(progress.progress) : null;
  return pct != null ? `Loading speech model… ${pct}%` : "Loading speech model…";
}

/**
 * Whisper via Supabase → Vercel → on-device fallback (Brave-friendly).
 */
export async function transcribeAudioBlob(blob, mimeType, { onStatus, onProgress, previewFallback = "" } = {}) {
  const body = {
    audio: await blobToBase64(blob),
    mimeType: mimeType || blob.type || "audio/webm",
  };

  let serverErr = "";

  const { data, error } = await supabase.functions.invoke("transcribe", { body });
  if (!error && !data?.error) {
    return (data?.text || "").trim();
  }
  serverErr = error ? await parseInvokeError(error) : (data?.error || "");

  try {
    return await invokeVercelTranscribe(body);
  } catch (vercelErr) {
    serverErr = serverErr || vercelErr.message;
  }

  const preview = (previewFallback || "").trim();
  if (preview) return preview;

  onStatus?.("Transcribing on your device…");
  try {
    return await transcribeLocally(blob, {
      onProgress: (p) => {
        const label = modelProgressLabel(p);
        if (label) onStatus?.(label);
        onProgress?.(p);
      },
    });
  } catch (localErr) {
    const base = serverErr || localErr.message;
    throw new Error(base.includes("OPENAI") ? `${base} On-device fallback failed — try Write or paste.` : base);
  }
}
