import type { Coin } from "@bellaso/chain";
import { fromBase64, toBase64 } from "./bytes";

const STORAGE_KEY = "bellaso.vault.v1";
const ITERATIONS = 600_000;

/** One stealth address of method 2 (TECH_SPEC section 4.6). The label never leaves this browser. */
export interface StealthEntry {
  index: number;
  address: string;
  label: string;
  createdAt: string;
  askGas: boolean;
}

/** One payment the inbox found. The spend page opens it again from `announcement` or `index`. */
export type InboxPayment = {
  txHash: string;
  height: number;
  address: string;
  amount: Coin[];
  spentTx?: string;
} & ({ method: "link"; announcement: string } | { method: "stealth"; index: number });

export interface VaultData {
  mnemonic: string;
  address: string;
  createdAt: string;
  payments: InboxPayment[];
  stealth: StealthEntry[];
}

interface Sealed {
  v: 1;
  salt: string;
  iv: string;
  data: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let session: { key: CryptoKey; salt: Uint8Array<ArrayBuffer>; data: VaultData } | null = null;

/** AES-256-GCM key from the passphrase with PBKDF2-SHA-256, 600,000 iterations (OWASP 2023). */
async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function seal(key: CryptoKey, salt: Uint8Array<ArrayBuffer>, data: VaultData): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data))));
  return { v: 1, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(cipher) };
}

function readSealed(): Sealed | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Sealed) : null;
  } catch {
    return null;
  }
}

/** True when this browser holds a vault, locked or not. */
export function hasVault(): boolean {
  return readSealed() !== null;
}

/** The unlocked vault of this tab, or null. A page reload locks it again. */
export function openVault(): VaultData | null {
  return session?.data ?? null;
}

/** Encrypts `data` with a new passphrase and stores it. It replaces any vault in this browser. */
export async function createVault(data: VaultData, passphrase: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(await seal(key, salt, data)));
  session = { key, salt, data };
}

/** Decrypts the stored vault. A wrong passphrase fails the AES-GCM tag check. */
export async function unlockVault(passphrase: string): Promise<VaultData> {
  const sealed = readSealed();
  if (!sealed) throw new Error("This browser has no Bellaso vault.");
  const salt = fromBase64(sealed.salt);
  const key = await deriveKey(passphrase, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(sealed.iv) }, key, fromBase64(sealed.data));
    session = { key, salt, data: JSON.parse(decoder.decode(plain)) as VaultData };
    return session.data;
  } catch {
    throw new Error("The passphrase is not correct.");
  }
}

/** Applies `change` to the unlocked vault and stores it encrypted again, with a new IV. */
export async function updateVault(change: (data: VaultData) => VaultData): Promise<VaultData> {
  if (!session) throw new Error("The vault is locked.");
  const data = change(session.data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(await seal(session.key, session.salt, data)));
  session = { ...session, data };
  return data;
}

/** Forgets the key and the plain data of this tab. The encrypted vault stays. */
export function lockVault(): void {
  session = null;
}

/** The encrypted vault as a file body. It opens only with the passphrase. */
export function exportVault(): string {
  const sealed = readSealed();
  if (!sealed) throw new Error("This browser has no Bellaso vault.");
  return JSON.stringify(sealed, null, 2);
}
