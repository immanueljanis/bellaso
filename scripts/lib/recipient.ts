import { pqRootFromSeed, type RecipientKeys } from "@bellaso/core";
import { deriveSealKeys } from "@qorechain/qoreseal";
import { deriveNativeAccount } from "@qorechain/sdk";
import { mnemonicToSeedSync } from "@scure/bip39";

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
