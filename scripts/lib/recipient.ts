import { addressOf, pqRootFromSeed, type RecipientKeys } from "@bellaso/core";
import { TESTNET } from "@bellaso/chain";
import { deriveSealKeys } from "@qorechain/qoreseal";
import { deriveNativeAccount, fetchKemKey } from "@qorechain/sdk";
import { mnemonicToSeedSync } from "@scure/bip39";
import { rest } from "./rest";

/** The keys of recipient account A from the Bellaso recovery phrase (TECH_SPEC section 4.1). */
export async function recipientKeys(mnemonic: string): Promise<{ address: string; keys: RecipientKeys }> {
  const account = await deriveNativeAccount(mnemonic, { accountIndex: 0 });
  const seal = deriveSealKeys({ mnemonic, index: 0 });
  return {
    address: account.address,
    keys: {
      publicKey: account.publicKey,
      privateKey: account.privateKey,
      kemSecretKey: seal.mlkemSecretKey,
      pqRoot: pqRootFromSeed(mnemonicToSeedSync(mnemonic)),
    },
  };
}

/** The recipient keys from RECIPIENT_MNEMONIC in the local `.env`. */
export async function recipientFromEnv() {
  const mnemonic = process.env.RECIPIENT_MNEMONIC;
  if (!mnemonic) throw new Error("RECIPIENT_MNEMONIC is missing. Run `bun scripts/keys.ts` first.");
  return recipientKeys(mnemonic);
}

/**
 * Public data that anyone reads for recipient `address` (TECH_SPEC section 6): its secp256k1
 * public key `P_A` from the auth account and its ML-KEM-1024 key `ek_A` from the KEM registry.
 */
export async function recipientPublicData(address: string): Promise<{ publicKey: Uint8Array; kemPublicKey: Uint8Array }> {
  const account = await rest<{ account: { pub_key?: { key: string } } }>(`/cosmos/auth/v1beta1/accounts/${address}`);
  const pubKey = account.account.pub_key?.key;
  if (!pubKey) throw new Error(`${address} has no public key on chain yet`);
  const publicKey = Uint8Array.from(Buffer.from(pubKey, "base64"));
  if (addressOf(publicKey) !== address) throw new Error(`The public key on chain does not give the address ${address}`);
  const kem = await fetchKemKey({ rest: TESTNET.rest, address });
  if (!kem.found || !kem.key) throw new Error(`${address} has no KEM key. Run scripts/setup.ts for it first.`);
  return { publicKey, kemPublicKey: kem.key.publicKey };
}
