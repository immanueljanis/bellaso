import { publicKeyOf } from "@bellaso/core";
import { TESTNET } from "@bellaso/chain";
import {
  type EncodeObject,
  createClient,
  deriveNativeAccount,
  directSignerFromPrivateKey,
  ensurePqcRegistered,
  generatePqcKeypair,
} from "@qorechain/sdk";
import { recipientFromEnv } from "./lib/recipient";
import { balances } from "./lib/rest";
import type { Coin } from "@bellaso/chain";
import { announcementContract, scanChain } from "./lib/scan";

const GAS_PRICE_UQOR = 0.15;
const GAS_MULTIPLIER = 1.4;

/**
 * Gate G5 and AC5 (TECH_SPEC sections 7.3 and 14). Finds the first unspent payment of
 * recipient account A, then: transaction 1 registers the one-time account's ML-DSA-87 key
 * (classical signature, allowed one time); transaction 2 sends every coin with a hybrid
 * signature. The destination is the first argument, or the CLI payer for a test.
 * Run from the repository root: `bun scripts/spend.ts [destination]`.
 */
async function main() {
  const { keys } = await recipientFromEnv();
  const payerMnemonic = process.env.PAYER_MNEMONIC;
  const destination = process.argv[2] ?? (payerMnemonic ? (await deriveNativeAccount(payerMnemonic)).address : undefined);
  if (!destination) throw new Error("Give a destination address as the first argument.");

  const scan = await scanChain(announcementContract(), keys);
  let payment;
  let held: Coin[] = [];
  for (const found of scan) {
    held = (await balances(found.address)).filter((coin) => BigInt(coin.amount) > 0n);
    if (held.length > 0) {
      payment = found;
      break;
    }
  }
  if (!payment) throw new Error(`No unspent payment among ${scan.length} found payments.`);
  console.log(`Spending ${payment.address} · holds ${held.map((c) => `${c.amount} ${c.denom}`).join(" + ")} · to ${destination}`);

  const pqcKeypair = generatePqcKeypair(payment.pqSeed);
  const client = createClient({ network: "testnet" });
  const signer = await directSignerFromPrivateKey(payment.privateKey, TESTNET.bech32Prefix);

  const registration = await ensurePqcRegistered(await client.connectTx(signer), {
    pqcKeypair,
    ecdsaPubkey: publicKeyOf(payment.privateKey),
    rest: TESTNET.rest,
  });
  const r = registration.result;
  console.log(
    registration.alreadyRegistered
      ? "G5 tx 1: key already registered"
      : `G5 tx 1 MsgRegisterPQCKeyV2: code ${r?.code} · tx ${registration.txHash} · gas ${r?.gasUsed}`,
  );

  const tx = await client.connectTx(signer, { pqcKeypair });
  const coins = await balances(payment.address);
  const send = (amount: Coin[]): EncodeObject => ({
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: { fromAddress: payment.address, toAddress: destination, amount },
  });
  const gas = Math.ceil((await tx.simulate([send(coins)])) * GAS_MULTIPLIER);
  const fee = BigInt(Math.ceil(gas * GAS_PRICE_UQOR));
  const amount = coins
    .map((coin) => (coin.denom === TESTNET.denoms.QOR.denom ? { ...coin, amount: (BigInt(coin.amount) - fee).toString() } : coin))
    .filter((coin) => BigInt(coin.amount) > 0n);
  const result = await tx.signAndBroadcast([send(amount)], {
    amount: [{ denom: TESTNET.denoms.QOR.denom, amount: fee.toString() }],
    gas: gas.toString(),
  });
  const hybridEvent = result.events?.some((event) => event.type === "pqc_hybrid_verify") ?? false;
  console.log(
    `G5 tx 2 hybrid MsgSend: code ${result.code} · tx ${result.transactionHash} · gas used ${result.gasUsed} / limit ${gas} · fee ${fee} uqor · pqc_hybrid_verify ${hybridEvent}`,
  );
  const left = await balances(payment.address);
  console.log(`Left on the one-time account: ${left.map((c) => `${c.amount} ${c.denom}`).join(" + ") || "nothing"}`);
  const pass = result.code === 0 && hybridEvent;
  console.log(pass ? "G5: PASS" : "G5: FAIL");
  if (!pass) process.exitCode = 1;
}

await main();
