# PLAN: Bellaso

> This document uses ASD-STE100 Simplified Technical English.
> Deadline: 2 Dec 2026, 23:59 UTC = 3 Dec 2026, 06:59 WIB. After the deadline, the project becomes read-only. There is no submit button.
> Freeze: 2 Dec 2026, 22:00 WIB. After the freeze, change only the README and the project form.

---

## 1. Roles

| Role | Owner | Work |
|---|---|---|
| P1: Core, chain and gateway | (name) | `packages/core`, `packages/chain`, `scripts/`, `apps/gateway`, gates G1 to G6 and G8, test vectors, gateway deployment |
| P2: Web app | (name) | `apps/web`, the vault, the QoreX payment, the inbox scan, UX |
| P3: Story and submission | (name, or shared by P1 and P2) | Registration, Discord, X posts, README, `AI_USAGE.md`, video, cover image |

## 2. Day plan

| Day | Date (WIB) | Work | Exit condition |
|---|---|---|---|
| 1 | Mon 23 Nov | All members register (GitHub, details, X, QoreX testnet). Make the public repository with the Apache-2.0 licence. Add the Bun workspace scaffold (`apps/web`, `apps/gateway`, `packages/core`, `packages/chain`, `scripts/`) and `bun run check`. Make the gateway host account. Post the idea in the fest Discord (section 4). Run gates G1 to G6 with CLI scripts. | Each gate is "pass" or has a selected fallback (section 3). |
| 2 | Tue 24 Nov | P1: complete `packages/core` (labels, derivations, announcement format, encoding, scan logic) and its unit tests (TECH_SPEC section 12.1). P2: the web layout and the pages with mock data. | `bun run check` passes. Test vectors are committed. |
| 3 | Wed 25 Nov | P1: complete `packages/chain` and the scripts `setup`, `records`, `scan`, `spend`. Run the full flow on testnet with the CLI. P2: the vault and `/create` with the SDK. | Evidence for AC1, AC2, AC4 and AC5 (CLI). |
| 4 | Thu 26 Nov | P1: the gateway (proxy, indexes, sponsor) and its tests. Deploy it. Run gate G8. P2: `/pay/[id]` and the payment with QoreX in the browser. | Evidence for AC3 (QoreX transaction hash) and AC10. |
| 5 | Fri 27 Nov | Web pages `/inbox` (scan in the browser, data from the gateway) and `/spend/[tx]`. Attend Workshop 4 at 23:30 WIB (submission clinic). | The full flow works in the browser through the gateway. |
| 6 | Sat 28 Nov | Method 2. P1: `addr-tweak` derivation and test vectors, the transfer feed, `sponsor-gas`, gate G9. P2: `/receive` with both methods, labels in the vault, method 2 rows in the inbox. | Evidence for AC11. |
| 7 | Sun 29 Nov | Link warnings and the reuse warning. Gateway limits and caps. `link-attempt.ts`. Demo data: 20 or more method 1 payments and 3 method 2 payments to 2 or more recipients. README with the architecture diagram, final `docs/THREAT_MODEL.md`, `AI_USAGE.md`. Deploy the web app to Vercel. Turn off app sleeping on the Railway gateway (TECH_SPEC section 13). | Evidence for AC6 and AC7. The deployed app works with the deployed gateway and the testnet. |
| 8 | Mon 30 Nov | Fix bugs. Cover image. Check each acceptance criterion again. Record a draft video. | AC1 to AC8, AC10 and AC11 pass. |
| 9 | Tue 1 Dec | Final video (3 minutes or less). X posts. Do the submission checklist (SPEC section 13). | AC9 passes. |
| 10 | Wed 2 Dec | Last check. Freeze at 22:00 WIB. | The project form is complete. |

Post progress on X with #BuildBeforeQDay on days 1, 3, 5, 7 and 9. The jury looks at the build history.

### 2.1 Backlog (updated 23 Nov, end of day 1)

