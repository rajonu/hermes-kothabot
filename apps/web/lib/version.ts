// ── KothaBot v2.0 — Version & Build Info ──────────────────────────────────────
// Bump APP_VERSION when releasing. BUILD_NUMBER auto-increments via CI/CD.
// Displayed in: Sidebar footer, Settings page, API health check.

export const APP_VERSION = '1.0.0';
export const BUILD_NUMBER = 210;
export const RELEASE_DATE = '2026-07-02';
export const IS_BETA = false;

export const VERSION_STRING = IS_BETA ? `v${APP_VERSION} Beta · build ${BUILD_NUMBER}` : `v${APP_VERSION} · build ${BUILD_NUMBER}`;

/**
 * Phases completed:
 *  ✅ Phase 1 — Foundation (auth, routing, dashboard layout)
 *  ✅ Phase 2 — Real data pages (orders, customers, analytics, settings)
 *  ✅ Phase 3 — Voice AI (Gemini Live + Railway WS + session chunking)
 *  ✅ Phase 4 — Widget embed (floating button, iframe, direct URL)
 *  ✅ Phase 5 — Billing (bKash/Nagad/Rocket + Lemon Squeezy, geo pricing, admin panel)
 *  ✅ Phase 6 — Support tickets, AI training/KB, integrations, PWA, public landing page
 *  ✅ Phase 7 — Public API, Webhooks, Google Calendar Integration
 */
