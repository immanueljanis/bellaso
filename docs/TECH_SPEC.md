# TECH SPEC: Bellaso

> This document uses ASD-STE100 Simplified Technical English. Terms have the meanings in `SPEC.md` section 6.
> Labels: **CONFIRMED** means read in code or docs, or measured on testnet. **MEASURED** means measured by the team on 23 Nov 2026. **UNCERTAIN** means a gate must prove it (section 14).

---

## 1. Principles

1. **No secret on a server.** All key operations run in the browser or the CLI. The Bellaso gateway relays and indexes public chain data only. No gateway route accepts a secret (AC7).
2. **One construction, three users of it.** The web app, the gateway and the CLI scripts use the same `packages/core` and `packages/chain` code.
3. **Pure core.** `packages/core` has no network and no DOM code. Thus unit tests and test vectors cover all cryptography.
4. **Fixed domain labels.** Every derivation uses a label from section 4.2. Do not add a label without a test vector.
5. **Read whole sets.** The scan reads all announcements. It never queries a single derived address (THREAT_MODEL R7).
6. **The chain is the source of truth.** The gateway keeps its indexes in memory only. A restart rebuilds them from the chain.
7. **Prove on testnet.** A gate or an acceptance criterion passes only with a transaction hash or command output.

## 2. Architecture

```
+--------------------------- Browser: apps/web (Vercel) ---------------------------+
|  Next.js client pages        packages/core (pure TS)      packages/chain          |
|  /create  /pay/[id]          derive, announcement,        tx_search, tx decode    |
|  /inbox   /spend/[tx]        encoding, open, stealth      @qorechain/sdk client   |
|  /receive                    address, labels              (endpoints = gateway)   |
|  Encrypted vault (localStorage)    Scan on the main thread    QoreX call (/pay)   |
|  ALL KEYS STAY HERE                                                               |
+----------------------------------------------------------------------------------+
     | QoreX (payer signs and          | HTTPS: public data and signed transactions only
     | broadcasts with its own node)   v
     |            +------------- apps/gateway: Bun + Fastify (Railway) -------------+
     |            |  /v1/lcd, /v1/rpc   proxy with allowlists (CORS for our origins) |
     |            |  /v1/announcements  indexes in memory, pulled from tx_search     |
     |            |  /v1/transfers      when a client asks (at most every 3 s)       |
     |            |  /v1/sponsor        sends 0.12 QOR to a new account A            |
     |            |  /v1/sponsor-gas    sends 0.12 QOR to a stealth address          |
     |            |  NO USER SECRET. The sponsor wallet holds test QOR only.         |
     |            +------------------------------------------------------------------+
     v                                  |
+------------------------- QoreChain testnet `qorechain-diana` --------------------+
|  x/bank: MsgSend (fUSD, uqor)                                                     |
|  x/pqc:  MsgRegisterPQCKeyV2 (ML-DSA-87), MsgRegisterKEMKey (ML-KEM-1024)         |
|  x/wasm: Bellaso announcement contract = own instance of code 865 (qday-receipts) |
|  CometBFT RPC: tx_search on wasm._contract_address                                |
+----------------------------------------------------------------------------------+
     ^
     | scripts/ (CLI, Bun): reads and writes the chain directly, without the gateway
```

The CLI does not use the gateway. The only exception is `scan.ts --source gateway`, which reads the gateway for the AC10 comparison. Thus the CLI scan is an independent check of the gateway (AC10). There is no relayer in the main design. Section 8.4 gives the fallbacks.

## 3. Network constants (CONFIRMED)

| Item | Value |
|---|---|
| Chain ID | `qorechain-diana` |
| REST | `https://api-testnet.qore.host` |
| RPC | `https://rpc-testnet.qore.host` |
| Bech32 prefix | `qor` |
| QOR denom | `uqor`, 6 decimals |
| fUSD denom | `erc20:0x97143B771D34ddb9130b807b135Ae675A5a963CA`, 6 decimals (case-sensitive) |
| fETH denom | `erc20:0x02292293c13880a26242690eb70a0e42B8E91c28`, 18 decimals |
| fBTC denom | `erc20:0x4604e7E45b2ecdbfbDc157103f5B2b62cb16451A`, 8 decimals |
| Max memo | 256 characters (MEASURED). Bellaso does not use the memo. |
| Minimum gas price | 0.1 uqor per gas |
| Announcement contract code | Code ID 865 (`qday-receipts`), instantiate permission "Everybody" (MEASURED) |
| CORS | The public REST and RPC send no `Access-Control-Allow-Origin` header for any origin. REST answers a preflight `OPTIONS` with 501 (MEASURED). The official workshop docs say the same and use a `/lcd` proxy (CONFIRMED). Thus a browser needs the gateway (section 9). |
| Latency from Jakarta | `tx_search`, one page: 0.34 to 0.87 s. One REST read: 0.59 s (MEASURED) |

## 4. Keys and derivations

### 4.1 Recipient keys

The recipient has one **Bellaso recovery phrase** (BIP-39, 24 words). The app makes it in the browser. QoreX does not hold it, because QoreX does not export private keys and refuses `MsgRegisterKEMKey` from a website (CONFIRMED, QoreX 0.4.3).

| Key | Derivation | Library | Status |
|---|---|---|---|
| Account A, secp256k1 `k_A`, `P_A` | `deriveNativeAccount(mnemonic, { accountIndex: 0 })`, path m/44'/118'/0'/0/0 | `@qorechain/sdk` 0.14.0 | CONFIRMED |
| Address of A | bech32("qor", RIPEMD160(SHA-256(compressed `P_A`))) | SDK | CONFIRMED |
| ML-DSA-87 key of A | `derivePqcCanonical(address, mnemonic)`. This is the QoreX derivation for coin-118 accounts. Thus the user can import the phrase into QoreX mobile to claim a handle. | SDK | UNCERTAIN (gate G1) |
| KEM key pair of A (`ek_A`, `dk_A`) | `deriveSealKeys({ mnemonic, index: 0 })`. It returns `mlkemPublicKey` (1,568 B) and `mlkemSecretKey` (3,168 B). It also returns X25519 keys. Bellaso does not use them. | `@qorechain/qoreseal` 0.1.0 | MEASURED (Bun spike, section 9.7) |
| Post-quantum root secret `pqRoot` | SHAKE-256(label `pq-root` ‖ BIP-39 seed (64 bytes)), 32 bytes | `@noble/hashes` | Bellaso design |

### 4.2 Domain labels

Each label is the UTF-8 string `bellaso/v1/<name>`. The input is the label bytes followed by fixed-length values. Thus no length prefix is necessary.

| Name | Input after the label | Output |
|---|---|---|
| `pq-root` | BIP-39 seed (64 bytes) | 32 bytes |
| `view-tag` | shared secret (32 bytes) | 1 byte |
| `spend-tweak` | shared secret (32 bytes) | 64 bytes, then reduced mod n |
| `pq-seed` | `pqRoot` (32 bytes) ‖ shared secret (32 bytes) | 32 bytes (ML-DSA-87 ξ) |
| `addr-tweak` | `pqRoot` (32 bytes) ‖ index `i` (4 bytes, big-endian) | 64 bytes, then reduced mod n (method 2) |
| `addr-pq-seed` | `pqRoot` (32 bytes) ‖ index `i` (4 bytes, big-endian) | 32 bytes (ML-DSA-87 ξ, method 2) |

### 4.3 Payer: make a payment target

Inputs: `P_A` and `ek_A` from the chain (section 6).

