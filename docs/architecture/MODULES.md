# Modules

Feature-by-feature breakdown of the KothaBot application.

---

## Auth Module

**Files:** `app/(auth)/`, `modules/auth/actions.ts`, `app/auth/callback/route.ts`, `lib/admin-session.ts`

### Client Auth (Supabase)
- **Email/password** — `signIn()` / `signUp()` in `actions.ts`. On register, calls `createShop()` to create the tenant record.
- **Google OAuth** — `signInWithGoogle()` triggers Supabase provider flow. Callback at `app/auth/callback/route.ts` exchanges code for session → redirects `/dashboard`.
- **Magic link (admin use)** — `POST /api/admin/generate-access-link` → Supabase magic link URL. Login page handles `#access_token=` hash via `setSession()` in `useEffect`.
- **Sign out** — `signOut()` server action, clears session, redirects `/login`.

### Admin Auth (PIN)
- Separate from Supabase. PIN stored in `ADMIN_PIN` env var.
- Login at `/admin-login` sets a cookie via `lib/admin-session.ts`.
- All admin API routes call `requireAdminSession()` to verify the cookie.
- Admin layout.tsx calls `requireAdminSession()` for page auth.
- **Critical:** Never use Supabase user auth in admin routes. The god admin is not a Supabase user.

### Region Detection at Signup
`createShop()` in `actions.ts` geo-detects visitor IP → sets `billing_region` (`BD` or `INTL`) on the shop record. Fallback: `BD` if detection fails.

---

## Dashboard Module

**Files:** `app/(dashboard)/`

### Layout (`layout.tsx`)
Runs 3 query waves on every navigation:
1. `supabase.auth.getUser()` — identity check
2. `shops` query with explicit columns (no `select('*')`)
3. 6 parallel count queries: orders, customers, products, voice_sessions (today), voice_sessions (all), subscriptions

Passes counts down as props to `Sidebar` and `BottomNav`. Widget context (training data) lazy-loads via `/api/voice/widget-context` when call button is pressed.

### Navigation
- **Desktop:** `Sidebar.tsx` — Business modules top-level; "Platform & Tools" collapsible group
- **Mobile:** `BottomNav.tsx` — Primary tabs (Dashboard, Orders, Customers, Analytics, More); More-sheet for everything else
- **Source of truth:** `lib/nav-items.ts` — add one line to add a new nav item to both platforms

### Key Pages
| Page | Role |
|---|---|
| `/dashboard` | Stats overview, recent orders, quick actions |
| `/orders` | Order list with filters; `/orders/[id]` has AI transcript viewer |
| `/customers` | Customer list with search; category-aware labels |
| `/products` | Category-aware product/service CRUD |
| `/leads` | Lead pipeline |
| `/analytics` | Voice session analytics, AI Cost Protection card |
| `/transcripts` | All voice transcripts with modal viewer |
| `/training` | Knowledge Base: manual FAQs + website extraction |
| `/integrations` | All external connections hub |
| `/billing` | Subscription status + payment flow |
| `/voice-links` | Public voice link CRUD |
| `/settings` | General shop settings |
| `/settings/backup` | Backup & restore |

---

## AI System Module

See [AI_SYSTEM.md](AI_SYSTEM.md) for full detail.

**Key files:** `apps/voice-server/src/`, `lib/prompt-layers.ts`, `lib/widget-training.ts`

The AI runs via:
1. **Voice calls** — Gemini 2.5 Flash Live via WebSocket (real-time bidirectional audio)
2. **Text chat** — Gemini 2.5 Flash Lite via SSE streaming (`/api/widget-chat`)
3. **Data extraction** — Gemini 2.5 Flash Lite (`/api/training/extract-website`)

---

## Billing Module

See [BILLING_SYSTEM.md](BILLING_SYSTEM.md) for full detail.

**Key files:** `app/(dashboard)/billing/`, `lib/platform-types.ts`, `lib/platform-settings.ts`

### Subscription Lockout
Shops with `status = 'past_due'` are:
- Redirected to billing page from dashboard layout
- Widget shows padlock screen (no AI access)
- Voice and API calls blocked at `/api/voice/check-limit`

