# SPEC: Bellaso

> **Hackathon:** Build Before Q-Day, the QoreChain Developer Fest.
> **Category:** Encrypted Apps.
> **Deadline:** 2 Dec 2026, 23:59 UTC (3 Dec 2026, 06:59 WIB).
> **Team:** 2 to 3 persons.
> **Stack:** TypeScript, Next.js, QoreChain SDK.
> **Network:** QoreChain testnet `qorechain-diana`. All tokens are test tokens with no value.
> **Repository:** a new public repository with the Apache-2.0 licence. All commits are made during the fest.
>
> This document is the reference for product decisions. It has priority over all other documents.
> Related documents:
> - `docs/LANDSCAPE.md`: competitors, market and sources.
> - `docs/TECH_SPEC.md`: cryptography, data formats, chain integration and gates.
> - `docs/THREAT_MODEL.md`: what Bellaso protects and what it does not protect.
> - `docs/PLAN.md`: the day plan.
>
> All documents use ASD-STE100 Simplified Technical English.

---

## 1. Problem

All stealth payment systems in use today hide the recipient with Elliptic-Curve Diffie-Hellman (ECDH). Examples are Umbra, ERC-5564, Squidl, Bitcoin Silent Payments, Railgun notes and Monero.

Each payment writes an announcement to a public chain. The chain keeps the announcement permanently.

A quantum computer can break elliptic-curve cryptography. When this occurs, an attacker can calculate the shared secret of each old announcement. The attacker can then match each old payment to its recipient.

This attack is "harvest now, de-anonymize later". It is different from the theft of funds:

- A chain can stop the theft of funds with a hard fork. Zcash and the Ethereum Foundation have plans for this.
- A chain cannot repair a privacy loss. The data is already public.

Sources (full list in `docs/LANDSCAPE.md`):

- An Ethereum researcher wrote: "the chain itself is the archive" and "privacy breaches are irreversible" (ethresear.ch, March 2026).
- L2BEAT gives Umbra and Monero the rating "Future adversary: Exposed".
- Google Quantum AI estimates that a quantum computer with fewer than 500,000 physical qubits can break secp256k1 in a few minutes (March 2026).

## 2. Product

Bellaso is a private payment link. The recipient privacy of Bellaso stays safe after Q-Day.

Bellaso does three things:

1. It hides the recipient with **ML-KEM-1024**, not with ECDH.
2. It sends each payment to a **one-time account**. The one-time account spends only with a hybrid signature: **secp256k1 + ML-DSA-87**.
3. It makes and uses all secret keys **in the browser or the CLI of the user**. No server, TEE or operator holds a key. The Bellaso gateway relays and indexes public chain data only.

**One-line description (UI and pitch):** "Private payment links that stay private after Q-Day."

**Pitch metaphor:** a *pentimento* is an old layer of a painting that becomes visible again after many years. Each ECDH stealth payment is a pentimento. It waits to become visible.

### 2.1 The name

Giovan Battista Bellaso was an Italian cryptographer of the Renaissance. In 1553 he published a polyalphabetic cipher with a key. History later gave the credit to Vigenère. Bellaso is the cryptographer that history forgot. The product makes the recipient of a payment invisible in the same way.

### 2.2 Two payment methods

| | Method 1: Payment link | Method 2: Stealth address |
|---|---|---|
| What the recipient shares | One link for all payers | One new address for each client or invoice |
| What the payer needs | The Bellaso pay page and QoreX | Any wallet that can send to a `qor1` address. A normal transfer. |
| Where the secret tweak comes from | ML-KEM-1024 shared secret, made in the browser of the payer | The post-quantum root secret of the recipient and an index, made in the browser of the recipient |
| Announcement on chain | Yes (1,570 bytes) | No |
| Gas for the spend | The payer sends 0.15 QOR with the payment | The Bellaso sponsor sends gas when the recipient spends, or the payer adds QOR |
| Weak point | None for chain observers | If the recipient gives one stealth address to many payers, those payments are linked to each other (not to account A) |

Both methods make one-time accounts. Both use the same inbox, the same spend flow and the same hybrid signatures.

## 3. Users

