import { type Coin, TESTNET } from "@bellaso/chain";
import {
  addressOf,
  addressPqSeed,
  addressTweak,
  decodeAnnouncement,
  openAnnouncement,
  publicKeyOf,
  tweakPrivateKey,
  tweakPublicKey,
} from "@bellaso/core";
import { GATEWAY_REST, type PqcKeypair, type Recipient, balancesOf, gatewayClient, loadSdk, postGateway, waitForQor } from "./chain-client";
import { fromBase64 } from "./bytes";
import type { InboxPayment } from "./vault";

/** Fee budget of the one-time MsgRegisterPQCKeyV2. Gate G5 paid about 0.059 QOR. */
export const REGISTRATION_UQOR = 65_000n;
/** Fee budget of the hybrid MsgSend. Gate G5 paid 34,133 uqor. */
export const SEND_UQOR = 40_000n;
const GAS_PRICE_UQOR = 0.15;
/** The highest fee transaction 2 may pay: twice its budget, so a dishonest simulation cannot burn the QOR as fee. */
export const MAX_SEND_FEE_UQOR = 2n * SEND_UQOR;
const GAS_MULTIPLIER = 1.4;
const QOR = TESTNET.denoms.QOR.denom;

export interface OneTimeAccount {
  address: string;
  privateKey: Uint8Array;
  pqcKeypair: PqcKeypair;
}


/**
 * The keys of the one-time account of a payment, from the recovery phrase only. Method 1
 * opens the announcement again (TECH_SPEC section 4.4); method 2 derives index `i` (section 4.6).
 */
export async function oneTimeAccount(recipient: Recipient, payment: InboxPayment): Promise<OneTimeAccount> {
  const { generatePqcKeypair } = await loadSdk();
  if (payment.method === "link") {
    const opened = openAnnouncement(recipient.keys, decodeAnnouncement(fromBase64(payment.announcement)), payment.address);
    if (!opened) throw new Error("This announcement does not open with your key.");
    return { address: opened.address, privateKey: opened.privateKey, pqcKeypair: generatePqcKeypair(opened.pqSeed) };
  }
  const h = addressTweak(recipient.keys.pqRoot, payment.index);
  const address = addressOf(tweakPublicKey(recipient.keys.publicKey, h));
  if (address !== payment.address) throw new Error("This stealth address does not come from your recovery phrase.");
  return {
    address,
    privateKey: tweakPrivateKey(recipient.keys.privateKey, h),
    pqcKeypair: generatePqcKeypair(addressPqSeed(recipient.keys.pqRoot, payment.index)),
  };
}

/** The QOR that the spend still needs: transaction 1 only before the first spend, transaction 2 always. */
export const spendNeeds = (registered: boolean) => (registered ? 0n : REGISTRATION_UQOR) + SEND_UQOR;

/** True when the chain already has the ML-DSA-87 key of `address`. */
export async function hasSigningKey(address: string): Promise<boolean> {
  const sdk = await loadSdk();
  return (await sdk.fetchPqcStatus({ rest: GATEWAY_REST, address })).registered === true;
}

/**
 * Gas for a stealth address that got tokens only (TECH_SPEC section 7.4). The sponsor sends
 * 0.12 QOR. Method 1 payments bring their own 0.15 QOR allowance.
 */
export async function askGas(address: string, needs: bigint): Promise<string> {
  const { txHash } = await postGateway<{ txHash: string }>("/v1/sponsor-gas", { address });
  await waitForQor(address, needs, 60_000);
  return txHash;
}

/** Transaction 1. Registers the ML-DSA-87 key of the one-time account, signed with secp256k1 only. */
export async function registerOneTimeKey(account: OneTimeAccount): Promise<string | null> {
  const sdk = await loadSdk();
  const signer = await sdk.directSignerFromPrivateKey(account.privateKey, "qor");
  const registration = await sdk.ensurePqcRegistered(await gatewayClient(sdk).connectTx(signer), {
    pqcKeypair: account.pqcKeypair,
    ecdsaPubkey: publicKeyOf(account.privateKey),
    rest: GATEWAY_REST,
    chainId: TESTNET.chainId,
  });
  return registration.alreadyRegistered ? null : (registration.txHash ?? null);
}

/** Every coin of `held`, with the QOR reduced by `fee`. A QOR rest of 0 or less is dropped. */
export function sendAmount(held: Coin[], fee: bigint): Coin[] {
  return held
    .map((coin) => (coin.denom === QOR ? { ...coin, amount: (BigInt(coin.amount) - fee).toString() } : coin))
    .filter((coin) => BigInt(coin.amount) > 0n);
}

/**
 * Transaction 2. Sends every coin to `destination` with a hybrid signature and returns the
 * hash and whether the chain emitted `pqc_hybrid_verify` (AC5).
 */
export async function sendAll(account: OneTimeAccount, destination: string): Promise<{ hash: string; hybrid: boolean }> {
  const sdk = await loadSdk();
  const signer = await sdk.directSignerFromPrivateKey(account.privateKey, "qor");
  const tx = await gatewayClient(sdk).connectTx(signer, { pqcKeypair: account.pqcKeypair });
  const held = await balancesOf(account.address);
  const message = (amount: Coin[]) => ({
    typeUrl: "/cosmos.bank.v1beta1.MsgSend",
    value: { fromAddress: account.address, toAddress: destination, amount },
  });
  const gas = Math.ceil((await tx.simulate([message(held)])) * GAS_MULTIPLIER);
  const fee = BigInt(Math.ceil(gas * GAS_PRICE_UQOR));
  if (fee > MAX_SEND_FEE_UQOR) throw new Error(`The network asked for an unusual fee (${fee} uqor). The spend stopped before signing.`);
  const amount = sendAmount(held, fee);
  if (amount.length === 0) throw new Error("This address holds nothing to send after the fee.");
  const result = await tx.signAndBroadcast([message(amount)], { amount: [{ denom: QOR, amount: fee.toString() }], gas: gas.toString() });
  if (result.code !== 0) throw new Error(`The chain refused the spend (code ${result.code}, tx ${result.transactionHash}).`);
  return { hash: result.transactionHash, hybrid: result.events?.some((event) => event.type === "pqc_hybrid_verify") ?? false };
}
