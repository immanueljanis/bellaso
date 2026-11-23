# THREAT MODEL: Bellaso

> This document uses ASD-STE100 Simplified Technical English.
> Terms have the meanings in `SPEC.md` section 6.
> Do not add a privacy or security claim to the UI, the README or the video if this document does not support it.

---

## 1. Assets

| ID | Asset | Owner |
|---|---|---|
| S1 | The link between a payment and recipient account A | Recipient |
| S2 | The link between two payments to the same recipient | Recipient |
| S3 | The funds in a one-time account | Recipient |
| S4 | The recipient secrets: the Bellaso recovery phrase, the KEM secret key, the secp256k1 key of account A, the post-quantum root secret | Recipient |
| S5 | The availability of the announcements, so that the recipient can find each payment | Recipient |

## 2. Adversaries

| ID | Adversary | Capabilities |
|---|---|---|
| T1 | Chain observer (today) | Reads all blocks, transactions, announcements and balances. Uses classical computers. |
| T2 | Future quantum adversary | Has all capabilities of T1. Also breaks secp256k1, ECDSA and ECDH. Cannot break ML-KEM-1024, ML-DSA-87 or SHAKE-256. Keeps a copy of all chain data from today. |
| T3 | Payer | Knows the one-time address that the payer paid and the shared secret of that payment. |
| T4 | Web host and software supply chain | Serves the JavaScript bundle of the Bellaso web app. |
| T5 | Announcement relayer | Exists only if `docs/TECH_SPEC.md` selects the EVM Announcer fallback. Sees the announcement before the chain does. Sees the IP address of the payer. |
| T6 | Validators and the public RPC operator | Order and include transactions. See the queries of the gateway, of the CLI and of QoreX. Testnet has 8 validators. They are probably operated by the QoreChain team (i). |
| T7 | Malicious code in the browser of the user | A browser extension or a cross-site script. |
| T8 | Bellaso gateway operator | Sees the IP address and the requests of each browser: which account A a payer page reads, which signed transactions a recipient broadcasts, and the sponsor requests. Can withhold or change the chain data that it relays. Never receives a secret. |

## 3. Security goals and how Bellaso meets them

| Goal | Against | Mechanism | Status |
|---|---|---|---|
| G1: An adversary cannot link a payment to account A (S1). | T1, T2 | The announcement contains only the ML-KEM-1024 ciphertext and the view tag. The one-time address comes from the shared secret through SHAKE-256 with a domain label. Only the KEM secret key gives the shared secret. Method 2: the tweak comes from the post-quantum root secret and an index through SHAKE-256. Nothing about it is on chain. | Met, if ML-KEM-1024 is IND-CCA2 secure and SHAKE-256 is preimage resistant. |
| G2: An adversary cannot link two payments to the same recipient (S2). | T1, T2, T3 | Each payment uses a new encapsulation. Thus each payment has a different shared secret and a different one-time address. Method 2: each stealth address uses a new index. | Met for method 1. Met for method 2 if the recipient uses each stealth address one time (risk R22). |
| G3: An adversary cannot spend the funds of a one-time account (S3). | T1, T2, T3 | A spend needs a secp256k1 signature and an ML-DSA-87 signature. The ML-DSA-87 seed comes from the post-quantum root secret of the recipient and the shared secret. The payer knows the shared secret but not the root secret. | Met, with residual risk R6. |
| G4: Secrets stay with the user (S4). | T4, T6, T8 | All key operations run in the browser or the CLI. No gateway route accepts a secret. Each route schema refuses unknown fields. | Met for T6 and T8. Partially met for T4 (risk R8). |
| G5: The recipient finds each payment (S5). | T6, T8 | Announcements are on chain. The scan reads all announcements, not only some. The CLI scan reads the chain without the gateway. | Met, if the validators include the transactions (risk R11) and the gateway serves all announcements (risk R18). |

### 3.1 Why a quantum adversary cannot link a one-time address to account A

