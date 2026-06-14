import { supabase } from "./supabase";

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

/**
 * Send recorded audio to Whisper via Supabase edge function, with Vercel API fallback.
 * Works in Brave — unlike webkitSpeechRecognition.
 */
export async function transcribeAudioBlob(blob, mimeType) {
  const body = {
    audio: await blobToBase64(blob),
    mimeType: mimeType || blob.type || "audio/webm",
  };

  const { data, error } = await supabase.functions.invoke("transcribe", { body });

  if (!error) {
    if (data?.error) throw new Error(data.error);
    return (data?.text || "").trim();
  }

  const edgeDetail = await parseInvokeError(error);
  const edgeMissing = /edge function|function not found|404|failed to send a request/i.test(edgeDetail);

  try {
    return await invokeVercelTranscribe(body);
  } catch (vercelErr) {
    if (edgeMissing) throw vercelErr;
    throw new Error(edgeDetail || vercelErr.message);
  }
}
