"use client";

import type { Coin } from "@bellaso/chain";
import { stealthAddress } from "@bellaso/core";
import { useEffect, useMemo, useState } from "react";
import { encode } from "uqr";
import { formatCoin } from "@/src/amount";
import { deriveRecipient } from "@/src/chain-client";
import { type GatewayTransfer, fetchTransfers } from "@/src/inbox";
import { type StealthEntry, updateVault } from "@/src/vault";
import { SiteHeader } from "../site-header";
import ui from "../ui.module.css";
import { VaultGate, useVault } from "../vault-gate";
import styles from "./receive.module.css";

type Method = "link" | "stealth";

const short = (address: string) => `${address.slice(0, 10)}…${address.slice(-7)}`;

/** A QR code of `text` as SVG squares in the board colors. */
function QrCode({ text }: { text: string }) {
  const { data, size } = useMemo(() => encode(text, { border: 2 }), [text]);
  const cells = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))).join("");
  return (
    <svg className={styles.qr} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code of ${text}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="var(--chalk)" />
      <path d={cells} fill="var(--board)" />
    </svg>
  );
}

/** What a payer needs to pay a stealth address from any wallet. */
const payerNote = (entry: StealthEntry) =>
  [
    `Please pay to this address: ${entry.address}`,
    "It is a normal transfer from any wallet on QoreChain testnet (qorechain-diana).",
    ...(entry.askGas ? ["Please also send 0.15 QOR to the same address, for the network fee."] : []),
  ].join("\n");

/** The sum of each denom in a list of transfers. */
function totals(transfers: GatewayTransfer[]): Coin[] {
  const sums = new Map<string, bigint>();
  for (const coin of transfers.flatMap((transfer) => transfer.amount)) sums.set(coin.denom, (sums.get(coin.denom) ?? 0n) + BigInt(coin.amount));
  return [...sums].map(([denom, amount]) => ({ denom, amount: amount.toString() }));
}

