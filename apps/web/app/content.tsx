import styles from "./landing.module.css";

export const REPO = "https://github.com/immanueljanis/bellaso";
/** The pay page of the testnet demo recipient. Its only funder is the Bellaso sponsor, so its payments stay unlinked (AC6). The fingerprint was checked against the chain on 23 Nov 2026. */
export const DEMO_PAY_PATH = "/pay/qor130jxjehyvf2ndr6lyutl9e09plv7k0epyhnmyz#k=b28fe7b8c9575ffb8d137581d33c2b2b";

export const HIDDEN = [
  "The link between a payment and the recipient",
  "The link between two payments to the same recipient",
  "The funds: a spend needs both signatures",
];

export const PUBLIC = [
  "The payer address, the amount and the token",
  "The time of the payment and of the spend",
  "That a transaction is a Bellaso payment",
  "Your IP and the link you open: our gateway sees them, the chain does not",
];

const COMPARED = {
  products: [
    ["Bellaso", "QoreChain testnet"],
    ["Silent Payments", "Bitcoin, BIP-352"],
    ["Umbra", "Ethereum, 270,000+ payments"],
    ["Fluidkey", "Payment links, $840M sent"],
  ],
  rows: [
    ["Hides who gets paid", "Yes", "Yes", "Yes", "Yes"],
    ["Who pays and how much", "Public", "Public", "Public", "Public"],
    ["Who sees your payment list", "Only you", "Only you", "Only you", "You and Fluidkey"],
    ["Old payments private after Q-Day", "Yes, ML-KEM-1024", "No", 'No, rated "Exposed"', "If you trust the service"],
    ["Funds safe after Q-Day", "Yes, ML-DSA-87", "No", "No", "No"],
  ],
} as const;

/** Bellaso next to three stealth payment products of the same category. Bellaso is the first column, so a phone shows it without a scroll. */
export function ComparedTable() {
  return (
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
                <td key={`${question}-${index}`} className={index === 0 ? styles.us : undefined}>
                  {answer}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
