import type { Coin } from "@bellaso/chain";
import { pqRootFromSeed, type RecipientKeys } from "@bellaso/core";
import { mnemonicToSeed } from "@scure/bip39";
import { GATEWAY_URL, readChain } from "./gateway";

/** The QoreChain SDK, loaded only by the pages that sign, so `/pay` stays small. */
export const loadSdk = () => import("@qorechain/sdk");
export type Sdk = Awaited<ReturnType<typeof loadSdk>>;
export type PqcKeypair = ReturnType<Sdk["derivePqcCanonical"]>;

/** The SDK client with both chain endpoints on the gateway, because the public endpoints send no CORS headers (gate G8). */
export function gatewayClient(sdk: Sdk) {
  return sdk.createClient({ network: "testnet", endpoints: { rpc: `${GATEWAY_URL}/v1/rpc`, rest: `${GATEWAY_URL}/v1/lcd` } });
}

export const GATEWAY_REST = `${GATEWAY_URL}/v1/lcd`;

export interface Recipient {
  address: string;
  keys: RecipientKeys;
  pqcKeypair: PqcKeypair;
  kemPublicKey: Uint8Array;
}

/** Every key of account A from the recovery phrase, the same derivations as `scripts/lib/recipient.ts` (TECH_SPEC section 4.1). */
export async function deriveRecipient(mnemonic: string): Promise<Recipient> {
  const sdk = await loadSdk();
  const { deriveSealKeys } = await import("@qorechain/qoreseal");
  const account = await sdk.deriveNativeAccount(mnemonic, { accountIndex: 0 });
  const seal = deriveSealKeys({ mnemonic, index: 0 });
  return {
    address: account.address,
    keys: {
      publicKey: account.publicKey,
      privateKey: account.privateKey,
      kemSecretKey: seal.mlkemSecretKey,
      pqRoot: pqRootFromSeed(await mnemonicToSeed(mnemonic)),
    },
    pqcKeypair: sdk.derivePqcCanonical(account.address, mnemonic),
    kemPublicKey: seal.mlkemPublicKey,
  };
}

/** The bank balances of one address. Only the spend and setup screens call it (THREAT_MODEL R7). */
export async function balancesOf(address: string): Promise<Coin[]> {
  const { balances } = await readChain<{ balances: Coin[] }>(`/cosmos/bank/v1beta1/balances/${address}`);
  return balances;
}

/** The uqor balance of one address. */
export async function qorOf(address: string): Promise<bigint> {
  return BigInt((await balancesOf(address)).find((coin) => coin.denom === "uqor")?.amount ?? "0");
}

/** Waits until `address` holds at least `uqor`, checking every 2 seconds, for at most `timeoutMs`. */
export async function waitForQor(address: string, uqor: bigint, timeoutMs = 90_000): Promise<bigint> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const held = await qorOf(address);
    if (held >= uqor || Date.now() > end) return held;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
}

/** Posts a JSON body to a gateway route and returns the answer, or throws its `error` sentence. */
export async function postGateway<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const answer = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw Object.assign(new Error(answer.error ?? `The gateway answered ${response.status}`), { status: response.status });
  return answer;
}
