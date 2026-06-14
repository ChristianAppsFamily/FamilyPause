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

/**
 * Send recorded audio to the transcribe edge function (Whisper).
 * Works in Brave — unlike webkitSpeechRecognition.
 */
export async function transcribeAudioBlob(blob, mimeType) {
  const audio = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke("transcribe", {
    body: { audio, mimeType: mimeType || blob.type || "audio/webm" },
  });

  if (error) {
    let detail = error.message || "Transcription failed";
    try {
      const ctx = error?.context;
      if (ctx?.json) {
        const body = await ctx.json();
        if (body?.error) detail = body.error;
      }
    } catch (_) { /* ignore */ }
    throw new Error(detail);
  }

  if (data?.error) throw new Error(data.error);
  return (data?.text || "").trim();
}
