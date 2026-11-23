import { TESTNET } from "@bellaso/chain";
import { GATEWAY_REST, type Recipient, gatewayClient, loadSdk, postGateway, qorOf, waitForQor } from "./chain-client";
import { readChain } from "./gateway";

/** Fee budget of MsgRegisterPQCKeyV2. Gate G1 paid 58,763 uqor. */
const SIGNING_KEY_UQOR = 65_000n;
/** Fee budget of the hybrid MsgRegisterKEMKey. Gate G2 paid 38,120 uqor. */
const KEM_KEY_UQOR = 45_000n;

export interface ChainKeys {
  signingKey: boolean;
  kemKey: boolean;
}

const found = (path: string) =>
  readChain<{ found?: boolean }>(path)
    .then((answer) => answer.found === true)
    .catch(() => false);

/** Which keys of account A the chain already has. A restored phrase can skip steps. */
export async function chainKeys(address: string): Promise<ChainKeys> {
  const [signingKey, kemKey] = await Promise.all([found(`/qorechain/pqc/v1/account/${address}`), found(`/qorechain/pqc/v1/kem/${address}`)]);
  return { signingKey, kemKey };
}

/** The QOR that the open setup steps need. */
export const setupNeeds = (keys: ChainKeys) => (keys.signingKey ? 0n : SIGNING_KEY_UQOR) + (keys.kemKey ? 0n : KEM_KEY_UQOR);

/**
 * Step 2 (SPEC section 7.1). Asks the sponsor for QOR and waits for it. When the sponsor
 * refuses, `onManual` gets the reason and the step waits until the recipient sends the QOR.
 * Returns the sponsor transaction, or null when no sponsor transfer was needed or made.
 */
export async function fundAccount(address: string, needs: bigint, onManual: (reason: string) => void): Promise<string | null> {
  if (needs === 0n || (await qorOf(address)) >= needs) return null;
  try {
    const { txHash } = await postGateway<{ txHash: string }>("/v1/sponsor", { address });
    if ((await waitForQor(address, needs, 60_000)) >= needs) return txHash;
    onManual("The sponsor transfer did not arrive in time.");
  } catch (reason) {
    onManual(reason instanceof Error ? reason.message : String(reason));
  }
  await waitForQor(address, needs, Number.POSITIVE_INFINITY);
  return null;
}

/** Step 3. Registers the ML-DSA-87 key with a proof of possession, signed with secp256k1 only (TECH_SPEC section 7.1). */
export async function registerSigningKey(recipient: Recipient): Promise<string | null> {
  const sdk = await loadSdk();
  const signer = await sdk.directSignerFromPrivateKey(recipient.keys.privateKey, "qor");
  const registration = await sdk.ensurePqcRegistered(await gatewayClient(sdk).connectTx(signer), {
    pqcKeypair: recipient.pqcKeypair,
    ecdsaPubkey: recipient.keys.publicKey,
    rest: GATEWAY_REST,
    chainId: TESTNET.chainId,
  });
  return registration.alreadyRegistered ? null : (registration.txHash ?? null);
}

/** Step 4. Publishes the ML-KEM-1024 key to the QoreSeal registry with a hybrid signature. */
export async function registerKemKey(recipient: Recipient): Promise<string | null> {
  const sdk = await loadSdk();
  if ((await sdk.fetchKemKey({ rest: GATEWAY_REST, address: recipient.address })).found) return null;
  const signer = await sdk.directSignerFromPrivateKey(recipient.keys.privateKey, "qor");
  const tx = await gatewayClient(sdk).connectTx(signer, { pqcKeypair: recipient.pqcKeypair });
  const result = await tx.signAndBroadcast(
    [sdk.msg.pqc.registerKemKey({ sender: recipient.address, algorithmId: sdk.KEM_ALGORITHM_ML_KEM_1024, publicKey: recipient.kemPublicKey })],
    "auto",
  );
  if (result.code !== 0) throw new Error(`The chain refused the KEM key (code ${result.code}, tx ${result.transactionHash}).`);
  return result.transactionHash;
}
