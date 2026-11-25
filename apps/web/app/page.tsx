import Link from "next/link";
import { ComparedTable, DEMO_PAY_PATH, HIDDEN, PUBLIC, REPO } from "./content";
import { FigJourney } from "./fig-journey";
import { FigLattice } from "./fig-lattice";
import { HeroCta } from "./hero-cta";
import { SiteHeader } from "./site-header";
import ui from "./ui.module.css";
import styles from "./landing.module.css";

/** The recipient flow in three plain steps, directly below the hero. */
const QUICK = [
  ["Create your link", "One minute, in this browser. You need no wallet extension."],
  ["Share it", "Send it to a client, or put it in your invoice."],
  ["Get paid", "Each payment lands in a new address. Your inbox finds it."],
] as const;

const FACTS = [
  ["Recipient hidden with", "ML-KEM-1024 · FIPS 203"],
  ["Funds spent with", "ML-DSA-87 + secp256k1"],
  ["Keys live in", "Your browser, nowhere else"],
  ["Runs on", "QoreChain testnet"],
] as const;

/** The two payment methods (SPEC section 2.2), as the methods section explains them. */
const METHODS = [
  {
    kicker: "Method 1",
    title: "Payment link",
    facts: [
      ["The payer uses", "QoreX, with one signature"],
      ["On chain", "A transfer to a new address, and an announcement of 1,570 bytes that only you can open"],
      ["The new address comes from", "A secret that the payer seals to your ML‑KEM‑1024 key. Only your key opens it."],
      ["Best for", "Many payers, a public page"],
    ],
    href: "/receive",
    action: "Get my payment link",
  },
  {
    kicker: "Method 2",
    title: "Stealth address",
    facts: [
      ["The payer uses", "Any wallet, with a normal transfer"],
      ["On chain", "A normal transfer, and nothing more"],
      ["The new address comes from", "Your post-quantum root secret and a counter. The secret never leaves your browser."],
      ["Best for", "One client or one invoice"],
    ],
    href: "/receive#stealth",
    action: "Make a stealth address",
  },
] as const;

const STEPS = [
  ["Rina publishes a key", "Her ML-KEM-1024 public key goes into the QoreSeal registry. Her link points to that key, not to a balance."],
  ["The payer seals a secret to it", "The browser of the payer makes a shared secret and 1,568 bytes of ciphertext. The secret gives a brand new address."],
  ["One transaction carries both", "QoreX signs it. The fUSD goes to the new address, and the ciphertext goes on chain as the announcement."],
  ["Only Rina can open it", "Her inbox tries every announcement with her secret key. She spends what opens with two signatures, secp256k1 and ML-DSA-87."],
] as const;

