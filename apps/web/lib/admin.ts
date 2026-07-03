// ── Master Admin Config ────────────────────────────────────────────────────────
// Add admin email addresses here. Only these users can access /admin.
export const ADMIN_EMAILS = [
  'rajsyful@gmail.com',
];

export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

// ── Available Gemini Live Models (Voice API only) ──────────────────────────────
// Both models priced at $0.005/min audio in · $0.018/min audio out (same rate).
// 2.5 Native Audio is cheaper on text tokens — use it as the default.
export const GEMINI_MODELS = [
  {
    id: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
    label: 'Gemini 2.5 Flash Native Audio',
    badge: 'Cheapest',
    badgeColor: '#10b981',
    description: 'Same audio rate as 3.1, cheaper text tokens. Default choice.',
  },
  {
    id: 'models/gemini-3.1-flash-live-preview',
    label: 'Gemini 3.1 Flash Live',
    badge: 'Best Quality',
    badgeColor: '#06b6d4',
    description: 'Highest quality voice. Slightly higher text token cost.',
  },
] as const;

export type GeminiModelId = typeof GEMINI_MODELS[number]['id'];
export const DEFAULT_MODEL: GeminiModelId = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

// ── Available Gemini Text Models (text chat + Messenger/WhatsApp replies) ──────
export const TEXT_MODELS = [
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    badge: 'Best Quality',
    badgeColor: '#a855f7',
    description: 'Best reasoning for text chat, Messenger, and WhatsApp replies.',
  },
] as const;

export type TextModelId = typeof TEXT_MODELS[number]['id'];
export const DEFAULT_TEXT_MODEL: TextModelId = 'gemini-2.5-flash-lite';
