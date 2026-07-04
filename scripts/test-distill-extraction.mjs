#!/usr/bin/env node
/**
 * One-off distill extraction test — same prompt as supabase/functions/distill.
 * Usage: node scripts/test-distill-extraction.mjs
 */
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_KEY;
if (!apiKey) {
  console.error('No ANTHROPIC_API_KEY or VITE_ANTHROPIC_KEY in .env.local');
  process.exit(1);
}

const meetingDate = '2026-07-04'; // Saturday — typical sync day from user session

const TRANSCRIPT = `Amanda: Let's lock in the week.
Spence: Couples counseling is Monday at 6:30pm — don't forget.
Amanda: Jordan's piano is Wednesday at 4:15.
Spence: Church is Sunday at 1pm.
Amanda: And small group is every Thursday at 8pm recurring.
Spence: I need an oil change on the van Saturday morning.
Amanda: We also need to pay the HOA by the 19th.
Spence: And we still haven't picked the summer camp for the boys.`;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const meetingDay = WEEKDAYS[new Date(`${meetingDate}T12:00:00`).getDay()];

const system = `You are FamilyPause, a family meeting intelligence assistant.
Known people: Spence, Amanda, Jordan, Maya, Both, Family
Known businesses: none listed
Categories: Family, Kids, Business, Finance, Home, Faith, Health, Schedule

MEETING DATE ANCHOR: ${meetingDate} (${meetingDay})
Use this date to resolve every relative day mentioned in the transcript.

YOUR JOB: Extract EVERY actionable item, appointment, errand, decision, task, or commitment — exhaustively. Do not skip, merge, or summarize away distinct items. If the transcript mentions 7 separate commitments, return 7 cards.

Return ONLY a valid JSON array. No markdown, no backticks, no commentary.

Each item object:
{
  "id": (unique integer starting at 1),
  "category": (from Categories above, or create one),
  "person": (specific name from Known people, or "Both", or "Family"),
  "task": (clear one-sentence description),
  "source": (exact phrase from transcript, under 15 words),
  "date": "YYYY-MM-DD" or null,
  "time": "HH:MM" 24-hour or null,
  "type": "action" | "event" | "decision" | "note",
  "recurring": true | false,
  "duration_minutes": integer or null
}

DATE & TIME EXTRACTION (critical):
- ALWAYS parse spoken dates and times into date and time fields when the transcript specifies them.
- Resolve weekday names (Monday, Wednesday, Sunday, Thursday, etc.) to YYYY-MM-DD using MEETING DATE ANCHOR: find that weekday in the 7-day window starting on the meeting date (meeting day = day 0, next days follow). Example: meeting on Sunday 2026-06-08 → Monday=2026-06-09, Wednesday=2026-06-11, Saturday=2026-06-14, Sunday=2026-06-08.
- Resolve "the 19th", "March 5", "next Tuesday" to concrete YYYY-MM-DD relative to the meeting date (use the month of the meeting date unless another month is stated).
- Parse times into 24h HH:MM: "6:30pm"→18:30, "1pm"→13:00, "8pm"→20:00, "4:15"→16:15 (assume PM for bare afternoon hours 1–6 without am/pm).
- Vague periods without a clock time leave time null: "Saturday morning", "Sunday afternoon", "evening" without a number.
- Set recurring:true when the transcript says "every", "weekly", "each week", "recurring", or similar for a repeating commitment.
- Set type:"event" for appointments with a date/time; type:"action" for tasks and errands without a fixed appointment time.
- ONLY leave date null when no day/date is mentioned at all. ONLY leave time null when no specific clock time is mentioned.

EXHAUSTIVE EXTRACTION RULES:
- Include errands ("oil change on the van"), kid tasks ("pick the summer camp"), scheduling items, and follow-ups — even if brief.
- One card per distinct commitment. Do not combine unrelated items.
- Map nicknames to the closest Known person. Use "Both" for shared couple tasks, "Family" for whole-household items.

Return only the JSON array.`;

const userPrompt = `Extract all action items from this family meeting transcript.

Meeting date (anchor for relative days): ${meetingDate}
Weekday dates this planning week: ${formatWeekdayReference(meetingDate)}

Transcript:
${TRANSCRIPT}`;

function formatWeekdayReference(meetingDate) {
  const start = new Date(`${meetingDate}T12:00:00`);
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    parts.push(`${WEEKDAYS[d.getDay()]}=${y}-${m}-${day}`);
  }
  return parts.join(', ');
}

function needsDateTime(card) {
  if (card.type === 'note') return false;
  if (card.date && card.time) return false;
  if (card.type === 'event' || card.recurring || card.date || card.time) {
    return !card.date || !card.time;
  }
  return card.type === 'action' || card.type === 'decision';
}

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  }),
});

const data = await res.json();
if (!res.ok) {
  console.error('API error:', data);
  process.exit(1);
}

const raw = data.content?.[0]?.text || '';
console.log('stop_reason:', data.stop_reason);
console.log('output_tokens:', data.usage?.output_tokens);
console.log('raw length:', raw.length);

let parsed;
try {
  parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
} catch {
  const m = raw.match(/\[[\s\S]*\]/);
  parsed = m ? JSON.parse(m[0]) : [];
}

console.log('\n--- Cards:', parsed.length, '---');
const complete = parsed.filter((c) => c.date && c.time);
const resolve = parsed.filter(needsDateTime);
const recurring = parsed.filter((c) => c.recurring);

console.log('Complete date+time:', complete.length);
console.log('Needs resolve:', resolve.length);
console.log('Recurring:', recurring.length);

for (const c of parsed) {
  console.log(`  [${c.id}] ${c.task?.slice(0, 50)} | date=${c.date} time=${c.time} recurring=${c.recurring} type=${c.type} resolve=${needsDateTime(c)}`);
}

const ok =
  parsed.length === 7
  && complete.length === 4
  && resolve.length === 3
  && recurring.length >= 1;

console.log(ok ? '\n✅ PASS' : '\n❌ FAIL — expected 7 cards, 4 complete, 3 resolve, 1+ recurring');
process.exit(ok ? 0 : 1);
