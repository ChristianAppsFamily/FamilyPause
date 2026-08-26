// ─────────────────────────────────────────────────────────────────────────────
// src/lib/ai.js — FamilyPause AI service
//
// All Anthropic calls go through the `distill` Supabase Edge Function so the
// API key stays server-side. Extraction prompts are built in the edge function.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';

export const buildSystemPrompt = (faithMode = false, familyName = null) =>
  `You are FamilyPause, an AI assistant that helps families run structured, meaningful weekly family meetings.

Your role:
- Guide families through agenda items: wins, challenges, action items, and gratitude
- Extract clear, specific action items from conversation and assign them to family members
- Keep the tone warm, encouraging, and faith-friendly
- Summarize meetings concisely at the end
- Help families stay consistent with their weekly rhythm
${familyName ? `\n- This is the ${familyName} family. Address them warmly by name when appropriate.` : ''}

Guidelines:
- Always be encouraging and positive — family meetings should feel safe
- Extract action items in the format: [Person] will [action] by [date]
- Keep responses concise — families are busy
- If a family member is struggling, respond with empathy first
- Never take sides in family disagreements
- You are not a therapist. For serious issues, gently recommend professional support${faithMode ? ' and encourage them to speak with their pastor or a trusted faith leader' : ''}.
${faithMode ? `
Faith Mode is ON:
- You may reference scripture, prayer, and faith principles naturally and warmly
- You can open or close meeting summaries with a short blessing or scripture
- Frame challenges through a lens of grace, growth, and God's faithfulness` : ''}`;

async function invokeDistill(body) {
  const { data, error } = await supabase.functions.invoke('distill', { body });

  if (error) {
    let detail = error?.message || String(error);
    let code = null;
    let status = error?.context?.status;
    try {
      const ctx = error?.context;
      if (ctx) {
        let parsed = null;
        if (typeof ctx.json === 'function') parsed = await ctx.json().catch(() => null);
        if (!parsed && ctx.body && typeof ctx.body === 'string') {
          try { parsed = JSON.parse(ctx.body); } catch (_) { parsed = ctx.body; }
        }
        if (parsed?.error) detail = parsed.error;
        else if (typeof parsed === 'string' && parsed) detail = parsed;
        if (parsed?.code) code = parsed.code;
        if (ctx.status) status = ctx.status;
      }
    } catch (_) { /* ignore */ }

    if (code === 'SESSION_PACK_REQUIRED' || code === 'DAILY_LIMIT' || code === 'WEEKLY_LIMIT' || code === 'FREE_SESSION_LIMIT' || status === 402) {
      const err = new Error(detail || 'Session pack required');
      err.code = code || 'SESSION_PACK_REQUIRED';
      err.status = 402;
      throw err;
    }

    console.error('[FamilyPause AI] Edge function error:', status, detail, error);
    throw new Error(`AI unavailable: ${detail}`);
  }

  const usage = data?.usage;
  if (usage) {
    const cacheRead = usage.cacheRead ?? 0;
    console.log('[FamilyPause AI] Token usage:', {
      input: usage.input,
      output: usage.output,
      cacheWrite: usage.cacheWrite ?? 0,
      cacheRead,
      cached: cacheRead > 0 ? '✅ Cache HIT' : '⚠️ Cache MISS (first call or expired)',
      stopReason: data?.stopReason ?? 'unknown',
      truncated: data?.truncated ?? false,
    });
  }
  if (data?.truncated) {
    console.warn('[FamilyPause AI] Response was truncated — increase max_tokens or shorten transcript.');
  }

  return data?.text || '';
}

/**
 * Weekly-sync transcript extraction — system prompt built server-side.
 */
export async function callDistillExtraction({ prompt, extraction, sessionId }) {
  return invokeDistill({
    prompt,
    cacheSystem: true,
    extraction,
    ...(sessionId ? { session_id: sessionId } : {}),
  });
}

/** General AI call with optional system override (non-extraction). */
export async function callFamilyPauseAI({
  prompt,
  systemOverride = null,
  faithMode = false,
  familyName = null,
}) {
  const system = systemOverride ?? buildSystemPrompt(faithMode, familyName);
  return invokeDistill({ prompt, system, cacheSystem: true });
}