1. `(ct, ss) = ML-KEM-1024.Encaps(ek_A)`. Use `mlkemEncapsulate(ek_A)` from `@qorechain/qoreseal`. It also does the key checks of the chain (length and modulus). Thus the payer page refuses a broken key.
2. `tag = SHAKE-256(view-tag ‖ ss)[0]`.
3. `h = int(SHAKE-256(spend-tweak ‖ ss, 64 bytes)) mod n`. If `h = 0`, encapsulate again.
4. `P_o = P_A + h·G`.
5. `addr_o = bech32("qor", RIPEMD160(SHA-256(compressed P_o)))`.

### 4.4 Recipient: open an announcement

1. `ss = ML-KEM-1024.Decaps(dk_A, ct)`. Use `mlkemDecapsulate(dk_A, ct)` from `@qorechain/qoreseal`. Note: `@noble/post-quantum` uses the other order, `decapsulate(ct, sk)`. Use one wrapper in `packages/core`.
2. If `SHAKE-256(view-tag ‖ ss)[0] ≠ tag`, stop.
3. `k_o = (k_A + h) mod n`. Calculate `addr_o` from `k_o·G`.
4. If `addr_o` is not the `to_address` of the `MsgSend` in the same transaction, stop. This removes all false positives (THREAT_MODEL R13).
5. `ξ_o = SHAKE-256(pq-seed ‖ pqRoot ‖ ss, 32 bytes)`.
6. `(pk_o, sk_o) = ML-DSA-87.KeyGen(ξ_o)`. Use `generatePqcKeypair(ξ_o)` from the SDK.

### 4.5 Spike result (MEASURED, local, Node 24, pure JavaScript)

The team ran this construction with `@noble/post-quantum` 0.7.1 and `@noble/curves` 2.4.0. The spike used an Ethereum-style address in place of the bech32 address. The difference is only the final hash.

| Check | Result |
|---|---|
| Sizes | KEM public key 1,568 B; KEM secret key 3,168 B; ciphertext 1,568 B; ML-DSA-87 public key 2,592 B; signature 4,627 B |
| Round trip | The recipient finds the payment and derives the same `k_o`. The ML-DSA-87 key is deterministic. |
| False positives | 3,000 announcements for another recipient: 8 view tag matches, 0 final matches |
| Encapsulate | 0.84 ms |
| Decapsulate | 1.00 ms |
| Scan of one announcement (no match) | 1.54 ms. Thus 10,000 announcements take about 15 s. |
| ML-DSA-87 key generation / signature | 2.69 ms / 12.86 ms |

### 4.6 Method 2: stealth address from an index

The recipient makes the one-time account alone. No payer, no ML-KEM and no announcement take part.

1. `i` = the next unused index in the vault. The first index is 0.
2. `h_i = int(SHAKE-256(addr-tweak ‖ pqRoot ‖ i, 64 bytes)) mod n`. If `h_i = 0`, use `i + 1`.
3. `P_i = P_A + h_i·G`, `k_i = (k_A + h_i) mod n`, `addr_i = bech32("qor", RIPEMD160(SHA-256(compressed P_i)))`.
4. `ξ_i = SHAKE-256(addr-pq-seed ‖ pqRoot ‖ i, 32 bytes)`, then `(pk_i, sk_i) = ML-DSA-87.KeyGen(ξ_i)`.
5. The vault stores `{ index, address, label, createdAt, askGas }`, encrypted. The label never leaves the browser.

`stealthAddress(publicKey, pqRoot, index)` in `@bellaso/core` does steps 2 and 3. The method 2 test vectors check it (section 12.1). The web app `/receive` and `link-attempt.ts` use it.

Why a chain observer cannot link `addr_i` to A, also after Q-Day: the argument of THREAT_MODEL section 3.1 applies. To prove a link, T2 must show `k_i − k_A = h_i`. `h_i` is a SHAKE-256 output of `pqRoot`, which never leaves the browser.

Recovery (design): after a restore from the recovery phrase, the app derives `i = 0` up to the highest used index plus 20 (gap limit) and matches them against the transfer feed (section 8.5). Status: not built. A restore on `/create` starts with an empty stealth address list. Thus the labels and the method 2 payments do not come back after a restore.

## 5. Announcement format v1

### 5.1 Bytes

| Offset | Length | Field |
|---|---|---|
| 0 | 1 | Version = `0x01` |
| 1 | 1 | View tag |
| 2 | 1,568 | ML-KEM-1024 ciphertext |

Total: 1,570 bytes. The announcement does not contain `addr_o`, because the `MsgSend` in the same transaction already shows it.

### 5.2 Records

The Bellaso announcement contract is an instance of code 865. Its execute message is `{"record":{"note":"<string>"}}`. The contract trims the note and accepts 1 to 140 Unicode characters (CONFIRMED in `build-before-qday/workshop-3/02-cross-vm/native/src/lib.rs`; a 141-character note was refused in a simulation).

1. Encode the 1,570 bytes with **base32768** (npm `base32768` 5.0.1). The result is 838 characters (MEASURED). The alphabet has no whitespace and only BMP characters (MEASURED). Thus the contract trim does not change it.
2. Split the string into records:
   - Record 1: the header `BL1:<n>:` followed by 134 characters. `<n>` is the number of records (one digit).
   - Records 2 to n: 140 characters each. The last record can be shorter.
3. For 1,570 bytes, n = 7 (MEASURED).

Fallback encoding: base64. It gives 2,096 characters and n = 16 (MEASURED). Use the header `BL1b:<nn>:`.

### 5.3 Contract instance

The team instantiates code 865 one time with the message `{}` and the label `bellaso-announcements-v1`. The address goes into `packages/chain/config.ts`, the gateway environment and the README. The contract has no admin.

## 6. Chain reads

The browser reads through the gateway: REST paths go to `/v1/lcd/<path>`, and the announcements come from `/v1/announcements` (section 9.3). The CLI reads the same paths on the chain directly.

| Data | Method | Status |
|---|---|---|
| `P_A` | `GET /cosmos/auth/v1beta1/accounts/{addr}` → `account.pub_key.key` (base64, 33 B). It exists only after the first signed transaction of A. Also `GET /qorechain/pqc/v1/account/{addr}` → `ecdsa_pubkey`. | CONFIRMED |
| `ek_A` | `GET /qorechain/pqc/v1/kem/{addr}` → `{found, key: {algorithm_id: 2, algorithm_name: "mlkem1024", public_key (base64), registered_height}}`. `fetchMlkemPublicKey({ rest, address })` wraps it. | CONFIRMED, MEASURED |
| PQC status of an account | `GET /qorechain/pqc/v1/account/{addr}` | CONFIRMED |
| Announcements (browser) | Gateway `GET /v1/announcements?after=<height>&limit=<n>` (section 9.3). | CONFIRMED (gate G8) |
| Announcements (gateway index and CLI) | RPC `tx_search` with the query `wasm._contract_address='<instance>'`, ordered by height. Decode each transaction with `decodeTxRaw` from `@cosmjs/proto-signing`. | MEASURED (query works on testnet) |
| Fallback for announcements | Contract smart query `{"latest":{"limit":20}}` or `{"receipt":{"id":N}}`. Each receipt has `id`, `sender`, `note`, `height`. | MEASURED |
| Transfers to stealth addresses (method 2) | Gateway `GET /v1/transfers?after=<height>&limit=<n>` (section 9.3): all bank transfers of fUSD, fETH, fBTC and QOR from height `TRANSFERS_FROM_HEIGHT`, not filtered by address. The gateway reads them with `tx_search` and the query `message.action='/cosmos.bank.v1beta1.MsgSend'`. The chain indexes no message event of a failed transaction. The CLI has no method 2 scan yet. | MEASURED |
| Volume of `MsgSend` on testnet | 818 transactions from height 10,500,000 to 10,603,961, about 41 hours. Thus about 20 each hour. 46 transactions from height 10,600,000 to about 10,604,134, all with code 0. | MEASURED (23 Nov 2026) |

