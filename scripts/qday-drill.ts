import { TESTNET } from "@bellaso/chain";
import { createClient, deriveNativeAccount, directSignerFromPrivateKey, msg, openEvmWindowMsg } from "@qorechain/sdk";
import { type Hex, bytesToHex, createWalletClient, defineChain, erc20Abi, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { balances } from "./lib/rest";

const EVM_RPC = "https://evm-testnet.qore.host";
const THIEF_EVM: Hex = `0x${"11".repeat(20)}`;
const FUSD_ERC20 = TESTNET.denoms.fUSD.denom.replace("erc20:", "") as Hex;
const diana = defineChain({
  id: 9800,
  name: "QoreChain diana",
  nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
  rpcUrls: { default: { http: [EVM_RPC] } },
});

/** Runs one attack and reports "REFUSED" with the chain's reason, or "MOVED FUNDS" when the chain accepts it. */
async function attack(name: string, run: () => Promise<unknown>): Promise<boolean> {
  try {
    const result = (await run()) as { code?: number; transactionHash?: string } | string | undefined;
    if (typeof result === "object" && result && result.code !== undefined && result.code !== 0) {
      console.log(`  ${name}: REFUSED in the block (code ${result.code}, tx ${result.transactionHash})`);
      return false;
    }
    console.log(`  ${name}: ACCEPTED (${typeof result === "string" ? result : JSON.stringify(result).slice(0, 120)})`);
    return true;
  } catch (reason) {
    const text = (reason instanceof Error ? reason.message : String(reason)).replace(/\s+/g, " ");
    console.log(`  ${name}: REFUSED · ${text.slice(0, 170)}`);
    return false;
  }
}

/**
 * A self-run Q-Day drill, like the fest drill: the attacker holds ONLY the classical secp256k1
 * key of an account that registered its ML-DSA-87 key, and tries every lane to move its funds.
 * The account is the CLI payer. Its phrase is read once to take the secp256k1 key, then dropped;
 * no step uses the phrase or the ML-DSA-87 key. Run: `bun scripts/qday-drill.ts`.
 */
async function main() {
  const mnemonic = process.env.PAYER_MNEMONIC;
  if (!mnemonic) throw new Error("PAYER_MNEMONIC is missing.");
  const victim = await deriveNativeAccount(mnemonic, { accountIndex: 0 });
  const stolenKey = victim.privateKey;
  const thief = (await deriveNativeAccount(`${"abandon ".repeat(11)}about`, { accountIndex: 0 })).address;
  const before = await balances(victim.address);
  console.log(`Victim ${victim.address} · holds ${before.map((c) => `${c.amount} ${c.denom}`).join(" + ")}`);
  console.log(`The attacker holds only the secp256k1 key. Thief address ${thief}.`);

  const signer = await directSignerFromPrivateKey(stolenKey, TESTNET.bech32Prefix);
  const classical = await createClient({ network: "testnet" }).connectTx(signer);
  const evm = privateKeyToAccount(bytesToHex(stolenKey));
  const wallet = createWalletClient({ account: evm, chain: diana, transport: http(EVM_RPC) });
  console.log(`EVM address of the victim ${evm.address}`);

  const moved = [
    await attack("1 native MsgSend of all QOR and fUSD, classical signature", () =>
      classical.signAndBroadcast([msg.bank.send({ fromAddress: victim.address, toAddress: thief, amount: before })], "auto"),
    ),
    await attack("2 open an EVM window with the classical key", () =>
      classical.signAndBroadcast([openEvmWindowMsg({ sender: victim.address, blocks: 100, maxTxs: 5, maxValue: "3000000" })], "auto"),
    ),
    await attack("3 EVM transfer of 1 QOR", () => wallet.sendTransaction({ to: THIEF_EVM, value: parseEther("1") })),
    await attack("4 EVM ERC-20 transfer of 10 fUSD", () =>
      wallet.writeContract({ address: FUSD_ERC20, abi: erc20Abi, functionName: "transfer", args: [THIEF_EVM, 10_000_000n] }),
    ),
    await attack("5 EVM ERC-20 approve of all fUSD to the thief", () =>
      wallet.writeContract({ address: FUSD_ERC20, abi: erc20Abi, functionName: "approve", args: [THIEF_EVM, 2n ** 255n] }),
    ),
  ];

  const after = await balances(victim.address);
  console.log(`After: ${after.map((c) => `${c.amount} ${c.denom}`).join(" + ")}`);
  const kept = before.every((coin) => after.find((c) => c.denom === coin.denom)?.amount === coin.amount);
  console.log(moved.some(Boolean) || !kept ? "DRILL: FUNDS MOVED" : "DRILL: SURVIVED. Every attack was refused and every coin is still there.");
  if (moved.some(Boolean) || !kept) process.exitCode = 1;
}

await main();
