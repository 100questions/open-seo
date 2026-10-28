import { expect, it } from "vitest";
import { installAesKwFallback } from "@/server/standalone/aes-kw-fallback";

// Node has a native AES-KW; the fallback replaces it, so matching RFC 3394
// here is what keeps grants wrapped on celld readable by a native one later.
installAesKwFallback();

const hex = (value: string) => Uint8Array.from(Buffer.from(value, "hex"));
const kwKey = (bytes: BufferSource) =>
  crypto.subtle.importKey("raw", bytes, { name: "AES-KW" }, false, [
    "wrapKey",
    "unwrapKey",
  ]);

it("wraps to the RFC 3394 vector and only unwraps with the same key", async () => {
  // RFC 3394 section 4.6: 256-bit KEK, 256-bit key data.
  const kek = await kwKey(
    hex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
  );
  const keyData = hex(
    "00112233445566778899aabbccddeeff000102030405060708090a0b0c0d0e0f",
  );
  const key = await crypto.subtle.importKey("raw", keyData, "AES-GCM", true, [
    "encrypt",
  ]);

  const wrapped = await crypto.subtle.wrapKey("raw", key, kek, "AES-KW");
  expect(Buffer.from(wrapped).toString("hex")).toBe(
    "28c9f404c4b810f4cbccb35cfb87f8263f5786e2d80ed326cbc7f0e71a99f43bfb988b9b7a02dd21",
  );

  const unwrapped = await crypto.subtle.unwrapKey(
    "raw",
    wrapped,
    kek,
    "AES-KW",
    "AES-GCM",
    true,
    ["encrypt"],
  );
  expect(
    new Uint8Array(await crypto.subtle.exportKey("raw", unwrapped)),
  ).toEqual(keyData);

  const otherKek = await kwKey(new Uint8Array(32));
  await expect(
    crypto.subtle.unwrapKey(
      "raw",
      wrapped,
      otherKek,
      "AES-KW",
      "AES-GCM",
      true,
      ["encrypt"],
    ),
  ).rejects.toThrow();
});
