/**
 * Bytes to base64 with a loop. `String.fromCharCode(...bytes)` overflows the call stack near
 * 125 KB in V8, which a vault with about 52 payments reaches (security audit, 23 Nov 2026).
 */
export function toBase64(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

/** Base64 to bytes. */
export const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
