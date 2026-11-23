# PLAN: Bellaso

> This document uses ASD-STE100 Simplified Technical English.
> Deadline: 2 Dec 2026, 23:59 UTC = 3 Dec 2026, 06:59 WIB. After the deadline, the project becomes read-only. There is no submit button.
> Freeze: 2 Dec 2026, 22:00 WIB. After the freeze, change only the README and the project form.

---

## 1. Roles

| Role | Owner | Work |
|---|---|---|
| P1: Core, chain and gateway | (name) | `packages/core`, `packages/chain`, `scripts/`, `apps/gateway`, gates G1 to G6 and G8, test vectors, gateway deployment |
| P2: Web app | (name) | `apps/web`, the vault, the QoreX payment, the Web Worker scan, UX |
| P3: Story and submission | (name, or shared by P1 and P2) | Registration, Discord, X posts, README, `AI_USAGE.md`, video, cover image |

## 2. Day plan

| Day | Date (WIB) | Work | Exit condition |
|---|---|---|---|
| 1 | Mon 23 Nov | All members register (GitHub, details, X, QoreX testnet). Make the public repository with the Apache-2.0 licence. Add the Bun workspace scaffold (`apps/web`, `apps/gateway`, `packages/core`, `packages/chain`, `scripts/`) and `bun run check`. Make the gateway host account. Post the idea in the fest Discord (section 4). Run gates G1 to G6 with CLI scripts. | Each gate is "pass" or has a selected fallback (section 3). |
| 2 | Tue 24 Nov | P1: complete `packages/core` (labels, derivations, announcement format, encoding, scan logic) and its unit tests (TECH_SPEC section 12.1). P2: the web layout and the pages with mock data. | `bun run check` passes. Test vectors are committed. |
| 3 | Wed 25 Nov | P1: complete `packages/chain` and the scripts `instantiate`, `setup`, `pay`, `scan`, `spend`. Run the full flow on testnet with the CLI. P2: the vault and `/create` with the SDK. | Evidence for AC1, AC2, AC4 and AC5 (CLI). |
| 4 | Thu 26 Nov | P1: the gateway (proxy, indexer, sponsor) and its tests. Deploy it. Run gate G8. P2: `/pay/[id]` and the payment with QoreX in the browser. | Evidence for AC3 (QoreX transaction hash) and AC10. |
| 5 | Fri 27 Nov | Web pages `/inbox` (scan in a Web Worker, data from the gateway) and `/spend/[tx]`. Attend Workshop 4 at 23:30 WIB (submission clinic). | The full flow works in the browser through the gateway. |
| 6 | Sat 28 Nov | Method 2. P1: `addr-tweak` derivation and test vectors, the transfer feed, `sponsor-gas`, `address.ts`, `send-plain.ts`, gate G9. P2: `/receive` with both methods, labels in the vault, method 2 rows in the inbox. | Evidence for AC11. |
| 7 | Sun 29 Nov | Link warnings and the reuse warning. Gateway limits and caps. `link-attempt.ts`. Demo data: 20 or more method 1 payments and 3 method 2 payments to 2 or more recipients. README with the architecture diagram, final `docs/THREAT_MODEL.md`, `AI_USAGE.md`. Deploy the web app to Vercel. | Evidence for AC6 and AC7. The deployed app works with the deployed gateway and the testnet. |
| 8 | Mon 30 Nov | Fix bugs. Cover image. Check each acceptance criterion again. Record a draft video. | AC1 to AC8, AC10 and AC11 pass. |
| 9 | Tue 1 Dec | Final video (3 minutes or less). X posts. Do the submission checklist (SPEC section 13). | AC9 passes. |
| 10 | Wed 2 Dec | Last check. Freeze at 22:00 WIB. | The project form is complete. |

Post progress on X with #BuildBeforeQDay on days 1, 3, 5, 7 and 9. The jury looks at the build history.

## 3. Gate status

Write the result and the evidence for each gate. TECH_SPEC section 14 defines the tests.

| Gate | Status | Evidence (transaction hash or output) | Selected fallback |
|---|---|---|---|
| G1 Account A | pending | | |
| G2 KEM key | pending | | |
| G3 Records | pending | | |
| G4 QoreX payment | pending | | |
| G5 Spend | pending | | |
| G6 Scan | pending | | |
| G7 Handles (optional) | pending | | |
| G8 Gateway (day 4) | pending | | |
| G9 Normal wallets for method 2 (day 6) | pending | | |

## 4. Fest Discord post (draft)

The FAQ says: "Post a short summary in the fest Discord: what it does, the category you are aiming for and the QoreChain features it uses. We will tell you how it fits and what the jury will look for."

> **Bellaso: private payment links that stay private after Q-Day** (Encrypted Apps)
>
> Stealth payments today (Umbra, ERC-5564, Silent Payments) hide the recipient with ECDH. Their announcements stay on chain forever, so a quantum computer can match every old payment to its recipient later. Bellaso fixes both sides:
> - The payer encapsulates to the recipient's ML-KEM-1024 key from the QoreSeal registry. Each payment goes to a new one-time account. The announcement holds only the KEM ciphertext and a view tag.
> - Each one-time account registers its own ML-DSA-87 key and spends with hybrid signatures, so the funds are also safe after Q-Day.
> - All keys stay in the user's browser. No TEE. Our gateway only relays and indexes public chain data, and the CLI works without it.
> - Two ways to get paid: a payment link (the payer uses QoreX), or a stealth address that the recipient makes for one client, so the client can pay from any wallet. Method 2 writes nothing on chain except the transfer.
>
> Features: hybrid ML-DSA-87 transactions, PQC key registration with proof of possession, QoreSeal and the KEM key registry, fUSD test tokens, an own instance of code 865 for announcements, QoreX for the payer.
>
> Questions: (1) Does an own instance of code 865 count as "Approved Native contracts"? (2) Is there a per-transaction limit for contract execution gas? We put 7 `MsgExecuteContract` records in one payment transaction.

## 5. Risks to the schedule

| Risk | Effect | Action |
|---|---|---|
| Gate G2 fails | The category requirement "registered recipient keys" fails. | Ask in Discord on day 1. Do not continue the web work until there is an answer. |
| Gate G4 fails | The payer cannot use QoreX. | Use `pay.ts` for the demo. Explain the limit in the README. |
| The contract budget refuses 7 records | The payment transaction fails. | Use TECH_SPEC section 8.4 in order. |
| Time | The web app is late. | The CLI flow is the minimum demo. The web app shows `/pay` and `/inbox` first. |
| The gateway work takes more than day 4 | The browser flows wait for it. | Do the proxy first. It unblocks all pages. The indexer and the sponsor come after it. Until then, `/inbox` can use `tx_search` through `/v1/rpc`. |
| Method 2 takes more than day 6 | AC11 is late. | Ship QoreX Send to a `qor1` stealth address first. MetaMask (AC12) is optional. Method 1 stays the main demo. |
| The gateway host stops during judging | The web app stops working. | Use an always-on paid instance, not a free instance that sleeps. Show the CLI flow in the README as a second way. |
| Other hackathons on 5 Dec (Base, Solana) | The team has less time. | Keep the scope in SPEC section 7.1 to 7.5. Do not start stretch features. |