### 3.1 Primary user: the freelancer

Rina is a freelance designer in Bandung. Clients in other countries pay her in stablecoins.

Her problem today:

- She gives one wallet address to all clients.
- Each client can see all her income and her balance.
- A normal stealth address stops this today. After Q-Day, all her history becomes visible.

Market size facts (sources in `docs/LANDSCAPE.md`):

- Indonesia has 13.6 million independent workers (BPS, February 2026).
- Indonesia has 22.93 million crypto accounts (OJK, July 2026).
- In a Stripe survey, 57% of independent workers want to receive stablecoin payouts (2026).

### 3.2 Secondary user: the donor

A donor sends money to a journalist or a creator. The donor and the recipient do not want a public link between them. The flow is the same as the freelancer flow. The pitch mentions this user only.

## 4. User story

1. Rina makes her Bellaso one time. She gets a payment link.
2. A client opens the link and types 150 fUSD.
3. The client signs one transaction with the QoreX wallet.
4. The payment goes to a new address. This address has no public link to Rina.
5. Rina opens her inbox. Bellaso scans the announcements and finds the payment.
6. Rina spends the funds from the one-time account. The transaction has a hybrid post-quantum signature.
7. A studio in Kyoto wants to pay from its usual wallet. Rina selects **Get paid › Stealth address**, types the label "Studio Kyoto" and gets a new address.
8. The studio sends 320 fUSD to that address with a normal transfer. It does not open Bellaso.
9. The payment appears in Rina's inbox with the label "Studio Kyoto". Rina spends it in the same way as in step 6.

## 5. Goals, non-goals and anti-goals

### 5.1 Goals

1. Show the full flow on testnet: create the recipient account, share the link, pay, scan and spend. Each step makes real transactions from the project addresses.
2. Make the recipient privacy quantum-safe. An announcement contains only an ML-KEM-1024 ciphertext and a view tag.
3. Make the spend quantum-safe. Each one-time account registers its own ML-DSA-87 key and always signs with a hybrid signature.
4. Satisfy all four requirements of the Encrypted Apps category (section 10.2).
5. Supply an honest threat model, a clear README and a video of 3 minutes or less.
6. Accept a payment from any wallet through a stealth address (method 2). Chain observers, today and after Q-Day, cannot link it to account A.

### 5.2 Non-goals (for the fest)

- Payer privacy (also called sender privacy). The payer address stays public.
- Amount privacy. The amount and the token stay public.
- Mainnet deployment.
- A mobile app.
- Card or fiat payments.
- Support for other chains.
- Token swaps.
- Social recovery and multisig.

### 5.3 Anti-goals (these cause failure)

- Do not make a mixer or a pool. The regulatory risk is high. Other fest categories already have many vaults.
- Do not keep keys or seeds on a server.
- Do not claim privacy that Bellaso does not give. The jury gives 20% of the score to post-quantum correctness.
- Do not combine funds from many one-time accounts into one account without a warning. This links the payments.
- Do not build a feature outside section 7 before all criteria in section 11 pass.

## 6. Terms

Each term has one meaning in all Bellaso documents.

| Term | Meaning |
|---|---|
| **Recipient account (A)** | The QoreChain account of the recipient. Its ML-DSA-87 key and its KEM key are registered on chain. |
| **KEM key** | The ML-KEM-1024 public key of account A. The payer uses it to make a shared secret. |
| **Shared secret** | 32 secret bytes. Only the payer and the recipient know them. |
| **One-time account** | A new account that receives payments. Its address is `P_A + h·G`. In method 1, the tweak `h` comes from the shared secret. In method 2, it comes from the post-quantum root secret and an index. |
| **Payment link (method 1)** | A link to the pay page of the recipient. The browser of the payer makes a new one-time account and an announcement for each payment. |
| **Stealth address (method 2)** | The address of a one-time account that the recipient makes for one client or one invoice. Any wallet can pay it with a normal transfer. The recipient gives it a private label. |
| **Announcement** | Public data for one method 1 payment: the ML-KEM-1024 ciphertext (1,568 bytes) and the view tag (1 byte). It does not contain the address of account A. Method 2 writes no announcement. |
| **View tag** | 1 byte from the shared secret. It makes the scan faster. |
| **Scan** | The recipient opens each announcement with the KEM secret key and finds the payments for account A. |
| **Spend** | Send funds from a one-time account with a hybrid signature. |
| **Hybrid signature** | A secp256k1 signature and an ML-DSA-87 signature on the same transaction. QoreChain requires both. |
| **Payer** | The person who pays. |
| **Recipient** | The person who receives the payment. |

