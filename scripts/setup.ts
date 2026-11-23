import { TESTNET } from "@bellaso/chain";
import { deriveSealKeys } from "@qorechain/qoreseal";
import {
  KEM_ALGORITHM_ML_KEM_1024,
  type BroadcastResult,
  createClient,
  deriveNativeAccount,
  derivePqcCanonical,
  directSignerFromPrivateKey,
  ensurePqcRegistered,
  fetchKemKey,
  msg,
} from "@qorechain/sdk";

import { balanceUqor, rest } from "./lib/rest";

const MIN_SETUP_UQOR = 100_000n;

/** Prints one transaction as evidence for docs/PLAN.md section 3. */
function evidence(step: string, result: BroadcastResult | undefined, hash: string | undefined) {
  if (!result) {
    console.log(`${step}: no transaction (${hash ?? "nothing to do"})`);
    return;
  }
  console.log(`${step}: code ${result.code} · tx ${result.transactionHash} · height ${result.height} · gas ${result.gasUsed}`);
}

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");

/**
 * Gates G1 and G2 (TECH_SPEC section 14). Registers the ML-DSA-87 key of recipient
 * account A with a proof of possession (classical signature, one time), then the
 * ML-KEM-1024 key with a hybrid signature, and reads both back over REST. Safe to run
 * again: each step is skipped when the chain already has the key.
 * Run from the repository root: `bun scripts/setup.ts`.
 */
async function main() {
  const mnemonic = process.env.RECIPIENT_MNEMONIC;
  if (!mnemonic) throw new Error("RECIPIENT_MNEMONIC is missing. Run `bun scripts/keys.ts` first.");

  const account = await deriveNativeAccount(mnemonic, { accountIndex: 0 });
  const pqcKeypair = derivePqcCanonical(account.address, mnemonic);
  const seal = deriveSealKeys({ mnemonic, index: 0 });
  console.log(`Account A: ${account.address}`);

  const funds = await balanceUqor(account.address);
  if (funds < MIN_SETUP_UQOR) {
    throw new Error(`Account A has ${funds} uqor. Send at least 0.1 QOR to ${account.address}, then run again.`);
  }

  const client = createClient({ network: "testnet" });
  const signer = await directSignerFromPrivateKey(account.privateKey, TESTNET.bech32Prefix);

  const classical = await client.connectTx(signer);
  const registration = await ensurePqcRegistered(classical, {
    pqcKeypair,
    ecdsaPubkey: account.publicKey,
    rest: TESTNET.rest,
  });
  evidence("G1 MsgRegisterPQCKeyV2", registration.result, registration.alreadyRegistered ? "already registered" : registration.txHash);

  const pqcStatus = await rest<{ found: boolean; account?: Record<string, unknown> & { public_key?: string } }>(
    `/qorechain/pqc/v1/account/${account.address}`,
  );
  const pqcMatches = pqcStatus.found && pqcStatus.account?.public_key === toBase64(pqcKeypair.publicKey);
  const pqcFields = Object.fromEntries(Object.entries(pqcStatus.account ?? {}).filter(([field]) => field !== "public_key"));
  console.log(`G1 REST pqc/account: found ${pqcStatus.found} · key matches derivePqcCanonical ${pqcMatches} · ${JSON.stringify(pqcFields)}`);

  const hybrid = await client.connectTx(signer, { pqcKeypair });
  const before = await fetchKemKey({ rest: TESTNET.rest, address: account.address });
  let kemResult: BroadcastResult | undefined;
  if (!before.found) {
    kemResult = await hybrid.signAndBroadcast(
      [
        msg.pqc.registerKemKey({
          sender: account.address,
          algorithmId: KEM_ALGORITHM_ML_KEM_1024,
          publicKey: seal.mlkemPublicKey,
        }),
      ],
      "auto",
    );
  }
  evidence("G2 MsgRegisterKEMKey (hybrid)", kemResult, before.found ? "already registered" : undefined);

  const kem = await rest<{ found: boolean; key?: { algorithm_id: number; public_key: string; registered_height: string } }>(
    `/qorechain/pqc/v1/kem/${account.address}`,
  );
  const kemMatches = kem.found && kem.key?.public_key === toBase64(seal.mlkemPublicKey);
  console.log(
    `G2 REST pqc/kem: found ${kem.found} · algorithm_id ${kem.key?.algorithm_id} · height ${kem.key?.registered_height} · key matches ${kemMatches}`,
  );

  const pass = pqcMatches && kemMatches && kem.key?.algorithm_id === 2;
  console.log(pass ? "G1 and G2: PASS" : "G1 and G2: FAIL");
  if (!pass) process.exitCode = 1;
}

await main();
