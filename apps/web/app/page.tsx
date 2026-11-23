import Link from "next/link";
import type { CSSProperties } from "react";
import { FigJourney } from "./fig-journey";
import { HeroCta } from "./hero-cta";
import { SiteHeader } from "./site-header";
import ui from "./ui.module.css";
import styles from "./landing.module.css";

const REPO = "https://github.com/immanueljanis/bellaso";
/** The testnet demo recipient. Its only funder is the Bellaso sponsor, so its payments stay unlinked (AC6). */
const DEMO_RECIPIENT = "qor130jxjehyvf2ndr6lyutl9e09plv7k0epyhnmyz";
/** The KEM key fingerprint of the demo recipient, checked against the chain on 23 Nov 2026. */
const DEMO_FINGERPRINT = "b28fe7b8c9575ffb8d137581d33c2b2b";

interface Point {
  left: string;
  top: string;
  delay: string;
  enter: string;
  label?: string;
}

/** The points of Fig. 1: a skewed grid of announcements, three of them yours. The scan line reaches each one by its x position. */
function announcementField(): Point[] {
  const width = 600;
  const height = 520;
  const scanSeconds = 4.2;
  const mine: Record<string, string> = { "5,3": "150 fUSD", "9,6": "0.25 fETH", "7,9": "80 fUSD" };
  const points: Point[] = [];
  for (let row = 0; row < 12; row++) {
    for (let column = -4; column < 17; column++) {
      const x = 24 + column * 38 + row * 13;
      const y = 26 + row * 42;
      if (x < 14 || x > width - 14 || y > height - 14) continue;
      points.push({
        left: `${((x / width) * 100).toFixed(2)}%`,
        top: `${((y / height) * 100).toFixed(2)}%`,
        delay: `${((x / width) * scanSeconds).toFixed(2)}s`,
        enter: `${(0.5 + row * 0.05 + (x / width) * 0.4).toFixed(2)}s`,
        label: mine[`${column},${row}`],
      });
    }
  }
  return points;
}

const FACTS = [
  ["Recipient hidden with", "ML-KEM-1024 · FIPS 203"],
  ["Funds spent with", "ML-DSA-87 + secp256k1"],
  ["Keys live in", "Your browser, nowhere else"],
  ["Runs on", "QoreChain testnet"],
] as const;

