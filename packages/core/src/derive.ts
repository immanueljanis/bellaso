import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToNumberBE, numberToBytesBE } from "@noble/curves/utils.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bech32 } from "@scure/base";
import { kdf } from "./labels";

const N = secp256k1.Point.CURVE().n;
const G = secp256k1.Point.BASE;

/** The bech32 address of a compressed secp256k1 public key: RIPEMD160(SHA-256(key)). */
export function addressOf(publicKey: Uint8Array, prefix = "qor"): string {
  return bech32.encode(prefix, bech32.toWords(ripemd160(sha256(publicKey))));
}

/** A 64-byte SHAKE-256 output reduced mod n. Zero is refused, because it would make the tweak a no-op. */
function scalarFrom(bytes: Uint8Array): bigint {
  const h = bytesToNumberBE(bytes) % N;
  if (h === 0n) throw new RangeError("Tweak is zero");
  return h;
}

/** The compressed secp256k1 public key of a 32-byte private key. */
export function publicKeyOf(privateKey: Uint8Array): Uint8Array {
  return secp256k1.getPublicKey(privateKey, true);
}

/** `P + h·G` for a compressed public key `P`, compressed. */
export function tweakPublicKey(publicKey: Uint8Array, h: bigint): Uint8Array {
  return secp256k1.Point.fromBytes(publicKey).add(G.multiply(h)).toBytes(true);
}

/** `(k + h) mod n` for a 32-byte private key `k`. */
export function tweakPrivateKey(privateKey: Uint8Array, h: bigint): Uint8Array {
  const k = (bytesToNumberBE(privateKey) + h) % N;
  if (k === 0n) throw new RangeError("Tweaked private key is zero");
  return numberToBytesBE(k, 32);
}

/** The post-quantum root secret from a 64-byte BIP-39 seed (label `pq-root`). */
export function pqRootFromSeed(bip39Seed: Uint8Array): Uint8Array {
  return kdf("pq-root", [bip39Seed], 32);
}

/** Method 1: the view tag of a shared secret (label `view-tag`). */
export function viewTag(sharedSecret: Uint8Array): number {
  return kdf("view-tag", [sharedSecret], 1)[0]!;
}

/** Method 1: the spend tweak `h` of a shared secret (label `spend-tweak`). */
export function spendTweak(sharedSecret: Uint8Array): bigint {
  return scalarFrom(kdf("spend-tweak", [sharedSecret], 64));
}

/** Method 1: the 32-byte ML-DSA-87 seed of a one-time account (label `pq-seed`). */
export function paymentPqSeed(pqRoot: Uint8Array, sharedSecret: Uint8Array): Uint8Array {
  return kdf("pq-seed", [pqRoot, sharedSecret], 32);
}

/** The index of a method 2 stealth address as 4 big-endian bytes. */
function indexBytes(index: number): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) throw new RangeError(`Bad index ${index}`);
  return numberToBytesBE(BigInt(index), 4);
}

/** Method 2: the tweak `h_i` of stealth address `index` (label `addr-tweak`). */
export function addressTweak(pqRoot: Uint8Array, index: number): bigint {
  return scalarFrom(kdf("addr-tweak", [pqRoot, indexBytes(index)], 64));
}

/** Method 2: the 32-byte ML-DSA-87 seed of stealth address `index` (label `addr-pq-seed`). */
export function addressPqSeed(pqRoot: Uint8Array, index: number): Uint8Array {
  return kdf("addr-pq-seed", [pqRoot, indexBytes(index)], 32);
}