## 7. Product flows

### 7.1 Recipient setup (one time)

1. Open Bellaso and select **Create my Bellaso**. The app makes a Bellaso recovery phrase in the browser. QoreX does not hold this phrase, because QoreX does not export private keys and does not register KEM keys for a website. The browser keeps the phrase in a vault, encrypted with a passphrase (`docs/TECH_SPEC.md` section 10). The recipient can also restore an existing phrase.
2. The Bellaso gateway sends 0.12 QOR to account A from the sponsor wallet. The QOR pays the two setup fees. In gates G1 and G2 these fees were 58,763 and 38,120 uqor, about 0.097 QOR in total (MEASURED). If the sponsor refuses or is not available, the app shows the reason. Then the recipient sends QOR from QoreX or from the faucet, and the app waits for it.
3. The app registers the ML-DSA-87 key of account A with a proof of possession. This occurs one time.
4. The app registers the KEM key of account A in the QoreSeal key registry. This transaction has a hybrid signature.
5. The app shows the payment link and a copy button. If the Handles kit works on testnet, the link uses an `@handle`.

Each step first reads the chain and skips the work that is already done. Thus an unlock of an existing vault finishes an open setup, or shows the link.

### 7.2 Payer: pay

1. Open the link. The app reads the secp256k1 public key and the KEM key of account A from the chain, through the Bellaso gateway.
2. Type the amount of fUSD. The app calculates the one-time address in the browser.
3. Connect QoreX. Sign **one native transaction**. The transaction sends the fUSD and a QOR gas allowance to the one-time address. It also writes the announcement as 7 short records into the Bellaso announcement contract. `docs/TECH_SPEC.md` sections 5 and 7.2 give the details. The fee was 0.457 QOR through QoreX in gate G4 (MEASURED), because QoreX sets the gas limit itself. The payer also sends the 0.15 QOR allowance, so a payment costs the payer about 0.61 QOR on top of the amount.
4. The receipt page shows: "Paid to a fresh address. No chain observer can link it to this link, now or after Q-Day." It also shows the one-time address and a link to the raw transaction through the gateway. No testnet explorer is confirmed (`docs/TECH_SPEC.md` section 13).

### 7.3 Recipient: inbox

1. On each scan, the app reads all announcements and all transfers from the Bellaso gateway. The request contains no address. Thus the gateway does not know which announcements or transfers belong to the recipient.
2. For each announcement, the app does these steps:
   1. Decapsulate the ciphertext with the KEM secret key.
   2. Compare the view tag.
   3. If the view tag is correct, calculate the one-time address. Compare it with the destination of the transfer in the same transaction.
3. The inbox shows the amount, the block height, the method and the status of each payment. The amount comes from the payment transaction. The app does not query the balance of a one-time account before a spend (`docs/THREAT_MODEL.md` R7).

### 7.4 Recipient: spend

1. Select a payment. Select **Spend**.
2. The app calculates the secp256k1 key and the ML-DSA-87 key of the one-time account.
3. On the first spend, the app sends a first transaction. It registers the ML-DSA-87 key of the one-time account with a proof of possession.
4. The app sends a second transaction. It sends the funds to the destination with a hybrid signature.
5. If the destination is account A or another one-time account of the same recipient, the app shows a warning: "This links your payments together."

### 7.5 Method 2: stealth address

Recipient:

1. Open **Get paid** and select **Stealth address**.
2. Type a label, for example "Studio Kyoto". Only this browser keeps the label, encrypted in the vault.
3. Select **Make a stealth address**. The app derives the next one-time account from the post-quantum root secret and the next index. No transaction occurs.
4. The app shows the `qor1` address, a QR code and a copy button. Optional: the switch **Ask the payer to add 0.15 QOR for gas**.
5. The list **Your stealth addresses** shows each label, address, received amount and status: waiting, paid, or paid more than one time. "Paid more than one time" shows the warning: "Payments to this address are linked to each other. Make a new address for each client."