/** The two payment methods (SPEC section 2.2): the hero names them, the methods section explains them. */
const METHODS = [
  {
    kicker: "Method 1",
    title: "Payment link",
    short: "One link for every payer. They pay with QoreX.",
    facts: [
      ["The payer uses", "QoreX, with one signature"],
      ["On chain", "A transfer to a new address, and 1,568 bytes of ML‑KEM‑1024 ciphertext"],
      ["The new address comes from", "A secret that the payer seals to your ML‑KEM‑1024 key. Only your key opens it."],
      ["Best for", "Many payers, a public page"],
    ],
    href: "/receive",
    action: "Get my payment link",
  },
  {
    kicker: "Method 2",
    title: "Stealth address",
    short: "One address for each client. They pay from any wallet.",
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

const HIDDEN = [
  "The link between a payment and the recipient",
  "The link between two payments to the same recipient",
  "The funds: a spend needs both signatures",
];

const PUBLIC = [
  "The payer address, the amount and the token",
  "The time of the payment and of the spend",
  "That a transaction is a Bellaso payment",
  "Your IP and the link you open: our gateway sees them, the chain does not",
];

const COMPARED = {
  products: [
    ["Silent Payments", "Bitcoin, BIP-352"],
    ["Umbra", "Ethereum, 270,000+ payments"],
    ["Fluidkey", "Payment links, $840M sent"],
    ["Bellaso", "QoreChain testnet"],
  ],
  rows: [
    ["Hides who gets paid", "Yes", "Yes", "Yes", "Yes"],
    ["Who pays and how much", "Public", "Public", "Public", "Public"],
    ["Who sees your payment list", "Only you", "Only you", "You and Fluidkey", "Only you"],
    ["Old payments private after Q-Day", "No", 'No, rated "Exposed"', "If you trust the service", "Yes, ML-KEM-1024"],
    ["Funds safe after Q-Day", "No", "No", "No", "Yes, ML-DSA-87"],
  ],
} as const;

/** The landing page (design canvas, Main board): the two methods first, one live figure, the honest limits and the comparison. */
export default function Home() {
  const points = announcementField();
  return (
    <>
      <SiteHeader
        action={
          <nav aria-label="Sections" className={styles.sections}>
            <a href="#methods">Two methods</a>
            <a href="#how">How it works</a>
            <a href="#public">What stays public</a>
            <a href="#compared">Compared</a>
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
              No chain observer can link a payment to you, today or after Q-Day. Get paid in two ways:
            </p>
            <ul className={`${styles.heroMethods} ${styles.up} ${styles.u1}`}>
              {METHODS.map((method) => (
                <li key={method.title}>
                  <span className={styles.heroMethodTitle}>{method.title}</span>
                  <span className={styles.heroMethodText}>{method.short}</span>
                </li>
              ))}
            </ul>
            <div className={`${styles.actions} ${styles.up} ${styles.u2}`}>
              <HeroCta />
              <Link href={`/pay/${DEMO_RECIPIENT}#k=${DEMO_FINGERPRINT}`} className={styles.textLink}>
                See a payment link <span className={styles.arrow}>→</span>
              </Link>
            </div>
          </div>
          <figure className={`${styles.fig1} ${styles.up} ${styles.u3}`}>
            <div
              className={styles.field}
              role="img"
              aria-label="Figure 1. A field of announcements. A scan line passes over all of them. Three light up: they belong to you."
            >
              <span className={`${ui.corner} ${ui.tl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.tr}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.bl}`} aria-hidden="true" />
              <span className={`${ui.corner} ${ui.br}`} aria-hidden="true" />
              {points.map((point) =>
                point.label ? (
                  <span key={point.left + point.top} className={styles.mine} style={{ left: point.left, top: point.top }} aria-hidden="true">
                    <span className={styles.mineDot} />
                    <span className={styles.found} style={{ animationDelay: point.delay }} />
                    <span className={styles.foundLabel} style={{ animationDelay: point.delay }}>
                      {point.label}
                    </span>
                  </span>
                ) : (
                  <span
                    key={point.left + point.top}
                    className={styles.point}
                    style={{ left: point.left, top: point.top, animationDelay: point.enter } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span className={styles.ping} style={{ animationDelay: point.delay }} />
                  </span>
                ),
              )}
              <div className={styles.scan} aria-hidden="true" />
            </div>
            <figcaption className={ui.caption}>
              <span className={ui.captionLabel}>Fig. 1</span>
              <span>Each point is an announcement on chain. Your key opens three of them. Nobody else can tell which three.</span>
            </figcaption>
          </figure>
        </section>

        <dl className={`${styles.facts} ${styles.up} ${styles.u4}`}>
          {FACTS.map(([term, value]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <section id="methods" className={`${styles.section} ${styles.reveal}`} aria-labelledby="methods-title">
          <h2 id="methods-title" className={styles.h2}>
            Two methods, both quantum-safe
          </h2>
          <p className={styles.lede}>
            Each payment lands in a new one-time account. The methods differ in how the payer pays and where the new address comes from. Every
            spend needs two signatures: secp256k1 and {"ML‑DSA‑87"}.
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

        <section className={`${styles.section} ${styles.reveal}`} aria-labelledby="problem">
          <p id="problem" className={styles.kicker}>
            The problem
          </p>
          <blockquote className={styles.quote}>“The chain itself is the archive.”</blockquote>
          <div className={styles.twoText}>
            <p>Stealth payments today hide the recipient with elliptic-curve math. Each payment leaves a record on chain, and the chain keeps every record.</p>
            <p>A quantum computer can break that math later and match every old payment to its recipient. A leak of privacy cannot be reversed by a fork.</p>
          </div>
          <p className={styles.source}>ethresear.ch, March 2026 · L2BEAT rates ECDH stealth payments “Exposed” to a future adversary</p>
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
                <span>What a chain observer sees: a transfer to a new address and 1,570 bytes of ciphertext. Nothing points to Rina.</span>
              </figcaption>
            </figure>
          </div>
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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  {COMPARED.products.map(([name, detail]) => (
                    <th key={name} scope="col" className={name === "Bellaso" ? styles.us : undefined}>
                      {name}
                      <span>{detail}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARED.rows.map(([question, ...answers]) => (
                  <tr key={question}>
                    <th scope="row">{question}</th>
                    {answers.map((answer, index) => (
                      <td key={`${question}-${index}`} className={index === 3 ? styles.us : undefined}>
                        {answer}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <a href={REPO}>Source code</a>
          <a href={`${REPO}/blob/main/docs/THREAT_MODEL.md`}>Threat model</a>
          <a href={`${REPO}/tree/main/apps/gateway`}>Run the gateway yourself</a>
        </nav>
      </footer>
    </>
  );
}
