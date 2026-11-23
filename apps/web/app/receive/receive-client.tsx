"use client";

import type { Coin } from "@bellaso/chain";
import { stealthAddress } from "@bellaso/core";
import { useEffect, useMemo, useRef, useState } from "react";
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

const METHODS: { value: Method; title: string; body: string }[] = [
  { value: "link", title: "Payment link", body: "One link for everyone. The payer opens it and pays with QoreX." },
  { value: "stealth", title: "Stealth address", body: "A new address for one client. The client pays from any wallet with a normal transfer." },
];

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
  const { state, opened, lock } = useVault();
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
  const madeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchTransfers()
      .then(setTransfers)
      .catch(() => setTransfers(null));
  }, []);

  useEffect(() => {
    if (!made) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    madeRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }, [made]);

  const stealth = vault?.stealth ?? [];
  const link = vault ? `${origin}/pay/${vault.address}` : "";
  const current = METHODS.find((item) => item.value === method)!;

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
      <SiteHeader
        nav
        action={
          vault && (
            <button type="button" className={ui.secondary} onClick={lock}>
              <span className={ui.long}>Lock vault</span>
              <span className={ui.short}>Lock</span>
            </button>
          )
        }
      />
      <main className="page">
        <h1>Get paid</h1>
        <p className={ui.lede}>Each payment lands in a new address that nobody can link to you, today or after Q-Day.</p>

        {!vault ? (
          <div style={{ marginTop: 40 }}>
            <VaultGate state={state} onUnlocked={opened} />
          </div>
        ) : (
          <div className={`${ui.columns} ${styles.columns}`}>
            <section className={ui.wide} aria-label="Ways to get paid">
              <div className={styles.switcher} role="tablist" aria-label="How do you want to get paid?">
                {METHODS.map((item) => (
                  <button
                    key={item.value}
                    id={`tab-${item.value}`}
                    type="button"
                    role="tab"
                    aria-selected={method === item.value}
                    aria-controls="method-panel"
                    className={styles.tab}
                    onClick={() => setMethod(item.value)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
              <p className={styles.methodBody}>{current.body}</p>

              <div id="method-panel" role="tabpanel" aria-labelledby={`tab-${method}`} className={styles.panelWrap}>
                {method === "link" ? (
                  <div className={`${ui.card} ${styles.panel}`} key="link">
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
                      <li>Send it to clients, or put it in your invoice or bio. It never changes.</li>
                      <li>The payer needs the QoreX app with fUSD and about 0.6 QOR for fees.</li>
                    </ul>
                    <p className={ui.hintLeft}>
                      A client who pays from another wallet or an exchange needs a stealth address instead.
                    </p>
                  </div>
                ) : (
                  <form
                    key="stealth"
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
                      {busy ? "Making the address…" : "Make a stealth address"}
                    </button>
                    <p className={ui.hintLeft}>Made in this browser from your recovery phrase. No transaction, no fee.</p>
                    {error && (
                      <p className={ui.error} role="alert">
                        {error}
                      </p>
                    )}
                  </form>
                )}
              </div>

              {method === "stealth" && made && (
                <div id="made" ref={madeRef} className={styles.made} aria-live="polite">
                  <p className={styles.madeTitle}>Send this to {made.label}</p>
                  <div className={styles.madeBody}>
                    <QrCode text={made.address} />
                    <div className={styles.madeText}>
                      <p className={styles.address}>{made.address}</p>
                      <div className={styles.madeActions}>
                        <button type="button" className={`${ui.primary} ${styles.copy}`} onClick={() => copy(made.address, "address")}>
                          {copied === "address" ? "Address copied" : "Copy address"}
                        </button>
                        <button type="button" className={ui.textLink} onClick={() => copy(payerNote(made), "note")}>
                          {copied === "note" ? "Message copied" : "Copy a message for the payer"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className={ui.hintLeft}>
                    The payment shows in your inbox. Use this address for {made.label} only.
                  </p>
                </div>
              )}

              <section aria-labelledby="stealth-title" className={styles.list}>
                <div className={styles.listHead}>
                  <h2 id="stealth-title" className={styles.listTitle}>
                    Your stealth addresses
                  </h2>
                  <span className={ui.hintLeft}>One address for each client.</span>
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
                          <span className={`${styles.status} ${paid.length === 0 ? styles.waiting : paid.length > 1 ? styles.reused : ""}`}>{status}</span>
                          <span className={styles.rowAddress}>{short(entry.address)}</span>
                          <span className={styles.received}>{received}</span>
                          {paid.length > 1 && (
                            <p className={styles.reuseWarning}>Payments to this address are linked to each other. Make a new address for each client.</p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </section>

            <figure className={`${ui.side} ${styles.figure}`}>
              <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
              <p className={styles.formula}>
                P = P<sub>A</sub> + h·G
              </p>
              <div className={`${styles.derivation} ${method === "link" ? styles.derivationOn : ""}`}>
                <p className={styles.kicker}>Payment link</p>
                <p className={styles.equation}>h = SHAKE256(ss)</p>
                <p className={styles.derivationNote}>ss is sealed by the payer&apos;s browser to your ML-KEM-1024 key.</p>
              </div>
              <div className={`${styles.derivation} ${method === "stealth" ? styles.derivationOn : ""}`}>
                <p className={styles.kicker}>Stealth address</p>
                <p className={styles.equation}>h = SHAKE256(pqRoot ‖ i)</p>
                <p className={styles.derivationNote}>pqRoot comes from your recovery phrase. i counts your addresses.</p>
              </div>
              <figcaption className={ui.caption}>
                <span className={ui.captionLabel}>Fig. 8</span>
                <span>Same math, different secret. Without h, nobody can connect P to your account, also with a quantum computer.</span>
              </figcaption>
            </figure>
          </div>
        )}
      </main>
    </>
  );
}
