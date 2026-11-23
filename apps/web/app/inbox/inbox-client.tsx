"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatCoin, mainCoin } from "@/src/amount";
import { deriveRecipient } from "@/src/chain-client";
import { txUrl } from "@/src/gateway";
import { type GatewayAnnouncement, fetchAnnouncements, fetchTransfers, matchStealth, mergePayments, openItem } from "@/src/inbox";
import { type InboxPayment, type VaultData, updateVault } from "@/src/vault";
import { SiteHeader } from "../site-header";
import ui from "../ui.module.css";
import { VaultGate, useVault } from "../vault-gate";
import styles from "./inbox.module.css";

interface Scan {
  total: number;
  opened: number;
  mine: Set<number>;
  millis: number;
  running: boolean;
  feed: { stealth: number; transfers: number | null; matches: number };
}

const TAPE_MS = 1_200;
const short = (address: string) => `${address.slice(0, 10)}…${address.slice(-7)}`;

/** The recipient inbox (SPEC section 7.3): every announcement and transfer comes to this browser, and only this browser opens them. */
export function InboxClient() {
  const { state, opened, lock } = useVault();
  const vault = state.kind === "open" ? state.vault : null;
  const [payments, setPayments] = useState<InboxPayment[]>([]);
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (current: VaultData) => {
    setError(null);
    setPayments(current.payments);
    try {
      const [{ keys }, items, transfers] = await Promise.all([deriveRecipient(current.mnemonic), fetchAnnouncements(), fetchTransfers()]);
      const started = performance.now();
      const mine = new Set<number>();
      const found: InboxPayment[] = [];
      const pause = Math.min(60, TAPE_MS / Math.max(1, items.length));
      setScan({ total: items.length, opened: 0, mine, millis: 0, running: true, feed: { stealth: current.stealth.length, transfers: null, matches: 0 } });
      for (const [index, item] of items.entries()) {
        const hits = openItem(keys, item as GatewayAnnouncement);
        if (hits.length > 0) mine.add(index);
        found.push(...hits);
        setScan((scan) => scan && { ...scan, opened: index + 1, mine: new Set(mine), millis: performance.now() - started });
        await new Promise((resolve) => setTimeout(resolve, pause));
      }
      const stealthHits = transfers ? matchStealth(current.stealth, transfers) : [];
      found.push(...stealthHits);
      const saved = await updateVault((data) => ({ ...data, payments: mergePayments(data.payments, found) }));
      setPayments(saved.payments);
      setScan((scan) => scan && { ...scan, running: false, feed: { stealth: current.stealth.length, transfers: transfers?.length ?? null, matches: stealthHits.length } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setScan((scan) => scan && { ...scan, running: false });
    }
  }, []);

  useEffect(() => {
    if (vault) void run(vault);
  }, [vault, run]);

  const byLink = payments.filter((payment) => payment.method === "link").length;
  const byStealth = payments.length - byLink;
  const unspent = payments.filter((payment) => !payment.spentTx).length;
  const headline = !scan || scan.running
    ? "Opening announcements with your key"
    : payments.length === 0
      ? "No payments yet"
      : `${payments.length} ${payments.length === 1 ? "payment" : "payments"} found: ${byLink} by link, ${byStealth} by stealth address`;
  const labelOf = (payment: InboxPayment) =>
    payment.method === "link" ? "Payment link" : `Stealth address · ${vault?.stealth.find((entry) => entry.index === payment.index)?.label ?? "unlabelled"}`;

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
      <main className={`page ${styles.inboxPage}`}>
        {!vault ? (
          <>
            <h1>Inbox</h1>
            <div style={{ marginTop: 40 }}>
              <VaultGate state={state} onUnlocked={opened} />
            </div>
          </>
        ) : (
          <>
            <div className={styles.top}>
              <div>
                <h1>Inbox</h1>
                <p className={ui.lede} aria-live="polite">
                  {headline}
                </p>
              </div>
              <button type="button" className={ui.secondary} onClick={() => void run(vault)} disabled={scan?.running}>
                {scan?.running ? "Scanning…" : "Scan again"}
              </button>
            </div>

            <figure className={`${ui.side} ${styles.figure}`}>
              <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
              <div className={styles.figureHead}>
                <h2 className={styles.figureTitle}>Announcements on chain</h2>
                <span className={styles.stat}>
                  {scan
                    ? `Opened ${scan.opened} of ${scan.total} · ${scan.mine.size} yours · ${(scan.millis / 1000).toFixed(2)} s in this browser`
                    : "Reading the gateway feed"}
                </span>
              </div>
              <div
                role="img"
                aria-label={scan ? `${scan.total} announcements. ${scan.mine.size} of them are yours.` : "Announcements"}
                className={styles.tape}
              >
                {Array.from({ length: scan?.total ?? 0 }, (_, index) => {
                  const done = scan !== null && index < scan.opened;
                  const cursor = scan?.running === true && index === scan.opened;
                  const mine = scan?.mine.has(index) === true;
                  return (
                    <span
                      key={index}
                      className={`${styles.tick} ${done ? (mine ? styles.tickMine : styles.tickOther) : ""} ${cursor ? styles.tickCursor : ""}`}
                    />
                  );
                })}
              </div>
              <div className={styles.legend}>
                <span>
                  <span className={`${styles.swatch} ${styles.tickMine}`} aria-hidden="true" />
                  Yours
                </span>
                <span>
                  <span className={`${styles.swatch} ${styles.tickOther}`} aria-hidden="true" />
                  For someone else
                </span>
                <span>
                  <span className={`${styles.swatch} ${styles.tickCursor}`} aria-hidden="true" />
                  Opening now
                </span>
              </div>
              <p className={styles.feed}>
                {!scan || scan.running
                  ? "Stealth addresses · waiting for the announcement scan"
                  : scan.feed.transfers === null
                    ? "Stealth addresses · the gateway has no transfer feed yet"
                    : `Stealth addresses · ${scan.feed.stealth} of yours checked against ${scan.feed.transfers} transfers in this browser · ${scan.feed.matches} ${scan.feed.matches === 1 ? "match" : "matches"}`}
              </p>
              <figcaption className={ui.caption}>
                <span className={ui.captionLabel}>Fig. 6</span>
                <span>
                  The gateway sends every announcement to every inbox. Your key opens yours here, so the gateway never learns which ones they are.
                </span>
              </figcaption>
            </figure>

            <section aria-labelledby="payments-title" className={styles.payments}>
              <div className={styles.paymentsHead}>
                <h2 id="payments-title" className={styles.paymentsTitle}>
                  Payments
                </h2>
                <span className={styles.unspent}>
                  Unspent <strong>{unspent}</strong>
                </span>
              </div>

              {payments.length === 0 && scan && !scan.running ? (
                <div className={styles.empty}>
                  <p className={styles.emptyTitle}>Nothing here yet</p>
                  <p className={ui.hintLeft}>
                    Share your link. Each payment shows here after a scan, and only this browser can tell that it is yours.
                  </p>
                </div>
              ) : (
                <ul className={styles.rows}>
                  {payments.map((payment) => {
                    const { main, gas } = mainCoin(payment.amount);
                    return (
                      <li key={`${payment.txHash}/${payment.address}`} className={styles.row}>
                        <div className={styles.amountCell}>
                          <span className={styles.amount}>{main ? formatCoin(main) : "nothing"}</span>
                          {gas && <span className={styles.gas}>+ {formatCoin(gas)} for gas</span>}
                        </div>
                        <div className={styles.whereCell}>
                          <span>{labelOf(payment)}</span>
                          <span className={styles.block}>block {payment.height.toLocaleString("en-US")}</span>
                        </div>
                        <span className={styles.address}>{short(payment.address)}</span>
                        <span className={`${styles.status} ${payment.spentTx ? styles.spent : ""}`}>{payment.spentTx ? "Spent" : "Unspent"}</span>
                        <Link href={payment.spentTx ? txUrl(payment.spentTx) : `/spend/${payment.txHash}`} className={styles.action}>
                          {payment.spentTx ? "View" : "Spend"} →
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              {error && (
                <p className={ui.error} role="alert">
                  {error}
                </p>
              )}
              <p className={styles.note}>
                Wait before you spend. A spend right after a payment is easy to match by time. Each spend also shows its one-time address on chain.
              </p>
            </section>
          </>
        )}
      </main>
    </>
  );
}
