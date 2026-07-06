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

function pickText(value) {
  const text = (value || "").trim();
  return text || null;
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
  return pickText(payload?.text);
}

function modelProgressLabel(progress) {
  if (!progress || progress.status !== "progress") return null;
  const pct = progress.progress != null ? Math.round(progress.progress) : null;
  return pct != null ? `Loading speech model… ${pct}%` : "Loading speech model…";
}

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke("transcribe", { body }),
      12000
    );
    const edgeText = !error && !data?.error ? pickText(data?.text) : null;
    if (edgeText) return edgeText;
    serverErr = error ? await parseInvokeError(error) : (data?.error || "");
  } catch {
    serverErr = serverErr || "Server transcription unavailable";
  }

  try {
    const vercelText = await withTimeout(invokeVercelTranscribe(body), 12000);
    if (vercelText) return vercelText;
  } catch (vercelErr) {
    if (vercelErr.message !== "timeout") serverErr = serverErr || vercelErr.message;
  }

  const preview = (previewFallback || "").trim();
  if (preview) return preview;

  onStatus?.("Loading speech model…");
  try {
    return await transcribeLocally(blob, {
      onStatus,
      onProgress: (p) => {
        const label = modelProgressLabel(p);
        if (label) onStatus?.(label);
        onProgress?.(p);
      },
    });
  } catch (localErr) {
    const localMsg = localErr.message || "Transcription failed";
    const needsServerKey = /GROQ_API_KEY|not configured/i.test(serverErr);
    if (needsServerKey && /No speech detected|timed out/i.test(localMsg)) {
      throw new Error(
        "Couldn't transcribe in the browser. Add a free GROQ_API_KEY (console.groq.com/keys) for fast server transcription, or use Write or paste."
      );
    }
    throw new Error(localMsg || serverErr || "Transcription failed");
  }
}
