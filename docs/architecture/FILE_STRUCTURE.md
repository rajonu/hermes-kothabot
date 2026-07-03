# File Structure

Complete monorepo layout with roles for all major files.

```
Kothabot-2.0/
├── apps/
│   ├── web/                              ← Next.js 16 App Router
│   │   ├── app/
│   │   │   ├── (auth)/                   ← Public auth pages
│   │   │   │   ├── login/page.tsx        ← Email/password + Google OAuth + hash token handler
│   │   │   │   ├── register/page.tsx     ← Registration + plan selection
│   │   │   │   └── onboarding/page.tsx   ← Post-registration setup wizard
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   └── callback/route.ts     ← Supabase OAuth code exchange → /dashboard
│   │   │   │
│   │   │   ├── (dashboard)/              ← Authenticated client dashboard
│   │   │   │   ├── layout.tsx            ← Root dashboard layout: user, shop, counts (3 query waves)
│   │   │   │   ├── dashboard/page.tsx    ← Overview cards + recent orders
│   │   │   │   ├── analytics/page.tsx    ← Call analytics + AI cost protection card
│   │   │   │   ├── products/page.tsx     ← Category-aware product/service manager
│   │   │   │   ├── orders/
│   │   │   │   │   ├── page.tsx          ← Order list
│   │   │   │   │   └── [id]/page.tsx     ← Order detail + AI transcript viewer
│   │   │   │   ├── customers/page.tsx    ← Category-aware customer/patient list
│   │   │   │   ├── leads/page.tsx        ← Lead pipeline
│   │   │   │   ├── transcripts/page.tsx  ← Voice call transcript list + modal viewer
│   │   │   │   ├── training/page.tsx     ← AI Knowledge Base (manual + website extraction)
│   │   │   │   ├── integrations/
│   │   │   │   │   ├── page.tsx          ← Integrations hub (Calendar, API, Telephony, Widget)
│   │   │   │   │   ├── EmbedConfigurator.tsx    ← Widget embed code generator
│   │   │   │   │   ├── ApiAccessPanel.tsx       ← API keys + webhook management
│   │   │   │   │   ├── GoogleCalendarPanel.tsx  ← Calendar OAuth connect/disconnect
│   │   │   │   │   ├── TelephonyPanel.tsx       ← SIP phone connection UI
│   │   │   │   │   └── LeadCaptureToggle.tsx    ← requirePhone widget setting
│   │   │   │   ├── billing/
│   │   │   │   │   ├── page.tsx          ← Subscription status + upgrade UI
│   │   │   │   │   └── PaymentModal.tsx  ← Config-driven payment flow (BD/INTL)
│   │   │   │   ├── voice-links/
│   │   │   │   │   └── VoiceLinksManager.tsx    ← Public voice link CRUD
│   │   │   │   └── settings/
│   │   │   │       ├── page.tsx          ← General settings
│   │   │   │       └── backup/page.tsx   ← Backup & restore
│   │   │   │
│   │   │   ├── (admin)/                  ← God admin panel (PIN auth)
│   │   │   │   ├── admin-login/page.tsx  ← PIN login
│   │   │   │   ├── admin/
│   │   │   │   │   ├── layout.tsx        ← Admin auth gate (requireAdminSession)
│   │   │   │   │   ├── page.tsx          ← Admin dashboard: shop list + BD/Global/Unassigned stats
│   │   │   │   │   ├── shops/[shopId]/
│   │   │   │   │   │   ├── page.tsx      ← Per-shop management + Feature Access toggles
│   │   │   │   │   │   ├── FeatureToggle.tsx     ← voip_enabled / api_access_enabled / white_label
│   │   │   │   │   │   └── RegionOverride.tsx    ← BD / Global region assignment
│   │   │   │   │   ├── payments/page.tsx ← Payment review + confirm/reject
│   │   │   │   │   ├── settings/
│   │   │   │   │   │   ├── page.tsx      ← Admin settings hub
│   │   │   │   │   │   ├── PlanSettingsForm.tsx     ← Plan pricing/limits editor
│   │   │   │   │   │   └── PaymentSettingsForm.tsx  ← Payment methods (bKash/Nagad/Rocket/Paddle)
│   │   │   │   │   ├── support/page.tsx
│   │   │   │   │   ├── emails/page.tsx
│   │   │   │   │   ├── knowledge/page.tsx
│   │   │   │   │   ├── backups/page.tsx
│   │   │   │   │   └── audit/page.tsx
│   │   │   │
│   │   │   ├── (widget)/                 ← Embeddable voice+chat widget
│   │   │   │   └── widget/[shopId]/
│   │   │   │       ├── page.tsx          ← Loads shop config, passes autostart + whiteLabel
│   │   │   │       └── WidgetPage.tsx    ← Voice/chat toggle UI, autostart hook
│   │   │   │
│   │   │   ├── (voice)/                  ← Public voice call pages
│   │   │   │   └── v/[slug]/page.tsx     ← Voice link landing page
│   │   │   │
│   │   │   └── api/                      ← All API routes (see API_REFERENCE.md)
│   │   │       ├── voice/
│   │   │       │   ├── save-session/route.ts       ← Save transcript + extract order
│   │   │       │   ├── check-limit/route.ts        ← Usage check + plan duration cap
│   │   │       │   ├── telephony-sync/route.ts     ← All active telephony shops for bridge
│   │   │       │   ├── system-config/route.ts      ← SIP IPs for Asterisk dynamic config
│   │   │       │   ├── transcripts/route.ts        ← List transcripts
│   │   │       │   └── cleanup-transcripts/route.ts ← Auto-delete expired non-order transcripts
│   │   │       ├── widget-chat/route.ts            ← Text chat (Gemini Flash Lite, SSE)
│   │   │       ├── admin/
│   │   │       │   ├── update-settings/route.ts    ← Update platform_settings key
│   │   │       │   ├── set-shop-feature/route.ts   ← Toggle voip/api/white-label
│   │   │       │   ├── set-shop-region/route.ts    ← Set BD/INTL billing region
│   │   │       │   ├── generate-access-link/route.ts ← Magic link for shop owner
│   │   │       │   └── settings/sip-ips/route.ts   ← Manage SIP provider IPs
│   │   │       ├── calendar/
│   │   │       │   ├── connect/route.ts
│   │   │       │   ├── callback/route.ts
│   │   │       │   ├── status/route.ts
│   │   │       │   ├── disconnect/route.ts
│   │   │       │   ├── test/route.ts
│   │   │       │   └── settings/route.ts
│   │   │       ├── v1/                             ← Public REST API (Bearer auth)
│   │   │       │   ├── me/route.ts
│   │   │       │   ├── customers/route.ts + [id]/route.ts
│   │   │       │   ├── orders/route.ts + [id]/route.ts
│   │   │       │   ├── appointments/route.ts + [id]/route.ts
│   │   │       │   ├── products/route.ts + [id]/route.ts
│   │   │       │   ├── knowledge/route.ts          ← WordPress knowledge chunk PUT/DELETE
│   │   │       │   ├── ai/chat/route.ts
│   │   │       │   ├── ai/order/route.ts
│   │   │       │   └── webhooks/route.ts + [id]/route.ts
│   │   │       ├── voice-links/setup/route.ts
│   │   │       ├── backup/create/route.ts + cron/route.ts
│   │   │       ├── api-keys/route.ts
│   │   │       └── training/extract-website/route.ts
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx           ← Desktop sidebar (collapsible Platform & Tools)
│   │   │   │   └── BottomNav.tsx         ← Mobile bottom nav (primary tabs + More sheet)
│   │   │   └── common/
│   │   │       └── PageHeader.tsx        ← Page title + description + docs link
│   │   │
│   │   ├── lib/
│   │   │   ├── nav-items.ts              ← BUSINESS_NAV + PLATFORM_NAV + isNavItemActive()
│   │   │   ├── category-nav.ts           ← getCategoryNav(): label mappings per category
│   │   │   ├── categories.config.ts      ← CATEGORIES_CONFIG: all 11 category definitions
│   │   │   ├── prompt-layers.ts          ← DEFAULT_CATEGORY_PROMPTS: AI prompts per category
│   │   │   ├── platform-types.ts         ← Client-safe types: PaymentMethod, PlatformPlan, methodsForRegion()
│   │   │   ├── platform-settings.ts      ← Server-only: getPlatformSettings(), updatePlatformSetting()
│   │   │   ├── widget-training.ts        ← buildTrainingData(): shared builder for voice widget context
│   │   │   ├── admin-session.ts          ← Admin PIN session helpers
│   │   │   ├── version.ts                ← APP_VERSION, BUILD_NUMBER constants
│   │   │   ├── utils.ts                  ← cn() tailwind merge helper
│   │   │   └── supabase/
│   │   │       ├── client.ts             ← Browser Supabase client
│   │   │       └── server.ts             ← Server Supabase client (cookies)
│   │   │
│   │   ├── modules/
│   │   │   └── auth/
│   │   │       └── actions.ts            ← signIn, signUp, signOut, createShop, Google OAuth
│   │   │
│   │   └── public/
│   │       ├── embed.js                  ← Embeddable widget script (bubble + iframe)
│   │       ├── kotha-logo.png            ← 192px logo
│   │       └── favicon.png              ← 64px favicon
│   │
│   └── voice-server/
│       └── src/
│           ├── index.ts                  ← WS server entry, route handling, CORS
│           ├── sessions/
│           │   ├── manager.ts            ← Session lifecycle: 90s chunks, 40s timeout, off-topic, farewell
│           │   └── types.ts              ← SessionConfig type (shopId, apiKey, whiteLabel, etc.)
│           └── gemini/
│               └── client.ts            ← Gemini Live API: buildSystemInstruction(), startLiveSession(), summarizeTranscript()
│
├── scratch/
│   └── bridge.js                         ← Asterisk ↔ Voice Server bridge (SCP to VPS manually)
│
├── supabase/
│   └── migrations/                       ← 001–018 ordered SQL migrations
│
├── wordpress-plugin/
│   ├── kothabot-connect/                 ← Plugin source
│   │   ├── kothabot-connect.php          ← Bootstrap + loader
│   │   ├── includes/
│   │   │   ├── class-kothabot-client.php           ← HTTP client, Bearer auth, 429 backoff
│   │   │   ├── class-kothabot-product-sync.php     ← WooCommerce product hooks + batch cron
│   │   │   ├── class-kothabot-order-sync.php       ← WC order → KothaBot (loop guard)
│   │   │   ├── class-kothabot-knowledge-sync.php   ← Page content + Elementor fallback
│   │   │   ├── class-kothabot-widget.php           ← wp_footer embed.js injection
│   │   │   ├── class-kothabot-webhook-receiver.php ← HMAC verify, order.created→WC
│   │   │   └── class-kothabot-amelia-sync.php      ← Amelia↔KothaBot two-way sync
│   │   └── admin/
│   │       └── class-kothabot-settings.php         ← WP admin settings page
│   └── kothabot-connect.zip              ← Ready-to-install plugin zip
│
└── docs/
    └── architecture/                     ← This documentation
```

---

## Key File Notes

### `proxy.ts` vs `middleware.ts`
Next.js 16 uses `proxy.ts` for middleware-style route rewrites. Having both `proxy.ts` and `middleware.ts` crashes the compiler. KothaBot uses `proxy.ts` only.

### `bridge.js`
Source is tracked in git at `scratch/bridge.js` but is **NOT** automatically deployed. After editing, manually SCP to VPS:
```bash
sshpass -p 'Allah7570#' scp scratch/bridge.js root@163.128.144.171:/var/www/bridge/bridge.js
pm2 restart kothabot-bridge
```

### `embed.js`
Served as a static public file. Injects an iframe bubble into merchant websites. Appends `?autostart=1` to trigger immediate voice connection on click. Uses `NEXT_PUBLIC_APP_URL` at build time.

### `widget-training.ts`
Shared builder called by both the dashboard layout (server component) and `/api/voice/widget-context` (lazy-load endpoint). Assembles training data, FAQ, products, and knowledge chunks into a single context string for Gemini.
