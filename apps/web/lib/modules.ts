/**
 * KothaBot Lite — Module Registry
 *
 * Single source of truth for all feature modules.
 * A module being OFF = route returns 404, nav item hidden, bot-server won't connect.
 * A module being ON = everything works as normal.
 *
 * Modules are stored in shops.modules (jsonb array).
 * When shops.modules IS NULL, defaults apply (back-compat).
 */

export type ModuleKey =
  | 'voice'
  | 'chat'
  | 'whatsapp'
  | 'messenger'
  | 'livechat'
  | 'calendar'
  | 'sheets'
  | 'scheduling'
  | 'voice_links'
  | 'api_access'
  | 'telephony';

/** Every known module — order matters for UI display. */
export const ALL_MODULES: ModuleKey[] = [
  'voice',
  'chat',
  'whatsapp',
  'messenger',
  'livechat',
  'calendar',
  'sheets',
  'scheduling',
  'voice_links',
  'api_access',
  'telephony',
];

/** Modules ON by default for a new / unconfigured shop. */
export const DEFAULT_MODULES: ModuleKey[] = [
  'voice',
  'chat',
  'livechat',
  'scheduling',
  'voice_links',
];

/** Display labels + descriptions for the Settings → Modules UI. */
export const MODULE_INFO: Record<ModuleKey, { label: string; description: string }> = {
  voice:       { label: 'Voice AI',          description: 'AI voice assistant on the phone widget' },
  chat:        { label: 'Text Chat',         description: 'AI text chat on the website widget' },
  whatsapp:    { label: 'WhatsApp',          description: 'WhatsApp Business API integration' },
  messenger:   { label: 'Messenger',         description: 'Facebook Messenger integration' },
  livechat:    { label: 'Live Chat',         description: 'Human handoff via live chat panel' },
  calendar:    { label: 'Google Calendar',   description: 'Sync appointments to Google Calendar' },
  sheets:      { label: 'Google Sheets',     description: 'Sync products/schedule from Sheets; write back orders' },
  scheduling:  { label: 'Scheduling',        description: 'Online booking & appointment scheduling' },
  voice_links: { label: 'Voice Links',       description: 'Shareable voice call links' },
  api_access:  { label: 'API Access',        description: 'Public API keys, webhooks, WP plugin' },
  telephony:   { label: 'SIP Telephony',     description: 'Answer phone calls via SIP trunk' },
};

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Check if a single module is enabled for a shop.
 * shops.modules = NULL → falls back to DEFAULT_MODULES.
 */
export function isModuleEnabled(
  shop: { modules?: string[] | null },
  key: ModuleKey,
): boolean {
  if (!shop.modules) return DEFAULT_MODULES.includes(key);
  return shop.modules.includes(key);
}

/** Return the subset of ALL_MODULES currently enabled. */
export function getEnabledModules(shop: { modules?: string[] | null }): ModuleKey[] {
  if (!shop.modules) return [...DEFAULT_MODULES];
  return ALL_MODULES.filter((m) => shop.modules!.includes(m));
}

/** Toggle a single module — returns the new array. */
export function toggleModule(
  current: string[] | null | undefined,
  key: ModuleKey,
  enable: boolean,
): string[] {
  const arr = current ?? [...DEFAULT_MODULES];
  if (enable) {
    if (arr.includes(key)) return arr;
    return [...arr, key];
  }
  return arr.filter((m) => m !== key);
}
