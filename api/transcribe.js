import { createClient } from "@supabase/supabase-js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

const extForMime = (mime) => {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  return "webm";
};

export default async function handler(req, res) {
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    return res.status(500).json({ error: "Supabase env vars not configured on server" });
  }

  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY not configured. Add a free key from https://console.groq.com/keys in Vercel env vars or run: supabase secrets set GROQ_API_KEY=gsk_...",
    });
  }

  const { audio, mimeType = "audio/webm" } = req.body || {};
  if (!audio || typeof audio !== "string") return res.status(400).json({ error: "Missing audio" });

  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  if (bytes.byteLength < 100) return res.status(400).json({ error: "Recording too short" });
  if (bytes.byteLength > 25 * 1024 * 1024) return res.status(413).json({ error: "Recording too large (max 25 MB)" });

  const ext = extForMime(mimeType);
  const form = new FormData();
  form.append("model", GROQ_WHISPER_MODEL);
  form.append("language", "en");
  form.append("response_format", "json");
  form.append("file", new Blob([bytes], { type: mimeType }), `dictation.${ext}`);

  const whisper = await fetch(GROQ_WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const data = await whisper.json();
  if (!whisper.ok) {
    return res.status(502).json({ error: data?.error?.message || "Transcription failed" });
  }

  return res.status(200).json({ text: (data.text || "").trim() });
}
