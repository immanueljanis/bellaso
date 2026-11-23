"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCoin } from "@/src/amount";
import { rawTxUrl } from "@/src/gateway";
import { type RestTx, type TxKind, type TxView, describeTx } from "@/src/tx-view";
import { SiteHeader } from "../../site-header";
import ui from "../../ui.module.css";
import styles from "./tx.module.css";

const HASH = /^[0-9A-Fa-f]{64}$/;

const TITLES: Record<TxKind, string> = {
  payment: "A Bellaso payment",
  transfer: "A transfer",
  "signing-key": "A signing key registration",
  "kem-key": "An encryption key registration",
  other: "A transaction",
};

const SUMMARIES: Record<TxKind, string> = {
  payment: "The payer sent funds to a new address and put an announcement on chain. Only the recipient can open it.",
  transfer: "One account sent funds to another.",
  "signing-key": "An account registered its ML-DSA-87 key. From now on, each spend of this account needs two signatures.",
  "kem-key": "An account published its ML-KEM-1024 key in the QoreSeal registry. Payers seal payment secrets to this key.",
  other: "This transaction is not a Bellaso payment or a plain transfer.",
};

type Load = { state: "loading" } | { state: "found"; view: TxView } | { state: "missing" } | { state: "error"; message: string };

const coins = (list: TxView["fee"]) => list.map(formatCoin).join(" + ");
const utcTime = (iso: string) => `${new Date(iso).toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} UTC`;

/** The readable view of one transaction: what moved, what the announcement is, which signatures the chain checked. */
export function TxClient({ hash }: { hash: string }) {
  const valid = HASH.test(hash);
  const [load, setLoad] = useState<Load>({ state: "loading" });

  const read = useCallback(async () => {
    try {
      const response = await fetch(rawTxUrl(hash.toUpperCase()), { headers: { accept: "application/json" } });
      if (response.status === 404) return setLoad({ state: "missing" });
      if (!response.ok) return setLoad({ state: "error", message: `The gateway answered ${response.status}. Try again in a minute.` });
      setLoad({ state: "found", view: describeTx((await response.json()) as RestTx) });
    } catch {
      setLoad({ state: "error", message: "The gateway did not answer. Check the connection and try again." });
    }
  }, [hash]);

  useEffect(() => {
    if (valid) void read();
  }, [valid, read]);

  const retry = () => {
    setLoad({ state: "loading" });
    void read();
  };

  const view = load.state === "found" ? load.view : null;

  return (
    <>
      <SiteHeader nav />
      <main className="page">
        <h1>{view ? TITLES[view.kind] : "Transaction"}</h1>
        <p className={ui.meta}>{hash}</p>

        {!valid && (
          <p className={ui.error} role="alert">
            This is not a transaction hash. A hash has 64 hexadecimal characters.
          </p>
        )}
        {valid && load.state === "loading" && <p className={ui.lede}>Reading the transaction from the chain…</p>}
        {load.state === "missing" && (
          <div className={ui.error} role="alert">
            <p>The chain does not show this transaction. A new transaction can take a few seconds.</p>
            <button type="button" className={ui.textLink} onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {load.state === "error" && (
          <div className={ui.error} role="alert">
            <p>{load.message}</p>
            <button type="button" className={ui.textLink} onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {view && (
          <>
            <p className={ui.lede}>{SUMMARIES[view.kind]}</p>
            <div className={ui.columns}>
              <section className={ui.wide} aria-label="Transaction details">
                <p className={`${styles.status} ${view.code === 0 ? styles.ok : styles.failed}`}>
                  {view.code === 0 ? "Success" : `Failed, code ${view.code}`} · block {view.height.toLocaleString("en-US")} · {utcTime(view.time)}
                </p>

                {view.transfers.map((transfer, index) => (
                  <div key={`${transfer.to}-${index}`} className={`${ui.card} ${styles.transfer}`}>
                    <p className={styles.amount}>{coins(transfer.amount)}</p>
                    <dl className={styles.route}>
                      <div>
                        <dt>From</dt>
                        <dd>{transfer.from}</dd>
                      </div>
                      <div>
                        <dt>To</dt>
                        <dd>{transfer.to}</dd>
                      </div>
                    </dl>
                  </div>
                ))}

                <dl className={`${ui.facts} ${styles.facts}`}>
                  {view.records > 0 && (
                    <>
                      <dt>Announcement</dt>
                      <dd>{view.records} records of ML-KEM-1024 ciphertext</dd>
                    </>
                  )}
                  <dt>Signature</dt>
                  <dd>{view.hybrid ? "secp256k1 + ML-DSA-87" : "secp256k1"}</dd>
                  {view.hybrid && (
                    <>
                      <dt>Chain event</dt>
                      <dd className={styles.event}>pqc_hybrid_verify</dd>
                    </>
                  )}
                  <dt>Network fee</dt>
                  <dd>{coins(view.fee)}</dd>
                  <dt>Gas used</dt>
                  <dd>{view.gasUsed.toLocaleString("en-US")}</dd>
                </dl>

                <p className={styles.raw}>
                  <a href={rawTxUrl(view.hash)} target="_blank" rel="noreferrer">
                    Raw JSON from the chain
                  </a>
                </p>
              </section>

              {(view.kind === "payment" || view.hybrid) && (
                <figure className={ui.figure}>
                  <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
                  <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
                  <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
                  <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
                  <h2 className={ui.figureTitle}>What a chain observer learns</h2>
                  <ul className={styles.seen}>
                    {view.kind === "payment" ? (
                      <>
                        <li>
                          <span className={`${ui.mark} ${ui.public}`}>public</span>
                          <span>The payer address, the amount, the token and the time.</span>
                        </li>
                        <li>
                          <span className={`${ui.mark} ${ui.public}`}>public</span>
                          <span>That this is a Bellaso payment.</span>
                        </li>
                        <li>
                          <span className={`${ui.mark} ${ui.hidden}`}>hidden</span>
                          <span>Who receives it. The new address has no public link to the account of the recipient.</span>
                        </li>
                        <li>
                          <span className={`${ui.mark} ${ui.hidden}`}>hidden</span>
                          <span>What the announcement says. Only the ML-KEM-1024 key of the recipient opens it.</span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          <span className={`${ui.mark} ${ui.public}`}>public</span>
                          <span>Both addresses, the amount, the token and the time.</span>
                        </li>
                        <li>
                          <span className={`${ui.mark} ${ui.hidden}`}>signed</span>
                          <span>The chain checked an ML-DSA-87 signature next to the secp256k1 signature. A broken secp256k1 key alone cannot sign for this account.</span>
                        </li>
                      </>
                    )}
                  </ul>
                  <figcaption className={ui.caption}>
                    <span className={ui.captionLabel}>Fig. 5</span>
                    <span>
                      {view.kind === "payment"
                        ? "This is the whole transaction. Nothing in it names the recipient."
                        : "The event pqc_hybrid_verify shows that the chain checked both signatures."}
                    </span>
                  </figcaption>
                </figure>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
