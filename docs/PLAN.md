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
| 7 | Sun 29 Nov | Link warnings and the reuse warning. Gateway limits and caps. `link-attempt.ts`. Demo data: 20 or more method 1 payments and 3 method 2 payments to 2 or more recipients. README with the architecture diagram, final `docs/THREAT_MODEL.md`, `AI_USAGE.md`. Deploy the web app to Vercel. Turn off app sleeping on the Railway gateway (TECH_SPEC section 13). | Evidence for AC6 and AC7. The deployed app works with the deployed gateway and the testnet. |
| 8 | Mon 30 Nov | Fix bugs. Cover image. Check each acceptance criterion again. Record a draft video. | AC1 to AC8, AC10 and AC11 pass. |
| 9 | Tue 1 Dec | Final video (3 minutes or less). X posts. Do the submission checklist (SPEC section 13). | AC9 passes. |
| 10 | Wed 2 Dec | Last check. Freeze at 22:00 WIB. | The project form is complete. |

Post progress on X with #BuildBeforeQDay on days 1, 3, 5, 7 and 9. The jury looks at the build history.

### 2.1 Backlog (updated 23 Nov, end of day 1)

Done on day 1: gates G1 to G6 on testnet, the core cryptography with tests, the CLI scripts (setup, records, scan, spend), the gateway REST proxy on Railway, the `/pay` page on Vercel, auto-deploys for both.

A. Gateway
- [x] A1 `/v1/announcements`: index of all valid announcements (TECH_SPEC section 9.4). Live test: 2 items, 0 rejected.
- [x] A2 `/v1/rpc`: JSON-RPC proxy with a method allowlist, so the browser can sign and broadcast
- [ ] A3 `/v1/sponsor`: fund a new account A; fund the sponsor wallet; `SPONSOR_MNEMONIC` on Railway
- [ ] A4 `/v1/transfers` and `/v1/sponsor-gas` (method 2)

B. Web
- [ ] B5 `/create`: setup in the browser, encrypted vault, sponsor
- [ ] B6 `/inbox`: scan in a Web Worker from `/v1/announcements`
- [ ] B7 `/spend`: two transactions, link warnings
- [ ] B8 `/receive`: payment link and stealth addresses (method 2)
- [ ] B9 Landing page from the design canvas; receipt polish

C. Proof
- [ ] C10 `link-attempt.ts` (AC6)
- [ ] C11 Demo data: 20 or more payments to 2 or more recipients (AC4)
- [ ] C12 Gates G8 (browser through the gateway) and G9 (normal wallets, method 2)
- [ ] C13 `scan.ts --source gateway` equals `--source chain` (AC10)

D. Submission
- [ ] D14 Final README with the architecture diagram
- [ ] D15 Final `docs/THREAT_MODEL.md`
- [ ] D16 `AI_USAGE.md`
- [ ] D17 Cover image 1200×675 or larger
- [ ] D18 Video, 3 minutes or less
- [ ] D19 X posts with #BuildBeforeQDay
- [ ] D20 Make the repository public
- [ ] D21 Project page: every `qor1` address, Check again, category Encrypted Apps, country Indonesia; all members registered; fest Discord post
- [ ] D22 Turn off app sleeping on Railway before judging

## 3. Gate status

Write the result and the evidence for each gate. TECH_SPEC section 14 defines the tests.

| Gate | Status | Evidence (transaction hash or output) | Selected fallback |
|---|---|---|---|
| G1 Account A | **pass** (23 Nov) | `MsgRegisterPQCKeyV2` tx `9794803F3945EB1DCB6082957131A00E7113A08521D4C0294429C05A8C097E9A`, gas 278,356. REST: `possession_proven: true`, `key_type: hybrid`, key equals `derivePqcCanonical`. | None |
| G2 KEM key | **pass** (23 Nov) | Hybrid `MsgRegisterKEMKey` tx `239683C28674613BBE8FB54348BC6F5629F46E92A8EB0AEF32518DECBCAA3825`, gas 247,499. REST: `algorithm_id: 2`, same key bytes. | None |
| G3 Records | **pass** (23 Nov) | Contract `qor17jq8wze2n9m02c6vtkle6uxr4xccq07e6gxc2np7zq78feuv7tnq2wpp8d` (tx `5121FCF7…F365C6`). `MsgSend` + 7 records in one hybrid tx `93A7B596014A2726D18B529A3D9D0F07CDB0026720BCEFC598C70C02C29B5BD4`: simulate 2,321,036 gas, used 817,224, wanted 3,017,347, fee 452,603 uqor. No contract gas limit was hit. | None |
| G4 QoreX payment | **pass** (23 Nov) | From https://bellaso.vercel.app/pay/qor1j677…tnyf in the QoreX mobile dApp browser (testnet on): tx `3D7BEDE9780D9F9EA942E9978BC5FDE7723EBFB937202B9B733806C87AC1FC72`, 1 MsgSend + 7 MsgExecuteContract, payer `qor1esra…a3s`, `PQCHybridSignature`, events `pqc_verify` and `pqc_hybrid_verify`, shield `shielded`. Gas used 838,445 / wanted 3,046,888 (QoreX ignored the 1.2M hint), fee 457,034 uqor. Account A appears 0 times in the transaction (AC3). Scan found it. Spent with fUSD: tx `04823BB8…4B76B0F` (registration) and `1223DC64…BED49EC` (hybrid send, 2 coins, fee 37,187 uqor). | The extension has no testnet switch; use QoreX mobile. |
| G5 Spend | **pass** (23 Nov) | Tx 1 `MsgRegisterPQCKeyV2` `7BBBF9300C0E7EECE488B4942A542A5E5C0D077BF3CA2A6A97B796321F444DE3` (gas 278,356, about 0.059 QOR). Tx 2 hybrid `MsgSend` `312346D87C20717906386C78284CF97EEDB8FEB130F95559EE675673567CEE7A` (gas 162,846, fee 34,133 uqor), event `pqc_hybrid_verify`. Total about 0.093 QOR. | None. The bundled form was not tested. |
| G6 Scan | **pass** (23 Nov) | `scan.ts`: 2 transactions, 1 announcement, 1 found (the G3 payment), 709 ms. | None |
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
