import { aeskw } from "@noble/ciphers/aes.js";

// celld's crypto.subtle has no AES-KW (denoland/celld#295): importing an
// AES-KW key throws NotSupportedError. @cloudflare/workers-oauth-provider wraps
// every grant's encryption key with an AES-KW key derived from the token, so
// without this every MCP sign-in on the Docker edition fails with a 500 at
// POST /api/oauth/consent. The fallback is RFC 3394 itself, so keys wrapped
// here unwrap byte-for-byte with a native AES-KW once celld ships one. Every
// other algorithm and format goes straight to the native implementation.

// An imported AES-KW key is a native AES-GCM key of the same bytes (celld
// accepts those), used only as a handle for the raw bytes kept here.
const kwKeyBytes = new WeakMap<CryptoKey, Uint8Array>();

function isAesKw(algorithm: unknown) {
  const name =
    typeof algorithm === "object" && algorithm !== null && "name" in algorithm
      ? algorithm.name
      : algorithm;
  return typeof name === "string" && name.toUpperCase() === "AES-KW";
}

function toBytes(data: BufferSource) {
  return ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice()
    : new Uint8Array(data).slice();
}

export function installAesKwFallback() {
  const subtle = crypto.subtle;
  const nativeImportKey = subtle.importKey.bind(subtle);
  const nativeWrapKey = subtle.wrapKey.bind(subtle);
  const nativeUnwrapKey = subtle.unwrapKey.bind(subtle);

  async function importKey(...args: Parameters<SubtleCrypto["importKey"]>) {
    const [format, keyData, algorithm] = args;
    if (format !== "raw" || !isAesKw(algorithm))
      return nativeImportKey(...args);
    const bytes = toBytes(keyData);
    const handle = await nativeImportKey("raw", bytes, "AES-GCM", false, [
      "encrypt",
    ]);
    kwKeyBytes.set(handle, bytes);
    return handle;
  }

  async function wrapKey(...args: Parameters<SubtleCrypto["wrapKey"]>) {
    const [format, key, wrappingKey, wrapAlgorithm] = args;
    const kek = kwKeyBytes.get(wrappingKey);
    if (!kek || format !== "raw" || !isAesKw(wrapAlgorithm)) {
      return nativeWrapKey(...args);
    }
    const raw = new Uint8Array(await subtle.exportKey("raw", key));
    return new Uint8Array(aeskw(kek).encrypt(raw)).buffer;
  }

  async function unwrapKey(...args: Parameters<SubtleCrypto["unwrapKey"]>) {
    const [
      format,
      wrappedKey,
      unwrappingKey,
      unwrapAlgorithm,
      unwrappedKeyAlgorithm,
      extractable,
      keyUsages,
    ] = args;
    const kek = kwKeyBytes.get(unwrappingKey);
    if (!kek || format !== "raw" || !isAesKw(unwrapAlgorithm)) {
      return nativeUnwrapKey(...args);
    }
    const raw = new Uint8Array(aeskw(kek).decrypt(toBytes(wrappedKey)));
    return nativeImportKey(
      "raw",
      raw,
      unwrappedKeyAlgorithm,
      extractable,
      keyUsages,
    );
  }

  Object.assign(subtle, { importKey, wrapKey, unwrapKey });
}
