import { parseArgs } from "node:util";
import { recipientFromEnv } from "./lib/recipient";
import { type AnnouncementSet, announcementContract, announcementsOf, contractTxs, gatewayAnnouncements, openPayments } from "./lib/scan";

const DEFAULT_GATEWAY_URL = "https://gateway-production-4e82893b.up.railway.app";

/**
 * Gates G6 and G8, AC4 and AC10 (TECH_SPEC sections 8 and 14): scans every announcement with
 * the key of recipient account A and prints the payments that belong to it.
 * `--source chain` (default) reads `tx_search` on the chain and never calls the gateway.
 * `--source gateway` reads every page of `/v1/announcements` from GATEWAY_URL.
 * Both sources print the same lines to stdout, so a plain `diff` of two runs proves parity.
 * The source, the amount of data read and the time go to stderr.
 * Run from the repository root: `bun scripts/scan.ts [--source chain|gateway]`.
 */
async function main() {
  const { values } = parseArgs({ options: { source: { type: "string", default: "chain" } } });
  if (values.source !== "chain" && values.source !== "gateway") {
    throw new Error(`--source must be chain or gateway, got "${values.source}"`);
  }
  const { address, keys } = await recipientFromEnv();
  const contract = announcementContract();
  const started = performance.now();

  let set: AnnouncementSet;
  let read: string;
  if (values.source === "chain") {
    const txs = await contractTxs(contract);
    set = announcementsOf(txs, contract);
    read = `${txs.length} transactions from ${contract}`;
  } else {
    const gatewayUrl = (process.env.GATEWAY_URL ?? DEFAULT_GATEWAY_URL).replace(/\/+$/, "");
    set = await gatewayAnnouncements(gatewayUrl);
    read = `${set.items.length} announcements from ${gatewayUrl}`;
  }
  const found = openPayments(keys, set.items);

  console.log(`Recipient ${address} · contract ${contract}`);
  console.log(`${set.items.length} announcements · ${set.rejected} rejected record sets · ${found.length} found`);
  for (const payment of found) {
    const amount = payment.amount.map((coin) => `${coin.amount} ${coin.denom}`).join(" + ");
    console.log(`  ${payment.address} · ${amount} · height ${payment.height} · tx ${payment.txHash}`);
  }
  console.error(`Source ${values.source} · read ${read} · ${(performance.now() - started).toFixed(0)} ms`);
}

await main();
