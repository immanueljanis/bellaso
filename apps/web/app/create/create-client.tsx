"use client";

import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type Recipient, deriveRecipient } from "@/src/chain-client";
import { txUrl } from "@/src/gateway";
import { paymentLink } from "@/src/link";
import { chainKeys, fundAccount, registerKemKey, registerSigningKey, setupNeeds } from "@/src/setup";
import { createVault, exportVault, hasVault, openVault, unlockVault } from "@/src/vault";
import { SiteHeader } from "../site-header";
import ui from "../ui.module.css";
import styles from "./create.module.css";

const MIN_PASSPHRASE = 12;

const STEPS = [
  {
    title: "Save your recovery phrase",
    body: "24 words, made in this browser. Bellaso cannot recover them for you. This browser keeps them encrypted with your passphrase.",
    progress: "Write the words down, then choose a passphrase.",
    doneMeta: "Saved in this browser",
  },
  {
    title: "Fund the account",
    body: "The Bellaso sponsor sends 0.12 QOR. It pays the two setup fees of about 0.1 QOR.",
    progress: "Asking the sponsor for QOR.",
    doneMeta: "Funded",
  },
  {
    title: "Register your signing key",
    body: "ML-DSA-87, with a proof that you hold the secret half. From now on, each transaction of this account needs two signatures.",
    progress: "Proving possession of the key. Waiting for the next block.",
    doneMeta: "Registered",
  },
  {
    title: "Publish your encryption key",
    body: "ML-KEM-1024, into the QoreSeal registry. Payers seal their secret to this key.",
    progress: "Signed with two signatures. Waiting for the next block.",
    doneMeta: "Published",
  },
  {
    title: "Share your link",
    body: "Your link points to your two public keys, not to a balance.",
    progress: "Making your link.",
    doneMeta: "Ready",
  },
] as const;

const TX_LABELS = ["Sponsor transfer", "Signing key", "Encryption key"] as const;

interface LoggedTx {
  label: string;
  hash: string;
}

const short = (hash: string) => `${hash.slice(0, 4)}…${hash.slice(-4)}`;

