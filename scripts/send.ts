import { TESTNET } from "@bellaso/chain";
import { createClient, deriveNativeAccount, derivePqcCanonical, directSignerFromPrivateKey, msg } from "@qorechain/sdk";

/**
 * Sends QOR from the CLI payer with a hybrid signature, for example to fund the sponsor
 * wallet or a test account. Run from the repository root: `bun scripts/send.ts <qor1 address> <uqor>`.
 */
async function main() {
  const [to, uqor] = process.argv.slice(2);
  if (!to?.startsWith("qor1") || !/^\d+$/.test(uqor ?? "")) throw new Error("Usage: bun scripts/send.ts <qor1 address> <uqor>");
  const mnemonic = process.env.PAYER_MNEMONIC;
  if (!mnemonic) throw new Error("PAYER_MNEMONIC is missing. Run `bun scripts/keys.ts` first.");
  const payer = await deriveNativeAccount(mnemonic, { accountIndex: 0 });
  const signer = await directSignerFromPrivateKey(payer.privateKey, TESTNET.bech32Prefix);
  const tx = await createClient({ network: "testnet" }).connectTx(signer, { pqcKeypair: derivePqcCanonical(payer.address, mnemonic) });
  const result = await tx.signAndBroadcast(
    [msg.bank.send({ fromAddress: payer.address, toAddress: to, amount: [{ denom: TESTNET.denoms.QOR.denom, amount: uqor! }] })],
    "auto",
  );
  console.log(`code ${result.code} · tx ${result.transactionHash} · ${uqor} uqor to ${to}`);
  if (result.code !== 0) process.exitCode = 1;
}

await main();
