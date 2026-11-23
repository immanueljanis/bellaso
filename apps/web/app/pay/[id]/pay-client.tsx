"use client";

import { TESTNET } from "@bellaso/chain";
import { useEffect, useState } from "react";
import { PAYMENT_TOKENS, toBaseUnits } from "@/src/amount";
import { type RecipientPublicData, loadRecipient, txUrl } from "@/src/gateway";
import { fingerprintFromHash, kemFingerprint, requestFromHash, withRequest } from "@/src/link";
import { type PaymentPlan, GAS_ALLOWANCE_UQOR, PAYMENT_GAS_LIMIT, QOREX_PAYMENT_FEE_QOR, planPayment } from "@/src/payment";
import { type QorexSignAndBroadcastResult, connectQorex, explainQorexError, qorexNative } from "@/src/qorex";
import { QrCode } from "../../qr-code";
import { SiteHeader } from "../../site-header";
import ui from "../../ui.module.css";
import styles from "./pay.module.css";

const TOKENS = PAYMENT_TOKENS;

type Stage = "loading" | "ready" | "signing" | "done" | "error";

const short = (address: string) => `${address.slice(0, 12)}…${address.slice(-7)}`;
const ALLOWANCE_QOR = Number(GAS_ALLOWANCE_UQOR) / 1e6;
const TOTAL_QOR = (ALLOWANCE_QOR + QOREX_PAYMENT_FEE_QOR).toFixed(2);

