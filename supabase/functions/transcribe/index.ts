// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: transcribe
// MediaRecorder audio → Groq Whisper (free tier, OpenAI-compatible API).
//
// Deploy:
//   supabase functions deploy transcribe
//   supabase secrets set GROQ_API_KEY=gsk_...
//   # Free key: https://console.groq.com/keys
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const extForMime = (mime: string) => {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      return json({ error: "GROQ_API_KEY not configured on server" }, 500);
    }

    const { audio, mimeType = "audio/webm" } = await req.json();
    if (!audio || typeof audio !== "string") return json({ error: "Missing audio" }, 400);

    const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
    if (bytes.byteLength < 100) return json({ error: "Recording too short" }, 400);
    if (bytes.byteLength > 25 * 1024 * 1024) return json({ error: "Recording too large (max 25 MB)" }, 413);

    const ext = extForMime(mimeType);
    const form = new FormData();
    form.append("model", GROQ_WHISPER_MODEL);
    form.append("language", "en");
    form.append("response_format", "json");
    form.append("file", new Blob([bytes], { type: mimeType }), `dictation.${ext}`);

    const res = await fetch(GROQ_WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    const data = await res.json();
    if (!res.ok) {
      return json({ error: data?.error?.message || "Transcription failed" }, 502);
    }

    return json({ text: (data.text || "").trim() });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
