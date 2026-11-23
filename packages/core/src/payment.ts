import { mlkemDecapsulate, mlkemEncapsulate } from "@qorechain/qoreseal";
import type { Announcement } from "./announcement";
import { addressOf, addressTweak, paymentPqSeed, spendTweak, tweakPrivateKey, tweakPublicKey, viewTag } from "./derive";

export interface PaymentTarget extends Announcement {
  /** The one-time address that receives the payment. */
  address: string;
}

/**
 * Method 1, payer side (TECH_SPEC section 4.3). Encapsulates to the recipient's ML-KEM-1024
 * key and derives the one-time address. `mlkemEncapsulate` also runs the key checks of the
 * chain, so a broken key is refused here.
 */
export function makePaymentTarget(recipientPublicKey: Uint8Array, kemPublicKey: Uint8Array, prefix = "qor"): PaymentTarget {
  for (;;) {
    const { cipherText, sharedSecret } = mlkemEncapsulate(kemPublicKey);
    let h: bigint;
    try {
      h = spendTweak(sharedSecret);
    } catch {
      continue;
    }
    return { cipherText, viewTag: viewTag(sharedSecret), address: addressOf(tweakPublicKey(recipientPublicKey, h), prefix) };
  }
}

export interface RecipientKeys {
  /** Compressed secp256k1 public key of account A. */
  publicKey: Uint8Array;
  /** 32-byte secp256k1 private key of account A. */
  privateKey: Uint8Array;
  /** ML-KEM-1024 secret key of account A. */
  kemSecretKey: Uint8Array;
  /** Post-quantum root secret. */
  pqRoot: Uint8Array;
}

export interface OpenedPayment {
  address: string;
  /** secp256k1 private key of the one-time account. */
  privateKey: Uint8Array;
  /** Seed of the one-time account's ML-DSA-87 key pair. */
  pqSeed: Uint8Array;
}

/**
 * Method 1, recipient side (TECH_SPEC section 4.4). Returns the one-time account only when
 * the view tag matches and the derived address is the transfer destination of the same
 * transaction. ML-KEM implicit rejection gives a random secret for a foreign ciphertext,
 * so the address check removes every false positive (THREAT_MODEL R13).
 */
export function openAnnouncement(
  keys: RecipientKeys,
  announcement: Announcement,
  destination: string,
  prefix = "qor",
): OpenedPayment | null {
  const sharedSecret = mlkemDecapsulate(keys.kemSecretKey, announcement.cipherText);
  if (viewTag(sharedSecret) !== announcement.viewTag) return null;
  const h = spendTweak(sharedSecret);
  const address = addressOf(tweakPublicKey(keys.publicKey, h), prefix);
  if (address !== destination) return null;
  return { address, privateKey: tweakPrivateKey(keys.privateKey, h), pqSeed: paymentPqSeed(keys.pqRoot, sharedSecret) };
}

/** Method 2 (TECH_SPEC section 4.6): the stealth address with index `i` of the recipient. No transaction occurs. */
export function stealthAddress(recipientPublicKey: Uint8Array, pqRoot: Uint8Array, index: number, prefix = "qor"): string {
  return addressOf(tweakPublicKey(recipientPublicKey, addressTweak(pqRoot, index)), prefix);
}
