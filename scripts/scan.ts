import { recipientFromEnv } from "./lib/recipient";
import { announcementContract, scanChain } from "./lib/scan";

/**
 * Gate G6 and AC4 (TECH_SPEC sections 8 and 14): scans every announcement of the contract
 * with the key of recipient account A and prints the payments that belong to it.
 * Run from the repository root: `bun scripts/scan.ts`.
 */
async function main() {
  const { address, keys } = await recipientFromEnv();
  const contract = announcementContract();
  console.log(`Recipient ${address} · contract ${contract}`);
  const result = await scanChain(contract, keys);
  console.log(
    `Scanned ${result.transactions} transactions · ${result.announcements} announcements · ${result.rejected} rejected record sets · ${result.found.length} found · ${result.millis.toFixed(0)} ms`,
  );
  for (const payment of result.found) {
    const amount = payment.amount.map((coin) => `${coin.amount} ${coin.denom}`).join(" + ");
    console.log(`  ${payment.address} · ${amount} · height ${payment.height} · tx ${payment.txHash}`);
  }
}

await main();