/** Get paid (SPEC sections 7.1 and 7.5): the payment link, and stealth addresses for one client each. */
export function ReceiveClient() {
  const { state, opened } = useVault();
  const vault = state.kind === "open" ? state.vault : null;
  const [method, setMethod] = useState<Method>("link");
  const [label, setLabel] = useState("");
  const [askGas, setAskGas] = useState(false);
  const [made, setMade] = useState<StealthEntry | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<GatewayTransfer[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchTransfers()
      .then(setTransfers)
      .catch(() => setTransfers(null));
  }, []);

  const stealth = vault?.stealth ?? [];
  const link = vault ? `${origin}/pay/${vault.address}` : "";

  async function copy(text: string, what: string) {
    await navigator.clipboard.writeText(text);
    setCopied(what);
  }

  async function make() {
    if (!vault || label.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { keys } = await deriveRecipient(vault.mnemonic);
      const index = stealth.reduce((next, entry) => Math.max(next, entry.index + 1), 0);
      const entry: StealthEntry = {
        index,
        address: stealthAddress(keys.publicKey, keys.pqRoot, index),
        label: label.trim(),
        createdAt: new Date().toISOString(),
        askGas,
      };
      await updateVault((data) => ({ ...data, stealth: [entry, ...data.stealth] }));
      opened({ ...vault, stealth: [entry, ...stealth] });
      setMade(entry);
      setLabel("");
      setCopied(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  const statusOf = (entry: StealthEntry) => {
    const paid = transfers?.filter((transfer) => transfer.to === entry.address) ?? [];
    return { paid, received: paid.length > 0 ? totals(paid).map(formatCoin).join(" + ") : transfers ? "Nothing yet" : "…" };
  };

  return (
    <>
      <SiteHeader nav />
      <main className="page">
        <h1>Get paid</h1>
        <p className={ui.lede}>Two ways. Both send each payment to an address that nobody can link to you, today or after Q-Day.</p>

        {!vault ? (
          <div style={{ marginTop: 40 }}>
            <VaultGate state={state} onUnlocked={opened} />
          </div>
        ) : (
          <>
            <div className={ui.columns}>
              <section className={ui.wide} aria-label="Ways to get paid">
                <div className={styles.methods} role="radiogroup" aria-label="Method">
                  {(
                    [
                      ["link", "Method 1", "Payment link", "One link for everyone. The payer opens it and pays with QoreX."],
                      ["stealth", "Method 2", "Stealth address", "A new address for one client. The client pays from any wallet."],
                    ] as const
                  ).map(([value, kicker, title, body]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={method === value}
                      className={`${styles.method} ${method === value ? styles.methodOn : ""}`}
                      onClick={() => setMethod(value)}
                    >
                      <span className={styles.kicker}>{kicker}</span>
                      <span className={styles.methodTitle}>{title}</span>
                      <span className={styles.methodBody}>{body}</span>
                    </button>
                  ))}
                </div>

                {method === "link" ? (
                  <div className={`${ui.card} ${styles.panel}`}>
                    <label htmlFor="paylink" className={ui.label}>
                      Your payment link
                    </label>
                    <div className={styles.copyRow}>
                      <input id="paylink" readOnly value={link} className={`${ui.input} ${styles.mono}`} />
                      <button type="button" className={`${ui.primary} ${styles.copy}`} onClick={() => copy(link, "link")}>
                        {copied === "link" ? "Copied" : "Copy link"}
                      </button>
                    </div>
                    <ul className={styles.notes}>
                      <li>Share it anywhere: invoices, email, your bio. It never changes.</li>
                      <li>Each payment still lands in a new address. The payer&apos;s browser makes it.</li>
                      <li>The payer needs QoreX with fUSD and about 0.6 QOR for fees and gas.</li>
                    </ul>
                    <p className={ui.hintLeft}>
                      Best for many payers, donations and a public profile. For a client who wants to pay from their usual wallet or an exchange, use a stealth address.
                    </p>
                  </div>
                ) : (
                  <form
                    className={`${ui.card} ${styles.panel}`}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void make();
                    }}
                  >
                    <label htmlFor="label" className={ui.label}>
                      Who is it for? <span className={styles.labelNote}>Only you see this label.</span>
                    </label>
                    <input
                      id="label"
                      className={ui.input}
                      placeholder="Studio Kyoto"
                      autoComplete="off"
                      value={label}
                      maxLength={60}
                      onChange={(event) => setLabel(event.target.value)}
                    />
                    <label className={styles.switchRow}>
                      <input type="checkbox" role="switch" checked={askGas} onChange={(event) => setAskGas(event.target.checked)} className={styles.switch} />
                      <span>
                        Ask the payer to add 0.15 QOR for gas
                        <span className={styles.switchNote}>
                          {askGas ? "On: the message for the payer asks for 0.15 QOR." : "Off: the Bellaso sponsor pays the gas when you spend."}
                        </span>
                      </span>
                    </label>
                    <button type="submit" className={ui.primary} disabled={busy || label.trim().length === 0}>
                      {busy ? "Deriving…" : "Make a stealth address"}
                    </button>
                    <p className={ui.hintLeft} style={{ marginTop: 10 }}>
                      Made in this browser from your recovery phrase. No transaction, no fee.
                    </p>

                    {made && (
                      <div className={styles.made} aria-live="polite">
                        <QrCode text={made.address} />
                        <div className={styles.madeText}>
                          <p className={styles.madeTitle}>Stealth address for {made.label}</p>
                          <p className={styles.address}>{made.address}</p>
                          <div className={styles.madeActions}>
                            <button type="button" className={ui.secondary} onClick={() => copy(made.address, "address")}>
                              {copied === "address" ? "Copied" : "Copy address"}
                            </button>
                            <button type="button" className={ui.textLink} onClick={() => copy(payerNote(made), "note")}>
                              {copied === "note" ? "Message copied" : `Copy a message for ${made.label}`}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {error && (
                      <p className={ui.error} role="alert">
                        {error}
                      </p>
                    )}
                  </form>
                )}
              </section>

              <figure className={ui.side}>
                <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
                <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
                <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
                <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
                <p className={styles.formula}>
                  P = P<sub>A</sub> + h·G
                </p>
                <div className={`${styles.derivation} ${method === "link" ? styles.derivationOn : ""}`}>
                  <p className={styles.kicker}>Method 1 · payment link</p>
                  <p className={styles.equation}>h = SHAKE256(ss)</p>
                  <p className={styles.derivationNote}>ss is sealed by the payer&apos;s browser to your ML-KEM-1024 key.</p>
                </div>
                <div className={`${styles.derivation} ${method === "stealth" ? styles.derivationOn : ""}`}>
                  <p className={styles.kicker}>Method 2 · stealth address</p>
                  <p className={styles.equation}>h = SHAKE256(pqRoot ‖ i)</p>
                  <p className={styles.derivationNote}>pqRoot comes from your recovery phrase. i counts your addresses.</p>
                </div>
                <figcaption className={ui.caption}>
                  <span className={ui.captionLabel}>Fig. 8</span>
                  <span>Same math, different secret. Without h, nobody can connect P to your account, also with a quantum computer.</span>
                </figcaption>
              </figure>
            </div>

            <section aria-labelledby="stealth-title" className={styles.list}>
              <div className={styles.listHead}>
                <h2 id="stealth-title" className={styles.listTitle}>
                  Your stealth addresses
                </h2>
                <span className={ui.hintLeft}>Use each address for one client only.</span>
              </div>
              {stealth.length === 0 ? (
                <p className={styles.empty}>None yet. Make one for your next client.</p>
              ) : (
                <ul className={styles.rows}>
                  {stealth.map((entry) => {
                    const { paid, received } = statusOf(entry);
                    const status = paid.length === 0 ? "Waiting" : paid.length === 1 ? "Paid" : `Paid ${paid.length} times`;
                    return (
                      <li key={entry.index} className={styles.row}>
                        <span className={styles.rowLabel}>{entry.label}</span>
                        <span className={styles.rowAddress}>{short(entry.address)}</span>
                        <span>{received}</span>
                        <span className={`${styles.status} ${paid.length === 0 ? styles.waiting : paid.length > 1 ? styles.reused : ""}`}>{status}</span>
                        <span className={styles.created}>{new Date(entry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                        {paid.length > 1 && (
                          <p className={styles.reuseWarning}>Payments to this address are linked to each other. Make a new address for each client.</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
