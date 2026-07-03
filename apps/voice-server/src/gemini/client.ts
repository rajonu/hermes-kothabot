import { GoogleGenAI, Modality } from '@google/genai';
import { SessionConfig, TranscriptEntry } from '../sessions/types.js';

// Default Live API model. Can be overridden per-shop from Master Admin panel.
const DEFAULT_MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

// ── Knowledge base character cap (Layer 4) ──────────────────────────────────
// Capping keeps voice startup fast and reduces token cost.
// 4 000 chars ≈ ~700 words — enough for most FAQs + product lists.
const KB_CHAR_LIMIT = 4000;

// ── Build system instruction from layered config ────────────────────────────
//
// Layer 1 – Global Rules    : arrives pre-assembled inside config.systemPrompt
//                             (useVoiceSession prepends global rules)
// Layer 2 – Business Profile: base prompt + language
// Layer 3 – Category Rules  : config.categoryRules (DB-driven) or hardcoded fallback
// Layer 4 – Knowledge Base  : config.trainingData, capped at KB_CHAR_LIMIT chars
//
export function buildSystemInstruction(
  config: SessionConfig,
  conversationSummary?: string
): string {
  // ── Layer 2: Business Profile & language ────────────────────────────────
  const lang = config.language === 'bn'
    ? 'LANGUAGE RULE (STRICT, NON-NEGOTIABLE): You MUST respond in Bangla for EVERY message — greetings, answers, confirmations, farewells. Do NOT switch to English or any other language unless the user writes to you first in that language.'
    : config.language === 'en'
    ? 'LANGUAGE RULE (STRICT, NON-NEGOTIABLE): You MUST respond in English for EVERY message — greetings, answers, confirmations, farewells. Do NOT switch to Bangla or any other language unless the user writes to you first in that language.'
    : "LANGUAGE RULE: Detect the language of the user's first spoken message and respond in that same language throughout the call. Only switch if the user switches.";

  const summary = conversationSummary
    ? `\n\n## Previous Conversation Summary\n${conversationSummary}\n\n(Continue the conversation naturally from where it left off.)`
    : '';

  // Layer 1 + custom system prompt arrive pre-merged in config.systemPrompt
  const base = config.systemPrompt?.trim() ||
    `You are a helpful AI voice assistant for ${config.shopName || 'this business'}. Help customers with their questions, take orders, and provide information about products and services.`;

  // ── Layer 4: Knowledge Base (capped) ────────────────────────────────────
  const rawKb = config.trainingData?.trim() ?? '';
  const kb = rawKb.length > KB_CHAR_LIMIT ? rawKb.slice(0, KB_CHAR_LIMIT) + '\n[…knowledge base truncated for performance]' : rawKb;
  const knowledge = kb
    ? `\n\n## Business Knowledge Base\nUse the following information to answer customer questions accurately:\n\n${kb}`
    : '';

  // ── Layer 3: Category Rules ──────────────────────────────────────────────
  // Prefer DB-driven rules (sent by the client); fall back to hardcoded defaults.
  const cf = config.collectFields ?? { name: true, phone: true, address: true };
  const collectList: string[] = [];
  if (cf.name)    collectList.push('customer full name');
  if (cf.phone)   collectList.push('phone number');
  if (cf.address) collectList.push('delivery address');

  const collectRule = collectList.length > 0
    ? `Before confirming any order or appointment, you MUST collect: ${collectList.join(', ')}. Ask for them one at a time if not already provided.`
    : `You can confirm orders without collecting personal details — just confirm the items.`;

  let categoryRule: string;
  if (config.categoryRules?.trim()) {
    // DB-driven category rules (Layer 3 from admin panel)
    categoryRule = config.categoryRules.trim();
  } else {
    // Hardcoded fallback for backward compatibility
    const category = config.category ?? 'other';
    if (category === 'clinic') {
      categoryRule = `## Appointment Scheduling (CLINIC)
You are a clinic appointment assistant. The Business Knowledge Base contains:
- "Doctors" section: doctor names, specializations, consultation fees, and which Location(s) they work at
- "Doctor Working Hours" section: which days/times each doctor is available, and the location for each slot
- "Appointment Types" section: available services
- "Clinic Locations" section: all branch/location names

AVAILABILITY QUESTIONS — When a patient asks "when is Dr. X available?" or "what days can I book?":
1. Look up that doctor's hours in the "Doctor Working Hours" section of the knowledge base.
2. State them clearly: e.g. "Dr. Arafat is available Monday, Wednesday, and Friday from 9am to 5pm at Uttara Branch."
3. If no working hours are listed for that doctor, say: "Let me book you in — what date and time works for you?"
4. NEVER say "I don't have availability information" if working hours are in the knowledge base.

LOCATION — If a doctor works at more than one location (per the "Doctors"/"Doctor Working Hours" sections), ask the patient which location they want and include it in the booking. If the clinic has only one location, skip asking.

BOOKING — Collect ALL of:
1. Doctor name  2. Appointment date and time  3. Patient full name  4. Patient phone  5. Location (only if the doctor has more than one)
Read back: "Appointment with Dr. [X] on [date] at [time]{location, if applicable} for [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.`;
    } else if (category === 'salon' || category === 'services') {
      categoryRule = `## Booking Collection (${category.toUpperCase()})
Collect ALL of: 1. Service name  2. Date and time  3. Customer name  4. Phone
Read back: "Booking for [service] on [date] at [time] for [name], phone [phone]. Correct?"
Wait for explicit YES before confirming.`;
    } else {
      categoryRule = `## Order Collection
Collect: 1. Items with qty  2. Total  3. Customer name, phone, address
Read back: "Order: [items], total [amount], deliver to [name], phone [phone], [address]. Correct?"
Wait for explicit YES before confirming.`;
    }
  }

  const identityRule = config.whiteLabel
    ? `\n\n## Identity Rules (CRITICAL)\nYou are the exclusive AI voice assistant for ${config.shopName || 'this business'}, built specifically for them.\n- If asked "who are you?", "who made you?", or any similar question — say: "I am the AI assistant of ${config.shopName || 'this business'}."\n- NEVER mention KothaBot, Google, Gemini, OpenAI, or any third-party AI platform.`
    : `\n\n## Identity Rules\nYou are KothaBot AI, the intelligent voice assistant for ${config.shopName || 'this business'}.\n- If asked "who are you?", "what AI is this?", or similar — say: "I am KothaBot AI, the assistant for ${config.shopName || 'this business'}."\n- You may mention KothaBot when asked, but do not volunteer it unprompted.`;

  const scopeRules = `

## Greeting Rules (CRITICAL — never re-introduce)
You have ALREADY introduced yourself in the opening greeting at the start of the call.
- If the customer greets back (Salam, Assalamualaikum, Hello, Hi, হাই, etc.), respond with a BRIEF warm acknowledgment + ONE short question to move forward.
  - GOOD: "Walaikum assalam! How can I help you today?"
  - GOOD: "ওয়ালাইকুম আসসালাম! আপনাকে কীভাবে সাহায্য করতে পারি?"
  - BAD (forbidden — never do this): "Walaikum assalam. I am [name] from [business]. How can I help?" — DO NOT repeat the business name or restate that you are an AI assistant.
- Never re-state who you are or which business you serve unless the customer explicitly asks.

## Scope & Off-Topic Rules (CRITICAL — saves cost)
You ONLY assist with ${config.shopName || 'this business'}: its products, services, orders, appointments, prices, hours, location, and related questions.
- For ANYTHING off-topic — singing, jokes, poems, stories, riddles, general knowledge, math, coding, news, weather, personal questions ("what do you eat", "how are you feeling"), or chit-chat — DECLINE in ONE short polite sentence and redirect. Example: "I can only help with ${config.shopName || 'our'} services — what would you like to order or ask about?"
- NEVER sing, tell a joke/story/poem, role-play, or answer trivia, even if asked repeatedly or "just once".
- Keep every reply concise. Do not pad answers.
- If the customer goes off-topic a SECOND time after your redirect, immediately say: "I can only help with ${config.shopName || 'our'} services. Thank you for contacting us. Goodbye!" — then say nothing more. Do NOT wait for a response.`;

  const callRules = `

## Data Collection Rules
${collectRule}

${categoryRule}

## Confirmation Rules (CRITICAL)
1. Read back the complete order/booking using the template above.
2. Wait for the customer to say YES / correct / right / হ্যাঁ / ঠিক আছে.
3. Only AFTER YES: say "Your order is confirmed" / "আপনার অর্ডার নিশ্চিত করা হয়েছে".
4. NEVER confirm until customer explicitly agrees.
5. If customer says NO — adjust and read back again.
6. Casual questions or "no thanks" are NOT orders.

## Call Ending Rules
- After confirming an order or appointment, ask "Is there anything else I can help you with?"
- When the customer says no / goodbye / thank you / done / they are satisfied — say a warm farewell:
  "Thank you for contacting [business name]. Have a great day! Goodbye!"
  (Use the actual business name.)
- Say NOTHING after the farewell. The system detects "Goodbye" and closes automatically.`;

  return `${base}${identityRule}${knowledge}${scopeRules}${callRules}\n\n${lang}${summary}`;
}