Payer:

1. Send the amount to the `qor1` address from any wallet, with a normal transfer. The payer does not open Bellaso.

Inbox and spend:

1. The inbox finds the payment from the transfer feed of the gateway. It does not query the address directly (`docs/THREAT_MODEL.md` R7).
2. The payment shows the label and the method "Stealth address".
3. The spend flow is the same as section 7.4. If the address has too little QOR for the two spend fees, the app first asks the Bellaso sponsor for 0.12 QOR of gas.

### 7.6 Stretch features (only after all criteria in section 11 pass)

- **Proof for an auditor:** the recipient exports a proof for one payment. The other payments stay hidden.
- **Sealed invoice note:** the payer adds a note. QoreSeal encrypts the note to the recipient.

## 8. What Bellaso hides and what it does not hide

| Data | Status | Cause |
|---|---|---|
| The link between a payment and account A | **Hidden, also after Q-Day** | Only the holder of the ML-KEM-1024 secret key can get the shared secret. |
| The link between two payments to the same recipient | **Hidden** | Each payment uses a different shared secret, and thus a different address. |
| The funds in a one-time account | **Protected from theft** | A spend needs a secp256k1 signature and an ML-DSA-87 signature. |
| The payer address | Public | Non-goal. |
| The amount and the token | Public | Non-goal. |
| The time of the payment and the time of the spend | Public | An observer can use the time for correlation. `docs/THREAT_MODEL.md` gives the details. |
| The fact that a transaction is a Bellaso payment | Public | The announcement has a fixed format. |
| The IP address of a payer and the link that the payer opens | Visible to the Bellaso gateway, not to the chain | The payer page reads account A through the gateway. `docs/THREAT_MODEL.md` R17 gives the details. |
| Two payments to the same stealth address (method 2) | Linked to each other, not to account A | They have the same destination. The app warns the recipient. |
| The IP address that asks for gas for a stealth address | Visible to the Bellaso gateway, not to the chain | Method 2 only. The payer can add QOR to avoid it. `docs/THREAT_MODEL.md` R23. |

## 9. Position against competitors

`docs/LANDSCAPE.md` has the full map of 23 projects. This table shows the four nearest projects.

| | Squidl | Specter | ERC-8441 (draft) | **Bellaso** |
|---|---|---|---|---|
| Quantum-safe announcement | No (ECDH) | Yes, ML-KEM-768 | Yes, ML-KEM-768 + ECDH | **Yes, ML-KEM-1024** |
| Quantum-safe spend | No | No | No ("Spending stays vulnerable") | **Yes, ML-DSA-87** |
| Location of the keys | TEE (Intel SGX) | Server | Not specified | **Browser of the user** |
| Key binding | ENS | ENS | On-chain registry | **QoreSeal registry + ML-DSA-87 account** |

### 9.1 Unique selling points

1. **Quantum-safe on two sides.** An attacker cannot de-anonymize old payments. An attacker cannot steal the funds.
2. **No party holds a key.** Only the user holds the keys. The gateway relays public data only, and the CLI works without it.
3. **Native to a post-quantum chain.** Bellaso uses the highest NIST security category (Category 5) for both the KEM and the signature.

## 10. Fit with the fest judging

### 10.1 Jury rubric (the same for all categories)

| Criterion | Weight | How Bellaso earns it |
|---|---|---|
| Works as described | 25% | The flows in sections 7.1 to 7.5 work on testnet. The video shows the same steps as the README. |
| QoreChain tech usage, verified in the repository and on chain | 25% | Bellaso targets 6 or more verified features (section 10.3). |
| Post-quantum correctness and security | 20% | Domain-separated derivations, proofs of possession and an honest threat model. |
| Originality | 15% | No stealth payment project is in the 130 fest projects. Bellaso is the only design that is quantum-safe on two sides. |
| Clarity, UX and documentation | 15% | Three screens, a README, diagrams and a list of terms. |