---

## Integrations Module

See [INTEGRATIONS.md](INTEGRATIONS.md) for full detail.

**Key files:** `app/(dashboard)/integrations/`

Integrations page (`/integrations`) has anchor-targeted sections:
- `#google-calendar` — Google Calendar OAuth
- `#api-access` — API keys + webhooks
- Lead Capture toggle
- Website Widget embed code

---

## Admin Module

**Files:** `app/(admin)/`

The god admin panel has full visibility across all shops. Auth is PIN-based (not Supabase).

### Admin Pages
| Page | Role |
|---|---|
| `/admin` | Shop list + BD/Global/Unassigned stats |
| `/admin/shops/[shopId]` | Per-shop: plan, region, feature flags, magic link |
| `/admin/payments` | Payment review + confirm/reject |
| `/admin/settings` | Plans, payment methods, SIP IPs, global AI rules |
| `/admin/support` | Support requests |
| `/admin/emails` | Email logs |
| `/admin/knowledge` | Global knowledge review |
| `/admin/backups` | Backup management |
| `/admin/audit` | Audit log |

### Admin API Routes
All use `requireAdminSession()` — never Supabase auth.

| Route | Action |
|---|---|
| `POST /api/admin/update-settings` | Update platform_settings key |
| `POST /api/admin/set-shop-feature` | Toggle per-shop feature flags |
| `POST /api/admin/set-shop-region` | Set BD/INTL billing region |
| `POST /api/admin/generate-access-link` | Magic link for shop owner |
| `GET/POST /api/admin/settings/sip-ips` | Manage SIP provider IPs |

---

## Voice Widget Module

**Files:** `app/(widget)/widget/[shopId]/`, `public/embed.js`

### embed.js
Injected into merchant sites via a `<script>` tag. Creates a floating bubble button. On click, injects a full-screen iframe pointing to `/widget/{shopId}?mode=voice&autostart=1`.

### WidgetPage.tsx
- Loads shop config server-side
- Passes `autostart={true}` → fires `startCall()` on mount when mode is voice
- White-label prop hides "Powered by KothaBot" footer
- Voice + chat mode toggling

### Voice Connection
Widget WebSocket connects to `NEXT_PUBLIC_VOICE_SERVER_URL` (wss://). Voice server manages Gemini Live session, chunking (90s), inactivity timeout (40s), off-topic detection.

---

## Knowledge Base Module

**Files:** `app/(dashboard)/training/`, `api/training/extract-website/`

### Manual Training Data
Simple Q&A pairs stored in `training_data` table. Types: `faq`, `info`, `policy`.

### Website Extraction
1. Submit URL → creates `knowledge_sources` row with `status=pending`
2. `POST /api/training/extract-website` — fetches URL, passes to Gemini for structured extraction
3. Creates `knowledge_chunks` rows with extracted content
4. `buildTrainingData()` loads all chunks, prepends to AI context

### WordPress Sync
WordPress plugin pushes page content via `PUT /api/v1/knowledge`. Stored as `knowledge_chunks` with `source_type='wordpress'`. Page builder content (Elementor) extracted via permalink fetch + text stripping.

---

## Backup Module

**Files:** `api/backup/`

- Manual: `POST /api/backup/create` — dumps shop data to JSON, uploads to Supabase Storage
- Scheduled: `POST /api/backup/cron` — triggered by external cron, requires `BACKUP_CRON_SECRET`
- Restore: downloads backup JSON, re-imports records

---

## Transcript Module

**Files:** `app/(dashboard)/transcripts/`, `api/voice/`

### Retention Policy
- `order_linked = true` → kept permanently
- `order_linked = false` → auto-deleted after 7 days
- Cleanup: `POST /api/voice/cleanup-transcripts` (cron-triggered, requires `TRANSCRIPT_CLEANUP_SECRET`)

### Viewer
`/transcripts` page shows list of sessions. Modal view shows full conversation. `/orders/[id]` also shows linked transcript inline.
