import { parseArgs } from "node:util";
import { encodeAnnouncement, makePaymentTarget, toRecords } from "@bellaso/core";
import { TESTNET } from "@bellaso/chain";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import {
  type EncodeObject,
  createClient,
  deriveNativeAccount,
  derivePqcCanonical,
  directSignerFromPrivateKey,
  ensurePqcRegistered,
} from "@qorechain/sdk";

import { recipientPublicData } from "./lib/recipient";
import { balances } from "./lib/rest";
import { announcementContract } from "./lib/scan";

/**
 * Gas limit of one payment (1 MsgSend + 7 records). Gate G3 used 817,224 gas and the QoreX
 * payment of gate G4 used 838,445; this is about 1.5 times that. The chain charges the limit,
 * so an explicit limit costs about 0.19 QOR, where "auto" (simulation × 1.3) cost 0.45 QOR.
 */
const DEFAULT_GAS_LIMIT = 1_250_000;
const GAS_PRICE_UQOR = 0.15;
const utf8 = new TextEncoder();

/** A whole number from an option, at least `min`. */
function integerOption(name: string, text: string, min: number): number {
  const value = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(value) || value < min) {
    throw new Error(`--${name} must be a whole number of ${min} or more, got "${text}"`);
  }
  return value;
}

/** A decimal fUSD amount (for example `2.5`) in base units, with the decimals of TESTNET.denoms.fUSD. */
function fusdUnits(text: string): bigint {
  const { decimals } = TESTNET.denoms.fUSD;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match || (match[2] ?? "").length > decimals) {
    throw new Error(`--amount must be a fUSD amount with ${decimals} decimals or fewer, got "${text}"`);
  }
  return BigInt(match[1]! + (match[2] ?? "").padEnd(decimals, "0"));
}

/** The held amount of `denom` in a balance list. */
const held = (coins: { denom: string; amount: string }[], denom: string) => BigInt(coins.find((c) => c.denom === denom)?.amount ?? "0");

/**
 * Method 1 payments with the SDK payer (gate G3, demo data for AC4). Each payment is one
 * hybrid transaction: a MsgSend of the fUSD amount and the gas allowance to a new one-time
 * address, and the announcement as 7 base32768 records in the announcement contract.
 *
 * Options:
 * - `--to <qor1…>`: the recipient. It must have a KEM key on chain. Default: account A of RECIPIENT_MNEMONIC.
 * - `--amount <fUSD>`: fUSD for each payment, for example `2.5`. Default 1. 0 sends no fUSD.
 * - `--count <n>`: the number of payments. Default 1.
 * - `--allowance <uqor>`: the gas allowance for each payment. Default 150000. 0 sends no QOR.
 * - `--gas <limit>`: the gas limit of each payment. Default 1250000.
 * - `--dry-run`: simulate each payment and send nothing. The simulation asks for more gas
 *   than a payment uses (G3: simulated 2,321,036, used 817,224).
 *
 * Run from the repository root: `bun scripts/records.ts --count 20 --amount 2 --allowance 0`.
 */