Source: https://build.qorechain.io/faq

### 10.2 Encrypted Apps requirements

| Requirement | How Bellaso satisfies it |
|---|---|
| ML-KEM-1024 encryption | The payer encapsulates to the KEM key of the recipient. |
| Registered recipient keys | The KEM key of the recipient is in the QoreSeal key registry. |
| ML-DSA key binding | The KEM key belongs to account A, which has a registered ML-DSA-87 key. Each one-time account also registers an ML-DSA-87 key. |
| Client-side encryption and decryption | The payer encapsulates in the browser. The recipient decapsulates in the browser. |

Source: https://build.qorechain.io/prizes

### 10.3 Target verified features

- Hybrid ML-DSA-87 transactions.
- PQC key registration with proof of possession.
- QoreSeal and the encryption key registry.
- Test tokens fUSD, fETH, fBTC.
- Handles (if the kit works on testnet).
- Approved Native contracts (if the jury counts an own instance of code 865, `qday-receipts`; ask in the fest Discord).
- MCP server or qore CLI (for the scan script).

### 10.4 Other prizes

- **Best AI-Native Build ($500):** add `AI_USAGE.md`. It shows the workflow, the AI output and the human contribution.
- **Regional Award, Asia-Pacific ($200):** for the highest-scored project in the region that wins no other prize.
- **Top-Quality Award ($250):** for a jury score of 70 or more and no other prize.
- **People's Choice:** a mainnet vote from 6 to 15 December. Use normal promotion only. More than one account for one person causes disqualification.

## 11. Acceptance criteria

Prove each criterion on testnet or with command output. A local unit test alone is not sufficient.

| ID | Criterion | Proof |
|---|---|---|
| AC1 | The recipient setup registers the ML-DSA-87 key of account A, and the possession is proven. | A REST query of the PQC status of account A. |
| AC2 | The KEM key of account A is registered, and other users can read it. | A REST query of the QoreSeal registry for account A. |
| AC3 | One payment is one native transaction that QoreX signs. It contains the transfer to the one-time address and the announcement. It does not contain the address of account A. | The transaction hash and the transaction body. |
| AC4 | The scan finds 100% of the payments to account A and 0 false positives in 20 or more announcements. Some announcements are for other recipients. | The output of the `scan` script on testnet. |
| AC5 | A spend from a one-time account succeeds with a hybrid signature. The chain emits the `pqc_hybrid_verify` event. | The transaction hash and the event. |
| AC6 | A third party has all chain data and all public data of account A, but no secret. The third party cannot link any payment to account A. | The `link-attempt` script uses public data only and finds 0 matches. |
| AC7 | Secret keys never leave the browser or the CLI of the user. | A code review and the gateway schema tests. No gateway route accepts a key. |
| AC8 | `bun run check` passes from the repository root. | The command output. |
| AC9 | All submission items in section 13 are complete. | The checklist. |
| AC10 | The deployed gateway serves the same announcements as the chain, and the browser flows work through it. | `scan.ts --source gateway` and `--source chain` give the same result. Gate G8 output. |
| AC11 | A stealth address (method 2) receives a normal transfer from QoreX **Send**, without the Bellaso pay page. The inbox finds it with the right label. A spend from it succeeds with a hybrid signature. `link-attempt` finds no link to account A. | Transaction hashes, the `scan` output and the `link-attempt` output. |
| AC12 (optional, gate G9) | A stealth address receives fUSD from an EVM wallet (MetaMask) and the recipient spends it with a hybrid signature. | Transaction hashes. |

## 12. Demo video (3 minutes or less)

| Time | Content |
|---|---|
| 0:00 to 0:20 | The problem: the L2BEAT rating "Future adversary: Exposed" for ECDH stealth payments. The quote: "the chain itself is the archive." |
| 0:20 to 0:45 | Rina makes her Bellaso and gets the link. |
| 0:45 to 1:10 | Method 1: a client pays 150 fUSD through the link with QoreX. |
| 1:10 to 1:25 | The raw transaction shows the funds in a new address with no link to Rina. No testnet explorer is confirmed. |
| 1:25 to 1:45 | Method 2: Rina makes a stealth address for "Studio Kyoto". The studio pays from the normal QoreX Send screen. |
| 1:45 to 2:10 | The inbox of Rina finds both payments. |
| 2:10 to 2:35 | Rina spends the funds. The video shows the `pqc_hybrid_verify` event. |
| 2:35 to 3:00 | The comparison with other stealth payments. The one-line description. |