## 7. Transactions

### 7.1 Recipient setup (Bellaso app, SDK)

The browser runs the SDK with both endpoints on the gateway: RPC `/v1/rpc` and REST `/v1/lcd` (gate G8). The app passes `chainId` to `ensurePqcRegistered`. Thus the SDK does not read `node_info`.

Each step reads the chain first and skips the work that is already done. Thus an unlock of an existing vault on `/create` finishes an open setup, or shows the link.

1. **Fund A.** The app reads the QOR balance of A. The fee budgets are 65,000 uqor for step 2 and 45,000 uqor for step 3. If the balance is less than the budgets of the open steps, the app calls the gateway `POST /v1/sponsor` with the address of A. The gateway sends 0.12 QOR (section 9.5). If the sponsor refuses or is not available, the app shows the reason, and the recipient sends QOR from QoreX or from the faucet. The app waits until the QOR arrives. A is the public payment identity. Thus both public links are acceptable (THREAT_MODEL R15, R20, R26).
2. **Register the ML-DSA-87 key of A.** Use `ensurePqcRegistered(tx, { pqcKeypair, ecdsaPubkey, rest, chainId })`. It builds `/qorechain.pqc.v1.MsgRegisterPQCKeyV2` with the proof of possession. The account signs with secp256k1 only. This exemption applies only while the account has no PQC key. `ensurePqcRegistered` reads `/cosmos/upgrade/v1beta1/applied_plan/<name>` to select the sign bytes of the proof of possession. Thus the gateway allows that path (gate G8). Cost: gate G1 used 278,356 gas and paid 58,763 uqor (MEASURED).
3. **Register the KEM key of A.** Use `msg.pqc.registerKemKey({ sender, algorithmId, publicKey: ek_A })` with a hybrid signature (`client.connectTx(signer, { pqcKeypair })`). The chain refuses it with codespace `pqc` code 254 if step 2 is not complete. Cost: gate G2 used 247,499 gas and paid 38,120 uqor (MEASURED).
4. **Read back** both keys with the REST calls in section 6 (AC1, AC2).

The two setup fees of gates G1 and G2 were 96,883 uqor together (MEASURED). The browser setup of gate G8 paid 58,763 and 38,115 uqor (MEASURED).

### 7.2 Payment (payer, QoreX)

Call `window.qorex.native.signAndBroadcast` with these messages, in this order:

1. `/cosmos.bank.v1beta1.MsgSend` from the payer to `addr_o`, with two coins: the fUSD amount and the gas allowance in `uqor`.
2. `/cosmwasm.wasm.v1.MsgExecuteContract` × n, one for each record, to the Bellaso announcement contract.

```ts
await window.qorex.native.signAndBroadcast({
  chainId: "qorechain-diana",
  messages: [sendMsg, ...recordMsgs],
});
```

Facts (CONFIRMED in QoreX 0.4.3 and `qorex-integrations`):

- QoreX accepts 1 to 32 messages and decodes `MsgSend` and `MsgExecuteContract`. Each `value` is protobuf bytes (`Uint8Array`, `number[]` or base64).
- `gasLimit` is a hint. The `qorex-types` docs say QoreX clamps it to 100,000 to 5,000,000 and uses 400,000 without it. For contract messages QoreX 0.4 ignores the hint: it simulates and asks for the simulation × 1.3 (MEASURED in gate G4: hint 1,200,000, gas wanted 3,046,888, gas used 838,445, fee 457,034 uqor). Thus a payer pays about 0.46 QOR fee plus the 0.15 QOR allowance per payment. The web app shows "about 0.46 QOR, set by QoreX".
- The QoreX extension has no testnet switch. Testnet payments go through the QoreX mobile dApp browser with Settings › Use testnet (developers), which opens `https://` pages only (MEASURED in gate G4).
- The result is `{ txHash, code, height?, shield }`. Check `capabilities` before the call.
- Do not set a memo.

Cost (MEASURED, gate G3, 23 Nov 2026): `MsgSend` + 7 records in one hybrid transaction simulated at 2,321,036 gas and used 817,224 gas. The SDK asked for 3,017,347 gas (simulation × 1.3), and the fee was 452,603 uqor (0.45 QOR) at 0.15 uqor per gas. The chain charges the gas limit, not the gas used. Thus a lower explicit limit (for example used × 1.5 ≈ 1.23M gas, about 0.18 QOR) can cut the fee in the CLI; QoreX sets its own limit (gate G4). No contract execution limit refused the 7 records.

### 7.3 Spend (recipient, SDK)

The one-time account is a coin-118 secp256k1 account. Sign with `directSignerFromPrivateKey(k_o, "qor")`, not with `EthNativeSigner`.

1. Read the PQC status of `addr_o`.
2. If no key is registered, send **transaction 1**: `MsgRegisterPQCKeyV2` for `pk_o` with the proof of possession. It is signed with secp256k1 only. Wait until the chain includes it.
3. Send **transaction 2**: a hybrid `MsgSend` from `addr_o` to the destination (`client.connectTx(signer, { pqcKeypair: { pk_o, sk_o } })`, then `tx.bankSend(to, coins)`).
4. Check that the result has the `pqc_hybrid_verify` event (AC5).

Do not put the registration and the send in one transaction. The chain probably refuses it, and all 100 recent registrations on testnet were single-message transactions (UNCERTAIN, gate G5).

**Gas allowance.** MEASURED in gate G5 (23 Nov 2026): transaction 1 used 278,356 gas and cost about 0.059 QOR. Transaction 2 (hybrid `MsgSend`) used 162,846 gas, with a limit of 227,551 and a fee of 34,133 uqor. The total is about 0.093 QOR. The default allowance of **0.15 QOR** (`150000uqor`) is enough.

**Fee budgets in the browser.** The spend page reads the balance and the PQC status of the one address that it spends. It needs 65,000 uqor for transaction 1 and 40,000 uqor for transaction 2. After transaction 1 is on chain, it needs only the 40,000 uqor. The gas of transaction 2 is the simulation × 1.4, at 0.15 uqor per gas. `scripts/spend.ts` uses the same multiplier and gas price.

**"Send all".** The app sends every coin of the one-time account. It takes the fee of transaction 2 from the QOR. If no QOR stays after the fee, the app leaves QOR out of the send.

**Browser spends (MEASURED, gate G8).** Method 1: transaction 1 used 278,326 gas, and transaction 2 used 177,235 gas with the `pqc_hybrid_verify` event. PLAN section 3 gives the hashes.

**Warnings.** If the destination is account A or another one-time account in the inbox, show: "This links your payments together."

### 7.4 Method 2: payment and spend

**Payment.** The payer sends a normal `MsgSend` to `addr_i` from any wallet. Bellaso is not part of this transaction. Gate G9 checks QoreX **Send** first, then an EVM wallet.

**Gas.** A transfer of tokens only brings no QOR. Before the spend, the app checks the QOR balance of `addr_i` against the fee budgets of section 7.3 (105,000 uqor before transaction 1, 40,000 uqor after it):

1. If the balance is enough (for example, the payer added QOR), spend at once.
2. Else, call the gateway `POST /v1/sponsor-gas` with `addr_i` (section 9.5). The sponsor sends 0.12 QOR. This covers transaction 1 (0.059 QOR) and transaction 2 (0.034 QOR), MEASURED in gate G5, with a margin.

