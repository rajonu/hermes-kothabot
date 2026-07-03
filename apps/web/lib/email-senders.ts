/**
 * Centralized email sender identities.
 * Format: `Display Name <address@domain>`
 *
 * The display name is what shows up in email clients (Gmail etc.)
 * instead of the bare "billing" or "support" string.
 *
 * To add a new sender:
 *  1. Add the constant here
 *  2. Make sure the address is verified in Resend
 */

export const SENDERS = {
  BILLING:  'KothaBot Billing <billing@kothabot.ai.bd>',
  SUPPORT:  'KothaBot Support <support@kothabot.ai.bd>',
  WELCOME:  'KothaBot <welcome@kothabot.ai.bd>',
  NOTIFY:   'KothaBot <noreply@kothabot.ai.bd>',
  TEST:     'KothaBot Test <test@kothabot.ai.bd>',
} as const;