async function main() {
  const { values } = parseArgs({
    options: {
      to: { type: "string" },
      amount: { type: "string", default: "1" },
      count: { type: "string", default: "1" },
      allowance: { type: "string", default: "150000" },
      gas: { type: "string", default: String(DEFAULT_GAS_LIMIT) },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const fusd = fusdUnits(values.amount);
  const count = integerOption("count", values.count, 1);
  const allowance = BigInt(integerOption("allowance", values.allowance, 0));
  const gas = integerOption("gas", values.gas, 1);
  const feeUqor = BigInt(Math.ceil(gas * GAS_PRICE_UQOR));
  const { QOR, fUSD } = TESTNET.denoms;
  const coins = [
    { denom: fUSD.denom, amount: fusd },
    { denom: QOR.denom, amount: allowance },
  ]
    .filter((coin) => coin.amount > 0n)
    .map((coin) => ({ denom: coin.denom, amount: coin.amount.toString() }));
  if (coins.length === 0) throw new Error("--amount and --allowance are both 0. A payment needs at least one coin.");

  const payerMnemonic = process.env.PAYER_MNEMONIC;
  if (!payerMnemonic) throw new Error("PAYER_MNEMONIC is missing. Run `bun scripts/keys.ts` first.");
  let recipient = values.to;
  if (!recipient) {
    const recipientMnemonic = process.env.RECIPIENT_MNEMONIC;
    if (!recipientMnemonic) throw new Error("Give --to <qor1…>, or set RECIPIENT_MNEMONIC for account A.");
    recipient = (await deriveNativeAccount(recipientMnemonic, { accountIndex: 0 })).address;
  }

  const payer = await deriveNativeAccount(payerMnemonic, { accountIndex: 0 });
  const start = await balances(payer.address);
  const needUqor = BigInt(count) * (allowance + feeUqor);
  const needFusd = BigInt(count) * fusd;
  console.log(`Payer ${payer.address} · ${held(start, QOR.denom)} uqor · ${held(start, fUSD.denom)} fUSD units`);
  console.log(
    `${count} payment(s) to ${recipient} · each ${fusd} fUSD units + ${allowance} uqor allowance · gas limit ${gas} · fee ${feeUqor} uqor`,
  );
  if (held(start, QOR.denom) < needUqor || held(start, fUSD.denom) < needFusd) {
    throw new Error(`The payer needs ${needUqor} uqor and ${needFusd} fUSD units for ${count} payment(s).`);
  }

  const { publicKey, kemPublicKey } = await recipientPublicData(recipient);
  const contract = announcementContract();
  const pqcKeypair = derivePqcCanonical(payer.address, payerMnemonic);
  const client = createClient({ network: "testnet" });
  const signer = await directSignerFromPrivateKey(payer.privateKey, TESTNET.bech32Prefix);
  if (!values["dry-run"]) {
    const registration = await ensurePqcRegistered(await client.connectTx(signer), {
      pqcKeypair,
      ecdsaPubkey: payer.publicKey,
      rest: TESTNET.rest,
    });
    console.log(`Payer ML-DSA-87: ${registration.alreadyRegistered ? "already registered" : `registered, tx ${registration.txHash}`}`);
  }
  const tx = await client.connectTx(signer, {
    pqcKeypair,
    registryTypes: [["/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract]],
  });
  const fee = { amount: [{ denom: QOR.denom, amount: feeUqor.toString() }], gas: gas.toString() };

  for (let n = 1; n <= count; n++) {
    const target = makePaymentTarget(publicKey, kemPublicKey);
    const records = toRecords(encodeAnnouncement(target));
    const messages: EncodeObject[] = [
      {
        typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        value: { fromAddress: payer.address, toAddress: target.address, amount: coins },
      },
      ...records.map((note) => ({
        typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
        value: { sender: payer.address, contract, msg: utf8.encode(JSON.stringify({ record: { note } })), funds: [] },
      })),
    ];
    if (values["dry-run"]) {
      console.log(`Dry run ${n}/${count}: simulated ${await tx.simulate(messages)} gas · one-time ${target.address} · not sent`);
      continue;
    }
    const result = await tx.signAndBroadcast(messages, fee);
    console.log(
      `Payment ${n}/${count}: code ${result.code} · tx ${result.transactionHash} · height ${result.height} · one-time ${target.address} · gas used ${result.gasUsed} / ${gas} · fee ${feeUqor} uqor`,
    );
    if (result.code !== 0) {
      process.exitCode = 1;
      console.log("Stopped: the chain refused this payment.");
      break;
    }
  }

  const end = await balances(payer.address);
  console.log(`Payer after: ${held(end, QOR.denom)} uqor · ${held(end, fUSD.denom)} fUSD units`);
}

await main();