A method 1 payment brings its own 0.15 QOR allowance. If its balance is not enough, the app stops with an error and does not ask the sponsor.

**Spend.** The same two transactions as section 7.3, with `k_i` and `(pk_i, sk_i)` from section 4.6.

**Browser test (MEASURED, 23 Nov 2026).** The CLI payer sent 0.3 QOR to a stealth address with a plain `MsgSend`. The inbox found it with its label. The spend sent transaction 1 and transaction 2, and transaction 2 had the `pqc_hybrid_verify` event. No sponsor gas was necessary. PLAN section 3 gives the hashes.

## 8. Scan

### 8.1 Algorithm

The gateway announcement index does steps 3.1 to 3.3 one time for all clients. The browser gets the result from `/v1/announcements`, checks the length and the version again, and does steps 3.4 and 3.5. The CLI does all steps with `tx_search` on the chain.

1. Start at height 0. The vault keeps no scanned height. Thus each scan reads every announcement again.
2. Get the announcements: from the gateway, 500 items for each page (browser), or with `tx_search`, 100 transactions for each page (CLI).
3. For each transaction:
   1. Decode the body. Find each `MsgSend` and its `to_address` and `amount`.
   2. Collect the `MsgExecuteContract` messages to the contract, in message order. Read the `note` of each.
   3. Parse the header. Join the notes. Decode base32768. Check the length (1,570) and the version (`0x01`).
   4. Open the announcement against each `MsgSend` destination of the same transaction (section 4.4).
   5. If it matches, store `{ txHash, height, address: addr_o, amount }`.
4. The browser saves the found payments in the vault. A payment keeps the spend status that the vault already has for it.

### 8.2 Status of a payment

- The amount comes from the payment transaction. The scan does not query the balance of `addr_o`.
- The vault stores the "spent" status after a spend.
- The app reads the balance of `addr_o` only on the spend screen. A spend shows the address anyway.

### 8.3 Performance

One announcement takes about 1.5 ms (MEASURED in Node). The browser runs the scan on the main thread. It makes a short pause after each announcement, so that the tape figure of the inbox can draw. The inbox opened 3 announcements in 0.16 s (MEASURED). This time includes the pauses. Move the scan to a Web Worker when the announcements reach about 1,000.

A `tx_search` result has the full transaction and all events: 11.9 KB of JSON for each transaction on a code 865 instance (MEASURED). A Bellaso transaction is larger, because it has 7 records and a hybrid signature. The gateway sends about 2.3 KB for each announcement (1,570 bytes in base64 and the transfer data). Thus the browser downloads less data and does not decode protobuf.

### 8.4 Fallbacks for the announcement path

Use these in this order if gates G3 or G4 fail:

1. **base64 records** (16 records, about 0.9 QOR).
2. **Two payer transactions:** transaction A = `MsgSend` + the first records; transaction B = the other records. The header of each part gives the part number. The scan joins the parts by the payer address and the height.
3. **Relayer + EVM Announcer:** the payer signs only the `MsgSend`. A relayer posts the announcement with `MsgCrossVMCall` (payload up to 65,536 bytes) to an EVM Announcer contract. This adds adversary T5 to the threat model.

### 8.5 Scan for method 2

1. Take `addr_i` of every stealth address entry in the vault. The gap limit after a restore is not built (section 4.6).
2. Read the full transfer feed from the gateway `/v1/transfers`, 500 items for each page. The feed starts at `TRANSFERS_FROM_HEIGHT`. The CLI has no method 2 scan yet.
3. Keep each transfer whose `to` is one of the stealth addresses. Store `{ txHash, height, address, amount, index }`. The label stays in the stealth address entry.
4. If one address has more than one transfer, `/receive` shows "Paid n times" and the reuse warning (THREAT_MODEL R22).

The scan never asks for the balance of a single stealth address. The spend screen reads the balance of the one address that it spends.

## 9. Gateway

`apps/gateway` is a Bun + Fastify service. It is the only server of Bellaso.

### 9.1 Why the gateway exists

1. **CORS.** The public REST and RPC send no CORS headers (section 3). Thus a browser cannot read the chain or broadcast a transaction directly.
2. **A fast inbox.** The announcement index decodes each Bellaso transaction one time and keeps a compact list. Thus each browser downloads about 2.3 KB for each announcement, not the full transaction (section 8.3).
3. **Setup without QOR.** The sponsor pays the setup fees of a new account A. Thus a new recipient does not need QOR before setup.

### 9.2 Rules

1. No route accepts a secret: a recovery phrase, a private key, a KEM secret key or a shared secret (AC7). The sponsor routes have a body schema with `additionalProperties: false`. The feed routes take only `after` and `limit`. The proxy routes relay only allowed public reads and signed transactions.
2. The proxy allows only the paths and the methods in section 9.3. It is not an open proxy.
3. The announcement route has no parameter for a recipient or an address. Every client gets all announcements (THREAT_MODEL R7).
4. The gateway keeps no access log with an IP address and a request path: the Fastify logger is off. The sponsor keeps only SHA-256(random salt of the process ‖ IP address), in memory, for 24 hours (THREAT_MODEL R17, R19).
5. All state is in memory: the two indexes and the sponsor limits. The indexes are a copy of public chain data (principle 6). There is no database and no volume.

### 9.3 Routes (v1)

| Method and path | Use | Limits |
|---|---|---|
| `GET /v1/health` | Answers `{ "ok": true }` | None |
| `GET /v1/lcd/*` | REST read | Allowed path prefixes: `/cosmos/auth/v1beta1/accounts/`, `/cosmos/bank/v1beta1/balances/`, `/qorechain/pqc/v1/`, `/cosmwasm/wasm/v1/contract/`, `/cosmos/tx/v1beta1/txs/`, `/cosmos/upgrade/v1beta1/applied_plan/`. The SDK `ensurePqcRegistered` reads the last one to select the sign bytes of the proof of possession (found in gate G8). Other paths, `..` segments and unusual characters get 403. |
| `POST /v1/rpc` | CometBFT JSON-RPC. The SDK reads accounts, simulates, broadcasts and waits through it. | Allowed methods: `status`, `abci_info`, `abci_query`, `broadcast_tx_sync`, `tx`, `tx_search`, `block`. One call or a batch of 10 calls or fewer. Other methods get 403. |
| `GET /v1/announcements?after=<height>&limit=<n>` | All valid announcements above a height, in height order | `limit` is 500 or less. A larger `limit` is cut to 500, not refused. There is no other parameter. |
| `GET /v1/transfers?after=<height>&limit=<n>` | All bank transfers of the four test denoms above a height | `limit` is 1,000 or less. A larger `limit` is cut to 1,000, not refused. There is no address parameter. |
| `POST /v1/sponsor` | Body `{ "address": "qor1..." }`. Sends the sponsor amount to a new account A | Section 9.5 |
| `POST /v1/sponsor-gas` | Body `{ "address": "qor1..." }`. Sends 0.12 QOR to a stealth address before its first spend | Section 9.5 |

All routes: a body of 64 KB or less, a rate limit for each IP address (120 requests each minute) and CORS for the origins in `ALLOWED_ORIGINS` only. The gateway has no POST route under `/v1/lcd`. The browser simulates and broadcasts through `/v1/rpc`.

Both sponsor routes have the same body schema: one field `address` with the pattern of a `qor1` account address, and `additionalProperties: false`. Thus the schema refuses an extra property with 400.