/** Recipient setup (SPEC section 7.1). Every key is made and kept in this browser; the chain gets the two public keys. */
export function CreateClient() {
  const [existing, setExisting] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreText, setRestoreText] = useState("");
  const [showPhrase, setShowPhrase] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [repeat, setRepeat] = useState("");
  const [wroteDown, setWroteDown] = useState(false);
  const [done, setDone] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [log, setLog] = useState<LoggedTx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setExisting(hasVault());
    const open = openVault();
    if (open) {
      void deriveRecipient(open.mnemonic).then((derived) => {
        setRecipient(derived);
        setDone(1);
        return runChainSteps(derived, 1);
      });
    }
    setMnemonic(generateMnemonic(wordlist, 256));
    setOrigin(window.location.origin);
  }, []);

  const phrase = restoring ? restoreText.trim().toLowerCase().split(/\s+/).join(" ") : mnemonic;
  const phraseValid = phrase.length > 0 && validateMnemonic(phrase, wordlist);
  const passphraseOk = passphrase.length >= MIN_PASSPHRASE && passphrase === repeat;
  const canSave = phraseValid && passphraseOk && (restoring || wroteDown) && !busy;

  async function runChainSteps(from: Recipient, start: number) {
    setBusy(true);
    setError(null);
    const record = (index: number, hash: string | null) => {
      if (hash) setLog((current) => [...current, { label: TX_LABELS[index - 1]!, hash }]);
      setDone(index + 1);
    };
    try {
      const keys = await chainKeys(from.address);
      let step = start;
      if (step === 1) {
        setProgress(STEPS[1].progress);
        record(1, await fundAccount(from.address, setupNeeds(keys), setManual));
        setManual(null);
        step = 2;
      }
      if (step === 2) {
        setProgress(STEPS[2].progress);
        record(2, keys.signingKey ? null : await registerSigningKey(from));
        step = 3;
      }
      if (step === 3) {
        setProgress(STEPS[3].progress);
        record(3, keys.kemKey ? null : await registerKemKey(from));
      }
      setDone(5);
      setProgress(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const derived = await deriveRecipient(phrase);
      await createVault(
        { mnemonic: phrase, address: derived.address, createdAt: new Date().toISOString(), payments: [], stealth: [] },
        passphrase,
      );
      setPassphrase("");
      setRepeat("");
      setShowPhrase(false);
      setRecipient(derived);
      setExisting(true);
      setDone(1);
      setBusy(false);
      await runChainSteps(derived, 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    setError(null);
    try {
      const vault = await unlockVault(passphrase);
      const derived = await deriveRecipient(vault.mnemonic);
      setPassphrase("");
      setRecipient(derived);
      setDone(1);
      setBusy(false);
      await runChainSteps(derived, 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([exportVault()], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bellaso-vault.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  const [link, setLink] = useState("");
  useEffect(() => {
    if (recipient && origin) void paymentLink(origin, recipient.address, recipient.kemPublicKey).then(setLink);
  }, [recipient, origin]);
  const allDone = done >= 5;
  const blockedByVault = existing && done === 0;

  return (
    <>
      <SiteHeader
        action={
          !allDone && (
            <Link href="/" className={ui.textLink}>
              <span className={ui.long}>Cancel setup</span>
              <span className={ui.short}>Cancel</span>
            </Link>
          )
        }
      />
      <main className="page">
        <h1>Create your Bellaso</h1>
        <p className={ui.lede}>
          Five steps, about one minute. Every key is made in this browser and stays here. The chain only ever sees your two public keys.
        </p>

        <div className={ui.columns}>
          <section aria-label="Setup steps" className={ui.wide}>
            {blockedByVault ? (
              <form
                className={ui.card}
                onSubmit={(event) => {
                  event.preventDefault();
                  void resume();
                }}
              >
                <p className={ui.doneTitle}>This browser already has a Bellaso.</p>
                <p className={ui.hintLeft} style={{ marginTop: 8 }}>
                  Unlock it to finish the setup or to see your payment link again. A second Bellaso here would replace the first, so this page does not make one.
                </p>
                <label htmlFor="unlock" className={ui.label} style={{ marginTop: 18 }}>
                  Passphrase
                </label>
                <input
                  id="unlock"
                  type="password"
                  className={ui.input}
                  autoComplete="current-password"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                />
                <button type="submit" className={ui.primary} disabled={busy || passphrase.length === 0}>
                  {busy ? "Unlocking…" : "Unlock"}
                </button>
              </form>
            ) : (
              <div className={styles.list}>
                <span className={styles.rail} aria-hidden="true" />
                <span
                  className={styles.railFill}
                  aria-hidden="true"
                  style={{ transform: `scaleY(${Math.min(1, done / 4)})` }}
                />
                <ol className={styles.steps}>
                  {STEPS.map((step, index) => {
                    const isDone = index < done;
                    const isActive = index === done;
                    return (
                      <li key={step.title} className={`${styles.step} ${isDone || isActive ? styles.on : ""}`}>
                        <span
                          className={`${styles.badge} ${isDone ? styles.badgeDone : ""} ${isActive ? styles.badgeActive : ""}`}
                          aria-hidden="true"
                        >
                          {isDone ? "✓" : index + 1}
                        </span>
                        <div className={styles.body}>
                          <div className={styles.head}>
                            <h2 className={styles.stepTitle}>{step.title}</h2>
                            <span className={`${styles.stepMeta} ${isDone ? styles.stepMetaDone : ""}`}>
                              {isDone ? step.doneMeta : isActive ? "In progress" : "Waiting"}
                            </span>
                          </div>
                          <p className={styles.stepBody}>{step.body}</p>

                          {index === 0 && isActive && (
                            <div className={styles.panel}>
                              {restoring ? (
                                <>
                                  <label htmlFor="restore" className={ui.label}>
                                    Your 24-word recovery phrase
                                  </label>
                                  <textarea
                                    id="restore"
                                    className={`${ui.input} ${styles.restore}`}
                                    value={restoreText}
                                    onChange={(event) => setRestoreText(event.target.value)}
                                    autoComplete="off"
                                    spellCheck={false}
                                  />
                                  {restoreText.trim() && !phraseValid && (
                                    <p className={ui.hintLeft}>These words are not a valid BIP-39 phrase yet.</p>
                                  )}
                                </>
                              ) : (
                                <>
                                  <div className={styles.row}>
                                    <button
                                      type="button"
                                      className={ui.secondary}
                                      aria-expanded={showPhrase}
                                      onClick={() => setShowPhrase(!showPhrase)}
                                    >
                                      {showPhrase ? "Hide phrase" : "Show phrase"}
                                    </button>
                                    <button type="button" className={ui.textLink} onClick={() => setRestoring(true)}>
                                      I already have a phrase
                                    </button>
                                  </div>
                                  {showPhrase && (
                                    <ol aria-label="Recovery phrase" className={styles.words}>
                                      {mnemonic.split(" ").map((word, at) => (
                                        <li key={`${at}-${word}`}>
                                          <span className={styles.wordIndex}>{at + 1}</span>
                                          {word}
                                        </li>
                                      ))}
                                    </ol>
                                  )}
                                </>
                              )}

                              <div className={styles.fields}>
                                <div>
                                  <label htmlFor="passphrase" className={ui.label}>
                                    Passphrase for this browser
                                  </label>
                                  <input
                                    id="passphrase"
                                    type="password"
                                    className={ui.input}
                                    autoComplete="new-password"
                                    value={passphrase}
                                    onChange={(event) => setPassphrase(event.target.value)}
                                  />
                                </div>
                                <div>
                                  <label htmlFor="repeat" className={ui.label}>
                                    Passphrase again
                                  </label>
                                  <input
                                    id="repeat"
                                    type="password"
                                    className={ui.input}
                                    autoComplete="new-password"
                                    value={repeat}
                                    onChange={(event) => setRepeat(event.target.value)}
                                  />
                                </div>
                              </div>
                              <p className={ui.hintLeft}>
                                {passphrase.length > 0 && passphrase.length < MIN_PASSPHRASE
                                  ? `Use ${MIN_PASSPHRASE} characters or more.`
                                  : repeat.length > 0 && passphrase !== repeat
                                    ? "The two passphrases are different."
                                    : "It encrypts the phrase in this browser. It never leaves this device."}
                              </p>
                              {!restoring && (
                                <label className={ui.check}>
                                  <input type="checkbox" checked={wroteDown} onChange={(event) => setWroteDown(event.target.checked)} />
                                  <span>I wrote the 24 words down. Without them, nobody can recover this account.</span>
                                </label>
                              )}
                              <button type="button" className={ui.primary} onClick={save} disabled={!canSave}>
                                {busy ? "Encrypting…" : "Save and continue"}
                              </button>
                            </div>
                          )}

                          {index === 0 && isDone && (
                            <div className={styles.row} style={{ marginTop: 12 }}>
                              <button type="button" className={ui.textLink} onClick={download}>
                                Download encrypted backup
                              </button>
                            </div>
                          )}

                          {index > 0 && index < 4 && isActive && progress && (
                            <div role="status" className={styles.progress}>
                              <div className={ui.sweep} />
                              <p className={styles.progressText}>{progress}</p>
                              {index === 1 && manual && recipient && (
                                <p className={styles.manual}>
                                  The sponsor is not available. Send 0.12 QOR from QoreX to{" "}
                                  <span className={styles.address}>{recipient.address}</span>. This page continues when it arrives.
                                  <span className={styles.reason}>Sponsor answer: {manual}</span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {error && (
              <div className={ui.error} role="alert">
                <p style={{ margin: 0 }}>{error}</p>
                {recipient && !busy && (
                  <button type="button" className={ui.textLink} onClick={() => runChainSteps(recipient, done)}>
                    Try again
                  </button>
                )}
              </div>
            )}

            {allDone && recipient && (
              <div className={styles.linkBox}>
                <label htmlFor="paylink" className={styles.linkLabel}>
                  Your payment link
                </label>
                <div className={styles.linkRow}>
                  <input id="paylink" readOnly value={link} className={`${ui.input} ${styles.linkInput}`} />
                  <button type="button" className={`${ui.primary} ${styles.copy}`} onClick={() => copyLink(link)}>
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>
                <p className={styles.next}>
                  Send it to clients. Each payment goes to a new address. <Link href="/inbox">Open my inbox</Link> ·{" "}
                  <Link href="/receive">Make a stealth address for one client</Link>
                </p>
              </div>
            )}
          </section>

          <figure className={ui.side}>
            <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
            <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
            <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
            <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
            <div className={styles.section}>
              <p className={styles.group}>On chain, public</p>
              <ul className={styles.keys}>
                {[
                  { name: "ML-DSA-87 public key", size: "2,592 B", color: "var(--blue-chalk)", scale: done > 2 ? 1 : 0 },
                  { name: "ML-KEM-1024 public key", size: "1,568 B", color: "var(--orange-chalk)", scale: done > 3 ? 0.605 : 0 },
                ].map((key) => (
                  <li key={key.name}>
                    <div className={styles.key}>
                      <span>{key.name}</span>
                      <span className={styles.size}>{key.size}</span>
                    </div>
                    <div className={styles.bar}>
                      <div className={styles.barFill} style={{ background: key.color, transform: `scaleX(${key.scale})` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.section}>
              <p className={styles.group}>In this browser, secret</p>
              <ul className={styles.keys}>
                {[
                  ["Recovery phrase", "24 words"],
                  ["ML-KEM-1024 secret key", "3,168 B"],
                  ["ML-DSA-87 secret key", "4,896 B"],
                  ["secp256k1 secret key", "32 B"],
                ].map(([name, size]) => (
                  <li key={name} className={styles.key}>
                    <span>{name}</span>
                    <span className={styles.size}>{size}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.section}>
              <p className={styles.group}>Transactions</p>
              {log.length === 0 ? (
                <p className={ui.hintLeft}>None yet.</p>
              ) : (
                <ul className={styles.keys}>
                  {log.map((entry) => (
                    <li key={entry.hash} className={styles.key}>
                      <span>{entry.label}</span>
                      <a className={styles.tx} href={txUrl(entry.hash)} target="_blank" rel="noreferrer">
                        {short(entry.hash)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <figcaption className={ui.caption}>
              <span className={ui.captionLabel}>Fig. 3</span>
              <span>Only the two public keys go on chain. The gateway relays public data and never sees a secret.</span>
            </figcaption>
          </figure>
        </div>
      </main>
    </>
  );
}