// ── Summarize transcript for session chunking ───────────────────────────────
function makeClient(apiKey: string) {
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1beta' } });
}

export async function summarizeTranscript(
  apiKey: string,
  transcript: TranscriptEntry[]
): Promise<string> {
  const ai = makeClient(apiKey);

  const lines = transcript
    .slice(-40) // last 40 turns max
    .map(e => `${e.role === 'user' ? 'Customer' : 'Assistant'}: ${e.text}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: [{
      role: 'user',
      parts: [{
        text: `Summarize this voice conversation in 150-200 words. Capture: customer's name (if given), what they asked/ordered, current status, any pending items, and tone of conversation. This summary will be injected into a new session to continue seamlessly.\n\nConversation:\n${lines}`
      }]
    }]
  });

  return response.text ?? '';
}

// ── Start a Gemini Live session ─────────────────────────────────────────────
// USER explicit goodbye — only clear farewells, NOT "thank you" / "thanks" / "all good"
// which fire constantly mid-conversation and cut the call prematurely.
// The 40s inactivity timer handles cases where the user just stops talking.
const GOODBYE_PATTERN = /\b(bye|goodbye|good bye|see you|বিদায়|আল্লাহ হাফেজ|আবার কথা হবে)\b/i;

// AI farewell — only explicit goodbye words so we don't accidentally trigger
// on "Have a good day, how can I help?" mid-conversation.
const AI_FAREWELL_PATTERN = /\b(goodbye|good bye|বিদায়|আল্লাহ হাফেজ)\b/i;

