export const ANNOUNCEMENT_VERSION = 1;
export const CIPHERTEXT_LENGTH = 1568;
export const ANNOUNCEMENT_LENGTH = 2 + CIPHERTEXT_LENGTH;

export interface Announcement {
  viewTag: number;
  cipherText: Uint8Array;
}

/** Format v1 (TECH_SPEC section 5.1): version byte, view tag byte, ML-KEM-1024 ciphertext. 1,570 bytes. */
export function encodeAnnouncement({ viewTag, cipherText }: Announcement): Uint8Array {
  if (cipherText.length !== CIPHERTEXT_LENGTH) throw new RangeError(`Ciphertext must be ${CIPHERTEXT_LENGTH} bytes`);
  if (!Number.isInteger(viewTag) || viewTag < 0 || viewTag > 255) throw new RangeError("View tag must be one byte");
  const bytes = new Uint8Array(ANNOUNCEMENT_LENGTH);
  bytes[0] = ANNOUNCEMENT_VERSION;
  bytes[1] = viewTag;
  bytes.set(cipherText, 2);
  return bytes;
}

/** Reads format v1. Throws on a wrong length or version, so the scan skips the record set (THREAT_MODEL R16). */
export function decodeAnnouncement(bytes: Uint8Array): Announcement {
  if (bytes.length !== ANNOUNCEMENT_LENGTH) throw new RangeError(`Announcement must be ${ANNOUNCEMENT_LENGTH} bytes, got ${bytes.length}`);
  if (bytes[0] !== ANNOUNCEMENT_VERSION) throw new RangeError(`Unknown announcement version ${bytes[0]}`);
  return { viewTag: bytes[1]!, cipherText: bytes.slice(2) };
}
