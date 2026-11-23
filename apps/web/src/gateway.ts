import { addressOf } from "@bellaso/core";
import { fromBase64 } from "./bytes";

/** The Bellaso gateway. The browser cannot call the public REST endpoint, because it sends no CORS headers. */
export const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://gateway-production-4e82893b.up.railway.app").replace(
  /\/+$/,
  "",
);

/** Reads public chain data through the gateway REST proxy (TECH_SPEC section 9.3). */
export async function readChain<T>(path: string): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}/v1/lcd${path}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`The gateway answered ${response.status} for ${path}`);
  return (await response.json()) as T;
}

export interface RecipientPublicData {
  /** Compressed secp256k1 public key of account A. */
  publicKey: Uint8Array;
  /** ML-KEM-1024 public key of account A from the QoreSeal registry. */
  kemPublicKey: Uint8Array;
}


/**
 * The public data a payer needs for recipient `address`. Checks that the public key on
 * chain gives the same address, so a wrong key cannot redirect the payment.
 */
export async function loadRecipient(address: string): Promise<RecipientPublicData> {
  const account = await readChain<{ account?: { pub_key?: { key?: string } } }>(`/cosmos/auth/v1beta1/accounts/${address}`);
  const key = account.account?.pub_key?.key;
  if (!key) throw new Error("This Bellaso account has no public key on chain yet.");
  const publicKey = fromBase64(key);
  if (addressOf(publicKey) !== address) throw new Error("The public key on chain does not match this address.");
  const kem = await readChain<{ found: boolean; key?: { public_key: string } }>(`/qorechain/pqc/v1/kem/${address}`);
  if (!kem.found || !kem.key) throw new Error("This account has no encryption key in the QoreSeal registry.");
  return { publicKey, kemPublicKey: fromBase64(kem.key.public_key) };
}

/** A transaction as raw JSON through the gateway. No explorer for `qorechain-diana` is confirmed yet. */
export const rawTxUrl = (hash: string) => `${GATEWAY_URL}/v1/lcd/cosmos/tx/v1beta1/txs/${hash}`;

/** The readable page of a transaction (`app/tx/[hash]`). It reads `rawTxUrl` and links to it. */
export const txUrl = (hash: string) => `/tx/${hash}`;