`after` and `limit` must be integers: `after` 0 or more, `limit` 1 or more. Else the route answers 400. A page holds up to `limit` items above `after`. It also keeps every other item of its last height, so it can be longer than `limit`. `next` is the height of the last item, or `after` for an empty page. Thus a client that asks again with `after=next` misses no item.

Response of `/v1/announcements`:

```json
{
  "items": [
    {
      "txHash": "<hex>",
      "height": 123,
      "transfers": [{ "from": "qor1...", "to": "qor1...", "amount": [{ "denom": "<denom>", "amount": "<integer string>" }] }],
      "announcement": "<base64 of 1,570 bytes>"
    }
  ],
  "next": 123,
  "rejected": 0
}
```

`transfers` holds every `MsgSend` of the transaction, in message order. `rejected` counts the transactions with a broken record set (THREAT_MODEL R16).

Response of `/v1/transfers`:

```json
{
  "items": [
    { "txHash": "<hex>", "height": 123, "msgIndex": 0, "from": "qor1...", "to": "qor1...", "amount": [{ "denom": "<denom>", "amount": "<integer string>" }] }
  ],
  "next": 123
}
```

`msgIndex` is the index of the `MsgSend` among all messages of the transaction.

### 9.4 Indexes

`apps/gateway/src/indexer.ts` has two indexes with the same mechanism (`TxIndex`):

| Index | Query | First height | Keeps |
|---|---|---|---|
| Announcement index | `wasm._contract_address='<instance>'` | 0 | Each valid announcement, with the transfers of its transaction |
| Transfer index | `message.action='/cosmos.bank.v1beta1.MsgSend'` | `TRANSFERS_FROM_HEIGHT` (10,600,000) | Each `MsgSend` that moves QOR, fUSD, fETH or fBTC |

1. The index does not poll. When a client asks a feed route, the index pulls the new transactions with `tx_search`, at most one time every 3 seconds. Thus an idle gateway makes no calls, and Railway can put it to sleep.
2. The pull starts at the height after the last indexed transaction. It uses ascending order and 100 transactions for each page. Two requests at the same time share one pull.
3. For each transaction, the announcement index does steps 3.1 to 3.3 of section 8.1 with `packages/core` and `packages/chain`. It skips a transaction hash that it already has.
4. Keep the valid items in height order. Count each transaction that fails to decode as rejected (THREAT_MODEL R16).

Storage: memory only. A restart or a wake from sleep rebuilds both indexes from the chain. The announcement index never opens an announcement, so it cannot tell whose it is.

### 9.5 Sponsor

- The sponsor wallet is a team testnet account. It is not a user key. Its recovery phrase is in the gateway environment (`SPONSOR_MNEMONIC`, set on Railway). It holds test QOR only.
- The sponsor wallet registered its ML-DSA-87 key on its first send. It signs each send with a hybrid signature. MEASURED: sponsor transaction `E034D4B3704D05DB44D8B8BD4BB4091A26F72428081BAD63E11FDDDFC6A90CB4` sent 120,000 uqor, paid a fee of 27,840 uqor and has the `pqc_hybrid_verify` event.
- The setup amount is `SPONSOR_AMOUNT_UQOR`, default `120000` (0.12 QOR). Gates G1 and G2 paid 58,763 + 38,120 = 96,883 uqor (MEASURED). Thus a smaller amount leaves almost no margin.
- The gas amount for a stealth address is `120000uqor` (0.12 QOR), fixed in the code.

**Setup (`POST /v1/sponsor`).** The gateway sends only if all these conditions are true:

1. The gateway has not funded this address since its start.
2. The IP address has fewer than 3 sponsorships in the last 24 hours before this one.
3. The total of sponsorships in the last 24 hours is less than `SPONSOR_DAILY_CAP` (default 50).
4. `/cosmos/auth/v1beta1/accounts/{address}` gives "not found" (404 with gRPC code 5). Thus the address is a new account.

**Gas for a stealth address (`POST /v1/sponsor-gas`, method 2).** The gateway sends only if all these conditions are true:

1. Conditions 1 to 3 of the setup apply.
2. `/cosmos/auth/v1beta1/accounts/{address}` has no public key. Thus the address has never signed a transaction.
3. The address has a balance of fUSD, fETH or fBTC that is more than 0.
4. The address has less than 0.12 QOR.

**Shared limits.** Setup and gas sponsorships share one budget: 3 for each IP address and `SPONSOR_DAILY_CAP` in total, in a rolling 24 hours. A request holds its place in the budget while the chain checks run. Thus two requests for one address cannot both pass. A refusal or a failed send gives the place back.

**State.** All limits are in memory. A restart resets the IP limits, the daily total and the list of funded addresses. The chain checks still stop a second sponsorship of one address. After a setup sponsorship, the account exists on chain. A stealth address keeps 0.12 QOR until its first spend, and after the spend it has a public key.

**Client IP address.** The gateway takes the client IP address from `X-Forwarded-For` behind `TRUST_PROXY_HOPS` trusted proxy hops (default 1, the Railway proxy). If a client could reach the gateway without the Railway proxy, it could forge this header and pass the IP limit (THREAT_MODEL R19). The gateway keeps the IP address only as SHA-256(random salt of the process ‖ IP address).

**Sends.** One queue runs every send, one at a time. Thus two sends never use the same account sequence. The gateway answers 200 only when the chain accepts the send.

**Answers.** Each refusal has an `error` sentence. The web app shows it as it is (`REFUSALS` in `apps/gateway/src/sponsor.ts`).

| Code | Cause | `error` sentence |
|---|---|---|
| 200 | The chain accepted the send | None. The body is `{ "txHash": "<hex>" }`. |
| 400 | The body is not one field `address` with a `qor1` account address | "Send a JSON body with one field, address, that holds a qor1 account address." |
| 503 | `SPONSOR_MNEMONIC` is not set | "The sponsor is not available. Get test QOR from the faucet or from QoreX." |
| 409 | The gateway already funded this address | "The sponsor already funded this address." |
| 429 | The IP limit | "This network already got 3 sponsorships in the last 24 hours. Try again later." |
| 429 | The daily cap | "The sponsor reached its limit for today. Try again later, or get test QOR from the faucet." |
| 409 | Setup: the account exists on chain | "This account is already on the chain. The sponsor funds new accounts only." |
| 409 | Gas: the address has a public key | "This address already signed a transaction. The sponsor sends gas only before the first spend." |
| 409 | Gas: no fUSD, fETH or fBTC | "This address holds no fUSD, fETH or fBTC. The sponsor sends gas only for a received payment." |
| 409 | Gas: 0.12 QOR or more | "This address already holds 0.12 QOR or more, which is enough gas." |
| 502 | A chain read failed, or the chain refused the send | "The sponsor could not complete the transfer. Try again in a minute." |

A chain observer sees a transfer from the sponsor wallet to the address. This shows that the address belongs to some Bellaso user. With few users, the set of sponsored addresses is small (THREAT_MODEL R23).

### 9.6 Configuration

`apps/gateway/src/config.ts` reads these variables. A number outside its range stops the start with an error.

| Variable | Default or rule |
|---|---|
| `PORT` | `8080` |
| `CHAIN_REST`, `CHAIN_RPC` | Section 3 |
| `ANNOUNCEMENT_CONTRACT` | The instance address (section 5.3) |
| `ALLOWED_ORIGINS` | `http://localhost:3000`. Example: `https://<web app>.vercel.app,http://localhost:3000` |
| `SPONSOR_MNEMONIC` | Secret. Never commit it. Set on Railway. Without it, both sponsor routes answer 503. |
| `SPONSOR_AMOUNT_UQOR` | `120000` |
| `SPONSOR_DAILY_CAP` | `50` |
| `TRANSFERS_FROM_HEIGHT` | `10600000`. The transfer index serves no older transfer. |
| `TRUST_PROXY_HOPS` | `1` (the Railway proxy) |

