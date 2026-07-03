/**
 * Shared AI reply pipeline (4-layer prompt assembly + Gemini call).
 * Extracted from app/api/widget-chat/route.ts so the same logic backs
 * the widget, the public v1 API, and the internal endpoint used by the
 * WhatsApp/Messenger routing engine. Behavior-preserving extraction —
 * do not change prompt text here without updating all three call sites'
 * expectations.
 */
import { createAdminClient } from '@/lib/supabase/server';
import { genAI } from '@/lib/gemini';
import { DEFAULT_TEXT_MODEL } from '@/lib/admin';
import { getGlobalAIRules, getCategoryPrompt } from '@/lib/platform-settings';
import { DEFAULT_CATEGORY_PROMPTS } from '@/lib/prompt-layers';
import { buildTrainingData } from '@/lib/widget-training';

export type ShopCategory = 'restaurant' | 'retail' | 'salon' | 'clinic' | 'pharmacy' | 'grocery' | 'services' | 'other';

export interface AIHistoryTurn {
  role: 'user' | 'assistant' | 'model';
  text: string;
}

export interface RunAIReplyArgs {
  shop: any;
  history: AIHistoryTurn[];
  message: string;
  /** Optional voice note: base64 audio, sent instead of transcribing separately —
   * Gemini reads audio directly, so `message` can be empty when this is set. */
  audio?: { base64: string; mimeType: string };
}

// ponytail: Gemini occasionally returns 503 "currently experiencing high
// demand" — was a single unretried call, so any blip dropped the customer's
// message entirely (no reply, no error surfaced to them). Retry transient
// errors a couple times with a short backoff before giving up for real.
function isRetryableGeminiError(err: any): boolean {
  const status = err?.status ?? err?.httpStatus ?? err?.response?.status;
  if (status === 503 || status === 429) return true;
  const msg = String(err?.message ?? '');
  return /503|overloaded|high demand|rate limit/i.test(msg);
}

async function sendMessageWithRetry(chat: { sendMessage: (parts: any[]) => Promise<any> }, parts: any[]) {
  const delays = [800, 2000];
  let lastErr: any;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await chat.sendMessage(parts);
    } catch (err: any) {
      lastErr = err;
      if (attempt === delays.length || !isRetryableGeminiError(err)) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}

/**
 * Builds the same 4-layer system instruction widget-chat uses, then sends
 * `message` through Gemini with `history` as prior chat turns. `shop` must
 * be a full shop row (id, name, category, ai_config, widget_config).
 */
export async function runAIReply({ shop, history, message, audio }: RunAIReplyArgs): Promise<string> {
  const db = createAdminClient();
  const shopId = shop.id;

  const knowledgeBase = await buildTrainingData(db, shopId, shop.name, shop.category);

  const aiConfig = shop.ai_config ?? {};
  const billingRegion = aiConfig.billing_region ?? 'BD';
  const rawLang = aiConfig.language ?? 'auto';
  // INTL shops default to English when merchant hasn't explicitly chosen a language
  const lang = rawLang === 'auto' && billingRegion === 'INTL' ? 'en' : rawLang;
  const langNote = lang === 'bn' ? 'Always reply in Bengali (Bangla).' : lang === 'en' ? 'Always reply in English.' : 'Reply in the same language the customer uses (Bengali or English).';
  const category: ShopCategory = (shop.category ?? 'other') as ShopCategory;
  const today = new Date().toISOString().slice(0, 10);
  const collectFields = aiConfig.collect_fields ?? { name: true, phone: true, address: false };

  const requiredFields: string[] = [];
  if (collectFields.name !== false) requiredFields.push('full name');
  if (collectFields.phone !== false) requiredFields.push('phone number');
  if (collectFields.address === true) requiredFields.push('address');

  const greetingMsg = shop.widget_config?.greeting ?? '';

  let [globalRulesRaw, categoryRules] = await Promise.all([
    getGlobalAIRules(),
    getCategoryPrompt(category).then(r => r ?? DEFAULT_CATEGORY_PROMPTS[category] ?? DEFAULT_CATEGORY_PROMPTS['other']),
  ]);
  globalRulesRaw = globalRulesRaw.replace(/\[Business Name\]/g, shop.name ?? 'this business');
  globalRulesRaw = globalRulesRaw.replace(/={10,}\s*👋 GREETING RULES[\s\S]*?(?=={10,}|$)/i, '');

  const systemInstruction = [
    globalRulesRaw,
    `\n## THIS SESSION\nYou are the AI assistant for ${shop.name}. You help customers via text chat.`,
    aiConfig.white_label
      ? `\n## Identity Rules (CRITICAL)\nYou are the exclusive AI assistant of ${shop.name}, built specifically for this business.\n- If asked "who made you?", "what AI are you?", "are you KothaBot/ChatGPT/Google?" — always say: "I am the intelligent AI assistant of ${shop.name}, built exclusively for us."\n- NEVER mention KothaBot, Google, Gemini, OpenAI, or any third-party AI platform.\n- If asked your name, say: "I'm the ${shop.name} AI assistant."`
      : '',
    langNote,
    `TODAY's date is: ${today}. Use this for scheduling.`,
    'Be concise and friendly. Keep replies under 3 sentences unless detail is needed.',
    greetingMsg ? `Your greeting: "${greetingMsg}". Use ONLY this greeting — never use "নমস্কার" or any other.` : 'Never use "নমস্কার" as a greeting.',
    aiConfig.systemPrompt ?? '',
    `\n## Scope & Off-Topic Rules (CRITICAL — saves cost)
You ONLY assist with ${shop.name}: its products, services, orders, appointments, prices, hours, location, and related questions.
- For ANYTHING off-topic — singing, jokes, poems, stories, riddles, general knowledge, math, coding, news, weather, personal questions, or chit-chat — DECLINE in ONE short polite sentence and redirect.
- NEVER sing, tell a joke/story/poem, role-play, or answer trivia, even if asked repeatedly.
- Keep every reply concise. Do not pad answers.`,
    categoryRules ? `\n${categoryRules}` : '',
    requiredFields.length
      ? `\n## Field Collection\nCollect from customer before confirming: ${requiredFields.join(', ')}. Ask one at a time.`
      : '',
    knowledgeBase ? `\n## Business Information\n${knowledgeBase}` : '',
  ].filter(Boolean).join('\n');

  const model = genAI.getGenerativeModel({ model: aiConfig.text_model ?? DEFAULT_TEXT_MODEL, systemInstruction });

  const mapped = (history ?? []).map((m) => ({
    role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));
  // Gemini requires the first history turn to be 'user' — drop any leading model turns.
  const firstUserIdx = mapped.findIndex((m) => m.role === 'user');
  const geminiHistory = firstUserIdx === -1 ? [] : mapped.slice(firstUserIdx);

  const chat = model.startChat({ history: geminiHistory });

  // Voice note: send the audio inline — Gemini transcribes + understands in
  // one call, no separate STT step needed. Text still included if present
  // (e.g. a caption alongside the voice note).
  const parts: any[] = [];
  if (audio) parts.push({ inlineData: { mimeType: audio.mimeType, data: audio.base64 } });
  if (message.trim()) parts.push({ text: message.trim() });
  if (!parts.length) parts.push({ text: '(empty message)' });

  const result = await sendMessageWithRetry(chat, parts);
  return result.response.text();
}