/** The landing page (design canvas, Main board): the benefit first, one live figure, the two methods, the honest limits and the comparison. */
export default function Home() {
  return (
    <>
      <SiteHeader
        action={
          <nav aria-label="Sections" className={styles.sections}>
            <a href="#methods">Ways to get paid</a>
            <a href="#how">How it works</a>
            <a href="#public">What stays public</a>
            <a href="#compared">Compared</a>
            <Link href="/deck">Deck</Link>
            <Link href="/inbox" className={ui.secondary}>
              <span className={styles.long}>Open my inbox</span>
              <span className={styles.short}>Inbox</span>
            </Link>
          </nav>
        }
      />
      <main className={styles.landing}>
        <section className={styles.hero}>
          <div>
            <h1 className={`${styles.heroTitle} ${styles.up}`}>Quantum-safe stealth payments.</h1>
            <p className={`${styles.heroLede} ${styles.up} ${styles.u1}`}>
              Get paid in crypto with one link. Each payment lands in a new address, so nobody who reads the chain can link your payments to you.
              Quantum-safe means that this stays true after Q-Day, the day a quantum computer breaks the keys of the wallets in use now.
            </p>
            <div className={`${styles.actions} ${styles.up} ${styles.u2}`}>
              <HeroCta />
              <Link href={DEMO_PAY_PATH} className={styles.textLink}>
                See what a payer sees <span className={styles.arrow}>→</span>
              </Link>
            </div>
          </div>
          <figure className={`${styles.fig1} ${styles.up} ${styles.u3}`}>
            <div className={styles.field}>
              <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
              <FigLattice />
            </div>
            <figcaption className={ui.caption}>
              <span className={ui.captionLabel}>Fig. 1</span>
              <span>Each point is an announcement on chain. Your key opens three of them. A quantum computer cannot tell which three.</span>
            </figcaption>
          </figure>
        </section>

        <ol className={`${styles.facts} ${styles.quick} ${styles.up} ${styles.u4}`}>
          {QUICK.map(([title, body], index) => (
            <li key={title}>
              <span className={styles.quickTitle}>
                {index + 1}. {title}
              </span>
              <span>{body}</span>
            </li>
          ))}
        </ol>

        <section className={`${styles.section} ${styles.reveal}`} aria-labelledby="problem">
          <p id="problem" className={styles.kicker}>
            The problem
          </p>
          <blockquote className={styles.quote}>“The chain itself is the archive.”</blockquote>
          <div className={styles.twoText}>
            <p>One wallet address shows each client your balance and what your other clients paid you. A stealth payment goes to a new address each time, so the payments are not linked.</p>
            <p>Stealth payments today use elliptic-curve math, and the chain keeps every record. A quantum computer can break that math later and match every old payment to its recipient. A leak of privacy cannot be reversed by a fork.</p>
          </div>
          <p className={styles.source}>ethresear.ch, March 2026 · L2BEAT rates ECDH stealth payments “Exposed” to a future adversary</p>
        </section>

        <section id="methods" className={`${styles.section} ${styles.reveal}`} aria-labelledby="methods-title">
          <h2 id="methods-title" className={styles.h2}>
            Two ways to get paid
          </h2>
          <p className={styles.lede}>
            Each payment lands in a new one-time account that only you can find. Start with the payment link. Use a stealth address for a client
            who pays from another wallet or from an exchange.
          </p>
          <div className={styles.methods}>
            {METHODS.map((method) => (
              <article key={method.title} className={styles.method}>
                <p className={styles.kicker}>{method.kicker}</p>
                <h3 className={styles.methodTitle}>{method.title}</h3>
                <dl className={styles.methodFacts}>
                  {method.facts.map(([term, value]) => (
                    <div key={term}>
                      <dt>{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link href={method.href} className={styles.textLink}>
                  {method.action} <span className={styles.arrow}>→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className={`${styles.section} ${styles.reveal}`} aria-labelledby="how-title">
          <h2 id="how-title" className={styles.h2}>
            How a link payment travels
          </h2>
          <div className={styles.journey}>
            <ol className={styles.steps}>
              {STEPS.map(([title, body], index) => (
                <li key={title} className={`${styles.step} ${styles[`s${index + 1}`]}`}>
                  <span className={`${styles.num} ${styles[`s${index + 1}`]}`}>{index + 1}</span>
                  <div>
                    <h3 className={styles.stepTitle}>{title}</h3>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <figure className={styles.fig2}>
              <FigJourney />
              <figcaption className={ui.caption}>
                <span className={ui.captionLabel}>Fig. 2</span>
                <span>What a chain observer sees: a transfer to a new address and an announcement of 1,570 bytes. Nothing points to Rina.</span>
              </figcaption>
            </figure>
          </div>
          <dl className={`${styles.facts}`}>
            {FACTS.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="public" className={`${styles.section} ${styles.reveal}`} aria-labelledby="public-title">
          <h2 id="public-title" className={styles.h2}>
            What stays hidden, and what does not
          </h2>
          <p className={styles.lede}>Bellaso hides who receives a payment. It does not hide who pays or how much.</p>
          <div className={styles.lists}>
            <div>
              <h3 className={`${styles.listTitle} ${styles.hiddenTitle}`}>Hidden, also after Q-Day</h3>
              <ul className={styles.list}>
                {HIDDEN.map((item) => (
                  <li key={item}>
                    <span className={`${styles.mark} ${styles.markHidden}`} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={`${styles.listTitle} ${styles.publicTitle}`}>Public</h3>
              <ul className={styles.list}>
                {PUBLIC.map((item) => (
                  <li key={item}>
                    <span className={`${styles.mark} ${styles.markPublic}`} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="compared" className={`${styles.section} ${styles.reveal}`} aria-labelledby="compared-title">
          <h2 id="compared-title" className={styles.h2}>
            Next to other stealth payments
          </h2>
          <p className={styles.lede}>All of them hide who gets paid, and none hide who pays. The difference is what happens after Q-Day.</p>
          <ComparedTable />
          <p className={styles.source}>
            Sources: L2BEAT privacy ratings (Umbra, Fluidkey), BIP-352, Gitcoin (Umbra usage), Crypto Briefing, June 2026 (Fluidkey usage). The three other
            products sign with elliptic-curve keys.
          </p>
        </section>

        <section className={`${styles.section} ${styles.story} ${styles.reveal}`} aria-labelledby="name">
          <img src="/brand/bellaso-mark.svg" alt="" width={96} height={96} className={styles.storyMark} />
          <div>
            <h2 id="name" className={styles.h2}>
              Named after the cryptographer history forgot
            </h2>
            <p>
              In 1553 Giovan Battista Bellaso published a cipher with a key. History gave the credit to Vigenère. It seemed the right name for payments
              that no chain observer can trace back to you.
            </p>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <p>Testnet only. All tokens are test tokens with no value.</p>
        <nav aria-label="Project">
          <Link href="/deck">Deck</Link>
          <a href={REPO}>Source code</a>
          <a href={`${REPO}/blob/main/docs/THREAT_MODEL.md`}>Threat model</a>
          <a href={`${REPO}/tree/main/apps/gateway`}>Run the gateway yourself</a>
        </nav>
      </footer>
    </>
  );
}
