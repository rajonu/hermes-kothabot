# AI System

---

## Overview

KothaBot uses Google Gemini for three AI functions:

| Function | Model | Delivery |
|---|---|---|
| Voice calls | Gemini 2.5 Flash Live | Real-time bidirectional WebSocket audio |
| Text chat | Gemini 2.5 Flash Lite | Server-Sent Events (SSE) streaming |
| Data extraction | Gemini 2.5 Flash Lite | REST, one-shot |

---

## 4-Layer Prompt System

Every AI interaction is built from four context layers, assembled in `buildSystemInstruction()` in `apps/voice-server/src/gemini/client.ts` (for voice) and inline in `/api/widget-chat/route.ts` (for text chat).

```
Layer 1: Global Rules
  Platform-wide safety and behavior rules (from platform_settings['global_ai_rules'])
  Applied to ALL shops regardless of category

Layer 2: Business Profile
  Shop name, language preference, custom system prompt set by the merchant

Layer 3: Category Rules
  DEFAULT_CATEGORY_PROMPTS[category] — order/booking collection instructions
  Specific to the shop's business type

Layer 4: Knowledge Base
  buildTrainingData() output:
  - Knowledge chunks (website extraction) — highest priority, loaded first
  - Manual training data (FAQ, info, policy)
  - Product/service catalog
```

### White-Label Identity Injection
When `shop.ai_config.white_label = true`, an additional identity rule is prepended:
> "You are [Business Name]'s AI assistant. You are NOT KothaBot, NOT Google, NOT Gemini. Never reveal the underlying AI technology."

---

## Voice Server Architecture

**Entry point:** `apps/voice-server/src/index.ts`

```
WebSocket connection → authenticate (shopId + apiKey headers)
                    → load SessionConfig from Next.js web app
                    → startLiveSession() with Gemini Live API
                    → bidirectional audio stream loop
                    → on disconnect/timeout → POST /api/voice/save-session
```

### Session Config (`types.ts`)
```typescript
interface SessionConfig {
  shopId:        string;
  apiKey:        string;       // Gemini API key
  shopName:      string;
  category:      string;
  systemPrompt:  string;       // Merchant's custom prompt
  language:      string;       // 'bn', 'en', 'auto'
  trainingData:  string;       // Full knowledge base context
  whiteLabel:    boolean;
  planDuration:  number;       // Max seconds (plan-based cap)
  callLimit:     number;       // Remaining calls this period
}
```

### Session Lifecycle (90-second chunking)

Gemini Live sessions have an internal context window limit. To handle long calls:

1. Every **90 seconds**, `doChunk()` is called
2. `summarizeTranscript()` sends the current transcript to Gemini Flash Lite for a 3-sentence summary
3. A new Gemini Live session starts with the summary prepended to Layer 4
4. `isFirstConnection=false` prevents the greeting from replaying
5. The call continues seamlessly from the user's perspective

### Inactivity & Termination

| Trigger | Action |
|---|---|
| 40 seconds of silence | Session ends, `end_reason='inactivity'` |
| 3 off-topic violations | Session ends, `end_reason='off_topic_limit'` |
| Plan duration cap reached | Session ends, `end_reason='plan_limit'` |
| Farewell detected | Session ends gracefully, `end_reason='completed'` |

---

## Voice Cost Protection (AI Abuse Shield)

### Off-Topic Detection
The AI is instructed to respond to off-topic requests with a refusal phrase. The voice server detects these phrases in AI output via `OFF_TOPIC_REFUSAL_PATTERNS` (Bangla + English patterns). On 3 violations, the session ends.

Logged as `off_topic_count` on the `voice_sessions` row.

### Plan-Based Duration Caps

| Plan | Max Call Duration |
|---|---|
| Trial | 3 minutes (180s) |
| Starter | 5 minutes (300s) |
| Pro | 8 minutes (480s) |
| Business | 12 minutes (720s) |

Fetched from `platform_settings['plans']` via `/api/voice/check-limit`.

### Usage Limits
`/api/voice/check-limit` also enforces the plan's `call_limit` (total calls per billing period). `-1` = unlimited.

---

## Telephony Voice Flow (SIP Calls)

```
Phone → SIP Provider → Asterisk PBX
  → extensions.conf: Audiosocket(DID_UUID, 127.0.0.1:9092)
  → bridge.js (TCP port 9092)
    - Receives 8kHz G.711 audio frames from Asterisk
    - Upcales to 24kHz PCM (linear interpolation)
    - Applies noise gate (silence threshold)
    - Sends to Voice Server via WebSocket
  → Voice Server → Gemini Live API
  → AI response audio
    - Sent back to bridge.js
    - Downscaled 24kHz→8kHz
    - Sent to Asterisk
  → Asterisk → Phone
```

### DID Matching
bridge.js strips leading zeros from the DID: `09644840050` → `9644840050`. Matched against `shops.ai_config.telephony.did`.

### Telephony Config Sync
bridge.js polls `GET /api/voice/telephony-sync` every 5 minutes. Returns all shops with `ai_config.telephony.status = 'active'`. Bearer token auth (`GATEWAY_TOKEN`).

---

## Text Chat (`/api/widget-chat`)

- Gemini 2.5 Flash Lite (non-real-time)
- Same 4-layer prompt system
- White-label identity rule injected when `white_label=true`
- Returns SSE stream (`text/event-stream`)
- Fires `order.created` / `appointment.created` webhooks when AI extracts an order

---

## Website Extraction (`/api/training/extract-website`)

1. Fetch URL content (server-side fetch)
2. Strip HTML, extract body text
3. Send to Gemini Flash Lite with extraction prompt:
   > "Extract all business-relevant information: services, prices, FAQs, policies, contact info, hours..."
4. Parse structured response → create `knowledge_chunks` rows

WordPress pages using Elementor: content fetched from permalink URL → full HTML → text stripped (same extraction pipeline).

---

## Session Analytics

All session terminations are logged to `voice_sessions`:

| Field | Values |
|---|---|
| `end_reason` | `completed`, `inactivity`, `off_topic_limit`, `plan_limit` |
| `off_topic_count` | 0–3 |
| `duration_seconds` | Actual call length |
| `order_linked` | Whether an order was extracted |

Displayed in `/analytics` page with breakdown cards.