1. The one-time public key is `P_o = P_A + h·G`. Here `h = SHAKE-256(label, shared secret)`.
2. T2 can calculate the private keys `k_A` and `k_o` from the public keys.
3. T2 can calculate `k_o − k_A`. But this difference exists for every pair of accounts. Thus it gives no signal.
4. To prove a link, T2 must show that `k_o − k_A = SHAKE-256(label, shared secret)`. T2 does not know the shared secret, because ML-KEM-1024 protects it.
5. Thus T2 cannot link `P_o` to `P_A`.

The same argument applies to method 2. There, `h_i = SHAKE-256(addr-tweak ‖ pqRoot ‖ i)`. T2 does not know `pqRoot`, because it never leaves the browser and is not on chain in any form. The index `i` is small, but without `pqRoot` it gives no signal.

### 3.2 Why the payer cannot spend the funds

1. The payer knows the shared secret, so the payer knows `h`.
2. The secp256k1 key of the one-time account is `k_o = k_A + h`. The payer does not know `k_A`.
3. The ML-DSA-87 seed of the one-time account comes from the post-quantum root secret. The payer does not know it.
4. Thus the payer cannot make either signature.

## 4. Known leaks and residual risks

Bellaso does not hide these items. The README and the video must say so.

| ID | Risk | Effect | Mitigation | Residual |
|---|---|---|---|---|
| R1 | The payer address, the amount and the token are public. | An observer sees who paid how much to a one-time address. | Non-goal. | Accepted. |
| R2 | Time correlation. | An observer can compare the time of a payment with the time of a spend. | The app shows the advice: "Wait before you spend." Stretch: a random delay option. | Accepted. |
| R3 | The fixed gas allowance marks each Bellaso payment. | An observer can see that a transaction is a Bellaso payment. | All Bellaso payments look the same. Thus the anonymity set is all Bellaso payments. | Accepted. |
| R4 | The anonymity set on testnet is small. | With few users, correlation is easier. | Say this in the README. | Accepted for testnet. |
| R5 | A spend can link payments. | If the recipient sends from two one-time accounts to the same destination, or to account A, an observer links them. | The app shows the warning: "This links your payments together." | Depends on the user. |
| R6 | The first spend shows the secp256k1 public key of the one-time account. | Before its ML-DSA-87 key is registered, the one-time account is protected only by secp256k1. A quantum adversary that breaks secp256k1 inside one block (about 3 seconds) can register its own key first. | `docs/TECH_SPEC.md` registers the ML-DSA-87 key in the first transaction of the one-time account. Google estimates "a few minutes" for one break (March 2026). | Low today. It increases when quantum computers become faster. |
| R7 | The gateway and the RPC operator see which addresses a client queries. | If the scan queried the balance of each derived address, the operator could group the addresses of one recipient. | The gateway sends all announcements to every client. Its announcement route has no filter. The destination and the amount come from the payment transaction. The scan never queries a single derived address. A spend in the web app reads the balance and the PQC status of one address only. Exception: the test script `scripts/spend.ts` reads the balance of each found payment, in order, until it finds one with funds. | Low. |
| R8 | The web host can serve malicious JavaScript. | Malicious code can copy the recovery phrase. | Open source code, a CLI that does the same operations, and instructions to run the app locally. | Accepted for the fest. |
| R9 | Secrets in browser storage. | Malicious code in the browser (T7) can read them while the vault is open. A person with the sealed vault (`localStorage` or the encrypted backup file) can try passphrases offline. | The vault in `localStorage` holds the recovery phrase, the payments found and the stealth address labels, all encrypted with AES-256-GCM. The key comes from the passphrase with PBKDF2-SHA-256 and 600,000 iterations. The passphrase has 12 characters or more. The app keeps the decrypted data in the memory of the tab only, and a page reload locks it. | Accepted for the fest. |
| R10 | Spam announcements. | An attacker can publish many false announcements. The scan becomes slower. | Each announcement costs a fee. Measured on 23 Nov 2026 (Node 24, pure JavaScript): one decapsulation takes 1.0 ms, and the scan of one announcement takes 1.5 ms. Thus 10,000 announcements take about 15 seconds. | Low. |
| R11 | Validators can stop transactions. | A payment or a spend can be delayed or blocked. | None on this chain. This is a liveness risk, not a privacy risk. | Accepted. |
| R12 | The code is new and has no audit. | A bug can break G1 to G4. | Test vectors, unit tests, the `link-attempt` script (AC6), and the QCAI audit if time permits. | Accepted for the fest. |
| R13 | A false positive in the scan. | ML-KEM decapsulation of a ciphertext for another recipient gives a random shared secret (implicit rejection). The view tag matches with probability 1/256. | After a view tag match, the scan also compares the derived address with the transfer destination in the same transaction. | None. |
| R14 | The payer can tell other persons: "I paid this one-time address, and it belongs to Rina." | That one payment becomes linked. | This is true for every payment system. Other payments stay unlinked (G2). | Accepted. |
| R15 | The recipient funds account A from a QoreX account. | An observer links account A to that QoreX account. | Account A is the public payment identity of the recipient. Thus this link alone gives no information about payments. If the same account also pays or funds a one-time address, R26 applies. | Accepted. |
| R16 | Anyone can write records into the announcement contract. | False or broken records can appear between real ones. | The scan reads records per transaction, checks the header, the length and the version, and compares the derived address with the `MsgSend` of the same transaction. | None. |
| R17 | The gateway can link a payment to account A by time. | A payer page reads the KEM key of A through the gateway. Some seconds later, a new announcement comes from the payer. The gateway operator (T8) can match the two. | The gateway keeps no access log with an IP address and a path. The code is open source. A user can run an own gateway or use the CLI. Chain observers (T1, T2) do not see this data. | Accepted. A public RPC operator has the same view today. The claims for T1 and T2 do not change. |
| R18 | The gateway can withhold or change chain data in the browser. | The inbox can miss a payment or show a false payment. | The CLI scan reads the chain directly (AC10). No testnet explorer is confirmed. The transaction links of the web app open the page `/tx/<hash>`, which reads the transaction through the gateway, so they do not check the gateway. The gateway can never spend, because it has no secret. A dishonest gateway could send its own KEM key to a payer; then it could link that payment and hold the funds, but not spend them. Thus each payment link carries `#k=` with the first 16 bytes of SHA-256 of the recipient's KEM key, and the pay page refuses a key that does not match. The URL fragment never reaches a server. A link without `#k=` stays payable and keeps this risk. A scan keeps every known payment, so withheld items cannot erase the vault. | Accepted. The browser trusts the gateway for data, as it trusts any RPC operator. It does not trust it with keys. |
| R19 | Abuse of the sponsor. | An attacker can empty the sponsor wallet. | One sponsorship for each address. 3 for each IP address in a rolling 24 hours, setup and gas together. A daily cap (`SPONSOR_DAILY_CAP`, 50). The wallet holds a small amount of test QOR. The limits are in memory, so a restart resets them. The chain checks still stop a second sponsorship of one address. The IP limit trusts `X-Real-IP`, which the Railway edge sets (`TRUST_PROXY_HOPS`). If a client could reach the gateway without the Railway proxy, it could forge this header and pass the IP limit. | Low. Testnet only. |
| R20 | Sponsor transfers link every sponsored account A to the sponsor wallet. | An observer can list the recipients that used the sponsor. | Account A is the public payment identity. The KEM key registrations are public anyway. Payments stay unlinked (G1, G2). The recipient can fund A from an own wallet (R26). Sponsor gas for a stealth address: R23. | Accepted. |
| R21 | The gateway becomes an open proxy. | Other persons use it to send any request to the chain. | Allowlists of paths and RPC methods, a body limit of 64 KB, a rate limit for each IP address and CORS for our origins. | Low. |
| R22 | A stealth address (method 2) is used more than one time. | All payments to that address are linked to each other. They are still not linked to account A. | The UI makes one address for each client or invoice, and shows "paid more than one time" with a warning. | Depends on the user. |
| R23 | Gas for a stealth address comes from the sponsor. | The gateway sees the IP address that asks gas for that address. Chain observers see that the address belongs to some Bellaso user: it joins the set of sponsored accounts. With few users, this set is small. If the sponsor also funded account A, `link-attempt` H4 reports a match for that address (CONFIRMED in `scripts/lib/link.ts`, not run on testnet). The match points to every account A that the sponsor funded, not to one. | No access log with an IP address and a path. The gateway keeps the IP address only as a salted hash, in memory, for 24 hours. A QoreX **Send** of QOR brings its own gas, so AC11 needs no sponsor gas. For a payment of tokens only, the switch **Ask the payer to add 0.15 QOR for gas** avoids sponsor gas. The IP limit trusts `X-Real-IP`, which the Railway edge sets (R19). | Accepted. Same class as R17. |
| R24 | The transfer feed is large or incomplete. | The inbox is slow, or it misses a method 2 payment. | The feed contains only four denoms. It starts at height `TRANSFERS_FROM_HEIGHT` (10,600,000), so it misses older transfers. Testnet had about 20 `MsgSend` transactions each hour (MEASURED, 23 Nov 2026). The CLI has no method 2 scan yet, so it cannot check this feed. Fallback: a feed of fUSD transfers only. | Accepted for testnet. |
| R25 | The payer of a stealth address knows that address. | The payer can tell other persons that this one address belongs to the recipient. | The same as R14. Other stealth addresses stay unlinked. | Accepted. |
| R26 | One account funds account A and also pays or funds a one-time address. | An observer links that one-time address to account A through the shared funder (`link-attempt` H4). MEASURED on 23 Nov 2026: wallet `qor1esra9lc9weq7js4x9ay4744fymfyqex5utra3s` funded the first account A `qor1j677x84lr8fr2u3x24z69snzxe6mgjt3zstnyf` and also paid the G4 payment. `link-attempt` failed on that account by H4. | Fund account A from the sponsor, or from a wallet that never pays or funds a Bellaso address. Sponsor gas for a stealth address has the same pattern (R23). The evidence account for AC6 and AC11 is now `qor130jxjehyvf2ndr6lyutl9e09plv7k0epyhnmyz`, funded only by the sponsor. On it, `link-attempt` passed with 0 matches for H1 to H5. | Depends on the user. The first failure was a test-setup artifact. |