// Order confirmed phrases — AI just confirmed, start a shorter inactivity window.
// NOTE: must require actual confirmation wording ("booked"/"confirmed"/"scheduled"),
// not mere mention of booking intent — "book an appointment" (still being arranged)
// was matching the old pattern and prematurely shrinking the inactivity timeout,
// killing calls mid-conversation while the patient was still picking a doctor.
const ORDER_CONFIRMED_PATTERN = /\b(order.{0,20}(confirm|placed|received)|(confirm|placed|received).{0,20}order|appointment.{0,20}(confirm|booked|scheduled)|(confirm|booked|scheduled).{0,20}appointment|অর্ডার.{0,10}নিশ্চিত|আপনার অর্ডার)\b/i;

export async function startLiveSession(
  apiKey: string,
  config: SessionConfig,
  conversationSummary: string,
  callbacks: {
    onAudio: (base64Pcm: string) => void;
    onTranscript: (role: 'user' | 'assistant', text: string, final: boolean) => void;
    onError: (err: Error) => void;
    onClose: () => void;
    onCallComplete: () => void;   // called when call should end gracefully
    onOrderConfirmed: () => void; // called when order confirmed → shorten inactivity
  },
  isFirstConnection = true
) {
  const ai = makeClient(apiKey);
  const systemInstruction = buildSystemInstruction(config, conversationSummary);
  const voice = config.voice ?? 'Aoede';
  const model = config.aiModel || DEFAULT_MODEL;
  console.log(`[gemini] using model: ${model}`);

  // Use a ref-style variable so onopen can safely send the greeting
  // even though it fires before the .connect() promise resolves.
  let sessionHandle: any = null;
  let openFired = false;
  const pendingActions: (() => void)[] = [];
  // Accumulate AI output transcription segments across a turn
  let outputTranscriptBuffer = '';

  const runWhenReady = (fn: () => void) => {
    if (sessionHandle) fn();
    else pendingActions.push(fn);
  };

  const session = await ai.live.connect({
    model,
    config: {
      responseModalities: [Modality.AUDIO],   // AUDIO only — TEXT modality causes code 1011
      systemInstruction: { parts: [{ text: systemInstruction }] },
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
      },
      // ── Transcription: BOTH directions ──────────────────────────────────
      // inputAudioTranscription:  populates serverContent.inputTranscription
      //   → user's speech-to-text (REQUIRED for order extraction + call ending)
      // outputAudioTranscription: populates serverContent.outputTranscription
      //   → AI's speech-to-text (for transcript display + END CALL detection)
      inputAudioTranscription:  {},
      outputAudioTranscription: {},
      // NOTE: realtimeInputConfig.automaticActivityDetection was tried but
      // made things worse — VAD config schema for this SDK version needs
      // more investigation before re-enabling.
    } as any,
    callbacks: {
      onopen: () => {
        openFired = true;
        if (!isFirstConnection) return; // reconnect — don't re-greet
        // Build a language-correct greeting trigger.
        // When language is explicitly set, do NOT use the stored greetingMessage —
        // it may be in the wrong language (e.g. Bangla greeting on an English-only account).
        // Instead tell the AI to generate its own greeting in the correct language.
        let greetingTrigger: string;
        if (config.language === 'en') {
          greetingTrigger = `[System: Start the conversation. Greet the customer warmly in English and ask how you can help with ${config.shopName ?? 'our services'} today.]`;
        } else if (config.language === 'bn') {
          const greeting = config.greetingMessage ?? `হ্যালো! ${config.shopName ?? 'আমাদের স্টোর'}-এ আপনাকে স্বাগতম। কীভাবে সাহায্য করতে পারি?`;
          greetingTrigger = `[System: Start the conversation. Say: "${greeting}"]`;
        } else {
          const greeting = config.greetingMessage ?? `Hello! Welcome to ${config.shopName ?? 'our store'}. How can I help you today?`;
          greetingTrigger = `[System: Start the conversation. Say: "${greeting}"]`;
        }
        runWhenReady(() => {
          try {
            sessionHandle.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: greetingTrigger }] }],
              turnComplete: true,
            });
          } catch (e) {
            console.warn('[gemini] greeting send failed:', e);
          }
        });
      },
      onmessage: (msg: any) => {
        try {
          // Debug: log any transcription events
          if (msg?.serverContent?.inputTranscription) {
            console.log('[gemini] inputTranscription:', JSON.stringify(msg.serverContent.inputTranscription));
          }
          if (msg?.serverContent?.outputTranscription) {
            console.log('[gemini] outputTranscription:', JSON.stringify(msg.serverContent.outputTranscription));
          }

          const parts = msg?.serverContent?.modelTurn?.parts ?? [];

          // ── Audio chunks + scan text parts in same loop ──
          for (const part of parts) {
            if (part?.inlineData?.mimeType?.startsWith('audio/')) {
              callbacks.onAudio(part.inlineData.data);
            }
            // Text parts alongside audio (happens in some API versions)
            if (part?.text) {
              const t = part.text.trim();
              if (t) {
                if (ORDER_CONFIRMED_PATTERN.test(t)) callbacks.onOrderConfirmed();
              }
            }
          }

          // ── Output audio transcription — accumulate segments ──────────────
          const outputTranscript = msg?.serverContent?.outputTranscription;
          if (outputTranscript?.text?.trim()) {
            const seg = outputTranscript.text.trim();
            outputTranscriptBuffer += (outputTranscriptBuffer ? ' ' : '') + seg;
            callbacks.onTranscript('assistant', outputTranscriptBuffer.trim(), false);
          }

          // ── Turn complete → flush accumulated AI transcript as final ────────
          if (msg?.serverContent?.turnComplete) {
            const textParts = parts.filter((p: any) => p?.text && !p.text.startsWith('**'));
            const textFallback = textParts.map((p: any) => p.text).join('').trim();
            const fullText = (outputTranscriptBuffer.trim() || textFallback).trim();

            if (fullText) {
              callbacks.onTranscript('assistant', fullText, true);
              // Detect natural AI farewell ("Goodbye!", "Have a great day!", etc.)
              // This replaces the old "END CALL" spoken trigger — no robotic phrase needed.
              if (AI_FAREWELL_PATTERN.test(fullText)) {
                console.log('[gemini] AI farewell detected:', fullText.slice(0, 80));
                callbacks.onCallComplete();
              }
              if (ORDER_CONFIRMED_PATTERN.test(fullText)) callbacks.onOrderConfirmed();
            }
            outputTranscriptBuffer = '';
          }

          // ── User input transcription — always mark as final ──────────────
          // NOTE: inputTranscription.finished is often absent/false in AUDIO-only
          // mode. Every segment IS a complete utterance — always treat as final.
          const inputTranscript = msg?.serverContent?.inputTranscription;
          if (inputTranscript?.text?.trim()) {
            const t = inputTranscript.text.trim();
            const isFinal = inputTranscript.finished !== false; // true unless explicitly false
            callbacks.onTranscript('user', t, isFinal);
            // Detect user goodbye from any transcription segment
            if (GOODBYE_PATTERN.test(t)) {
              console.log('[gemini] User goodbye detected:', t);
              callbacks.onCallComplete();
            }
            // Detect order confirmation in user speech too
            if (ORDER_CONFIRMED_PATTERN.test(t)) callbacks.onOrderConfirmed();
          }
        } catch (err) {
          console.warn('[gemini] message parse error:', err);
        }
      },
      onerror: (err: any) => {  // eslint-disable-next-line @typescript-eslint/no-unused-vars
        callbacks.onError(new Error(err?.message || 'Gemini Live error'));
      },
      onclose: (evt: any) => {
        console.log(`[gemini] onclose code=${evt?.code} reason="${evt?.reason?.slice(0,120)}"`);
        callbacks.onClose();
      },
    },
  });

  // Session is now resolved — make it available and flush any queued actions
  sessionHandle = session;
  for (const fn of pendingActions) fn();
  pendingActions.length = 0;

  return session;
}