/** Method 1, the payer flow (SPEC section 7.2): one QoreX transaction with the transfer and the announcement. */
export function PayClient({ recipient }: { recipient: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [keys, setKeys] = useState<RecipientPublicData | null>(null);
  const [payer, setPayer] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("");
  const [symbol, setSymbol] = useState<(typeof TOKENS)[number]["symbol"]>("fUSD");
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [result, setResult] = useState<QorexSignAndBroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasQorex, setHasQorex] = useState(false);
  const [copied, setCopied] = useState(false);
  const [href, setHref] = useState("");
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    setHasQorex(qorexNative() !== null);
    setHref(window.location.href);
    const request = requestFromHash(window.location.hash);
    const known = TOKENS.find((item) => item.symbol === request?.symbol);
    if (request && known) {
      setAmountText(request.amount);
      setSymbol(known.symbol);
      setAsked(true);
    }
    loadRecipient(recipient)
      .then(async (data) => {
        const expected = fingerprintFromHash(window.location.hash);
        if (expected && (await kemFingerprint(data.kemPublicKey)) !== expected) {
          throw new Error("The encryption key from the network does not match this link. Do not pay. Ask the recipient to send the link again.");
        }
        setKeys(data);
        setStage("ready");
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStage("error");
      });
  }, [recipient]);

  const token = TOKENS.find((t) => t.symbol === symbol)!;
  const amount = toBaseUnits(amountText, token.decimals);
  const shown = amount ? amountText.trim() : "0";
  const phoneLink = href ? withRequest(href, amount ? { amount: amountText.trim(), symbol } : null) : "";

  async function pay() {
    const native = qorexNative();
    if (!keys || !amount || !native) return;
    setError(null);
    setStage("signing");
    try {
      const from = payer ?? (await connectQorex(TESTNET.chainId));
      setPayer(from);
      const next = planPayment(from, keys, token.denom, amount);
      setPlan(next);
      const sent = await native.signAndBroadcast({ chainId: TESTNET.chainId, messages: next.messages, gasLimit: PAYMENT_GAS_LIMIT });
      if (sent.code !== 0) throw new Error(`The chain refused the transaction (code ${sent.code}, tx ${sent.txHash}).`);
      setResult(sent);
      setStage("done");
    } catch (reason) {
      setError(explainQorexError(reason));
      setStage("ready");
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(phoneLink);
    setCopied(true);
  }

  const steps = plan
    ? [
        { label: "Sealed a secret to the recipient’s key", detail: `ML-KEM-1024 · ciphertext 1,568 B · ${plan.recordCount} records`, done: true },
        { label: "Made a new address", detail: plan.target.address, done: true },
        {
          label: stage === "done" ? "Signed and sent with QoreX" : "Waiting for your signature in QoreX",
          detail: stage === "done" && result ? `tx ${result.txHash} · block ${result.height ?? "pending"}` : "Check the QoreX window",
          done: stage === "done",
        },
      ]
    : [];

  return (
    <>
      <SiteHeader />
      <main className={ui.main}>
        <section className={ui.form} aria-labelledby="pay-title">
          <h1 id="pay-title" className={ui.title}>
            Pay
          </h1>
          <p className={styles.intro}>A Bellaso payment link. Your payment goes to a new address that only the recipient can find.</p>
          <p className={ui.meta}>To {short(recipient)}</p>

          <div className={ui.card}>
            {stage === "ready" && !hasQorex && (
              <div className={styles.noWallet}>
                {phoneLink && <QrCode text={phoneLink} label="QR code of this payment link" className={styles.qr} />}
                <div className={styles.noWalletText}>
                  <p className={styles.noWalletTitle}>This browser has no QoreX wallet. Pay from your phone.</p>
                  <ol className={styles.noWalletSteps}>
                    <li>Scan the code with your phone to get this link.</li>
                    <li>In the QoreX app, turn on Settings › Use testnet (developers).</li>
                    <li>Open the link in the QoreX browser and pay there.</li>
                  </ol>
                  <button type="button" className={ui.secondary} onClick={copyLink}>
                    {copied ? "Link copied" : "Copy this link"}
                  </button>
                </div>
              </div>
            )}

            <label htmlFor="amount" className={ui.label}>
              Amount{asked && <span className={styles.asked}> · the recipient asks for this amount</span>}
            </label>
            <div className={styles.amountRow}>
              <input
                id="amount"
                className={`${ui.field} ${styles.amount}`}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amountText}
                onChange={(event) => setAmountText(event.target.value)}
                disabled={stage === "signing" || stage === "done"}
              />
              <label htmlFor="token" className="sr-only">
                Token
              </label>
              <select
                id="token"
                className={`${ui.field} ${styles.token}`}
                value={symbol}
                onChange={(event) => setSymbol(event.target.value as typeof symbol)}
                disabled={stage === "signing" || stage === "done"}
              >
                {TOKENS.map((t) => (
                  <option key={t.symbol}>{t.symbol}</option>
                ))}
              </select>
            </div>

            <dl className={ui.facts}>
              <dt>The recipient gets</dt>
              <dd>
                {shown} {symbol}
              </dd>
              <dt>Gas for the recipient</dt>
              <dd>{ALLOWANCE_QOR} QOR</dd>
              <dt>Network fee (QoreX)</dt>
              <dd>about {QOREX_PAYMENT_FEE_QOR} QOR</dd>
            </dl>
            <p className={styles.total}>
              <span>Total from your wallet</span>
              <strong>
                {shown} {symbol} + about {TOTAL_QOR} QOR
              </strong>
            </p>

            {stage === "loading" && <p className={ui.hint}>Reading the recipient’s keys from QoreChain…</p>}

            {(stage === "ready" || stage === "signing") && hasQorex && (
              <>
                <button type="button" className={ui.primary} onClick={pay} disabled={!amount || stage === "signing"}>
                  {stage === "signing" ? "Check QoreX…" : `Pay ${amount ? `${shown} ${symbol} ` : ""}with QoreX`}
                </button>
                <p className={ui.hint}>
                  {payer ? `Connected as ${short(payer)}. ` : "QoreX asks you to connect, then to sign. "}You sign one transaction.
                </p>
              </>
            )}

            {steps.length > 0 && (
              <ol className={ui.steps} aria-live="polite">
                {steps.map((step) => (
                  <li key={step.label} className={ui.step}>
                    <span className={`${ui.stepIcon} ${step.done ? ui.stepDone : ui.stepActive}`} aria-hidden="true" />
                    <div>
                      <p className={ui.stepLabel}>{step.label}</p>
                      <p className={ui.stepDetail}>{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {stage === "done" && result && plan && (
              <div className={ui.done}>
                <p className={ui.doneTitle}>Paid to a fresh address.</p>
                <p>No chain observer can link it to this link, now or after Q-Day.</p>
                <p className={ui.stepDetail}>
                  {plan.target.address} · shield {result.shield} ·{" "}
                  <a href={txUrl(result.txHash)} target="_blank" rel="noreferrer">
                    view the transaction
                  </a>
                </p>
              </div>
            )}

            {error && (
              <p className={ui.error} role="alert">
                {error}
              </p>
            )}
          </div>
        </section>

        <figure className={ui.figure}>
          <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
          <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
          <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
          <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
          <h2 className={ui.figureTitle}>What the chain will see</h2>
          <ul className={styles.seen}>
            <li>
              <span className={`${ui.mark} ${ui.public}`}>public</span>
              <span>Your address, the amount and the token.</span>
            </li>
            <li>
              <span className={`${ui.mark} ${ui.hidden}`}>hidden</span>
              <span>
                That the new address belongs to this recipient.
                {plan && <span className={ui.stepDetail}> {short(plan.target.address)}</span>}
              </span>
            </li>
            <li>
              <span className={`${ui.mark} ${ui.hidden}`}>hidden</span>
              <span>The announcement: 1,570 bytes sealed with ML-KEM-1024. It does not name the recipient.</span>
            </li>
          </ul>
          <figcaption className={ui.caption}>
            <span className={ui.captionLabel}>Fig. 4</span>
            <span>The new address is made in this browser from a secret sealed to the recipient’s ML-KEM-1024 key.</span>
          </figcaption>
        </figure>
      </main>
    </>
  );
}
