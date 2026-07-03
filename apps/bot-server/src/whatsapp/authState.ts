import {
  initAuthCreds,
  BufferJSON,
  proto,
  type AuthenticationState,
  type AuthenticationCreds,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";
import { supabase } from "../supabase";
import { encryptSecret, decryptSecret } from "../crypto";

/**
 * DB-backed replacement for Baileys' `useMultiFileAuthState` (which persists to
 * local disk — unusable on Railway because containers are ephemeral and would
 * force a fresh QR scan on every redeploy).
 *
 * Storage shape: `clients_channels.wa_session_data` (jsonb) for
 * `(shop_id = shopId, channel_type = 'whatsapp')` stores a JSON object
 * `{ blob: string }` where `blob` is the AES-256-GCM-encrypted (see crypto.ts)
 * serialization of `{ creds, keys }`, where `keys` is a plain object keyed by
 * `${category}-${id}` (mirroring useMultiFileAuthState's per-file naming) and
 * `creds`/`keys` are serialized with `JSON.stringify(data, BufferJSON.replacer)`
 * so Buffers round-trip correctly. We keep the *whole* blob (creds + all signal
 * keys) in memory per shop and rewrite the entire blob to the DB on every
 * `keys.set()` / `saveCreds()` call — simplest correct approach given Baileys'
 * SignalKeyStore interface (see node_modules/@whiskeysockets/baileys/lib/Utils/
 * use-multi-file-auth-state.js for the file-based reference implementation this
 * mirrors).
 */

type KeysBlob = Record<string, any>;

interface PersistedAuth {
  creds: AuthenticationCreds;
  keys: KeysBlob;
}

function keyId(type: string, id: string): string {
  return `${type}-${id}`;
}

async function loadPersistedAuth(shopId: string): Promise<PersistedAuth | null> {
  const { data, error } = await supabase
    .from("clients_channels")
    .select("wa_session_data")
    .eq("shop_id", shopId)
    .eq("channel_type", "whatsapp")
    .maybeSingle();

  if (error) {
    console.error(`[authState] failed to load session for shop ${shopId}:`, error.message);
    return null;
  }

  const raw = data?.wa_session_data as { blob?: string } | null | undefined;
  if (!raw?.blob) return null;

  try {
    const decrypted = decryptSecret(raw.blob);
    const parsed = JSON.parse(decrypted, BufferJSON.reviver) as PersistedAuth;
    return parsed;
  } catch (err: any) {
    console.error(`[authState] failed to decrypt/parse session for shop ${shopId}:`, err.message);
    return null;
  }
}

async function persistAuth(shopId: string, auth: PersistedAuth): Promise<void> {
  const serialized = JSON.stringify(auth, BufferJSON.replacer);
  const encrypted = encryptSecret(serialized);

  const { error } = await supabase
    .from("clients_channels")
    .upsert(
      {
        shop_id: shopId,
        channel_type: "whatsapp",
        wa_session_data: { blob: encrypted },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shop_id,channel_type" }
    );

  if (error) {
    console.error(`[authState] failed to persist session for shop ${shopId}:`, error.message);
  }
}

export async function getAuthState(
  shopId: string
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const existing = await loadPersistedAuth(shopId);

  const creds: AuthenticationCreds = existing?.creds ?? initAuthCreds();
  const keysBlob: KeysBlob = existing?.keys ?? {};

  const persist = async (): Promise<void> => {
    await persistAuth(shopId, { creds, keys: keysBlob });
  };

  // ponytail: Baileys fires keys.set() dozens of times in a burst during
  // initial pairing (one per pre-key), each call rewrites the whole blob —
  // without debouncing this floods Postgres with concurrent upserts on the
  // same row and they start timing out. Coalesce bursts into one write.
  let pendingPersist: Promise<void> | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedPersist = (): Promise<void> => {
    if (!pendingPersist) {
      pendingPersist = new Promise((resolve) => {
        persistTimer = setTimeout(() => {
          persistTimer = null;
          pendingPersist = null;
          persist().then(resolve);
        }, 300);
      });
    }
    return pendingPersist;
  };

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const result: { [id: string]: SignalDataTypeMap[T] } = {};
        for (const id of ids) {
          let value = keysBlob[keyId(type, id)];
          if (type === "app-state-sync-key" && value) {
            // Mirrors useMultiFileAuthState: app-state-sync-key needs to be
            // rehydrated into a proto message, not left as a plain object.
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }
          if (value !== undefined && value !== null) {
            result[id] = value;
          }
        }
        return result;
      },
      set: async (data) => {
        for (const category in data) {
          const categoryData = (data as any)[category];
          for (const id in categoryData) {
            const value = categoryData[id];
            const k = keyId(category, id);
            if (value) {
              keysBlob[k] = value;
            } else {
              delete keysBlob[k];
            }
          }
        }
        await debouncedPersist();
      },
    },
  };

  const saveCreds = async (): Promise<void> => {
    await persist();
  };

  return { state, saveCreds };
}

/** Clears the persisted session (e.g. after a logout / loggedOut disconnect). */
export async function clearAuthState(shopId: string): Promise<void> {
  const { error } = await supabase
    .from("clients_channels")
    .update({ wa_session_data: null, is_active: false, updated_at: new Date().toISOString() })
    .eq("shop_id", shopId)
    .eq("channel_type", "whatsapp");

  if (error) {
    console.error(`[authState] failed to clear session for shop ${shopId}:`, error.message);
  }
}
