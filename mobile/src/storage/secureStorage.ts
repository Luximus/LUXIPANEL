/**
 * Thin wrapper over `expo-secure-store` (iOS Keychain / Android Keystore) used to
 * persist SENSITIVE values (session JWT, panel metadata referencing SSH keys)
 * outside of plain-text AsyncStorage.
 *
 * SecureStore values have a platform size limit (~2KB on Android). For larger
 * payloads we transparently segment the string across numbered chunk keys and
 * persist a small manifest describing how many chunks exist, so callers can keep
 * storing arbitrary JSON without worrying about the limit.
 */
import * as SecureStore from "expo-secure-store";

/**
 * Conservative per-value budget. Android's Keystore-backed SecureStore warns
 * past ~2048 bytes; we stay well under to leave room for UTF-8 multi-byte chars.
 */
const CHUNK_SIZE = 1536;
const MANIFEST_SUFFIX = "__manifest";

function chunkKey(key: string, index: number): string {
  return `${key}__${index}`;
}

function manifestKey(key: string): string {
  return `${key}${MANIFEST_SUFFIX}`;
}

/**
 * SecureStore keys must match [A-Za-z0-9._-]. Our storage keys use ":" as a
 * scope separator, so normalise to a safe, collision-free form.
 */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

export async function secureGetItem(rawKey: string): Promise<string | null> {
  const key = safeKey(rawKey);
  try {
    const manifest = await SecureStore.getItemAsync(manifestKey(key));
    if (!manifest) {
      // No manifest => either absent or a small single-value entry.
      return await SecureStore.getItemAsync(key);
    }
    const count = Number.parseInt(manifest, 10);
    if (!Number.isFinite(count) || count <= 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      if (part == null) return null; // corrupted / partial write
      parts.push(part);
    }
    return parts.join("");
  } catch {
    return null;
  }
}

export async function secureSetItem(rawKey: string, value: string): Promise<void> {
  const key = safeKey(rawKey);
  try {
    // Clean any previous representation (single value or older chunk set).
    await secureRemoveItem(rawKey);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
    }
    await SecureStore.setItemAsync(manifestKey(key), String(chunks.length));
  } catch {
    /* ignore: best-effort persistence, mirrors AsyncStorage callers */
  }
}

export async function secureRemoveItem(rawKey: string): Promise<void> {
  const key = safeKey(rawKey);
  try {
    await SecureStore.deleteItemAsync(key);
    const manifest = await SecureStore.getItemAsync(manifestKey(key));
    if (manifest) {
      const count = Number.parseInt(manifest, 10);
      if (Number.isFinite(count)) {
        for (let i = 0; i < count; i += 1) {
          await SecureStore.deleteItemAsync(chunkKey(key, i));
        }
      }
      await SecureStore.deleteItemAsync(manifestKey(key));
    }
  } catch {
    /* ignore */
  }
}
