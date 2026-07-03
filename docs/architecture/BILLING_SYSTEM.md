# Billing System

---

## Plans

Four tiers configured via god admin → Settings → Plans (stored in `platform_settings['plans']`).

| Plan | Default Price (BDT) | Default Call Limit | Period |
|---|---|---|---|
| Trial | Free | 20 calls | 14 days |
| Starter | ৳999/mo | 100 calls | 30 days |
| Pro | ৳1,999/mo | 300 calls | 30 days |
| Business | ৳4,999/mo | Unlimited (-1) | 30 days |

### PlatformPlan Type (`lib/platform-types.ts`)
```typescript
interface PlatformPlan {
  name:       string;
  price:      number;        // BDT amount
  price_usd?: number;        // USD in cents
  period_days: number;
  call_limit:  number;       // -1 = unlimited
  features:   string[];      // Feature bullet points
  ls_checkout_url?: string;  // Paddle checkout URL (INTL)
}
```

---

## Billing Regions

Each shop has a `billing_region` in `shops.ai_config`:
- `BD` — Bangladesh users, BDT pricing, local payment methods
- `INTL` — International users, USD pricing, Paddle

Region is set at signup (IP geo-detection) and can be overridden by god admin.

---

## Payment Methods

Configured via god admin → Settings → Payment Methods (stored in `platform_settings['payment_methods']`).

### PaymentMethod Type (`lib/platform-types.ts`)
```typescript
interface PaymentMethod {
  id:           PaymentMethodId;
  name:         string;
  enabled:      boolean;
  regions:      ('BD' | 'INTL')[];
  phone?:       string;       // For manual methods (bKash etc.)
  qr_url?:      string | null;
  checkout_url?: string | null; // For Paddle
}

type PaymentMethodId = 'bkash' | 'nagad' | 'rocket' | 'paddle';
```

### `methodsForRegion(methods, region)`
Filters payment methods to only those enabled for a given region:
```typescript
function methodsForRegion(methods: PaymentMethod[], region: 'BD' | 'INTL'): PaymentMethod[] {
  return methods.filter(m => m.enabled && m.regions.includes(region));
}
```

### Default Methods
| Method | Regions | Type |
|---|---|---|
| bKash | BD | Manual (phone + screenshot) |
| Nagad | BD | Manual (phone + screenshot) |
| Rocket | BD | Manual (phone + screenshot) |
| Paddle | INTL | External checkout redirect |

---

## Payment Flow

### BD (Manual Payment)
1. User selects plan → `PaymentModal` opens
2. If multiple methods: choose step (bKash / Nagad / Rocket)
3. Payment step: shows provider phone number + optional QR code
4. User sends money externally, enters transaction ID
5. `POST /api/billing/submit-payment` → creates `payments` row with `status=pending`
6. God admin reviews at `/admin/payments` → clicks Confirm or Reject
7. On confirm: `subscriptions` updated, user's access restored

### INTL (Paddle)
1. User selects plan → `PaymentModal` opens
2. Redirects to Paddle checkout URL (configured per plan in `ls_checkout_url`)
3. Paddle handles payment → webhook → subscription update (webhook not yet implemented — manual confirm by admin)

---

## Subscription Lockout

**Trigger:** `subscriptions.status = 'past_due'`

Effects:
- Dashboard layout detects `past_due` → redirects all routes to `/billing`
- Widget shows padlock screen (no AI access)
- `/api/voice/check-limit` returns 403 → voice calls blocked
- All public API v1 routes return 402 if subscription is past_due

**Recovery:** God admin confirms payment → status set to `active` → immediate access restored.

---

## Admin Billing UI

### Payment Review (`/admin/payments`)
Lists all pending payments. Admin sees:
- Shop name
- Plan requested
- Amount + transaction ID
- Payment method
- "Confirm" button → updates payment status + activates subscription
- "Reject" button → marks payment rejected, notifies merchant

### Plan Settings (`/admin/settings`)
`PlanSettingsForm` — collapsible cards for each plan:
- Edit name, period, call limit
- BDT price + USD price (cents)
- Lemon Squeezy / Paddle checkout URL
- Feature bullet points (add/remove)
- "Save Plan Settings" → `POST /api/admin/update-settings` with `key='plans'`

### Payment Settings (`/admin/settings`)
`PaymentSettingsForm` — 4 method cards:
- Enable/disable toggle
- Region pills (🇧🇩 BD / 🌍 Global) — toggle which regions see this method
- bKash/Nagad/Rocket: phone number + QR URL fields
- Paddle: checkout URL field

---

## Days Remaining Display

Subscription `expires_at` is shown in Sidebar footer and BottomNav More-sheet:
- Active paid sub: "Xd until renewal"
- Trial / inactive: "Xd remaining"
- `daysLeft = null`: "Active" / "Free trial"

Calculated in dashboard layout from `subscriptions.expires_at`.
