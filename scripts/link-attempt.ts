import { parseArgs } from "node:util";
import { addressOf, addressTweak, tweakPublicKey } from "@bellaso/core";
import { type SearchedTxWithEvents, TESTNET, searchTxs } from "@bellaso/chain";
import { deriveNativeAccount } from "@qorechain/sdk";
import { type Match, type PublicView, linkHeuristics } from "./lib/link";
import { recipientFromEnv, recipientPublicData } from "./lib/recipient";
import { allPages, announcementContract, announcementsOf, contractTxs, scanChain } from "./lib/scan";

/** Method 2 indexes that the scoring phase derives for account A. */
const STEALTH_INDEXES = 100;

/** Every transaction with a bank transfer from or to `address`, fees included, from the transfer event index. */
async function historyOf(address: string): Promise<SearchedTxWithEvents[]> {
  const search = (field: string) => allPages((page) => searchTxs(TESTNET.rpc, `transfer.${field}='${address}'`, { page }));
  const [received, sent] = await Promise.all([search("recipient"), search("sender")]);
  return [...received, ...sent];
}

/**
 * The data of the attack phase. Its only inputs are the address of A and the suspect
 * addresses. It reads public chain data: `P_A`, `ek_A`, every transaction of the announcement
 * contract, and every transaction with a transfer from or to A or a one-time address.
 */
async function publicView(account: string, extraSuspects: string[]): Promise<{ view: PublicView; read: string }> {
  const { publicKey, kemPublicKey } = await recipientPublicData(account);
  const contract = announcementContract();
  const txs = await contractTxs(contract);
  const { items } = announcementsOf(txs, contract);
  const oneTime = new Set(items.flatMap((item) => item.transfers.map((transfer) => transfer.to)));
  const suspects = new Set([...oneTime, ...extraSuspects]);
  const histories = new Map<string, SearchedTxWithEvents[]>();
  for (const address of [account, ...suspects]) histories.set(address, await historyOf(address));
  const transferTxs = new Set([...histories.values()].flat().map((tx) => tx.hash)).size;
  return {
    view: { account, publicKey, kemPublicKey, items, suspects, histories },
    read: `${txs.length} contract transactions · ${items.length} announcements · ${oneTime.size} one-time addresses · ${extraSuspects.length} suspect addresses · ${transferTxs} transactions with transfers`,
  };
}

/**
 * The scoring phase, after the attack. It loads RECIPIENT_MNEMONIC and returns the true
 * payment addresses of A: the method 1 scan and method 2 indexes 0 to STEALTH_INDEXES - 1.
 */
async function truePaymentsOf(account: string) {
  const { address, keys } = await recipientFromEnv();
  if (address !== account) throw new Error(`RECIPIENT_MNEMONIC belongs to ${address}, not to the attacked account ${account}`);
  const found = await scanChain(announcementContract(), keys);
  const stealth = Array.from({ length: STEALTH_INDEXES }, (_, index) =>
    addressOf(tweakPublicKey(keys.publicKey, addressTweak(keys.pqRoot, index))),
  );
  return { found: found.length, truth: new Set([...found.map((payment) => payment.address), ...stealth]) };
}

/**
 * AC6 and AC11 (SPEC section 11, TECH_SPEC section 12.2). A third party with all chain data
 * and all public data of account A, but no secret, tries to link Bellaso payments to A.
 * The attack phase gets only the address of A (and optional suspect addresses) and prints
 * the matches of each heuristic in scripts/lib/link.ts. Then the scoring phase loads
 * RECIPIENT_MNEMONIC to learn the true payments of A and counts the matches that hit them.
 * Without RECIPIENT_MNEMONIC, every match counts as true. Exit code 1 if a heuristic of kind
 * "A" links a true payment to A. This is a demonstration with concrete heuristics, not a
 * proof (THREAT_MODEL section 3.1).
 *
 * Options:
 * - `--account <qor1…>`: account A. Default: the address of RECIPIENT_MNEMONIC; only the address goes into the attack.
 * - `--suspect <qor1…>`: another address to test, for example a method 2 stealth address. Repeat it for more.
 *
 * Run from the repository root: `bun scripts/link-attempt.ts [--account qor1…] [--suspect qor1…]`.
 */
async function main() {
  const { values } = parseArgs({
    options: { account: { type: "string" }, suspect: { type: "string", multiple: true, default: [] } },
  });
  let account = values.account;
  let accountSource = "--account";
  if (!account) {
    const mnemonic = process.env.RECIPIENT_MNEMONIC;
    if (!mnemonic) throw new Error("Give --account <qor1…>, or set RECIPIENT_MNEMONIC.");
    account = (await deriveNativeAccount(mnemonic, { accountIndex: 0 })).address;
    accountSource = "the address of RECIPIENT_MNEMONIC; only this address goes into the attack";
  }

  console.log("ATTACK PHASE: public data only. The attack gets the address of A and reads the chain. It gets no secret.");
  console.log(`  Account A ${account} (from ${accountSource})`);
  const { view, read } = await publicView(account, values.suspect);
  console.log(`  Read ${read}`);
  const heuristics = linkHeuristics(view);
  for (const kind of ["A", "G2"] as const) {
    console.log(kind === "A" ? "Links to account A (AC6):" : "Links between payments (G2, not to A):");
    for (const h of heuristics.filter((item) => item.kind === kind)) {
      console.log(`  ${h.id} ${h.title}: ${h.matches.length}`);
      for (const match of h.matches) console.log(`       ${match.evidence}`);
    }
  }
  console.log("Attack phase complete. It used the address of A and public chain data only.");

  console.log("");
  let truth: Set<string> | null = null;
  if (process.env.RECIPIENT_MNEMONIC) {
    console.log("SCORING PHASE: loads RECIPIENT_MNEMONIC now, after the attack, to learn the true payments of A.");
    const scored = await truePaymentsOf(account);
    truth = scored.truth;
    console.log(`  True payments of A: ${scored.found} from the method 1 scan, plus method 2 indexes 0 to ${STEALTH_INDEXES - 1}`);
  } else {
    console.log("SCORING PHASE skipped: RECIPIENT_MNEMONIC is not set. Every match counts as true.");
  }
  const isTrue = (match: Match, need: number) => match.addresses.filter((address) => truth?.has(address) ?? true).length >= need;
  const linking: string[] = [];
  for (const h of heuristics) {
    const hits = h.matches.filter((match) => isTrue(match, h.need)).length;
    if (h.kind === "A" && hits > 0) linking.push(h.id);
    console.log(`  ${h.id}: ${h.matches.length} matches · ${hits} ${h.kind === "A" ? "link a true payment to A" : "join true payments of A"}`);
  }
  if (linking.length > 0) {
    console.log(`RESULT: FAIL. ${linking.join(", ")} link a true payment to account A.`);
    process.exitCode = 1;
  } else {
    console.log("RESULT: PASS. No heuristic links a true payment to account A.");
  }
}

await main();
