// ── Message types: Browser → Voice Server ──────────────────────────────────
export type ClientMessage =
  | { type: 'START_SESSION'; shopId: string; config: SessionConfig }
  | { type: 'AUDIO_CHUNK'; data: string } // base64 PCM 16-bit 16kHz mono
  | { type: 'END_SESSION' };

// ── Message types: Voice Server → Browser ──────────────────────────────────
export type ServerMessage =
  | { type: 'SESSION_READY'; sessionId: string }
  | { type: 'AUDIO_CHUNK'; data: string }   // base64 PCM for playback
  | { type: 'TRANSCRIPT'; role: 'user' | 'assistant'; text: string; final: boolean }
  | { type: 'SESSION_ENDED'; duration: number; transcript: TranscriptEntry[]; shopId: string; endReason: SessionEndReason; offTopicCount: number }
  | { type: 'CHUNK_RESET' }                 // notifies UI that session was chunked
  | { type: 'ERROR'; code: string; message: string };

// ── Session configuration sent from browser ────────────────────────────────
export interface SessionConfig {
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede'; // Gemini voice names
  language?: 'bn' | 'en' | 'auto';
  shopName?: string;
  systemPrompt?: string;
  greetingMessage?: string;
  themeColor?: string;
  /** Admin-configurable Gemini model override, e.g. 'models/gemini-3.1-flash-live-preview' */
  aiModel?: string;
  /** Training data (FAQs, product info) injected into system prompt */
  trainingData?: string;
  /** Which customer fields to collect during order */
  collectFields?: {
    name:    boolean;
    phone:   boolean;
    address: boolean;
  };
  /** Shop category — drives category-specific collection rules */
  category?: 'restaurant' | 'retail' | 'salon' | 'clinic' | 'pharmacy' | 'grocery' | 'services' | 'other';
  /** Layer 3: category-specific prompt fetched from DB. When present, replaces hardcoded category rules. */
  categoryRules?: string;
  /** Hard cap on a single call's duration in seconds (clamped 60–900). Defaults to 300 (5 min). */
  maxCallSeconds?: number;
  /** Subscription plan id — drives duration cap (trial=180, starter=300, pro=480, business=720) */
  planId?: string;
  /**
   * Session origin. Determines where the transcript is saved from.
   *   - 'widget'     → browser hook handles save-session POST (default; existing behaviour)
   *   - 'voice_link' → browser handles save-session POST
   *   - 'phone'      → voice-server POSTs save-session itself on endSession (no browser involved)
   */
  source?: 'widget' | 'voice_link' | 'phone';
  /** When true, AI never mentions KothaBot and identifies as the business's own assistant. */
  whiteLabel?: boolean;
  /** Original DID for phone-call sessions (e.g. "9644840050"). Used as caller_did in DB. */
  callerDid?: string;
}

// ── Session end reasons (sent back to browser for analytics) ───────────────
export type SessionEndReason =
  | 'completed'           // normal farewell / user goodbye
  | 'off_topic_limit'     // 3 off-topic strikes
  | 'time_limit'          // hard duration cap
  | 'user_requested_end'  // user clicked end button
  | 'silence_timeout'     // inactivity timeout
  | 'system_end'          // reconnect failed / error
  | 'ws_disconnected';    // browser closed

// ── Internal session state ──────────────────────────────────────────────────
export interface VoiceSession {
  id: string;
  shopId: string;
  config: SessionConfig;
  startedAt: number;
  lastActivityAt: number;
  chunkCount: number;                          // how many 90s chunks so far
  conversationSummary: string;                 // rolling summary for chunking
  transcript: TranscriptEntry[];
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}
