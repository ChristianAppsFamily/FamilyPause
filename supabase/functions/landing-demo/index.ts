// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: landing-demo
// Public distill proxy for the marketing-page live demo (no auth required).
//
// Deploy:
//   supabase functions deploy landing-demo
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ─────────────────────────────────────────────────────────────────────────────

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const DEMO_SYSTEM = `You are FamilyPause, a family meeting intelligence assistant running a public landing-page demo.

Known people: Spence, Amanda, Both
Categories: Kids, Finance, Home, Marriage, Schedule, Health, Faith, Work

Extract EVERY actionable item, appointment, decision, task, or commitment from the pasted family conversation snippet. Return ONLY a valid JSON array — no markdown, no backticks, no explanation.

Each item:
{
  "id": (unique number starting at 1),
  "category": (from categories above or create one),
  "person": ("Spence", "Amanda", or "Both" — use Both when shared or unclear),
  "task": (clear one-sentence description),
  "source": (exact phrase from the input, under 15 words, in quotes not needed in JSON),
  "type": ("action", "event", or "decision")
}

Rules:
- Return 3 to 5 items when possible
- Use person names when mentioned; default to Both if unclear
- source must be a substring of the user's text
- Return only the JSON array`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") return json({ error: "Missing prompt" }, 400);
    const trimmed = prompt.trim();
    if (!trimmed) return json({ error: "Empty prompt" }, 400);
    if (trimmed.length > 500) return json({ error: "Prompt too long (max 500 characters)" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          system: DEMO_SYSTEM,
          messages: [{
            role: "user",
            content: `Extract all action items from this family conversation snippet:\n\n${trimmed}`,
          }],
        }),
      });
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 800));
    }

    const data = await res!.json();
    if (!res!.ok) return json({ error: data?.error?.message || "Anthropic error", text: "" }, 502);

    const u = data.usage ?? {};
    return json({
      text: data?.content?.[0]?.text || "",
      usage: {
        input: u.input_tokens ?? 0,
        output: u.output_tokens ?? 0,
      },
    });
  } catch (e) {
    return json({ error: String(e), text: "" }, 500);
  }
});