## 5. Cryptographic assumptions

| Primitive | Standard | Use in Bellaso | Assumption |
|---|---|---|---|
| ML-KEM-1024 | FIPS 203 | Shared secret between payer and recipient | IND-CCA2, NIST Category 5 |
| ML-DSA-87 | FIPS 204 | Second signature of account A and of each one-time account | EUF-CMA, NIST Category 5 |
| secp256k1 ECDSA | SEC 2 | First signature (required by QoreChain) | Classical security only. Not quantum-safe. |
| SHAKE-256 | FIPS 202 | Derivations with domain labels | Collision and preimage resistance. Grover's algorithm decreases the security to about 128 bits for 256-bit outputs. |

A hybrid signature is secure while one of its two parts is secure. Thus a spend stays safe after Q-Day because of ML-DSA-87.

## 6. Out of scope

- Payer privacy and amount privacy.
- Network-level privacy (IP addresses). Users can use a VPN or Tor.
- A compromised operating system or device of the user.
- Mainnet risks. Bellaso runs on testnet only during the fest.

## 7. Comparison with the nearest competitors

| Threat | Squidl | Specter | ERC-8441 | Bellaso |
|---|---|---|---|---|
| T2 links old payments | Yes (ECDH) | No | No | **No** |
| T2 steals funds | Yes | Yes (secp256k1 spend) | Yes ("Spending stays vulnerable") | **No** (hybrid with ML-DSA-87) |
| The operator sees keys | TEE operator, if SGX is compromised | Yes (server) | Not specified | **No** (the gateway relays public data only) |
| Payer privacy | Yes, inside Sapphire | No | No | No |
