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

/** The fingerprint in a URL fragment such as `#k=…`, or null when the link has none. */
export function fingerprintFromHash(hash: string): string | null {
  return /(?:^#|&)k=([0-9a-f]{32})(?:&|$)/.exec(hash)?.[1] ?? null;
}