Done on day 1: gates G1 to G6 on testnet, the core cryptography with tests, the CLI scripts (setup, records, scan, spend), the gateway REST proxy on Railway, the `/pay` page on Vercel, auto-deploys for both.

Done later on day 1: the gateway indexes and sponsor routes, the browser setup, inbox, spend and `/receive`, gate G8, `link-attempt.ts` and the scan parity check (section 3.1).

A. Gateway
- [x] A1 `/v1/announcements`: index of all valid announcements (TECH_SPEC section 9.4). Live test: 2 items, 0 rejected.
- [x] A2 `/v1/rpc`: JSON-RPC proxy with a method allowlist, so the browser can sign and broadcast
- [x] A3 `/v1/sponsor`: fund a new account A; fund the sponsor wallet; `SPONSOR_MNEMONIC` on Railway. The setup amount is 0.12 QOR.
- [x] A4 `/v1/transfers` and `/v1/sponsor-gas` (method 2)

B. Web
- [x] B5 `/create`: setup in the browser, encrypted vault, sponsor
- [x] B6 `/inbox`: scan in the browser from `/v1/announcements` and `/v1/transfers`
- [x] B7 `/spend`: two transactions, link warnings
- [x] B8 `/receive`: payment link and stealth addresses (method 2)
- [x] B9 Landing page from the design canvas; the receipt links to the raw transaction

C. Proof
- [x] C10 `link-attempt.ts` (AC6). Pass on the clean account `qor130jx…`.
- [x] C11 Demo data (AC4): 20 announcements, 11 to account A and 9 to qor130jx…. `scan.ts` finds the 11 with 0 false positives, and the chain and gateway outputs are identical (MEASURED, 23 Nov). The sponsor got 1 QOR more (tx 33EA68EC…3869).
- [ ] C12 Gates G8 (browser through the gateway) and G9 (normal wallets, method 2). G8 pass. G9 partial: the QoreX mobile **Send** and the EVM wallet are not tested yet.
- [x] C13 `scan.ts --source gateway` equals `--source chain` (AC10)

D. Submission
- [x] D14 Final README with the architecture diagram
- [ ] D15 Final `docs/THREAT_MODEL.md`
- [x] D16 `AI_USAGE.md`
- [x] D17 Cover image 1200×675 or larger: `apps/web/public/brand/cover-1600x900.png`, also the Open Graph image
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
| G8 Gateway (day 4) | **pass** (23 Nov) | Browser through the gateway. Setup of `qor1837j3xcwwrcsdy04wmghs9pk8jum2c396te9as` (funded by hand): signing key tx `70E3A8D50E2EFB90A7FA62FB8919522DBDA8985B4ED7C77A9F446EB86C7747EF` (fee 58,763 uqor), KEM key tx `D3B01178F2C2BC45781A10C2DAC3AAA01270B48FE18C5FCC2ED89A0A75505250` (fee 38,115 uqor, hybrid). Setup with the live sponsor of `qor130jxjehyvf2ndr6lyutl9e09plv7k0epyhnmyz` in 26 s: sponsor tx `E034D4B3704D05DB44D8B8BD4BB4091A26F72428081BAD63E11FDDDFC6A90CB4` (120,000 uqor, fee 27,840 uqor, `pqc_hybrid_verify`), signing key tx `BA34BD91A75696C978509132AFBE7E58BA8864D59C1084595B3F52FFE6D6BC4E`, KEM key tx `73DF790AD042C780D969096C430A50979E634B55A1C61D2E1D4FD1A3C07F10B2`. Spend of method 1 payment `59CF3A20…9856` to `qor1su8vdyp2nlgunpyelkqs70724t9czd8a2tkw27`: tx 1 `80DE620C34DFD22A1D9BFE22471C7388C05B39F24A320DB8A842639B551FF23B` (gas 278,326), tx 2 `F1BA9D659A2BF0748462791263B13405AC94D6EC6BFB42034FE5785FD75EB726` (gas 177,235, `pqc_hybrid_verify`). `scan.ts --source gateway` equals `--source chain` (section 3.1). The gateway had to allow `/cosmos/upgrade/v1beta1/applied_plan/`, because `ensurePqcRegistered` reads it. | None |
| G9 Normal wallets for method 2 (day 6) | **partial** (23 Nov) | Stealth address `qor1gcu82enavqpqlj7pm6newarh86j3k5zhnljfwn` (index 0, label "Studio Kyoto") made in the browser. Plain `MsgSend` of 0.3 QOR from the CLI payer: tx `7BFA8294676C6AC02F6F67D7D73E6733089B6A8EFA781D55CD7A6FB3278E2D0E`. The inbox found it with the label. Spend: tx 1 `F828F4AC85E7564A22AA37A148F6DC8B860279B58FED02B86875149C9892B3E1`, tx 2 `372120ADD707092667BCB3AB115D7EFB1776100000A09EAD5A137D80D9A2E830` (`pqc_hybrid_verify`). Feed size: 818 `MsgSend` transactions from height 10,500,000 to 10,603,961 (about 41 hours, about 20 each hour); 46 from height 10,600,000 to about 10,604,134, all with code 0. Not tested yet: the QoreX mobile **Send** and the EVM wallet. | Not selected yet |