The web app reads the gateway URL from `NEXT_PUBLIC_GATEWAY_URL`.

### 9.7 Spike result (MEASURED, 23 Nov 2026, Bun 1.3.3, Windows)

| Check | Result |
|---|---|
| Fastify 5.12.8 on Bun, with `@fastify/cors` 11.4.3 and `@fastify/rate-limit` 11.3.0 | Works. The response has `access-control-allow-origin` for the allowed origin. |
| `bun:sqlite` | Works. It is built in, so it adds no package. The gateway does not use it now (section 9.4). |
| REST proxy with a path allowlist | Allowed path: 200 from testnet. Other path: 403. Over the rate limit: 429. |
| `@qorechain/sdk` 0.14.0 and `@qorechain/qoreseal` 0.1.0 on Bun | `generateMnemonic`, `deriveNativeAccount`, `derivePqcCanonical` (2,592-byte key), `deriveSealKeys` (1,568-byte key) and the ML-KEM round trip work. |

Gate G8 later proved that the SDK signs and broadcasts from a browser through the gateway (PLAN section 3).

## 10. Vault (secret storage in the browser)

`apps/web/src/vault.ts` keeps the vault.

- Storage: the browser `localStorage`, key `bellaso.vault.v1`. The stored value is `{ v: 1, salt, iv, data }`, with each part in base64.
- Encryption: AES-256-GCM with WebCrypto. The key comes from the user passphrase with PBKDF2-SHA-256, 600,000 iterations and a 16-byte random salt. Each save uses a new 12-byte IV. The passphrase has 10 characters or more.
- Content: the recovery phrase, the address of A, the payments that the inbox found and the stealth address entries `{ index, address, label, createdAt, askGas }`. All of it is encrypted, because the payment list and the labels link payments to A.
- The vault keeps no scanned height (section 8.1).
- The app keeps the decrypted data in the memory of the tab only. **Lock vault** or a page reload locks it again.
- **Download encrypted backup** on `/create` saves the sealed vault as `bellaso-vault.json`. It opens only with the passphrase.
- A restore from the recovery phrase is possible on `/create`.
- The phrase shows only on `/create`, before the first save. There is no **Export recovery phrase** screen yet.

## 11. Repository structure

The repository is a Bun workspace. Bun is the package manager, the test runner and the runtime of the gateway and the scripts. Vercel builds the web app. Workspace packages export TypeScript source and have no build or bundle step.

```
bellaso/
  package.json              workspaces and the scripts "check", "dev", "gateway"
  bun.lock
  apps/
    web/                    Next.js App Router, client components only (Vercel)
      app/page.tsx          landing page
      app/create/           recipient setup and restore (7.1)
      app/pay/[id]/         payer flow (7.2); id = qor1 address
      app/inbox/            scan and list (8)
      app/spend/[tx]/       spend (7.3, 7.4)
      app/receive/          get paid: payment link (method 1) and stealth addresses (4.6)
      app/vault-gate.tsx    unlock and lock of the vault
      src/vault.ts          10
      src/setup.ts          7.1
      src/payment.ts        7.2: payment target and messages
      src/qorex.ts          7.2: QoreX call and errors
      src/inbox.ts          8.1 steps 3.3 to 3.5, 8.5
      src/spend.ts          7.3, 7.4
      src/gateway.ts        gateway REST reads, transaction links
      src/chain-client.ts   SDK client on the gateway, recipient keys, balances
      test/
    gateway/                Bun + Fastify (Railway)
      src/app.ts            routes and schemas (9.3)
      src/proxy.ts          allowlists (9.2)
      src/indexer.ts        in-memory indexes (9.4)
      src/sponsor.ts        9.5
      src/config.ts         9.6
      src/server.ts         starts the app
      test/
  packages/
    core/                   pure TypeScript, no network, no DOM
      src/labels.ts         domain labels (4.2)
      src/derive.ts         key, address and tweak derivations (4.2 to 4.6)
      src/payment.ts        payment target, open an announcement, stealthAddress (4.3, 4.4, 4.6)
      src/announcement.ts   format v1 (5.1)
      src/encoding.ts       base32768 records (5.2)
      test/
    chain/                  network code with a base URL (chain or gateway)
      src/config.ts         network constants (3) and the contract address
      src/tx.ts             tx_search, transaction decode, transfers and records (6, 8.1)
  scripts/                  CLI, run with Bun; reads the chain directly
    keys.ts                 makes the test accounts in the local .env
    chain-status.ts         chain ID and height
    setup.ts                7.1
    records.ts              7.2 with an SDK payer (gate G3, demo data)
    scan.ts                 8 (AC4, AC10); --source chain or gateway
    spend.ts                7.3 (AC5)
    link-attempt.ts         AC6, AC11
    send.ts                 sends QOR from the CLI payer with a hybrid signature
    lib/                    scan, link heuristics, recipient keys, REST reads
    test/
  docs/
```

### 11.1 Dependencies

| Package | Version | Use |
|---|---|---|
| Bun | 1.3.3 or later | Package manager, test runner, runtime of the gateway and the scripts |
| `next`, `react`, `react-dom` | 16.4.6, 19.3.1 | Web app (Turbopack) |
| `fastify` | 5.12.8 | Gateway |
| `@fastify/cors` | 11.4.3 | Gateway CORS |
| `@fastify/rate-limit` | 11.3.0 | Gateway rate limit |
| `@qorechain/sdk` | 0.14.0 | Accounts, PQC registration, hybrid signing, transactions |
| `@qorechain/pqc` | 0.2.3 | ML-DSA-87 |
| `@qorechain/qoreseal` | 0.1.0 | KEM keys, encapsulation, registry message, KEM key fetch |
| `@cosmjs/proto-signing` | as used by the SDK | `decodeTxRaw` |
| `@noble/curves`, `@noble/hashes` | 2.4.0 | secp256k1 point math, SHAKE-256, RIPEMD-160 |
| `@scure/base` | 2.4.0 | bech32 |
| `base32768` | 5.0.1 | Record encoding |
| `typescript` | 6.0.x | Type checks. typescript-eslint 8.73 refuses TypeScript 7 (MEASURED on 23 Nov 2026). |
| `eslint`, `@eslint/js`, `typescript-eslint` | 10.15, 10.0, 8.73 | Lint |
| `@qorechain/handles` | 0.1.0 | Optional (gate G7) |

The QoreChain packages, `@noble`, `@scure` and `base32768` have no install script (MEASURED on npm, 23 Nov 2026). Bun runs the install scripts of a dependency only if the package is in the default trusted list of Bun or in `trustedDependencies`. Do not add entries to `trustedDependencies`.

### 11.2 The `check` script

`bun run check` runs `tsc --noEmit` in each workspace, `eslint`, `bun test` and the Next.js build. The shared verifier runs `npm run check`, which starts the same script.

## 12. Tests

### 12.1 Unit tests (`bun test`)

