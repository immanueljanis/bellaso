import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { deriveNativeAccount, generateMnemonic } from "@qorechain/sdk";

const ROLES = [
  { key: "RECIPIENT_MNEMONIC", role: "Recipient account A (the Bellaso recovery phrase)" },
  { key: "PAYER_MNEMONIC", role: "CLI payer (gate G3, demo data)" },
  { key: "SPONSOR_MNEMONIC", role: "Gateway sponsor wallet" },
] as const;

const envFile = new URL("../.env", import.meta.url);

/**
 * Makes the test accounts that the CLI signs for. A missing mnemonic is generated and
 * appended to the local `.env` (git ignores it). Mnemonics are never printed; only the
 * addresses are. Run from the repository root: `bun scripts/keys.ts`.
 */
async function main() {
  const current = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  if (current.length > 0 && !current.endsWith("\n")) appendFileSync(envFile, "\n");
  for (const { key, role } of ROLES) {
    let mnemonic = process.env[key];
    if (!mnemonic) {
      mnemonic = generateMnemonic(256);
      appendFileSync(envFile, `${key}="${mnemonic}"\n`);
    }
    const { address } = await deriveNativeAccount(mnemonic, { accountIndex: 0 });
    console.log(`${role}\n  ${address}`);
  }
}

await main();
