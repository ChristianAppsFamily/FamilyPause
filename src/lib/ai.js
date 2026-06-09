// ─────────────────────────────────────────────────────────────────────────────
// src/lib/ai.js — FamilyPause AI service
//
// All Anthropic calls go through the `distill` Supabase Edge Function so the
// API key stays server-side. This module:
//   1. Builds the system prompt (with optional Faith Mode and family name)
//   2. Invokes the edge function with prompt caching enabled
//   3. Logs cache hit/miss stats to the console for debugging
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

/**
 * callFamilyPauseAI — invoke the distill edge function with prompt caching.
 *
 * @param {object} opts
 * @param {string} opts.prompt          - the user message / transcript
 * @param {string} [opts.systemOverride] - optional full system prompt override
 * @param {boolean} [opts.faithMode]    - faith-mode flag from user profile
 * @param {string|null} [opts.familyName] - family name from user profile
 * @returns {Promise<string>} the AI response text
 */
export async function callFamilyPauseAI({
  prompt,
  systemOverride = null,
  faithMode = false,
  familyName = null,
}) {
  const system = systemOverride ?? buildSystemPrompt(faithMode, familyName);

  const { data, error } = await supabase.functions.invoke('distill', {
    body: { prompt, system, cacheSystem: true },
  });

  if (error) throw error;

  // Log cache stats forwarded from the edge function
  const usage = data?.usage;
  if (usage) {
    const cacheRead = usage.cacheRead ?? 0;
    console.log('[FamilyPause AI] Token usage:', {
      input: usage.input,
      output: usage.output,
      cacheWrite: usage.cacheWrite ?? 0,
      cacheRead,
      cached: cacheRead > 0 ? '✅ Cache HIT' : '⚠️ Cache MISS (first call or expired)',
    });
  }

  return data?.text || '';
}
