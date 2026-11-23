import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { fromBase64, toBase64 } from "../src/bytes";
import { fingerprintFromHash, kemFingerprint, paymentLink } from "../src/link";

test("toBase64 handles a 300 KB vault, where a spread overflows the stack", () => {
  const bytes = Uint8Array.from({ length: 300_000 }, (_, i) => i % 251);
  const text = toBase64(bytes);
  expect(text).toBe(Buffer.from(bytes).toString("base64"));
  expect(fromBase64(text)).toEqual(bytes);
});

test("the payment link carries the first 16 bytes of SHA-256 of the KEM key", async () => {
  const key = Uint8Array.from({ length: 1568 }, (_, i) => (i * 7) % 256);
  const expected = createHash("sha256").update(key).digest("hex").slice(0, 32);
  expect(await kemFingerprint(key)).toBe(expected);
  expect(await paymentLink("https://bellaso.vercel.app", "qor1abc", key)).toBe(`https://bellaso.vercel.app/pay/qor1abc#k=${expected}`);
});

test("fingerprintFromHash reads only a well-formed k", () => {
  expect(fingerprintFromHash(`#k=${"ab".repeat(16)}`)).toBe("ab".repeat(16));
  expect(fingerprintFromHash(`#x=1&k=${"0f".repeat(16)}`)).toBe("0f".repeat(16));
  expect(fingerprintFromHash("")).toBeNull();
  expect(fingerprintFromHash("#k=short")).toBeNull();
  expect(fingerprintFromHash(`#k=${"AB".repeat(16)}`)).toBeNull();
});
