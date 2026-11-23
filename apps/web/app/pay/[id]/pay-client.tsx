"use client";

import { TESTNET } from "@bellaso/chain";
import { useEffect, useState } from "react";
import { toBaseUnits } from "@/src/amount";
import { type RecipientPublicData, loadRecipient } from "@/src/gateway";
import { type PaymentPlan, GAS_ALLOWANCE_UQOR, PAYMENT_GAS_LIMIT, QOREX_PAYMENT_FEE_QOR, planPayment } from "@/src/payment";
import { type QorexSignAndBroadcastResult, connectQorex, explainQorexError, qorexNative } from "@/src/qorex";
import { SiteHeader } from "../../site-header";
import ui from "../../ui.module.css";
import styles from "./pay.module.css";

const TOKENS = [
  { symbol: "fUSD", ...TESTNET.denoms.fUSD },
  { symbol: "fETH", ...TESTNET.denoms.fETH },
  { symbol: "fBTC", ...TESTNET.denoms.fBTC },
] as const;

type Stage = "loading" | "ready" | "connected" | "signing" | "done" | "error";

const short = (address: string) => `${address.slice(0, 12)}…${address.slice(-7)}`;

/** Method 1, the payer flow (SPEC section 7.2): one QoreX transaction with the transfer and the announcement. */
export function PayClient({ recipient }: { recipient: string }) {
  const [stage, setStage] = useState<Stage>("loading");
  const [keys, setKeys] = useState<RecipientPublicData | null>(null);
  const [payer, setPayer] = useState<string | null>(null);
  const [amountText, setAmountText] = useState("150.00");
  const [symbol, setSymbol] = useState<(typeof TOKENS)[number]["symbol"]>("fUSD");
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [result, setResult] = useState<QorexSignAndBroadcastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecipient(recipient)
      .then((data) => {
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
  const hasQorex = stage !== "loading" && qorexNative() !== null;

  async function connect() {
    setError(null);
    try {
      setPayer(await connectQorex(TESTNET.chainId));
      setStage("connected");
    } catch (reason) {
      setError(explainQorexError(reason));
    }
  }

  async function pay() {
    const native = qorexNative();
    if (!keys || !payer || !amount || !native) return;
    setError(null);
    const next = planPayment(payer, keys, token.denom, amount);
    setPlan(next);
    setStage("signing");
    try {
      const sent = await native.signAndBroadcast({
        chainId: TESTNET.chainId,
        messages: next.messages,
        gasLimit: PAYMENT_GAS_LIMIT,
      });
      if (sent.code !== 0) throw new Error(`The chain refused the transaction (code ${sent.code}, tx ${sent.txHash}).`);
      setResult(sent);
      setStage("done");
    } catch (reason) {
      setError(explainQorexError(reason));
      setStage("connected");
    }
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
          <p className={ui.meta}>{recipient}</p>

          <div className={ui.card}>
            <label htmlFor="amount" className={ui.label}>
              Amount
            </label>
            <div className={styles.amountRow}>
              <input
                id="amount"
                className={`${ui.field} ${styles.amount}`}
                inputMode="decimal"
                autoComplete="off"
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
                {amount ? amountText : "0"} {symbol}
              </dd>
              <dt>Gas for the recipient to move it later</dt>
              <dd>{Number(GAS_ALLOWANCE_UQOR) / 1e6} QOR</dd>
              <dt>Network fee, set by QoreX</dt>
              <dd>about {QOREX_PAYMENT_FEE_QOR} QOR</dd>
            </dl>

            {stage === "loading" && <p className={ui.hint}>Reading the recipient’s keys from QoreChain…</p>}
            {stage === "ready" && (
              <>
                <button type="button" className={ui.primary} onClick={connect} disabled={!hasQorex}>
                  Connect QoreX
                </button>
                {!hasQorex && <p className={ui.hint}>Open this page in the QoreX app (dApp browser, testnet on) to pay.</p>}
              </>
            )}
            {stage === "connected" && (
              <>
                <button type="button" className={ui.primary} onClick={pay} disabled={!amount}>
                  Pay {amount ? amountText : ""} {symbol} with QoreX →
                </button>
                <p className={ui.hint}>Connected as {payer ? short(payer) : ""}. You sign one transaction.</p>
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
                <p>Nobody can link it to this link, now or after Q-Day.</p>
                <p className={ui.stepDetail}>
                  {plan.target.address} · shield {result.shield}
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