### 3.1 Other evidence (MEASURED, 23 Nov 2026)

| Item | Result |
|---|---|
| AC6 on the clean account | `link-attempt` on `qor130jxjehyvf2ndr6lyutl9e09plv7k0epyhnmyz` (funded only by the sponsor): **PASS**. H1 to H5 all 0, without the scoring secret. This is now the evidence account for AC6 and AC11. |
| AC6 on the first account | `link-attempt` on `qor1j677x84lr8fr2u3x24z69snzxe6mgjt3zstnyf`: **FAIL** by H4. Wallet `qor1esra9lc9weq7js4x9ay4744fymfyqex5utra3s` funded this account and also paid the G4 payment. This is a test-setup artifact (THREAT_MODEL R26). |
| AC10 | `scan.ts --source chain` and `scan.ts --source gateway`: the diff of the two stdout outputs is empty. |
| Cheap CLI payment | `records.ts` payment `59CF3A20DFFA2911A6F46E84BED2F215C3CC6A7D46367818384ACE5815349856` used 838,518 of 1,250,000 gas. Fee 187,500 uqor, about 0.19 QOR, against about 0.45 QOR with "auto" gas. |
| Browser inbox | 3 announcements opened in 0.16 s, on the main thread. |
| Test QOR left | The CLI payer has about 2.5 QOR, and the sponsor wallet about 0.79 QOR. Backlog C11 needs more. |

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
| Gate G4 fails | The payer cannot use QoreX. | Use `records.ts` for the demo. Explain the limit in the README. |
| The contract budget refuses 7 records | The payment transaction fails. | Use TECH_SPEC section 8.4 in order. |
| Time | The web app is late. | The CLI flow is the minimum demo. The web app shows `/pay` and `/inbox` first. |
| The gateway work takes more than day 4 | The browser flows wait for it. | Do the proxy first. It unblocks all pages. The indexes and the sponsor come after it. Until then, `/inbox` can use `tx_search` through `/v1/rpc`. |
| Method 2 takes more than day 6 | AC11 is late. | Ship QoreX Send to a `qor1` stealth address first. MetaMask (AC12) is optional. Method 1 stays the main demo. |
| The gateway host stops during judging | The web app stops working. | Use an always-on paid instance, not a free instance that sleeps. Show the CLI flow in the README as a second way. |
| Other hackathons on 5 Dec (Base, Solana) | The team has less time. | Keep the scope in SPEC section 7.1 to 7.5. Do not start stretch features. |
