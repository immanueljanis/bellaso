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
6. **The chain is the source of truth.** The gateway database is a cache. If you delete it, the indexer makes it again from the chain.
7. **Prove on testnet.** A gate or an acceptance criterion passes only with a transaction hash or command output.

## 2. Architecture

```
+--------------------------- Browser: apps/web (Vercel) ---------------------------+
|  Next.js client pages        packages/core (pure TS)      packages/chain          |
|  /create  /pay/[id]          derive, announcement,        REST and RPC clients    |
|  /inbox   /spend/[tx]        encoding, scan, labels       (base URL = gateway),   |
|  Encrypted vault (IndexedDB) Web Worker: scan             tx builders, QoreX call |
|  ALL KEYS STAY HERE                                                               |
+----------------------------------------------------------------------------------+
     | QoreX (payer signs and          | HTTPS: public data and signed transactions only
     | broadcasts with its own node)   v
     |            +------------- apps/gateway: Bun + Fastify (Railway) -------------+
     |            |  /v1/lcd, /v1/rpc   proxy with allowlists (CORS for our origins) |
     |            |  /v1/announcements  indexer -> SQLite cache (bun:sqlite)         |
     |            |  /v1/sponsor        sends 0.1 QOR to a new account A             |
     |            |  NO USER SECRET. The sponsor wallet holds test QOR only.          |
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

The CLI does not use the gateway. Thus the CLI scan is an independent check of the gateway (AC10). There is no relayer in the main design. Section 8.4 gives the fallbacks.

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
5. The vault stores `{ i, label, createdAt, askGas }`, encrypted. The label never leaves the browser.

Why a chain observer cannot link `addr_i` to A, also after Q-Day: the argument of THREAT_MODEL section 3.1 applies. To prove a link, T2 must show `k_i − k_A = h_i`. `h_i` is a SHAKE-256 output of `pqRoot`, which never leaves the browser.

Recovery: after a restore from the recovery phrase, the app derives `i = 0` up to the highest used index plus 20 (gap limit) and matches them against the transfer feed (section 8.5).

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
| Announcements (browser) | Gateway `GET /v1/announcements?after=<height>` (section 9.3). | Bellaso design |
| Announcements (gateway indexer and CLI) | RPC `tx_search` with the query `wasm._contract_address='<instance>'`, ordered by height. Decode each transaction with `decodeTxRaw` from `@cosmjs/proto-signing`. | MEASURED (query works on testnet) |
| Fallback for announcements | Contract smart query `{"latest":{"limit":20}}` or `{"receipt":{"id":N}}`. Each receipt has `id`, `sender`, `note`, `height`. | MEASURED |
| Transfers to stealth addresses (method 2) | Gateway `GET /v1/transfers?after=<height>` (section 9.3): all bank transfers of fUSD, fETH, fBTC and QOR, not filtered. The CLI uses `tx_search` with `message.action='/cosmos.bank.v1beta1.MsgSend'`. | UNCERTAIN: volume on testnet (gate G9) |

## 7. Transactions

### 7.1 Recipient setup (Bellaso app, SDK)

1. **Fund A.** The app calls the gateway `POST /v1/sponsor` with the address of A. The gateway sends 0.1 QOR (section 9.5). If the sponsor refuses or is not available, the recipient sends QOR from QoreX or from the faucet. A is the public payment identity. Thus both public links are acceptable (THREAT_MODEL R15, R20).
2. **Register the ML-DSA-87 key of A.** Use `ensurePqcRegistered(tx, { pqcKeypair, rest })`. It builds `/qorechain.pqc.v1.MsgRegisterPQCKeyV2` with the proof of possession. The account signs with secp256k1 only. This exemption applies only while the account has no PQC key. Cost: 276k to 298k gas, about 0.03 QOR (CONFIRMED).
3. **Register the KEM key of A.** Use `msg.pqc.registerKemKey({ sender, publicKey: ek_A })` with a hybrid signature (`client.connectTx(signer, { pqcKeypair })`). The chain refuses it with codespace `pqc` code 254 if step 2 is not complete. Cost: 247k to 277k gas, about 0.025 QOR (CONFIRMED).
4. **Read back** both keys with the REST calls in section 6 (AC1, AC2).

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

- QoreX accepts 1 to 32 messages and decodes `MsgSend` and `MsgExecuteContract`.
- With a contract message, QoreX simulates and sets the gas limit to ceil(simulated × 1.3).
- The result is `{ txHash, code, height?, shield }`. Check `capabilities` before the call.
- Do not set a memo.

Cost estimate from simulation: a transaction with one record uses about 481k gas. Each further record adds about 278k gas. Thus `MsgSend` + 7 records costs about 0.3 to 0.45 QOR. With base64 (16 records) it costs about 0.9 QOR. UNCERTAIN: a per-transaction contract execution budget of 1.5M gas can refuse 7 records (gate G3).

### 7.3 Spend (recipient, SDK)

The one-time account is a coin-118 secp256k1 account. Sign with `directSignerFromPrivateKey(k_o, "qor")`, not with `EthNativeSigner`.

1. Read the PQC status of `addr_o`.
2. If no key is registered, send **transaction 1**: `MsgRegisterPQCKeyV2` for `pk_o` with the proof of possession. It is signed with secp256k1 only. Wait until the chain includes it.
3. Send **transaction 2**: a hybrid `MsgSend` from `addr_o` to the destination (`client.connectTx(signer, { pqcKeypair: { pk_o, sk_o } })`, then `tx.bankSend(to, coins)`).
4. Check that the result has the `pqc_hybrid_verify` event (AC5).

Do not put the registration and the send in one transaction. The chain probably refuses it, and all 100 recent registrations on testnet were single-message transactions (UNCERTAIN, gate G5).

**Gas allowance.** Transaction 1 costs about 0.03 QOR. A hybrid `MsgSend` with 2 coins costs about 0.02 QOR (166k to 217k gas). The default allowance is **0.15 QOR** (`150000uqor`). Gate G5 measures the real value.

**"Send all".** The app sends the full fUSD balance and the QOR balance minus the fee of transaction 2.

**Warnings.** If the destination is account A or another one-time account in the inbox, show: "This links your payments together."

### 7.4 Method 2: payment and spend

**Payment.** The payer sends a normal `MsgSend` to `addr_i` from any wallet. Bellaso is not part of this transaction. Gate G9 checks QoreX **Send** first, then an EVM wallet.

**Gas.** A normal transfer brings no QOR. Before the spend, the app checks the QOR balance of `addr_i`:

1. If the balance is 0.06 QOR or more (the payer added QOR), spend at once.
2. Else, call the gateway `POST /v1/sponsor-gas` with `addr_i` (section 9.5). The sponsor sends 0.06 QOR. This covers transaction 1 (about 0.03 QOR) and transaction 2 (about 0.02 QOR).

**Spend.** The same two transactions as section 7.3, with `k_i` and `(pk_i, sk_i)` from section 4.6.

## 8. Scan

### 8.1 Algorithm

The gateway indexer does steps 3.1 to 3.3 one time for all clients. The browser gets the result from `/v1/announcements`, checks the length and the version again, and does steps 3.4 and 3.5. The CLI does all steps with `tx_search` on the chain.

1. Read the last scanned height from the vault. The default is the height of the contract instantiation.
2. Get the announcements after that height: from the gateway (browser) or with `tx_search`, 100 transactions for each page (CLI).
3. For each transaction:
   1. Decode the body. Find the `MsgSend` and its `to_address` and `amount`.
   2. Collect the `MsgExecuteContract` messages to the contract, in message order. Read the `note` of each.
   3. Parse the header. Join the notes. Decode base32768 (or base64). Check the length (1,570) and the version (`0x01`).
   4. Open the announcement (section 4.4).
   5. If it matches, store `{ txHash, height, to: addr_o, amount }`.
4. Save the new height.

### 8.2 Status of a payment

- The amount comes from the payment transaction. The scan does not query the balance of `addr_o`.
- The vault stores the "spent" status after a spend.
- The app reads the balance of `addr_o` only on the spend screen. A spend shows the address anyway.

### 8.3 Performance

One announcement takes about 1.5 ms (MEASURED in Node). The browser runs the scan in a Web Worker so that the UI stays responsive.

A `tx_search` result has the full transaction and all events: 11.9 KB of JSON for each transaction on a code 865 instance (MEASURED). A Bellaso transaction is larger, because it has 7 records and a hybrid signature. The gateway sends about 2.3 KB for each announcement (1,570 bytes in base64 and the transfer data). Thus the browser downloads less data and does not decode protobuf.

### 8.4 Fallbacks for the announcement path

Use these in this order if gates G3 or G4 fail:

1. **base64 records** (16 records, about 0.9 QOR).
2. **Two payer transactions:** transaction A = `MsgSend` + the first records; transaction B = the other records. The header of each part gives the part number. The scan joins the parts by the payer address and the height.
3. **Relayer + EVM Announcer:** the payer signs only the `MsgSend`. A relayer posts the announcement with `MsgCrossVMCall` (payload up to 65,536 bytes) to an EVM Announcer contract. This adds adversary T5 to the threat model.

### 8.5 Scan for method 2

1. Derive `addr_i` for every index in the vault (and up to the gap limit after a restore).
2. Read the transfer feed after the last scanned height (gateway `/v1/transfers` in the browser, `tx_search` in the CLI).
3. Keep each transfer whose `to` is one of the derived addresses. Store `{ txHash, height, from, amount, index, label }`.
4. If one address has more than one transfer, mark it "paid more than one time" (THREAT_MODEL R22).

The scan never asks for the balance of a single stealth address. The spend screen reads the balance of the one address that it spends.

## 9. Gateway

`apps/gateway` is a Bun + Fastify service. It is the only server of Bellaso.

### 9.1 Why the gateway exists

1. **CORS.** The public REST and RPC send no CORS headers (section 3). Thus a browser cannot read the chain or broadcast a transaction directly.
2. **A fast inbox.** The indexer decodes each Bellaso transaction one time and keeps a compact list. Thus each browser downloads about 2.3 KB for each announcement, not the full transaction (section 8.3).
3. **Setup without QOR.** The sponsor pays the setup fees of a new account A. Thus a new recipient does not need QOR before setup.

### 9.2 Rules

1. No route accepts a secret: a recovery phrase, a private key, a KEM secret key or a shared secret. Each route has a request schema with `additionalProperties: false` (AC7).
2. The proxy allows only the paths and the methods in section 9.3. It is not an open proxy.
3. The announcement route has no parameter for a recipient or an address. Every client gets all announcements (THREAT_MODEL R7).
4. The gateway keeps no access log with an IP address and a request path. The sponsor keeps a salted hash of the IP address for 24 hours only (THREAT_MODEL R17, R19).
5. The database is a cache of public chain data (principle 6).

### 9.3 Routes (v1)

| Method and path | Use | Limits |
|---|---|---|
| `GET /v1/health` | Chain height, indexed height, counters | None |
| `GET /v1/lcd/*` | REST read | Allowed path prefixes: `/cosmos/auth/v1beta1/accounts/`, `/cosmos/bank/v1beta1/balances/`, `/qorechain/pqc/v1/`, `/cosmwasm/wasm/v1/contract/`, `/cosmos/tx/v1beta1/txs/` |
| `POST /v1/lcd/cosmos/tx/v1beta1/simulate` and `POST /v1/lcd/cosmos/tx/v1beta1/txs` | Simulate or broadcast a signed transaction | Body 64 KB or less |
| `POST /v1/rpc` | CometBFT JSON-RPC | Allowed methods: `status`, `abci_query`, `tx`, `tx_search`, `broadcast_tx_sync`. Body 64 KB or less |
| `GET /v1/announcements?after=<height>&limit=<n>` | All valid announcements after a height, in height order | `limit` is 500 or less. There is no other parameter. |
| `POST /v1/sponsor` | Body `{ "address": "qor1..." }`. Sends the sponsor amount to a new account A | Section 9.5 |
| `GET /v1/transfers?after=<height>&limit=<n>` | All bank transfers of the four test denoms after a height: `{ txHash, height, from, to, amount }` | `limit` is 1,000 or less. There is no address parameter. |
| `POST /v1/sponsor-gas` | Body `{ "address": "qor1..." }`. Sends 0.06 QOR to a stealth address before its first spend | Section 9.5 |

All routes: a rate limit for each IP address (120 requests each minute) and CORS for the origins in `ALLOWED_ORIGINS` only.

Response of `/v1/announcements`:

```json
{
  "items": [
    {
      "txHash": "<hex>",
      "height": 123,
      "time": "<RFC 3339>",
      "to": "qor1...",
      "amount": [{ "denom": "<denom>", "amount": "<integer string>" }],
      "announcement": "<base64 of 1,570 bytes>"
    }
  ],
  "next": 124,
  "tip": 130
}
```

### 9.4 Indexer

1. Every `POLL_MS` (default 5,000 ms), call `tx_search` for the announcement contract after the saved height. Use ascending order and 100 transactions for each page.
2. For each transaction, do steps 3.1 to 3.3 of section 8.1 with `packages/core` and `packages/chain`.
3. Keep the valid announcements. Skip the invalid ones and count them (THREAT_MODEL R16).
4. Save the announcements and the new height in one database transaction.
5. In the same loop, call `tx_search` for `message.action='/cosmos.bank.v1beta1.MsgSend'` and keep each transfer of fUSD, fETH, fBTC or `uqor` in the table `transfer` (method 2).

Storage: SQLite with `bun:sqlite` (built into Bun), in a file on a persistent volume.

| Table | Columns |
|---|---|
| `announcement` | `tx_hash` (primary key), `height`, `time`, `to_address`, `amount_json`, `body` |
| `cursor` | `height` |
| `sponsorship` | `address` (primary key), `ip_hash`, `tx_hash`, `created_at` |
| `transfer` | `tx_hash` + `msg_index` (primary key), `height`, `from_address`, `to_address`, `denom`, `amount` |
| `gas_sponsorship` | `address` (primary key), `ip_hash`, `tx_hash`, `created_at` |

### 9.5 Sponsor

- The sponsor wallet is a team testnet account. It is not a user key. Its recovery phrase is in the gateway environment (`SPONSOR_MNEMONIC`). It holds test QOR only.
- The sponsor wallet has a registered ML-DSA-87 key and signs with a hybrid signature.
- The amount is `100000uqor` (0.1 QOR). The setup costs about 0.055 QOR (section 7.1).
- The gateway sends only if all these conditions are true:
  1. `/cosmos/auth/v1beta1/accounts/{address}` gives "not found". Thus the address is a new account.
  2. The table `sponsorship` has no row for the address.
  3. The IP address has 3 or fewer sponsorships in the last 24 hours.
  4. The total for the day is less than `SPONSOR_DAILY_CAP`.

**Gas for a stealth address (method 2).** `POST /v1/sponsor-gas` sends `60000uqor` only if all these conditions are true:

1. The address has a balance of fUSD, fETH or fBTC that is more than 0.
2. The address has less than 0.06 QOR.
3. `/cosmos/auth/v1beta1/accounts/{address}` has no public key. Thus the address has never signed a transaction.
4. The table `gas_sponsorship` has no row for the address.
5. The IP address and daily limits of the sponsor apply.

A chain observer sees a transfer from the sponsor wallet to the address. This shows that the address belongs to some Bellaso user. It does not show which one (THREAT_MODEL R23).

### 9.6 Configuration

| Variable | Example or rule |
|---|---|
| `PORT` | `8080` |
| `CHAIN_REST`, `CHAIN_RPC` | Section 3 |
| `ANNOUNCEMENT_CONTRACT` | The instance address (section 5.3) |
| `ALLOWED_ORIGINS` | `https://<web app>.vercel.app,http://localhost:3000` |
| `DB_PATH` | `/data/bellaso.sqlite` |
| `POLL_MS` | `5000` |
| `SPONSOR_MNEMONIC` | Secret. Never commit it. |
| `SPONSOR_AMOUNT_UQOR` | `100000` |
| `SPONSOR_DAILY_CAP` | `50` |

The web app reads the gateway URL from `NEXT_PUBLIC_GATEWAY_URL`.

### 9.7 Spike result (MEASURED, 23 Nov 2026, Bun 1.3.3, Windows)

| Check | Result |
|---|---|
| Fastify 5.12.8 on Bun, with `@fastify/cors` 11.4.3 and `@fastify/rate-limit` 11.3.0 | Works. The response has `access-control-allow-origin` for the allowed origin. |
| `bun:sqlite` | Works. It is built in, so it adds no package. |
| REST proxy with a path allowlist | Allowed path: 200 from testnet. Other path: 403. Over the rate limit: 429. |
| `@qorechain/sdk` 0.14.0 and `@qorechain/qoreseal` 0.1.0 on Bun | `generateMnemonic`, `deriveNativeAccount`, `derivePqcCanonical` (2,592-byte key), `deriveSealKeys` (1,568-byte key) and the ML-KEM round trip work. |

Not proven yet: the SDK signs and broadcasts from a browser through the gateway (gate G8).

## 10. Vault (secret storage in the browser)

- The app encrypts the recovery phrase with AES-GCM. The key comes from the user passphrase with PBKDF2-SHA-256 and 600,000 iterations (WebCrypto).
- The app stores the ciphertext, the scan height and the payment list in IndexedDB. The payment list is also encrypted, because it links payments to A.
- The app keeps the decrypted keys in memory only. It deletes them when the user locks the app or closes the tab.
- The **Export recovery phrase** screen shows the phrase after the passphrase.

## 11. Repository structure

The repository is a Bun workspace. Bun is the package manager, the test runner and the runtime of the gateway and the scripts. Vercel builds the web app. Workspace packages export TypeScript source and have no build or bundle step.

```
bellaso/
  package.json              workspaces and the scripts "check", "dev", "gateway"
  bun.lock
  apps/
    web/                    Next.js App Router, client components only (Vercel)
      app/page.tsx          landing page
      app/create/           recipient setup (7.1)
      app/pay/[id]/         payer flow (7.2); id = qor1 address or handle
      app/inbox/            scan and list (8)
      app/spend/[tx]/       spend (7.3, 7.4)
      app/receive/          get paid: payment link (method 1) and stealth addresses (4.6)
      src/vault.ts          10
      src/scan.worker.ts    scan in a Web Worker (8.3)
    gateway/                Bun + Fastify (Railway)
      src/server.ts         routes and schemas (9.3)
      src/proxy.ts          allowlists (9.2)
      src/indexer.ts        9.4
      src/sponsor.ts        9.5
      src/db.ts             bun:sqlite
      test/
  packages/
    core/                   pure TypeScript, no network, no DOM
      labels.ts             domain labels (4.2)
      derive.ts             4.3 and 4.4
      announcement.ts       format v1 (5.1)
      encoding.ts           base32768 / base64 records (5.2)
      scan.ts               8.1 step 3
      test/
    chain/                  network code with a base URL (chain or gateway)
      config.ts             network constants (3) and the contract address
      rest.ts               REST reads (6)
      rpc.ts                tx_search and decode
      qorex.ts              QoreX payment call (7.2)
      txs.ts                SDK transactions (7.1, 7.3)
  scripts/                  CLI, run with Bun; reads the chain directly
    instantiate.ts          5.3
    setup.ts                7.1
    pay.ts                  7.2 with an SDK payer (for tests and demo data)
    scan.ts                 8 (AC4, AC10); --source chain or gateway
    spend.ts                7.3 (AC5)
    link-attempt.ts         AC6, AC11
    address.ts              4.6: make a stealth address (method 2)
    send-plain.ts           7.4: a normal MsgSend, as any wallet does
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
| Test vectors | Fixed seeds give fixed `addr_o`, `tag`, `k_o` and `pk_o`. A change to a label or an order fails the test. |
| Round trip × 100 | Random recipients and payments: the recipient always finds the payment and derives a key for `addr_o`. |
| False positives × 2,000 | Announcements for other recipients never match (THREAT_MODEL R13). |
| Payer cannot spend | With `ss` and public data only, the test cannot derive `k_o` or `pk_o`. |
| Encoding round trip | base32768 and base64 records: split, join, decode. Header errors give a clear error. |
| Record limits | Each record has 1 to 140 characters and no leading or trailing whitespace. |
| Gateway proxy allowlists | A path or an RPC method outside the allowlist gives 403. A body over 64 KB gives 413. |
| Gateway schemas | Each route refuses unknown fields. No route has a field for a secret (AC7). |
| Gateway indexer | Fixture transactions: a valid one, a broken header, a wrong length, missing records. Only the valid one is kept. |
| Gateway announcements | The route has no filter. The pages follow the height. |
| Gateway sponsor | It refuses an existing account, a second request for the same address, and requests over the limits. |
| Method 2 vectors | Fixed seeds and indexes give fixed `addr_i`, `k_i` and `pk_i`. A change to `addr-tweak` or `addr-pq-seed` fails the test. |
| Method 2 recovery | After a restore, the gap-limit scan finds every used index in a fixture transfer feed. |
| Method 2 reuse | Two fixture transfers to one stealth address give the status "paid more than one time". |
| Gas sponsor rules | `sponsor-gas` refuses an address with no token balance, an address with a public key, and a second request. |

### 12.2 Testnet scripts (evidence for the acceptance criteria)

| Script | Criterion | Output to keep |
|---|---|---|
| `setup.ts` | AC1, AC2 | Two transaction hashes and the two REST responses |
| `pay.ts` × 20, to 2 or more recipients | AC3 data | Transaction hashes |
| One payment with QoreX in the browser | AC3 | Transaction hash and body |
| `scan.ts --source chain` | AC4 | Found 100%, false positives 0 |
| `scan.ts --source gateway` | AC10 | The same result as `--source chain` |
| `spend.ts` | AC5 | Two transaction hashes and the `pqc_hybrid_verify` event |
| `link-attempt.ts` | AC6 | 0 matches |
| `address.ts`, then a QoreX **Send** to it, then `scan.ts` and `spend.ts` | AC11 | The transfer hash, the scan line with the label, two spend hashes, and `link-attempt` with 0 matches |

`link-attempt.ts` uses only public data: the address, `P_A` and `ek_A` of A, and all transactions. It checks three things:

1. No transaction field contains the address, `P_A` or `ek_A` of A.
2. A decapsulation with any key other than `dk_A` finds 0 matches.
3. The one-time addresses are all different.

It is a demonstration, not a proof. The proof is in THREAT_MODEL section 3.1.

## 13. Deployment

- **Web app:** Vercel. Client components only. Set `NEXT_PUBLIC_GATEWAY_URL`.
- **Gateway:** Railway (team decision, 23 Nov 2026). One always-on instance with a persistent volume for SQLite. Start command: `bun apps/gateway/src/server.ts`. Health check: `/v1/health`. Use the default subdomain of the host. The team does not buy a domain.
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
| **G4** QoreX | Send the same transaction from the browser with QoreX. | Code 0. Record `shield`, gas and fee. | Payer uses the CLI (`pay.ts`) for the demo, and the web app shows the QoreX path as "next". |
| **G5** Spend | Transaction 1 (registration) and transaction 2 (hybrid send) from a one-time account. Also simulate a bundled registration + send. | Both succeed. The `pqc_hybrid_verify` event is present. Record fees and set the gas allowance. | If transaction 1 fails, ask in the fest Discord. |
| **G6** Scan | Run `scan.ts` against the transactions from G3 and G4. | The scan finds them. | Read the contract state with smart queries (section 6). |
| **G7** Handles (optional) | Claim a handle in QoreX mobile with the Bellaso phrase. Resolve it with `@qorechain/handles`. | `ownerPubkeyHex` hashes to the address of A. | Use the `qor1` address in the link. |
| **G8** Gateway | Deploy the gateway. In the browser, through the gateway: read the KEM key, do the setup with the sponsor, and broadcast a spend with the SDK. Then compare `scan.ts --source gateway` with `--source chain`. | All steps succeed. The two scans give the same result. | If the SDK does not accept a base URL with a path, serve the proxy at the root paths of the gateway (`/cosmos/...`, `/qorechain/...`, and `/` for RPC). |
| **G9** Normal wallets (day 6) | 1. Send fUSD to a stealth address from the QoreX **Send** screen. 2. Measure the number of `MsgSend` transactions on testnet per day (feed size). 3. Optional: send ERC-20 fUSD from MetaMask to the `0x` form of the same address, then read the native balance. | 1: the transfer lands and the scan finds it. 2: the feed for 10 days fits in 5 MB or less. 3: the native balance shows the fUSD and the spend succeeds. | 1 fails: method 2 waits. 2 fails: the feed returns only fUSD transfers. 3 fails: show only the `qor1` form and drop AC12. |

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
| A gateway with Bun + Fastify | The public endpoints send no CORS headers (MEASURED). The gateway also indexes announcements and sponsors the setup. The team wants a long-term product. | Next.js route handlers on Vercel (smaller, but no indexer). |
| A Bun workspace | One toolchain for the gateway, the scripts and the tests. | pnpm, Node, tsx and Vitest. |
| The CLI does not use the gateway | The CLI is an independent check of the gateway (AC10). | One code path through the gateway for all clients. |
| Method 2 derives from `pqRoot` and an index | Any wallet can pay. No announcement and no payer code are necessary. Recovery uses a gap limit. | The gateway makes addresses for the payer (the gateway would know which address belongs to which link, as Fluidkey does). |
| Method 2 scan reads a full transfer feed | No query for a single address (THREAT_MODEL R7). | Balance queries for each stealth address. |
| Gas for method 2 from the sponsor at spend time | A normal wallet sends no QOR. The sponsor shows only "a Bellaso address", not whose. | A fee grant from account A (it links A to the address on chain). |
