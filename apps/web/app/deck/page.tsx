import type { Metadata } from "next";
import Link from "next/link";
import { DEMO_PAY_PATH, HIDDEN, PUBLIC, REPO } from "../content";
import { FigLattice } from "../fig-lattice";
import landing from "../landing.module.css";
import { SiteHeader } from "../site-header";
import ui from "../ui.module.css";
import { DeckStage } from "./deck-stage";
import styles from "./deck.module.css";

export const metadata: Metadata = {
  title: "Deck",
  description: "The Bellaso pitch in ten slides: the problem, the two payment methods, the proof on QoreChain testnet and the limits.",
};

const LABELS = [
  "Build Before Q-Day · Encrypted Apps",
  "The setup",
  "The archive",
  "Meet Bellaso",
  "Two methods",
  "Quantum-safe",
  "Proof on testnet",
  "Why QoreChain",
  "Honest limits",
  "Try it",
] as const;

const IN_USE = [
  ["Umbra", "270,000+ payments"],
  ["Fluidkey", "$840M sent"],
  ["Railgun", "$4.5B volume in January 2026"],
  ["Stablecoins", "$482B of payments in 9 months"],
] as const;

const TODAY = [
  ["Hide who gets paid", true],
  ["Keep your payment list to you", true],
  ["Stay private after Q-Day", false],
  ["Keep the funds safe after Q-Day", false],
] as const;

const METHODS = [
  {
    kicker: "Method 1",
    title: "Payment link",
    rows: [
      ["You share", "One link for all payers"],
      ["The payer uses", "QoreX, one transaction"],
      ["On chain", "An announcement of 1,570 bytes"],
      ["Payer cost", "About 0.61 QOR"],
    ],
    hash: "3D7BEDE9780D9F9EA942E9978BC5FDE7723EBFB937202B9B733806C87AC1FC72",
  },
  {
    kicker: "Method 2",
    title: "Stealth address",
    rows: [
      ["You share", "One new address for each client"],
      ["The payer uses", "Any wallet, one normal transfer"],
      ["On chain", "Nothing more than the transfer"],
      ["Spend gas", "The sponsor sends 0.12 QOR"],
    ],
    hash: "58C8C659FE930F767B65FA26C8A3B225020939EFCAEF36077F19CCA9FD543793",
  },
] as const;

const PROOF = [
  ["Register the signing key", "9794803F3945EB1DCB6082957131A00E7113A08521D4C0294429C05A8C097E9A"],
  ["Register the encryption key", "239683C28674613BBE8FB54348BC6F5629F46E92A8EB0AEF32518DECBCAA3825"],
  ["Pay by link, from QoreX mobile", "3D7BEDE9780D9F9EA942E9978BC5FDE7723EBFB937202B9B733806C87AC1FC72"],
  ["Pay to a stealth address", "58C8C659FE930F767B65FA26C8A3B225020939EFCAEF36077F19CCA9FD543793"],
  ["Spend with two signatures", "312346D87C20717906386C78284CF97EEDB8FEB130F95559EE675673567CEE7A"],
] as const;

const QORECHAIN = [
  ["Key registration with proof", "x/pqc binds an ML-DSA-87 key to each account. MsgRegisterPQCKeyV2 proves possession."],
  ["QoreSeal key registry", "MsgRegisterKEMKey publishes the ML-KEM-1024 key that each payer seals to."],
  ["Hybrid signatures in the chain", "The chain refused 5 of 5 attacks by a holder of the secp256k1 key alone (code 20)."],
] as const;

const short = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

/**
 * The pitch of Bellaso as ten short slides. Each slide has one sentence, one exhibit and one source line.
 * Each number comes from SPEC.md, docs/PLAN.md, docs/LANDSCAPE.md or docs/THREAT_MODEL.md.
 */