| Test | What it proves |
|---|---|
| Test vectors | Fixed seeds give fixed `addr_o`, `tag`, `h`, `pqRoot` and the `pq-seed` output. A change to a label or an order fails the test. |
| Round trip × 100 | Random payments to one recipient: the recipient always finds the payment and derives a key for `addr_o`. |
| False positives × 300 | Announcements for another recipient never match. A matching ciphertext with a different transfer destination is refused (THREAT_MODEL R13). |
| Announcement format and records | Format v1 is 1,570 bytes and refuses a wrong version or length. An announcement needs 7 records of 140 characters or fewer, with no leading or trailing whitespace. A bad header or a missing record gives an error. |
| Labels | The label set equals section 4.2. A label is the UTF-8 bytes of `bellaso/v1/<name>`. |
| Gateway proxy allowlists | A path or an RPC method outside the allowlist gives 403. Dot segments and unusual characters are refused. A batch has 10 calls or fewer. |
| Gateway configuration | The defaults of section 9.6. A bad number stops the start. |
| Gateway schemas | Both sponsor routes refuse extra properties and bad addresses before any chain read. No route has a field for a secret (AC7). |
| Gateway indexes | Fixture transactions: only valid announcements stay, and broken record sets are counted. The transfer index keeps each `MsgSend` of the four test denoms from its first height. A page keeps every item of its last height. The routes refuse bad parameters. |
| Gateway sponsor | It funds a new account one time and refuses an existing account. It answers 503 without a wallet. The IP limit counts the address that the proxy adds, not one that the client writes. Setup and gas share the daily cap. A failed read or send answers 502 and gives the place back. Sends run one at a time. An IP address gets one more sponsorship when its oldest one is 24 hours old. |
| Gas sponsor rules | `sponsor-gas` funds only an unsigned address that holds a payment and little QOR. |
| Method 2 vectors | Fixed seeds and indexes give fixed `addr_i` and the `addr-pq-seed` output. `stealthAddress` gives the same `addr_i`. A change to `addr-tweak` or `addr-pq-seed` fails the test. |
| Link heuristics | `scripts/test/link.test.ts`: clean public data gives no match, and a fresh KEM key opens no announcement of A (H5). H1 to H4 and H6 to H9 each find a fixture leak. |
| Web helpers | `apps/web/test`: the inbox opens a payment to this recipient and ignores one to another recipient; method 2 matching keeps only vault addresses; the spend takes the fee from the QOR; amounts and QoreX errors. |

Not built yet:

- "Payer cannot spend": with `ss` and public data only, the test cannot derive `k_o` or `pk_o`.
- A body over 64 KB gives 413.
- Method 2 recovery with the gap limit.
- A unit test for method 2 reuse ("Paid n times").

### 12.2 Testnet scripts (evidence for the acceptance criteria)

Run each script from the repository root with `bun scripts/<name>.ts`. The scripts read the secrets from the local `.env` (`RECIPIENT_MNEMONIC`, `PAYER_MNEMONIC`).

| Script | Criterion | Output to keep |
|---|---|---|
| `setup.ts` | AC1, AC2 | Two transaction hashes and the two REST responses |
| `records.ts --count 20`, to 2 or more recipients | AC4 data | Transaction hashes |
| One payment with QoreX in the browser | AC3 | Transaction hash and body |
| `scan.ts --source chain` | AC4 | Found 100%, false positives 0 |
| `scan.ts --source gateway` | AC10 | The same stdout as `--source chain` |
| `spend.ts` | AC5 | Two transaction hashes and the `pqc_hybrid_verify` event |
| `link-attempt.ts` | AC6 | `RESULT: PASS`: H1 to H5 have 0 matches that hit a true payment |
| A stealth address from `/receive`, then a QoreX **Send** to it, then the inbox and the spend in the browser | AC11 | The transfer hash, the inbox row with the label, two spend hashes, and `link-attempt --suspect <address>` with `RESULT: PASS` |

**`records.ts`** makes method 1 payments with the CLI payer. Each payment is one hybrid transaction: a `MsgSend` and 7 records (section 7.2). Options:

- `--to <qor1…>`: the recipient. It must have a KEM key on chain. Default: account A of `RECIPIENT_MNEMONIC`.
- `--amount <fUSD>`: fUSD for each payment, for example `2.5`. Default 1.
- `--count <n>`: the number of payments. Default 1.
- `--allowance <uqor>`: the gas allowance for each payment. Default 150,000. 0 is allowed.
- `--gas <limit>`: the gas limit of each payment. Default 1,250,000. The fee is the limit × 0.15 uqor.
- `--dry-run`: simulate each payment and send nothing.

MEASURED: payment `59CF3A20DFFA2911A6F46E84BED2F215C3CC6A7D46367818384ACE5815349856` used 838,518 of 1,250,000 gas. Its fee was 187,500 uqor (about 0.19 QOR). With the "auto" gas of the SDK, a payment paid about 0.45 QOR (gate G3).

**`scan.ts --source chain|gateway`.** `chain` (the default) reads `tx_search` on the chain and never calls the gateway. `gateway` reads every page of `/v1/announcements` from `GATEWAY_URL`. Both print the same lines to stdout. The source, the counts and the time go to stderr. Thus a plain `diff` of two runs proves AC10. MEASURED: the diff of both outputs is empty.

**`send.ts <qor1> <uqor>`** sends QOR from the CLI payer with a hybrid signature, for example to fund the sponsor wallet or a test account.

**`link-attempt.ts`** plays a third party (AC6, AC11). It has two phases:

1. **Attack phase.** It uses public data only. Its inputs are the address of A and the optional suspect addresses. It reads `P_A`, `ek_A`, every transaction of the announcement contract, and every transaction with a bank transfer from or to A or a one-time address. Then it runs nine heuristics in `scripts/lib/link.ts`.
2. **Scoring phase.** After the attack, it loads `RECIPIENT_MNEMONIC` to learn the true payments of A: the method 1 scan and the method 2 indexes 0 to 99. Without `RECIPIENT_MNEMONIC`, it counts every match as true.

| ID | Heuristic | Kind |
|---|---|---|
| H1 | The identifiers of A (address, account bytes, EVM address, `P_A`, `ek_A`, in text, hex and base64) in a transaction of a one-time address | Link to A (AC6) |
| H2 | A transfer from A to a one-time address | Link to A |
| H3 | A transfer from a one-time address to A | Link to A |
| H4 | A funder of A also funded a one-time address | Link to A |
| H5 | Open each announcement with `P_A` and a fresh ML-KEM-1024 key | Link to A |
| H6 | A transfer from one one-time address to another | Joins payments (G2) |
| H7 | One-time addresses that paid the same destination | Joins payments |
| H8 | One funder paid more than one one-time address | Joins payments |
| H9 | One one-time address in more than one announcement | Joins payments |

Options:

- `--account <qor1…>`: account A. Default: the address of `RECIPIENT_MNEMONIC`. Only the address goes into the attack.
- `--suspect <qor1…>`: another address to test, for example a stealth address. Repeat it for more.

The script exits with code 1 if an H1 to H5 match hits a true payment.

It is a demonstration, not a proof. The proof is in THREAT_MODEL section 3.1.

## 13. Deployment

- **Web app:** Vercel. Client components only. Set `NEXT_PUBLIC_GATEWAY_URL`.
- **Gateway:** Railway (team decision, 23 Nov 2026). Project `bellaso`, service `gateway`, connected to the GitHub repository (branch `main`). A push that changes a watched path deploys it. URL: `https://gateway-production-4e82893b.up.railway.app`.
  - Build: `apps/gateway/Dockerfile` (`oven/bun:1.3.3-slim`, installs only the gateway dependencies). The image runs the TypeScript source.
  - Service settings, kept on the Railway service (not in a file, because Config as Code files stop working on 1 Dec 2026, and the IaC file format does not document a Dockerfile path or sleeping): `dockerfilePath` `apps/gateway/Dockerfile`, `healthcheckPath` `/v1/health`, `healthcheckTimeout` 60, `restartPolicyType` `ON_FAILURE` with 3 retries, `watchPatterns` `apps/gateway/**`, `packages/**`, `bun.lock`, one replica in `asia-southeast1-eqsg3a`, `sleepApplication` true.
  - Variables: `ALLOWED_ORIGINS` and `SPONSOR_MNEMONIC`. Railway sets `PORT`.
  - Cost: app sleeping is on. The gateway has no volume, because all its state is in memory and the indexes pull from the chain only when a client asks (section 9.4). A wake from sleep rebuilds the indexes and resets the sponsor limits. Turn sleeping off before judging (PLAN, day 7), so the first request of a juror does not wait for a cold start.
