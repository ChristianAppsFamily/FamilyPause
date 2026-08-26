// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: distill
// Proxies the Anthropic call SERVER-SIDE so the API key is never in the browser.
//
// Deploy:
//   supabase functions deploy distill
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.)
//
// Extraction mode: pass `extraction` with meeting_date + family context; the
// function builds the system prompt here (source of truth for date/time rules).
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Sunday of the current Pacific planning week as YYYY-MM-DD. */
function pacificWeekStartSunday(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const dayIndex = WEEKDAY_INDEX[get("weekday") ?? "Sun"] ?? 0;
  const sunday = new Date(Date.UTC(year, month - 1, day, 12, 0, 0) - dayIndex * 86400000);
  const y = sunday.getUTCFullYear();
  const m = String(sunday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(sunday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

type ExtractionContext = {
  meeting_date?: string;
  people?: string[];
  businesses?: string[];
  categories?: string[];
  topic_hint?: string;
};

function buildDistillExtractionPrompt(ctx: ExtractionContext): string {
  const people = ctx.people ?? [];
  const businesses = ctx.businesses ?? [];
  const categories = ctx.categories ?? [];
  const topicHint = ctx.topic_hint ?? "";
  const meetingDate = ctx.meeting_date ?? "unknown";
  const meetingDay =
    ctx.meeting_date && /^\d{4}-\d{2}-\d{2}$/.test(ctx.meeting_date)
      ? WEEKDAYS[new Date(`${ctx.meeting_date}T12:00:00`).getDay()]
      : "unknown";

  return `You are FamilyPause, a family meeting intelligence assistant.
Known people: ${people.join(", ") || "none listed"}
Known businesses: ${businesses.join(", ") || "none listed"}
Categories: ${categories.join(", ") || "Family, Kids, Business, Finance, Home, Faith, Health"}${topicHint}

MEETING DATE ANCHOR: ${meetingDate} (${meetingDay})
Use this date to resolve every relative day mentioned in the transcript.

HOW YOUR OUTPUT IS USED:
Every extracted item will be written to the family's Google Calendar — not only appointments.
- type:"event" → a normal timed calendar entry; the app uses the task text as the event title (no type prefix).
- type:"action" → calendar entry titled like "To-Do: {task}"
- type:"decision" → calendar entry titled like "Decision: {task}"
- type:"note" → calendar entry titled like "Note: {task}"
If date/time are null, the app still keeps the item and asks the family to assign a reminder date/time (or defaults to an all-day entry on the meeting date). Prefer accurate nulls over inventing dates.
You still return a "task" string and a "type" field — the app may add a type prefix for non-events. Do not put "To-Do:" / "Decision:" / "Note:" inside the task text yourself.

YOUR JOB: Extract EVERY actionable item, appointment, errand, decision, task, commitment, or noteworthy reminder — exhaustively. Do not skip, merge, or summarize away distinct items. If the transcript mentions 7 separate commitments, return 7 cards. Do not invent filler notes; only include notes when someone stated something the family should remember.

Return ONLY a valid JSON array. No markdown, no backticks, no commentary.

Each item object:
{
  "id": (unique integer starting at 1),
  "category": (from Categories above, or create one),
  "person": (specific name from Known people, or "Both", or "Family"),
  "task": (clear calendar-ready title — weave the person's name in when needed; see TASK TITLES below),
  "source": (exact phrase from transcript, under 15 words),
  "date": "YYYY-MM-DD" or null,
  "time": "HH:MM" 24-hour or null,
  "type": "action" | "event" | "decision" | "note",
  "recurring": true | false,
  "date_only": true | false,
  "byday": ["MO"|"TU"|"WE"|"TH"|"FR"|"SA"|"SU"] or omit,
  "duration_minutes": integer or null
}

TASK TITLES (person name in the title — important):
The person field alone is not enough for the calendar glance. When person is a specific individual (NOT "Both" or "Family"), weave their name into task naturally:
- Possessive for events/appointments belonging to that person: "Maya's birthday party", "Harbor's school project due", "Harbor's parent-teacher conference"
- Subject / name-prefix for actions that person performs: "Joe: renew driver's license" or "Renew Joe's driver's license" — never awkward phrasing like "Joe's renew license" or "Joe's call insurance company"
- Subject sentences when natural: "Amanda attending work conference"
- When person is "Both" or "Family", keep generic household phrasing (e.g. "Franklins' anniversary party" only if that is how the family refers to it) — do not invent first names
- Do NOT mechanically prepend Name: or Name's to every title. Use judgement so the calendar reads clearly without checking the person badge.
- Never duplicate the type label inside the task ("To-Do: …").

DATE & TIME EXTRACTION (critical):
- ALWAYS parse spoken dates and times into date and time fields when the transcript specifies them.
- Resolve weekday names (Monday, Wednesday, Sunday, Thursday, etc.) to YYYY-MM-DD using MEETING DATE ANCHOR: find that weekday in the 7-day window starting on the meeting date (meeting day = day 0, next days follow). If the transcript names the same weekday as the meeting date, use the meeting date. Example: meeting on Sunday 2026-06-08 → Monday=2026-06-09, Wednesday=2026-06-11, Saturday=2026-06-14, Sunday=2026-06-08.
- Resolve "the 19th", "March 5", "next Tuesday" to concrete YYYY-MM-DD relative to the meeting date (use the month of the meeting date unless another month is stated).
- Parse times into 24h HH:MM: "6:30pm"→18:30, "1pm"→13:00, "8pm"→20:00, "4:15"→16:15 (assume PM for bare afternoon hours 1–6 without am/pm).
- Vague periods without a clock time leave time null: "Saturday morning", "Sunday afternoon", "evening" without a number.
- Birthdays, due dates, and deadlines with a calendar date but no clock time: set date_only:true and leave time null. Do not invent a clock time (no 10:00, no midnight).
- Set recurring:true only when the transcript says the commitment continues every week (or similar) after this week — "every Tuesday", "weekly", "each week". Optionally include byday with Google weekday codes (MO TU WE TH FR SA SU) on that single series card.
- If the same commitment is named on more than one day THIS week (soccer Tuesday and Thursday; project work Monday, Wednesday, and Thursday), emit ONE CARD PER DATE with the same task text. Do not merge those days into one card. Set recurring:false unless they also said it continues every week after. Never drop a day's occurrence because the title matches another card.
- Set type:"event" for appointments with a fixed place/time on the calendar; type:"action" for tasks and errands; type:"decision" when the family agreed on a choice; type:"note" for context worth remembering that is not a task.
- ONLY leave date null when no day/date is mentioned at all. ONLY leave time null when no specific clock time is mentioned. Null date/time is expected for many actions, decisions, and notes.

EXHAUSTIVE EXTRACTION RULES:
- Include errands ("oil change on the van"), kid tasks ("pick the summer camp"), scheduling items, and follow-ups — even if brief.
- One card per distinct commitment, including each dated occurrence this week. Do not combine unrelated items or collapse multiple days into one card.
- Map nicknames to the closest Known person. Use "Both" for shared couple tasks, "Family" for whole-household items.

Return only the JSON array.`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function logRawResponse(rawText: string, stopReason: string | undefined, outputTokens: number, meetingDate?: string) {
  console.log("[distill] meeting_date:", meetingDate ?? "n/a");
  console.log("[distill] stop_reason:", stopReason ?? "unknown", "output_tokens:", outputTokens);
  console.log("[distill] raw response length:", rawText.length);
  if (stopReason === "max_tokens") {
    console.warn("[distill] TRUNCATED — response hit max_tokens; JSON may be incomplete");
  }
  if (rawText.length <= 8000) {
    console.log("[distill] raw response:", rawText);
  } else {
    console.log("[distill] raw response (head):", rawText.slice(0, 4000));
    console.log("[distill] raw response (tail):", rawText.slice(-1000));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve workspace
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id, role")
      .eq("user_id", user.id);
    if (!membership?.length) return json({ error: "No workspace" }, 400);
    const owner = membership.find((m: { role: string }) => m.role === "owner");
    const workspaceId = owner?.workspace_id ?? membership[0].workspace_id;

    // Plan / session gate
    const { data: sub } = await admin
      .from("subscriptions")
      .select("plan, active, trial_ends_at")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    const plan = sub?.plan || "free";
    const isPaid = sub?.active && (plan === "family" || plan === "pro" || plan === "ministry");
    const FREE_WEEKLY_BUILDS = 1;

    if (!isPaid) {
      // Free plan: 1 build per Pacific calendar week (Sunday–Saturday).
      const weekStart = pacificWeekStartSunday();
      const { data: usage } = await admin
        .from("ai_distill_usage")
        .select("count")
        .eq("workspace_id", workspaceId)
        .eq("usage_date", weekStart)
        .maybeSingle();
      if ((usage?.count || 0) >= FREE_WEEKLY_BUILDS) {
        return json({ error: "Weekly free limit reached", code: "WEEKLY_LIMIT" }, 402);
      }
    }

    const { prompt, system, cacheSystem = false, extraction } = await req.json();
    if (!prompt) return json({ error: "Missing prompt" }, 400);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "ANTHROPIC_API_KEY not configured" }, 500);

    const systemText = extraction
      ? buildDistillExtractionPrompt(extraction as ExtractionContext)
      : system;

    const systemBlock = cacheSystem && systemText
      ? [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }]
      : systemText;

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
          max_tokens: 8192,
          system: systemBlock,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 800));
    }

    const data = await res!.json();
    if (!res!.ok) return json({ error: data?.error?.message || "Anthropic error", text: "" }, 502);

    const rawText = data?.content?.[0]?.text || "";
    const stopReason = data?.stop_reason as string | undefined;
    const u = data.usage ?? {};
    const outputTokens = u.output_tokens ?? 0;

    logRawResponse(rawText, stopReason, outputTokens, extraction?.meeting_date);

    return json({
      text: rawText,
      stopReason: stopReason ?? null,
      truncated: stopReason === "max_tokens",
      usage: {
        input: u.input_tokens ?? 0,
        output: outputTokens,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
      },
    });
  } catch (e) {
    return json({ error: String(e), text: "" }, 500);
  }
});
