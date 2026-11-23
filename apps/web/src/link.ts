/**
 * The fingerprint of an ML-KEM-1024 public key: the first 16 bytes of its SHA-256, in hex. A
 * payment link carries it in the URL fragment, which the browser never sends to a server.
 */
export async function kemFingerprint(kemPublicKey: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(kemPublicKey)));
  return Array.from(digest.subarray(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * The payment link of a recipient. The fingerprint lets the payer check that the gateway sent
 * the recipient's real encryption key, so a dishonest gateway cannot swap it (THREAT_MODEL R18).
 */
export async function paymentLink(origin: string, address: string, kemPublicKey: Uint8Array): Promise<string> {
  return `${origin}/pay/${address}#k=${await kemFingerprint(kemPublicKey)}`;
}

/** An amount that the recipient asks for: the decimal text and the token symbol, as the pay page shows them. */
export interface PaymentRequest {
  amount: string;
  symbol: string;
}

/**
 * `link` with the request in its fragment as `a=` and `t=`, or without one for null. The fragment
 * stays in the browser, so the gateway does not learn the amount before the payment is on chain.
 */
export function withRequest(link: string, request: PaymentRequest | null): string {
  const [base = "", hash = ""] = link.split("#");
  const parts = hash.split("&").filter((part) => part.length > 0 && !/^[at]=/.test(part));
  if (request) parts.push(`a=${request.amount}`, `t=${request.symbol}`);
  return parts.length > 0 ? `${base}#${parts.join("&")}` : base;
}

/** The request in a URL fragment, or null when the amount or the token is missing or not well-formed. */
export function requestFromHash(hash: string): PaymentRequest | null {
  const amount = /(?:^#|&)a=(\d{1,12}(?:\.\d{1,18})?)(?:&|$)/.exec(hash)?.[1];
  const symbol = /(?:^#|&)t=([A-Za-z]{2,8})(?:&|$)/.exec(hash)?.[1];
  return amount && symbol ? { amount, symbol } : null;
}

/** The fingerprint in a URL fragment such as `#k=…`, or null when the link has none. */
export function fingerprintFromHash(hash: string): string | null {
  return /(?:^#|&)k=([0-9a-f]{32})(?:&|$)/.exec(hash)?.[1] ?? null;
}
