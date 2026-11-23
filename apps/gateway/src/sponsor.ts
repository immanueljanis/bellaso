import { createHash, randomBytes } from "node:crypto";
import { type Coin, TESTNET } from "@bellaso/chain";
import type { TxClient } from "@qorechain/sdk";

/** Sends `uqor` from the sponsor wallet to `address` and resolves to the transaction hash. */
export type SendUqor = (address: string, uqor: number) => Promise<string>;

export interface SponsorOptions {
  /** Without a sender, every sponsor request answers 503. */
  send?: SendUqor;
  fetch: typeof fetch;
  chainRest: string;
  amountUqor: number;
  dailyCap: number;
  now?: () => number;
}

export interface SponsorAnswer {
  code: number;
  body: { txHash: string } | { error: string };
}

interface ChainAccount {
  pub_key?: unknown;
  base_account?: { pub_key?: unknown };
}

/** The gas amount for a stealth address: transaction 1 and 2 of a spend, with a margin (TECH_SPEC section 7.4). */
export const GAS_UQOR = 120_000;
const PER_IP = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const QOR = TESTNET.denoms.QOR.denom;
const TOKENS: string[] = [TESTNET.denoms.fUSD.denom, TESTNET.denoms.fETH.denom, TESTNET.denoms.fBTC.denom];

/** The `error` sentence of each refusal. The web app can show it as it is. */
export const REFUSALS = {
  badAddress: "Send a JSON body with one field, address, that holds a qor1 account address.",
  unavailable: "The sponsor is not available. Get test QOR from the faucet or from QoreX.",
  exists: "This account is already on the chain. The sponsor funds new accounts only.",
  funded: "The sponsor already funded this address.",
  ipLimit: "This network already got 3 sponsorships in the last 24 hours. Try again later.",
  dailyCap: "The sponsor reached its limit for today. Try again later, or get test QOR from the faucet.",
  signed: "This address already signed a transaction. The sponsor sends gas only before the first spend.",
  noPayment: "This address holds no fUSD, fETH or fBTC. The sponsor sends gas only for a received payment.",
  hasGas: "This address already holds 0.12 QOR or more, which is enough gas.",
  failed: "The sponsor could not complete the transfer. Try again in a minute.",
} as const;

const refuse = (code: number, error: string): SponsorAnswer => ({ code, body: { error } });

/**
 * The sponsor (TECH_SPEC section 9.5, THREAT_MODEL R19). Setup and gas sponsorships share
 * one budget: 3 for each IP address and `dailyCap` in total, in the last 24 hours. A
 * sponsorship holds its place in the budget while the chain checks run, so two requests
 * for one address cannot both pass. A refusal or a failed send gives the place back.
 *
 * ponytail: all state is in memory, because Railway puts the gateway to sleep and the chain
 * is the source of truth. A restart resets the IP limits, the daily total and the record of
 * funded addresses. The chain checks still stop a second sponsorship of one address: after
 * a setup sponsorship the account exists, and a stealth address keeps 0.12 QOR until its
 * first spend gives it a public key. Move the state to `bun:sqlite` on a volume if restarts
 * ever let the wallet drain.
 *
 * An IP address is kept only as SHA-256(random salt of this process ‖ IP), for 24 hours.
 * One promise queue runs every send, so two sends never race on the account sequence.
 */
