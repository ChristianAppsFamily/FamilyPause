// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: distill
// Proxies the Anthropic call SERVER-SIDE so the API key is never in the browser.
//
// Deploy:
//   supabase functions deploy distill
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.)
//
// The browser calls this via supabase.functions.invoke("distill", { body: { prompt, system, cacheSystem? } }),
// which forwards the signed-in user's JWT. We verify it so only logged-in users can spend tokens.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // Require a valid signed-in Supabase user.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { prompt, system, cacheSystem = false } = await req.json();
    if (!prompt) return json({ error: "Missing prompt" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    // Build system block — wrap in cache_control when caller requests it.
    // Prompt caching saves ~90% on repeated calls (cache TTL: 5 min).
    const systemBlock = cacheSystem && system
      ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
      : system;

    // Retry once on transient upstream errors.
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // Required header to enable prompt caching
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
          // claude-haiku-4-5-20251001: latest Haiku 4.5, ~3x cheaper than Sonnet
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4096,
          system: systemBlock,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 800));
    }

    const data = await res!.json();
    if (!res!.ok) return json({ error: data?.error?.message || "Anthropic error", text: "" }, 502);

    // Forward cache usage stats to the client for debugging
    const u = data.usage ?? {};
    return json({
      text: data?.content?.[0]?.text || "",
      usage: {
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
      },
    });
  } catch (e) {
    return json({ error: String(e), text: "" }, 500);
  }
});
