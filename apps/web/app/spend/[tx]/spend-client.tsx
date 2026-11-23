"use client";

import { type Coin, TESTNET } from "@bellaso/chain";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCoin, mainCoin } from "@/src/amount";
import { type Recipient, balancesOf, deriveRecipient } from "@/src/chain-client";
import { txUrl } from "@/src/gateway";
import {
  type OneTimeAccount,
  REGISTRATION_UQOR,
  SEND_UQOR,
  askGas,
  hasSigningKey,
  oneTimeAccount,
  registerOneTimeKey,
  sendAll,
  spendNeeds,
} from "@/src/spend";
import { updateVault } from "@/src/vault";
import { SiteHeader } from "../../site-header";
import ui from "../../ui.module.css";
import { VaultGate, useVault } from "../../vault-gate";
import styles from "./spend.module.css";

const ADDRESS = /^qor1[02-9ac-hj-np-z]{38}$/;
const short = (text: string) => `${text.slice(0, 10)}…${text.slice(-7)}`;
const qor = (uqor: bigint) => `${(Number(uqor) / 1e6).toFixed(3).replace(/0+$/, "").replace(/\.$/, "")} QOR`;

interface Phase {
  label: string;
  detail: string;
  state: "done" | "active" | "waiting";
}

/** The spend of one payment (SPEC section 7.4): transaction 1 registers the one-time key, transaction 2 sends with two signatures. */
export function SpendClient({ txHash }: { txHash: string }) {
  const { state, opened, lock } = useVault();
  const vault = state.kind === "open" ? state.vault : null;
  const payment = vault?.payments.find((item) => item.txHash === txHash) ?? null;
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [account, setAccount] = useState<OneTimeAccount | null>(null);
  const [held, setHeld] = useState<Coin[] | null>(null);
  const [registered, setRegistered] = useState<boolean | null>(null);
  const [destination, setDestination] = useState("");
  const [linkAccepted, setLinkAccepted] = useState(false);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ hash: string; hybrid: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const spentBefore = payment?.spentTx && !result ? payment.spentTx : null;

  useEffect(() => {
    if (spentBefore) router.replace(txUrl(spentBefore));
  }, [spentBefore, router]);

  useEffect(() => {
    if (!vault || !payment || payment.spentTx) return;
    let live = true;
    void (async () => {
      try {
        const derived = await deriveRecipient(vault.mnemonic);
        const opened = await oneTimeAccount(derived, payment);
        const [coins, keyOnChain] = await Promise.all([balancesOf(opened.address), hasSigningKey(opened.address)]);
        if (!live) return;
        setRecipient(derived);
        setAccount(opened);
        setHeld(coins);
        setRegistered(keyOnChain);
      } catch (reason) {
        if (live) setError(reason instanceof Error ? reason.message : String(reason));
      }
    })();
    return () => {
      live = false;
    };
  }, [vault, payment]);

  const target = destination.trim();
  const ownAddresses = new Set([vault?.address, ...(vault?.payments.map((item) => item.address) ?? []), ...(vault?.stealth.map((item) => item.address) ?? [])]);
  const links = ownAddresses.has(target);
  const validTarget = ADDRESS.test(target) && target !== account?.address;
  const heldQor = BigInt(held?.find((coin) => coin.denom === TESTNET.denoms.QOR.denom)?.amount ?? "0");
  const needs = registered === null ? 0n : spendNeeds(registered);
  const shown = held ? mainCoin(held.length > 0 ? held : (payment?.amount ?? [])) : payment ? mainCoin(payment.amount) : null;

  const mark = (index: number, detail: string, done = true) =>
    setPhases((current) =>
      current.map((phase, at) => (at === index ? { ...phase, detail, state: done ? "done" : "active" } : at === index + 1 && done ? { ...phase, state: "active" } : phase)),
    );

  async function spend() {
    if (!account || !payment || !validTarget || (links && !linkAccepted)) return;
    setBusy(true);
    setError(null);
    setPhases([
      { label: "Register the quantum-safe key of this address", detail: "Transaction 1 of 2 · secp256k1 only, allowed one time", state: "active" },
      { label: "Send with two signatures", detail: "Transaction 2 of 2", state: "waiting" },
      { label: "Chain checks both", detail: "Waiting for the block", state: "waiting" },
    ]);
    try {
      if (heldQor < needs) {
        if (payment.method !== "stealth") throw new Error(`This address holds ${qor(heldQor)}. The spend needs about ${qor(needs)} for fees.`);
        mark(0, "Asking the Bellaso sponsor for 0.12 QOR of gas", false);
        await askGas(account.address, needs);
      }
      const first = await registerOneTimeKey(account);
      mark(0, first ? `ML-DSA-87 · proof of possession · tx ${short(first)}` : "ML-DSA-87 key already on chain");
      const sent = await sendAll(account, target);
      mark(1, `secp256k1 + ML-DSA-87 · tx ${short(sent.hash)}`);
      mark(2, sent.hybrid ? "event pqc_hybrid_verify" : "No pqc_hybrid_verify event in the result");
      const left = await balancesOf(account.address);
      if (left.some((coin) => coin.denom !== TESTNET.denoms.QOR.denom && BigInt(coin.amount) > 0n)) {
        setError("Tokens are still on this address. Open the payment from the inbox again to spend the rest.");
      } else {
        await updateVault((data) => ({
          ...data,
          payments: data.payments.map((item) => (item.txHash === payment.txHash && item.address === payment.address ? { ...item, spentTx: sent.hash } : item)),
        }));
      }
      setResult(sent);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setPhases([]);
    } finally {
      setBusy(false);
    }
  }

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
        <Link href="/inbox" className={styles.back}>
          ← Inbox
        </Link>
        {!vault ? (
          <div style={{ marginTop: 32 }}>
            <VaultGate state={state} onUnlocked={opened} />
          </div>
        ) : !payment ? (
          <div className={`${ui.card} ${ui.narrow}`} style={{ marginTop: 32 }}>
            <p className={ui.doneTitle}>This payment is not in your inbox</p>
            <p className={ui.hintLeft} style={{ marginTop: 8 }}>
              Open the inbox and scan again. Only payments that your key opens show here.
            </p>
            <Link href="/inbox" className={ui.primaryLink}>
              Open my inbox
            </Link>
          </div>
        ) : (
          <div className={ui.columns} style={{ marginTop: 24 }}>
            <section className={ui.wide} aria-labelledby="spend-title">
              <h1 id="spend-title">
                {payment.spentTx || result ? "Spent" : "Spend"} {shown?.main ? formatCoin(shown.main) : ""}
              </h1>
              <p className={ui.meta}>
                from {payment.address} · block {payment.height.toLocaleString("en-US")} ·{" "}
                {payment.method === "link" ? "payment link" : "stealth address"}
              </p>

              {payment.spentTx && !result ? (
                <div className={ui.done}>
                  <p className={ui.doneTitle}>Already spent.</p>
                  <p className={ui.stepDetail}>Opening the transaction…</p>
                </div>
              ) : (
                <div className={ui.card}>
                  <label htmlFor="destination" className={ui.label}>
                    Send to
                  </label>
                  <input
                    id="destination"
                    className={`${ui.input} ${styles.destination}`}
                    placeholder="qor1…"
                    autoComplete="off"
                    spellCheck={false}
                    value={destination}
                    onChange={(event) => {
                      setDestination(event.target.value);
                      setLinkAccepted(false);
                    }}
                    disabled={busy || result !== null}
                  />
                  <div className={styles.quick}>
                    <button
                      type="button"
                      className={ui.textLink}
                      onClick={() => {
                        setDestination(vault.address);
                        setLinkAccepted(false);
                      }}
                      disabled={busy || result !== null}
                    >
                      My Bellaso account
                    </button>
                  </div>
                  {target.length > 0 && !ADDRESS.test(target) && <p className={ui.hintLeft}>Use a qor1 address with 38 characters after qor1.</p>}
                  {links && (
                    <div className={styles.warning} role="alert">
                      <p className={styles.warningTitle}>This links your payments together.</p>
                      <p>Anyone could then see that this payment belongs to your Bellaso account. Send to an exchange or a new wallet instead.</p>
                      <label className={ui.check} style={{ marginTop: 10 }}>
                        <input type="checkbox" checked={linkAccepted} onChange={(event) => setLinkAccepted(event.target.checked)} />
                        <span>Send to my own address anyway</span>
                      </label>
                    </div>
                  )}

                  <dl className={ui.facts}>
                    <dt>You send</dt>
                    <dd>{held ? held.map(formatCoin).join(" + ") || "nothing" : "reading the balance…"}</dd>
                    <dt>Key registration, one time</dt>
                    <dd>{registered === null ? "…" : registered ? "done" : `about ${qor(REGISTRATION_UQOR)}`}</dd>
                    <dt>Network fee</dt>
                    <dd>about {qor(SEND_UQOR)}</dd>
                    <dt>QOR left, sent with it</dt>
                    <dd>{held ? qor(heldQor > needs ? heldQor - needs : 0n) : "…"}</dd>
                  </dl>

                  {!result && (
                    <button type="button" className={ui.primary} onClick={spend} disabled={!account || !validTarget || busy || (links && !linkAccepted)}>
                      {busy ? "Sending…" : `Send ${shown?.main ? formatCoin(shown.main) : "the funds"}`}
                    </button>
                  )}

                  {phases.length > 0 && (
                    <ol className={ui.steps} aria-live="polite">
                      {phases.map((phase) => (
                        <li key={phase.label} className={ui.step}>
                          <span
                            className={`${ui.stepIcon} ${phase.state === "done" ? ui.stepDone : phase.state === "active" ? ui.stepActive : ""}`}
                            aria-hidden="true"
                          />
                          <div>
                            <p className={ui.stepLabel}>{phase.label}</p>
                            <p className={ui.stepDetail}>{phase.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  {result && (
                    <div className={ui.done}>
                      <p className={ui.doneTitle}>{result.hybrid ? "Sent. The chain checked both signatures." : "Sent."}</p>
                      <p className={ui.stepDetail}>
                        {result.hybrid ? "event pqc_hybrid_verify · " : ""}tx{" "}
                        <a href={txUrl(result.hash)} target="_blank" rel="noreferrer">
                          {short(result.hash)}
                        </a>
                      </p>
                      <Link href="/inbox" className={ui.primaryLink}>
                        Back to the inbox
                      </Link>
                    </div>
                  )}

                  {error && (
                    <p className={ui.error} role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </section>

            <figure className={ui.side}>
              <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
              <h2 className={ui.figureTitle}>Two signatures on one spend</h2>
              <div className={styles.sig}>
                <div className={styles.sigHead}>
                  <span>secp256k1</span>
                  <span className={styles.size}>64 B</span>
                </div>
                <div className={styles.bar}>
                  <div className={`${styles.barFill} ${styles.ec}`} style={{ transform: `scaleX(${recipient ? 64 / 4627 : 0})` }} />
                </div>
                <p className={styles.sigNote}>A quantum computer can forge this one.</p>
              </div>
              <div className={styles.sig}>
                <div className={styles.sigHead}>
                  <span>ML-DSA-87</span>
                  <span className={styles.size}>4,627 B</span>
                </div>
                <div className={styles.bar}>
                  <div className={`${styles.barFill} ${styles.pq}`} style={{ transform: `scaleX(${recipient ? 1 : 0})` }} />
                </div>
                <p className={styles.sigNote}>It cannot forge this one. FIPS 204, NIST category 5.</p>
              </div>
              <p className={styles.explain}>
                The chain accepts the spend only when both are valid. The ML-DSA-87 key of this address comes from your recovery phrase and the payment secret, so the payer cannot make it.
              </p>
              <figcaption className={ui.caption}>
                <span className={ui.captionLabel}>Fig. 7</span>
                <span>Signature sizes to scale. The first spend also registers the ML-DSA-87 key of this address, in its own transaction.</span>
              </figcaption>
            </figure>
          </div>
        )}
      </main>
    </>
  );
}