- **Transaction links:** no testnet explorer for `qorechain-diana` is confirmed. The web app opens a transaction as raw JSON through the gateway REST read `/v1/lcd/cosmos/tx/v1beta1/txs/<hash>`.
  - Use the default subdomain of the host. The team does not buy a domain.
- **Self-hosting:** the README shows how to run the gateway locally with `bun run gateway` and an `.env` file.
- The README lists these testnet addresses: the announcement contract, the sponsor wallet, the demo recipient account A, the demo payer and two demo one-time accounts. It also lists the gateway URL.
- The project does not use mainnet.

## 14. Gates

Each gate has a test, a pass condition and a fallback. Record the result (transaction hash or output) in `docs/PLAN.md`. G1 to G6 run on day 1 with CLI scripts. G8 runs on day 4.

| Gate | Test | Pass condition | Fallback |
|---|---|---|---|
| **G1** Account A | Derive A from a new phrase. Fund it. Register its ML-DSA-87 key. Read `/qorechain/pqc/v1/account/{addr}`. Compare the key with `derivePqcCanonical`. | Registered, possession proven. | If the canonical key fails, use `deriveUnifiedAccount` and drop the QoreX import feature (handles). |
| **G2** KEM key | Register `ek_A` with a hybrid transaction. Read `/qorechain/pqc/v1/kem/{addr}`. | `found: true`, `algorithm_id: 2`, the same bytes. | None. This gate blocks the category requirement. Ask in the fest Discord. |
| **G3** Records | Instantiate code 865. Simulate, then send with the SDK: `MsgSend` + 7 base32768 records. | Code 0. Record the gas used. | Section 8.4, in order. |
| **G4** QoreX | Send the same transaction from the browser with QoreX. | Code 0. Record `shield`, gas and fee. | Payer uses the CLI (`records.ts`) for the demo, and the web app shows the QoreX path as "next". |
| **G5** Spend | Transaction 1 (registration) and transaction 2 (hybrid send) from a one-time account. Also simulate a bundled registration + send. | Both succeed. The `pqc_hybrid_verify` event is present. Record fees and set the gas allowance. | If transaction 1 fails, ask in the fest Discord. |
| **G6** Scan | Run `scan.ts` against the transactions from G3 and G4. | The scan finds them. | Read the contract state with smart queries (section 6). |
| **G7** Handles (optional) | Claim a handle in QoreX mobile with the Bellaso phrase. Resolve it with `@qorechain/handles`. | `ownerPubkeyHex` hashes to the address of A. | Use the `qor1` address in the link. |
| **G8** Gateway | Deploy the gateway. In the browser, through the gateway: read the KEM key, do the setup with the sponsor, and broadcast a spend with the SDK. Then compare `scan.ts --source gateway` with `--source chain`. | All steps succeed. The two scans give the same result. | If the SDK does not accept a base URL with a path, serve the proxy at the root paths of the gateway (`/cosmos/...`, `/qorechain/...`, and `/` for RPC). |
| **G9** Normal wallets (day 6) | 1. Send fUSD to a stealth address from the QoreX **Send** screen. 2. Measure the number of `MsgSend` transactions on testnet per day (feed size). 3. Optional: send ERC-20 fUSD from MetaMask to the `0x` form of the same address, then read the native balance. | 1: the transfer lands and the scan finds it. 2: the feed for 10 days fits in 5 MB or less. 3: the native balance shows the fUSD and the spend succeeds. | 1 fails: method 2 waits. 2 fails: the feed returns only fUSD transfers. 3 fails: show only the `qor1` form and drop AC12. |

Status on 23 Nov 2026: G1 to G6 and G8 pass. G9 is partial: a plain `MsgSend` from the CLI payer to a stealth address landed, and the browser found and spent it. The volume is about 20 `MsgSend` transactions each hour (section 6). The QoreX **Send** screen and the EVM wallet are not tested yet. G7 is pending. PLAN section 3 has the evidence.

## 15. Decisions and alternatives

| Decision | Reason | Alternative not used |
|---|---|---|
| Bellaso holds account A, not QoreX | QoreX does not export `k_A` and refuses `MsgRegisterKEMKey` from a website (CONFIRMED). | Use the QoreX account of the user as A. |
| Native lane only | QoreX signs native messages. Native accounts use hybrid signatures for every transaction after registration. | EVM contracts and the EVM window. |
| Announcement in an own instance of code 865 | It is the only way found to put the announcement in the same QoreX transaction as the payment (CONFIRMED). | `MsgCrossVMCall` (QoreX refuses it), the memo (256 characters), IBC memo. |
| base32768 records | 7 records in place of 16. Thus the fee is about half. | base64 (fallback). |
| Scan with `tx_search` | It gives the `MsgSend` destination and amount in the same read. No query for a single address. | Per-address balance queries (THREAT_MODEL R7). |
| Two transactions for the first spend | The chain lets a registration pass without a hybrid signature only as a single message (probable). | One bundled transaction (gate G5 checks it). |
| ML-KEM-1024 and ML-DSA-87 | NIST Category 5, the category requirement, and the QoreChain defaults. | ML-KEM-768 (used by Specter and ERC-8441). |
| A gateway with Bun + Fastify | The public endpoints send no CORS headers (MEASURED). The gateway also indexes announcements and transfers, and sponsors the setup and the gas of stealth addresses. The team wants a long-term product. | Next.js route handlers on Vercel (smaller, but no index). |
| Gateway state in memory, pulled when a client asks | The chain is the source of truth. Railway can put an idle gateway to sleep, and a restart rebuilds the indexes. | SQLite (`bun:sqlite`) on a persistent volume, with a poll loop. |
| Sponsor setup amount 0.12 QOR | Gates G1 and G2 paid 96,883 uqor (MEASURED). A smaller amount leaves almost no margin. | A smaller amount. |
| Vault in `localStorage` | The vault is one encrypted JSON value. | IndexedDB. |
| Scan on the main thread | 3 announcements opened in 0.16 s (MEASURED). A worker is not necessary at this size. | A Web Worker. Add it when the announcements reach about 1,000. |
| A Bun workspace | One toolchain for the gateway, the scripts and the tests. | pnpm, Node, tsx and Vitest. |
| The CLI does not use the gateway | The CLI is an independent check of the gateway (AC10). | One code path through the gateway for all clients. |
| Method 2 derives from `pqRoot` and an index | Any wallet can pay. No announcement and no payer code are necessary. Recovery uses a gap limit. | The gateway makes addresses for the payer (the gateway would know which address belongs to which link, as Fluidkey does). |
| Method 2 scan reads a full transfer feed | No query for a single address (THREAT_MODEL R7). | Balance queries for each stealth address. |
| Gas for method 2 from the sponsor at spend time | A normal wallet sends no QOR. The sponsor shows only "a Bellaso address", not whose. | A fee grant from account A (it links A to the address on chain). |
