import { supabase } from './supabase';

export const DEMO_STORAGE_KEY = 'fp-landing-demo-used-at';
export const DEMO_MAX_CHARS = 500;
export const DEMO_MIN_LOADING_MS = 2500;

export const TOPIC_SAMPLES = {
  'Kids & Schedule': 'Jordan has a dentist appointment Thursday at 3. We need to figure out summer camp registration before Friday, and Amanda will handle pickup from soccer on Tuesdays.',
  Finances: 'We need to follow up with the accountant before month end on Q2 filing. Spence should call about refinancing. Both of us should review the budget this weekend.',
  Marriage: 'We want a date night next Saturday if we can get a sitter. Spence needs to book the restaurant. Let\'s talk about how stressed we\'ve both been and plan one evening with no screens.',
};

const LOADING_MESSAGES = [
  'Reading your conversation.',
  'Extracting action items.',
  'Organizing your week.',
];

export function getLoadingMessage(index) {
  return LOADING_MESSAGES[Math.min(index, LOADING_MESSAGES.length - 1)];
}

export function isDemoLimited() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return false;
    const usedAt = new Date(raw).getTime();
    if (Number.isNaN(usedAt)) return false;
    return Date.now() - usedAt < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function markDemoUsed() {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, new Date().toISOString());
  } catch { /* ignore */ }
}

export function parseDemoCards(raw) {
  if (!raw) return [];
  let parsed = [];
  try {
    parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) parsed = JSON.parse(m[0]);
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((c) => c && (c.task || c.source))
    .slice(0, 5)
    .map((c, i) => ({
      id: c.id ?? i + 1,
      person: c.person || 'Both',
      category: c.category || 'Home',
      task: c.task || '',
      source: c.source || '',
      date: c.date || null,
      time: c.time || null,
      type: (c.type || 'action').toLowerCase(),
    }));
}

export function formatDemoWhen(date, time, type) {
  if (!date) return '';
  const dt = new Date(`${date}T${time || '00:00'}:00`);
  if (Number.isNaN(dt.getTime())) return '';
  const day = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!time) return type === 'event' ? day : `Due · ${day}`;
  const t = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const formatted = `${day} · ${t}`;
  return type === 'event' ? formatted : `Due · ${formatted}`;
}

export function personRole(person) {
  const p = (person || '').toLowerCase();
  if (p === 'both' || p === 'family' || p === 'shared') return 'both';
  if (p.includes('spence')) return 'spence';
  if (p.includes('amanda')) return 'amanda';
  return 'both';
}


export async function callLandingDemoAI(prompt) {
  const { data, error } = await supabase.functions.invoke('landing-demo', {
    body: { prompt: prompt.trim() },
  });

  if (error) {
    let detail = error?.message || String(error);
    try {
      const ctx = error?.context;
      if (ctx) {
        let body = null;
        if (typeof ctx.json === 'function') body = await ctx.json().catch(() => null);
        if (!body && ctx.body && typeof ctx.body === 'string') {
          try { body = JSON.parse(ctx.body); } catch { body = ctx.body; }
        }
        if (body?.error) detail = body.error;
        else if (typeof body === 'string' && body) detail = body;
      }
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  if (data?.error) throw new Error(data.error);
  return parseDemoCards(data?.text || '');
}