export class Sponsor {
  private readonly funded = new Set<string>();
  private readonly gasFunded = new Set<string>();
  private grants: { ipHash: string; at: number }[] = [];
  private readonly salt = randomBytes(32);
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: SponsorOptions) {}

  /** `POST /v1/sponsor`: funds a new account A for its setup (TECH_SPEC section 7.1). */
  fund(address: string, ip: string): Promise<SponsorAnswer> {
    return this.grant(this.funded, address, ip, this.options.amountUqor, async () => {
      if (await this.account(address)) return REFUSALS.exists;
    });
  }

  /** `POST /v1/sponsor-gas`: funds the first spend of a stealth address that holds a payment (TECH_SPEC section 7.4). */
  fundGas(address: string, ip: string): Promise<SponsorAnswer> {
    return this.grant(this.gasFunded, address, ip, GAS_UQOR, async () => {
      const [account, coins] = await Promise.all([this.account(address), this.balances(address)]);
      if (account?.pub_key || account?.base_account?.pub_key) return REFUSALS.signed;
      if (!coins.some((coin) => TOKENS.includes(coin.denom) && BigInt(coin.amount) > 0n)) return REFUSALS.noPayment;
      if (BigInt(coins.find((coin) => coin.denom === QOR)?.amount ?? "0") >= BigInt(GAS_UQOR)) return REFUSALS.hasGas;
    });
  }

  private async grant(
    done: Set<string>,
    address: string,
    ip: string,
    uqor: number,
    chainRefusal: () => Promise<string | undefined>,
  ): Promise<SponsorAnswer> {
    const send = this.options.send;
    if (!send) return refuse(503, REFUSALS.unavailable);
    const now = (this.options.now ?? Date.now)();
    this.grants = this.grants.filter((grant) => now - grant.at < DAY_MS);
    const ipHash = createHash("sha256").update(this.salt).update(ip).digest("hex");
    if (done.has(address)) return refuse(409, REFUSALS.funded);
    if (this.grants.filter((grant) => grant.ipHash === ipHash).length >= PER_IP) return refuse(429, REFUSALS.ipLimit);
    if (this.grants.length >= this.options.dailyCap) return refuse(429, REFUSALS.dailyCap);

    const grant = { ipHash, at: now };
    done.add(address);
    this.grants.push(grant);
    const release = () => {
      done.delete(address);
      this.grants = this.grants.filter((other) => other !== grant);
    };
    try {
      const reason = await chainRefusal();
      if (reason) {
        release();
        return refuse(409, reason);
      }
      return { code: 200, body: { txHash: await this.queued(() => send(address, uqor)) } };
    } catch {
      release();
      return refuse(502, REFUSALS.failed);
    }
  }

  private queued<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private read(path: string): Promise<Response> {
    return this.options.fetch(`${this.options.chainRest}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  }

  /** The account of `address`, or null when the chain answers "not found" (404 with gRPC code 5, MEASURED). */
  private async account(address: string): Promise<ChainAccount | null> {
    const response = await this.read(`/cosmos/auth/v1beta1/accounts/${address}`);
    const body = (await response.json()) as { code?: number; account?: ChainAccount };
    if (response.status === 404 && body.code === 5) return null;
    if (!response.ok || !body.account) throw new Error(`accounts answered ${response.status}`);
    return body.account;
  }

  private async balances(address: string): Promise<Coin[]> {
    const response = await this.read(`/cosmos/bank/v1beta1/balances/${address}`);
    if (!response.ok) throw new Error(`balances answered ${response.status}`);
    return ((await response.json()) as { balances: Coin[] }).balances;
  }
}

/**
 * The sponsor wallet: account index 0 of `mnemonic`, its ML-DSA-87 key from
 * `derivePqcCanonical`, and a hybrid signature on each send (TECH_SPEC section 9.5). It
 * loads the SDK and connects on the first send, so an idle gateway makes no call and a
 * cold start does not wait for the SDK (3 to 9 s to import, MEASURED on Windows). Then it
 * registers the ML-DSA-87 key if the chain does not have it yet. `Sponsor` runs one send
 * at a time.
 */
export function sponsorWallet(mnemonic: string, chainRpc: string, chainRest: string): SendUqor {
  let ready: Promise<TxClient> | undefined;
  const connect = async () => {
    const { createClient, deriveNativeAccount, derivePqcCanonical, directSignerFromPrivateKey, ensurePqcRegistered } = await import("@qorechain/sdk");
    const account = await deriveNativeAccount(mnemonic, { accountIndex: 0 });
    const pqcKeypair = derivePqcCanonical(account.address, mnemonic);
    const client = createClient({ network: "testnet", endpoints: { rpc: chainRpc, rest: chainRest } });
    const signer = await directSignerFromPrivateKey(account.privateKey, TESTNET.bech32Prefix);
    await ensurePqcRegistered(await client.connectTx(signer), { pqcKeypair, ecdsaPubkey: account.publicKey, rest: chainRest });
    return client.connectTx(signer, { pqcKeypair });
  };
  return async (address, uqor) => {
    ready ??= connect().catch((error: unknown) => {
      ready = undefined;
      throw error;
    });
    const tx = await ready;
    const result = await tx.bankSend(address, [{ denom: QOR, amount: String(uqor) }]);
    if (result.code !== 0) throw new Error(`The chain refused the sponsor send (code ${result.code}).`);
    return result.transactionHash;
  };
}
