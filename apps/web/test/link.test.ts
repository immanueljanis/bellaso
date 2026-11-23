import { createHash } from "node:crypto";
import { expect, test } from "bun:test";
import { fromBase64, toBase64 } from "../src/bytes";
import { fingerprintFromHash, kemFingerprint, paymentLink, requestFromHash, withRequest } from "../src/link";

test("a payment link carries a requested amount in the fragment and keeps the fingerprint", () => {
  const link = `https://bellaso.vercel.app/pay/qor1abc#k=${"ab".repeat(16)}`;
  const asked = withRequest(link, { amount: "150.5", symbol: "fUSD" });
  expect(asked).toBe(`${link}&a=150.5&t=fUSD`);
  expect(fingerprintFromHash(new URL(asked).hash)).toBe("ab".repeat(16));
  expect(requestFromHash(new URL(asked).hash)).toEqual({ amount: "150.5", symbol: "fUSD" });
  expect(withRequest(asked, { amount: "80", symbol: "fETH" })).toBe(`${link}&a=80&t=fETH`);
  expect(withRequest(asked, null)).toBe(link);
});

test("requestFromHash refuses a request that is not a plain amount and a token symbol", () => {
  expect(requestFromHash("#k=abc")).toBeNull();
  expect(requestFromHash("#a=150")).toBeNull();
  expect(requestFromHash("#a=-5&t=fUSD")).toBeNull();
  expect(requestFromHash("#a=1e9&t=fUSD")).toBeNull();
  expect(requestFromHash("#a=150&t=<b>")).toBeNull();
});

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