## 13. Submission checklist (before 2 Dec 2026, 23:59 UTC)

- [ ] Each team member completes the registration: GitHub, personal details, X and the QoreX testnet address.
- [ ] The GitHub repository is public. GitHub detects the Apache-2.0 `LICENSE` file.
- [ ] The project page lists every `qor1` address the project uses: account A, the CLI payer, the sponsor wallet and the announcement contract. The fest verifies features only from transactions of these addresses (FAQ, "Declared and Verified").
- [ ] The README contains the problem, the design, the run steps, the `qor1` testnet addresses and the credits (QoreChain kits, Squidl, Specter, ERC-5564, ERC-8441).
- [ ] The video is 3 minutes or less.
- [ ] The cover image is 16:9 and 1200×675 pixels or larger.
- [ ] `docs/THREAT_MODEL.md` is final.
- [ ] The gateway is deployed. `/v1/health` answers. The README gives the gateway URL and the self-hosting steps.
- [ ] `AI_USAGE.md` is in the repository.
- [ ] The project form shows the category Encrypted Apps and the country Indonesia.
- [ ] The team posts progress on X with #BuildBeforeQDay.

## 14. Decisions

1. The name is **Bellaso**.
2. The category is **Encrypted Apps**.
3. The primary story is a payment link for a freelancer.
4. Secret keys stay only in the browser or the CLI of the user.
5. Payer privacy and amount privacy are not in scope.
6. The repository is a Bun workspace: `apps/web` (Next.js on Vercel), `apps/gateway` (Bun + Fastify), `packages/core`, `packages/chain` and `scripts/`.
7. Bellaso has a gateway. The public QoreChain endpoints send no CORS headers (MEASURED on 23 Nov 2026). The gateway also indexes the announcements and the transfers, and sponsors the setup fees and the gas of stealth addresses. It keeps its state in memory and rebuilds its indexes from the chain. It never receives a secret. The team selected this design for a long-term product.
8. Bellaso has two payment methods: the payment link (method 1) and the stealth address (method 2). Method 2 lets a payer use any wallet. The team selected both on 23 Nov 2026.

## 15. Open items (closed on day 1 with a prototype)

Each item is a gate in `docs/PLAN.md`. `docs/TECH_SPEC.md` section 14 gives the tests.

Research on 23 Nov 2026 already closed some questions:

- The announcement goes into an own instance of code 865 (`qday-receipts`), as 7 base32768 records. QoreX decodes `MsgExecuteContract` (CONFIRMED). QoreX refuses `MsgCrossVMCall` (CONFIRMED).
- The SDK can register the KEM key without QoreX (CONFIRMED in code). QoreX refuses it (CONFIRMED).

Closed on 23 Nov 2026 (`docs/PLAN.md` section 3 has the evidence):

1. G1 (pass): the ML-DSA-87 key of account A uses the QoreX derivation `derivePqcCanonical`.
2. G2 (pass): KEM key registration on testnet works end to end.
3. G3 (pass): one transaction accepts `MsgSend` + 7 records. No contract gas limit stopped it.
4. G4 (pass): QoreX mobile signs that transaction. The fee was 0.457 QOR.
5. G5 (pass): the first spend costs about 0.093 QOR. Thus the default gas allowance of 0.15 QOR is enough.
6. G6 (pass): the CLI scan finds the payments.
7. G8 (pass): the SDK signs and broadcasts from the browser through the gateway.

Open:

1. G7: whether the Handles kit works on testnet (optional).
2. G9 (partial): which normal wallets can pay a stealth address. A plain `MsgSend` from the CLI payer works. QoreX Send is not tested yet. An EVM wallet (MetaMask, ERC-20 fUSD) only if the EVM transfer lands in the same native account and the recipient can spend it.
