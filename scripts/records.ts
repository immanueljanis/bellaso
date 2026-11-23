import { addressOf, encodeAnnouncement, makePaymentTarget, toRecords } from "@bellaso/core";
import { TESTNET } from "@bellaso/chain";
import { MsgExecuteContract, MsgInstantiateContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import {
  type EncodeObject,
  createClient,
  deriveNativeAccount,
  derivePqcCanonical,
  directSignerFromPrivateKey,
  ensurePqcRegistered,
  fetchKemKey,
} from "@qorechain/sdk";

import { balanceUqor, rest } from "./lib/rest";

const ALLOWANCE_UQOR = 150_000n;
const TEST_AMOUNT_UQOR = 50_000n;
const CONTRACT_LABEL = "bellaso-announcements-v1";
const utf8 = new TextEncoder();

/** Public data a payer reads for recipient `address`: its secp256k1 public key and its ML-KEM-1024 key. */
async function recipientPublicData(address: string) {
  const account = await rest<{ account: { pub_key?: { key: string } } }>(`/cosmos/auth/v1beta1/accounts/${address}`);
  const pubKey = account.account.pub_key?.key;
  if (!pubKey) throw new Error(`${address} has no public key on chain yet`);
  const publicKey = Uint8Array.from(Buffer.from(pubKey, "base64"));
  if (addressOf(publicKey) !== address) throw new Error("addressOf(P_A) does not give the address of A");
  const kem = await fetchKemKey({ rest: TESTNET.rest, address });
  if (!kem.found || !kem.key) throw new Error(`${address} has no KEM key. Run scripts/setup.ts first.`);
  return { publicKey, kemPublicKey: kem.key.publicKey };
}

/**
 * Gate G3 (TECH_SPEC section 14): one hybrid transaction with a MsgSend to a new one-time
 * address and the announcement as 7 base32768 records in the own instance of code 865.
 * Instantiates the contract first when ANNOUNCEMENT_CONTRACT is not set.
 * Run from the repository root: `bun scripts/records.ts`.
 */
async function main() {
  const payerMnemonic = process.env.PAYER_MNEMONIC;
  const recipientMnemonic = process.env.RECIPIENT_MNEMONIC;
  if (!payerMnemonic || !recipientMnemonic) throw new Error("Run `bun scripts/keys.ts` first.");

  const payer = await deriveNativeAccount(payerMnemonic, { accountIndex: 0 });
  const recipientAddress = (await deriveNativeAccount(recipientMnemonic, { accountIndex: 0 })).address;
  const pqcKeypair = derivePqcCanonical(payer.address, payerMnemonic);
  const startBalance = await balanceUqor(payer.address);
  console.log(`Payer ${payer.address} · ${startBalance} uqor`);

  const client = createClient({ network: "testnet" });
  const signer = await directSignerFromPrivateKey(payer.privateKey, TESTNET.bech32Prefix);
  const registration = await ensurePqcRegistered(await client.connectTx(signer), {
    pqcKeypair,
    ecdsaPubkey: payer.publicKey,
    rest: TESTNET.rest,
  });
  console.log(`Payer ML-DSA-87: ${registration.alreadyRegistered ? "already registered" : `registered, tx ${registration.txHash}`}`);
  const tx = await client.connectTx(signer, {
    pqcKeypair,
    registryTypes: [
      ["/cosmwasm.wasm.v1.MsgInstantiateContract", MsgInstantiateContract],
      ["/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract],
    ],
  });

  let contract: string | undefined = process.env.ANNOUNCEMENT_CONTRACT ?? TESTNET.announcementContract;
  if (!contract) {
    const instantiated = await tx.signAndBroadcast(
      [
        {
          typeUrl: "/cosmwasm.wasm.v1.MsgInstantiateContract",
          value: {
            sender: payer.address,
            admin: "",
            codeId: BigInt(TESTNET.announcementCodeId),
            label: CONTRACT_LABEL,
            msg: utf8.encode("{}"),
            funds: [],
          },
        },
      ],
      "auto",
    );
    contract = instantiated.events
      ?.find((event) => event.type === "instantiate")
      ?.attributes.find((attribute) => attribute.key === "_contract_address")?.value;
    if (!contract) throw new Error(`Instantiate gave no contract address (tx ${instantiated.transactionHash})`);
    console.log(`Instantiated code ${TESTNET.announcementCodeId}: ${contract} · tx ${instantiated.transactionHash} · gas ${instantiated.gasUsed}`);
  }

  const { publicKey, kemPublicKey } = await recipientPublicData(recipientAddress);
  const target = makePaymentTarget(publicKey, kemPublicKey);
  const records = toRecords(encodeAnnouncement(target));
  console.log(`One-time address ${target.address} · ${records.length} records · ${records.map((r) => r.length).join("/")} chars`);

  const messages: EncodeObject[] = [
    {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: {
        fromAddress: payer.address,
        toAddress: target.address,
        amount: [{ denom: TESTNET.denoms.QOR.denom, amount: (TEST_AMOUNT_UQOR + ALLOWANCE_UQOR).toString() }],
      },
    },
    ...records.map((note) => ({
      typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
      value: { sender: payer.address, contract, msg: utf8.encode(JSON.stringify({ record: { note } })), funds: [] },
    })),
  ];

  const simulated = await tx.simulate(messages);
  console.log(`G3 simulate: ${simulated} gas for 1 MsgSend + ${records.length} MsgExecuteContract`);

  const before = await balanceUqor(payer.address);
  const result = await tx.signAndBroadcast(messages, "auto");
  const after = await balanceUqor(payer.address);
  const fee = before - after - TEST_AMOUNT_UQOR - ALLOWANCE_UQOR;
  console.log(
    `G3 broadcast: code ${result.code} · tx ${result.transactionHash} · height ${result.height} · gas used ${result.gasUsed} / wanted ${result.gasWanted} · fee ${fee} uqor`,
  );
  console.log(`ANNOUNCEMENT_CONTRACT=${contract}`);
  console.log(result.code === 0 ? "G3: PASS" : "G3: FAIL");
  if (result.code !== 0) process.exitCode = 1;
}

await main();