export default function Deck() {
  return (
    <>
      <SiteHeader
        action={
          <Link href="/create" className={ui.secondary} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
            Create my Bellaso
          </Link>
        }
      />
      <DeckStage labels={LABELS}>
        <div className={styles.center}>
          <img src="/brand/bellaso-mark.svg" alt="" width={104} height={104} />
          <h1 className={styles.brand}>Bellaso</h1>
          <p className={styles.tagline}>
            Quantum-safe <em>stealth payments.</em>
          </p>
          <p className={styles.pill}>
            <span className={ui.dot} aria-hidden="true" />
            Live on QoreChain testnet, with two payment methods
          </p>
        </div>

        <div>
          <h2 className={styles.title}>
            Stealth payments work today. <em>Not after Q-Day.</em>
          </h2>
          <div className={styles.pair}>
            <div>
              <p className={styles.small}>In use now</p>
              <ul className={styles.plain}>
                {IN_USE.map(([name, number]) => (
                  <li key={name}>
                    <strong>{name}</strong>
                    <span>{number}</span>
                  </li>
                ))}
              </ul>
            </div>
            <table className={styles.status}>
              <thead>
                <tr>
                  <th scope="col">Stealth payments today</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {TODAY.map(([claim, holds]) => (
                  <tr key={claim}>
                    <th scope="row">{claim}</th>
                    <td className={holds ? styles.yes : styles.no}>{holds ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.source}>
            Sources: Gitcoin (Umbra), Crypto Briefing, June 2026 (Fluidkey), docs/LANDSCAPE.md entries 37 and 47 · L2BEAT rates Umbra “Future
            adversary: Exposed”.
          </p>
        </div>

        <div className={styles.center}>
          <blockquote className={styles.quote}>
            “The chain itself <em>is the archive.</em>”
          </blockquote>
          <p className={styles.lede}>
            A chain keeps each payment record. Google Quantum AI estimates that fewer than 500,000 physical qubits break secp256k1 in a few minutes.
          </p>
          <p className={styles.source}>Sources: ethresear.ch, March 2026 · Google Quantum AI, March 2026.</p>
        </div>

        <div className={styles.center}>
          <h2 className={styles.title}>
            Meet <em>Bellaso.</em>
          </h2>
          <p className={styles.lede}>A private payment link that stays private after Q-Day.</p>
          <ol className={styles.flow}>
            <li>
              <strong>The payer</strong>
              <span>QoreX, or any wallet</span>
            </li>
            <li className={styles.flowMark}>
              <img src="/brand/bellaso-mark-small.svg" alt="Bellaso" width={44} height={44} />
            </li>
            <li>
              <strong>A one-time account</strong>
              <span>New for each payment</span>
            </li>
            <li>
              <strong>Your inbox</strong>
              <span>Only your key finds it</span>
            </li>
          </ol>
          <p className={styles.band}>The recipient account appears 0 times in the payment transaction.</p>
          <p className={styles.source}>Source: docs/PLAN.md, gate G4.</p>
        </div>

        <div>
          <h2 className={styles.title}>
            Two ways to <em>get paid.</em>
          </h2>
          <div className={styles.cards}>
            {METHODS.map((method) => (
              <article key={method.title} className={styles.card}>
                <p className={styles.small}>{method.kicker}</p>
                <h3>{method.title}</h3>
                <dl>
                  {method.rows.map(([term, value]) => (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Proof</dt>
                    <dd>
                      <Link href={`/tx/${method.hash}`} className={styles.hash}>
                        {short(method.hash)}
                      </Link>
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <p className={styles.band}>Both end in a one-time account that needs two signatures to spend.</p>
          <p className={styles.source}>Sources: SPEC.md sections 2.2 and 7.2 · docs/PLAN.md, gates G4 and G9.</p>
        </div>

        <div className={styles.pair}>
          <div>
            <h2 className={styles.title}>
              Quantum-safe on <em>two sides.</em>
            </h2>
            <dl className={styles.sides}>
              <div>
                <dt>Who gets paid</dt>
                <dd>Hidden with ML-KEM-1024 (FIPS 203)</dd>
              </div>
              <div>
                <dt>The funds</dt>
                <dd>Spent with secp256k1 and ML-DSA-87 (FIPS 204)</dd>
              </div>
            </dl>
            <p className={styles.source}>Source: docs/TECH_SPEC.md.</p>
          </div>
          <figure className={styles.figure}>
            <div className={landing.field}>
              <FigLattice />
            </div>
          </figure>
        </div>

        <div>
          <h2 className={styles.title}>
            Each step is <em>a transaction.</em>
          </h2>
          <ul className={styles.proof}>
            {PROOF.map(([step, hash]) => (
              <li key={step}>
                <span>{step}</span>
                <Link href={`/tx/${hash}`} className={styles.hash}>
                  {short(hash)}
                </Link>
              </li>
            ))}
          </ul>
          <p className={styles.band}>Setup takes 26 s. One spend costs 0.093 QOR. The scan of one announcement takes 1.5 ms.</p>
          <p className={styles.source}>Source: docs/PLAN.md, gates G1, G2, G4, G5, G8 and G9 · docs/THREAT_MODEL.md R10.</p>
        </div>

        <div>
          <h2 className={styles.title}>
            It works because of <em>QoreChain.</em>
          </h2>
          <dl className={styles.three}>
            {QORECHAIN.map(([title, body]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{body}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.source}>
            Source: docs/PLAN.md, gates G1, G2 and the Q-Day drill. Also in use: an x/wasm contract of code 865, fUSD, fETH, fBTC and the QoreX wallet.
          </p>
        </div>

        <div>
          <h2 className={styles.title}>
            Bellaso hides who gets paid. <em>Not who pays.</em>
          </h2>
          <div className={styles.lists}>
            <div>
              <h3 className={styles.yes}>Hidden, also after Q-Day</h3>
              <ul>
                {HIDDEN.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={styles.no}>Public</h3>
              <ul>
                {PUBLIC.slice(0, 3).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className={styles.source}>Source: docs/THREAT_MODEL.md. Testnet only. The code has no audit.</p>
        </div>

        <div className={styles.center}>
          <h2 className={styles.title}>
            Get paid. <em>Stay private after Q-Day.</em>
          </h2>
          <p className={styles.lede}>One minute in the browser gives you a payment link on QoreChain testnet.</p>
          <p className={styles.actions}>
            <Link href="/create" className={landing.cta}>
              Create my Bellaso
            </Link>
            <Link href={DEMO_PAY_PATH} className={landing.textLink}>
              See what a payer sees
            </Link>
          </p>
          <p className={styles.source}>
            <a href={REPO}>Source code</a> · <a href={`${REPO}/blob/main/docs/THREAT_MODEL.md`}>Threat model</a>
          </p>
        </div>
      </DeckStage>
    </>
  );
}
