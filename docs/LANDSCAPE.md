# LANDSCAPE: competitors, market and sources

> Research date: 23 Nov 2026. Labels: **[n]** is a source in section 8. **(i)** is an inference from the team. **nf** means "not found".
> This document uses ASD-STE100 Simplified Technical English.

---

## 1. Quantum basics for payments

Cryptography in a payment system does three jobs. A quantum computer attacks each job in a different way.

| Job | Algorithm today | Quantum attack | Can a chain repair it later? |
|---|---|---|---|
| **Signature:** who can move the funds | ECDSA, EdDSA | The attacker calculates the private key from the public key. Then the attacker steals the funds. | Partially. A chain can do an emergency hard fork [35]. Zcash has "quantum recoverability" [15]. |
| **Key exchange and encryption:** who can read and link the data | ECDH | The attacker opens old data that the chain keeps. Then the attacker de-anonymizes old payments. | **No.** "Privacy breaches are irreversible" [9]. |
| **Zero-knowledge proof on an elliptic curve:** used by privacy pools | Groth16 on BN254 | The attacker makes false proofs. Then the attacker removes funds from the pool. | Partially. The pool can change to a new proof system. |

The post-quantum replacements are NIST standards:

- **ML-KEM** (FIPS 203) replaces ECDH for key exchange.
- **ML-DSA** (FIPS 204) replaces ECDSA for signatures.

QoreChain has both on its main network and on its testnet.

**Harvest now, de-anonymize later.** A public chain keeps all data permanently. An attacker does not need to intercept data. "The chain itself is the archive" [9]. An attacker can copy all announcements today and open them after Q-Day.

## 2. Competitor map

Column keys:

- **Hides:** P = payer, R = recipient (the link to the payment), A = amount, E = the existence of the address.
- **Q-theft:** a quantum attacker can steal the funds.
- **Q-HNDL:** a quantum attacker can de-anonymize old payments ("harvest now, de-anonymize later").

L2BEAT gives a "Future adversary" rating to privacy projects. This table quotes that rating where it exists.

| # | Project | Hides | Mechanism | Q-theft | Q-HNDL | Compliance | Status and traction | Hackathon wins |
|---|---|---|---|---|---|---|---|---|
| 1 | GrimSwap | R; A is public (i) | Groth16/BN254 pool + ERC-5564 secp256k1 ECDH stealth address [1] | Yes (i) | Yes, in the stealth layer (i) | nf | Testnet, Unichain Sepolia [1] | HackMoney 2026 finalist [1] |
| 2 | Squidl | R, E; P only inside Sapphire [2] | secp256k1 ECDH stealth address inside the Oasis Sapphire TEE [2] | Yes (i) | Yes. The meta-address is public. The ephemeral keys are on chain (i). | nf | 2024 prototype | ETHGlobal Singapore 2024 finalist; Oasis 3rd place; Dynamic Best Consumer [2] |
| 3 | Specter | R | ML-KEM-768 + SHAKE256 + 1-byte view tag. Spend keys are secp256k1. All cryptography runs on a server [3]. | Yes (i) | No, for announcements [3] | nf | Prototype | ENS prize pool, HackMoney 2026 [3] |
| 4 | Umbra | R | secp256k1 ECDH stealth address + registry [4] | Yes (i) | **Yes: "Exposed"** [4] | nf | Live. More than 270,000 payments and about $500M [5] | nf |
| 5 | Fluidkey | R | Stealth signer on a new Safe. No on-chain announcement [6]. | Yes (i) | No [6]. The operator holds the viewing key. | Viewing key at the service; KYC for bank transfers [6] | $840M transfers, more than 24,000 users (June 2026) [7] | nf |
| 6 | ERC-5564 / ERC-6538, scheme 1 | R | secp256k1 ECDH, view tag, registry [8] | Yes (i) | Yes [8] | None | Standard | n/a |
| 7 | ERC-8441, scheme 3 | R | Hybrid ML-KEM-768 + secp256k1 ECDH [8] | **Yes: "Spending stays vulnerable"** [8] | No, while ML-KEM is safe [8] | None | Draft (2026) [8] | n/a |
| 8 | Bitcoin Silent Payments (BIP-352) | R, E | secp256k1 ECDH with the transaction input keys [10] | Yes (i) | Yes, for each known address (i) | None | Cake Wallet, Sparrow [10] | n/a |
| 9 | Railgun | P, R, A in the pool | Groth16/BN254. Ed25519 ECDH + AES-GCM notes [11] | Yes (i) | **Yes: at risk** [11] | Private Proofs of Innocence; viewing keys | About $103M TVL [12]; $4.5B total volume (Jan 2026) [37] | n/a |
| 10 | Privacy Pools (0xbow) | Link P→R | Groth16/BN254, Poseidon commitments [13] | Yes (i) | No: "Nothing encrypted is written onchain" [13] | Association sets, ragequit [13] | $8.19M [13] | n/a |
| 11 | Tornado Cash | Link P→R | Groth16/BN254, Pedersen hash commitments [14] | Yes (i) | At risk [14] | None | $545.78M [14] | n/a |
| 12 | Zcash (Orchard, Ironwood) | P, R, A | Halo 2 on Pallas/Vesta. Note key agreement on Pallas [16]. | Funds recoverable later with ZIP 2005 [15] | **Yes, for known addresses** [16] | Viewing keys | About 30% of ZEC is shielded (Apr 2026) [19] | n/a |
| 13 | Monero (Carrot, FCMP++) | P, R, A | ECDH one-time addresses, ring signatures or FCMP++ | Yes [20] | **Yes: "Exposed"** [21] | View keys | Live | n/a |
| 14 | Aztec | P, R, A | Client-side UltraHonk on BN254 (i) | Yes (i) | **Yes: "Exposed"** [23] | nf | Alpha (July 2026) [22] | n/a |
| 15 | Penumbra | P, R, A | Groth16/BLS12-377, decaf377 [24] | Yes (i) | Yes (i) | Viewing keys (i) | Status unclear in 2026 [24] | n/a |
| 16 | Namada MASP | P, R, A | Sapling design on BLS12-381/Jubjub (i) | Yes (i) | Yes (i) | Viewing keys (i) | TVL about $420; $600K drain in June 2026 [25] | n/a |
| 17 | Hinkal | P, R, A | ZK shielded pools | Yes (i) | Probable (i) | Access tokens, screening [26] | TVL about $226K; exploit in July 2026 [26] | n/a |
| 18 | Cloak (Solana) | P, R, A | Shielded UTXO pool, Groth16 [27] | Yes (i) | nf | nf | Live. 520 transactions in 30 days (Sep 2026) [27] | Solana Cypherpunk, 3rd place [27] |
| 19 | Turbine Cash, Mixoor (Solana) | Link P→R | zk-SNARK deposit and withdraw pool [28] | Yes (i) | Probably no (i) | Risk screening before deposit [28] | Turbine is live. Mixoor is a hackathon build [28]. | Range bounty, Solana Privacy Hack [28] |
| 20 | Zama ERC-7984 | A | TFHE (lattice) + a 13-operator KMS [29] | Yes (i) | **Yes: "Exposed"** through the KMS [29] | User and delegated decryption [29] | $83.39M [29] | n/a |
| 21 | Arcium / Umbra (Solana) | P, R, A [30] | MPC + X25519 [30] | Yes (i) | Yes (i) | "Compliance tools" [30] | Mainnet alpha (Feb 2026) [30] | n/a |
| 22 | Oasis Sapphire | Contract state, calldata | Intel SGX TEE, X25519 [31] | Yes (i) | Yes (i) | nf | Live | n/a |
| 23 | Kohaku (Ethereum Foundation) | Planned P, R | SDK for Railgun, Privacy Pools and others [32] | A planned "PQ killswitch" [32] | No post-quantum stealth address in the roadmap (i) | From the plug-ins | SDK released May 2026 [32] | n/a |
| — | **Bellaso** | **R** | **ML-KEM-1024 stealth address + ML-DSA-87 one-time accounts** | **No** | **No** | Planned proof for one payment (stretch) | Hackathon build | — |

**Result of the map:** almost all payment privacy systems today let a quantum attacker de-anonymize old payments. The research found **no live system that uses a post-quantum KEM and a post-quantum signature on the one-time account.**

## 3. The nearest competitors in detail

### 3.1 Squidl [2]

- **What it does:** private static payment links that are also ENS names. It accepts card payments (converted to USDC) and supports many chains.
- **How it works:** the Oasis Sapphire TEE makes, uses and signs with the ECDH stealth keys. A ROFL oracle writes an announcement only after a stealth address receives funds. Sapphire wrapped tokens give payer privacy.
- **What it hides:** the recipient link. The team claims that nobody, also the developers, can see the stealth addresses or their balances.
- **Weaknesses:** the keys are inside Intel SGX. A TEE or RPC compromise breaks the privacy. The secp256k1 and X25519 keys are not quantum-safe (i). It is a prototype from 2024.
- **Difference from Bellaso:** Bellaso has no TEE and is quantum-safe. Squidl has payer privacy and card payments. Bellaso does not.

### 3.2 GrimSwap [1]

- **What it does:** a private DEX as a Uniswap v4 hook. Public and private swaps use the same pool.
- **How it works:** a deposit goes into a Poseidon tree. A Groth16 (BN254) proof from the browser is checked before the swap. The output goes to an ERC-5564 secp256k1 stealth address. A relayer sends the transaction.
- **What it hides:** the link from the depositor to the swap output. The swap size is visible (i).
- **Weaknesses:** testnet only. BN254 and secp256k1 are not quantum-safe (i). The relayer gives gas to stealth addresses, and this can make a link (i).
- **Difference from Bellaso:** GrimSwap is a swap product with a pool. Bellaso is a payment link without a pool.

### 3.3 Specter [3]

- **What it does:** stealth payments with ENS names.
- **How it works:** ML-KEM-768 replaces ECDH for the announcement. The spend keys are secp256k1. The server does all the cryptography.
- **Weaknesses:** the funds are not quantum-safe. The server sees the keys.
- **Difference from Bellaso:** Bellaso uses ML-KEM-1024, quantum-safe spend keys (ML-DSA-87) and client-side keys.

### 3.4 ERC-8441 [8]

- **What it is:** a draft Ethereum standard, "Hybrid post-quantum stealth address scheme", scheme 3 of ERC-5564.
- **How it works:** ML-KEM-768 + secp256k1 ECDH for the announcement. The spend stays on secp256k1.
- **Its own statement:** "The scheme protects the announcement layer only. Spending stays vulnerable to a quantum attacker."
- **Difference from Bellaso:** Bellaso also protects the spend. Ethereum cannot do this today because Ethereum accounts have no post-quantum signature. QoreChain accounts have one.

### 3.5 Fluidkey and Umbra [4][6]

- **Umbra:** a live ECDH stealth address product. L2BEAT rates it "Exposed" to a future adversary.
- **Fluidkey:** does not write announcements on chain, so L2BEAT rates it "Private" to a future adversary. But the Fluidkey service holds the viewing key. The user must trust the service.
- **Difference from Bellaso:** Bellaso writes announcements on chain, but only with ML-KEM-1024. Thus the user does not need to trust a service, and the announcements stay private after Q-Day.

## 4. Gaps that no project fills today (i)

| Gap | Does Bellaso fill it? |
|---|---|
| 1. A post-quantum spend from the one-time account | **Yes.** ML-DSA-87 one-time accounts. |
| 2. The highest KEM level (ML-KEM-1024) for stealth addresses | **Yes.** All other designs use ML-KEM-768. |
| 3. A link from a name to a new address without a trusted party | **Yes.** Client-side keys and an on-chain registry. |
| 4. Post-quantum compliance: show one payment to an auditor | Partially. A stretch feature (SPEC section 7.6). |
| 5. Post-quantum payer privacy (a hash-based STARK pool) | No. This is roadmap work. |

## 5. Market conditions

### 5.1 The quantum threat comes nearer

- Google Quantum AI, March 2026: two circuits break ECDLP-256 with fewer than 1,200 logical qubits and 90 million Toffoli gates, or fewer than 1,450 logical qubits and 70 million Toffoli gates. They can run on fewer than 500,000 physical qubits in a few minutes. This is about 20 times fewer qubits than older estimates [38].
- ECDSA.Fail, September 2026: an open contest decreased the cost of one elliptic-curve point addition by 86.1% [39].
- Global Risk Institute, 2025 report: experts give a 28% to 49% probability of a cryptographically relevant quantum computer in 10 years. This is the highest value in the series [40].
- Project Eleven, May 2026: Q-Day can occur "as early as 2030" [41].
- NIST IR 8547, final version, October 2026: quantum-vulnerable public-key algorithms are deprecated after 2030 and disallowed after 2035, at all key sizes [42].
- EU roadmap, June 2025: high-risk use cases must change to post-quantum cryptography by the end of 2030 [43].
- The Ethereum Foundation started a post-quantum team in January 2026. Its planning target for core post-quantum infrastructure is about 2029 [44].
- The ERC-8441 draft appeared in 2026. Thus the Ethereum community now starts work on the problem that Bellaso solves [8].

### 5.2 Privacy demand stays strong

- Zcash: about 30% of ZEC was shielded in April 2026, a record [19]. ZEC was about $753 on 20 Nov 2026. It was still one of the best assets of the year, while BTC decreased to about $60,000 [45].
- Railgun: $4.5B total volume in January 2026, up from $2.4B one year before [37].
- Fluidkey: $840M in transfers and more than 24,000 users in June 2026 [7].
- The Ethereum Foundation renamed its privacy team "Privacy Stewards of Ethereum" (September 2025) and announced the Kohaku wallet framework (October 2025) [46].

### 5.3 Stablecoin payments grow

- Stablecoin payment volume was $482B from January to September 2026, 45% more than in the same period of 2025. Payments that involve businesses were 64% of the value [47].
- Stablecoin supply was $288.87B on 16 Nov 2026 [48].

### 5.4 Regulation prefers compliant privacy

- OFAC removed the sanctions on Tornado Cash on 21 Mar 2025 [49].
- A jury convicted Roman Storm on one count on 6 Aug 2025. The retrial is in April 2027 [50].
- The founders of Samourai Wallet received sentences of 5 and 4 years in November 2025 [51].
- The EU AMLR, Article 79, forbids anonymous accounts at crypto service providers from 10 July 2027 [52].
- The SEC Chair said in December 2025 that blockchains let users prove compliance without showing their full history [53].
- **Effect on Bellaso (i):** Bellaso hides the recipient only. The payer stays public. Bellaso is not a pool or a mixer. A stretch feature lets a recipient show one payment to an auditor. Thus Bellaso fits the "compliant privacy" direction better than a mixer.

### 5.5 Indonesia

- 13.6 million independent workers ("pekerja bebas"). About 64% earn less than Rp2 million each month (BPS, February 2026) [54].
- 22.93 million crypto accounts (OJK, July 2026) [55].
- Rank 7 of 151 in the Chainalysis Global Crypto Adoption Index 2025 [56].
- OJK supervises crypto assets since 10 Jan 2025 [57].
- 57% of independent workers in a Stripe survey want stablecoin payouts. Only 18% in emerging markets receive them now [58].

## 6. Problem statement (for the README and the pitch)

> Every stealth-address payment system in use today hides the recipient with elliptic-curve Diffie-Hellman. Its announcements stay on a public chain forever. When a quantum computer breaks elliptic curves, anyone can match each old payment to its recipient. A chain can recover stolen funds with a fork. It cannot recover lost privacy. Freelancers and businesses who receive crypto payments today make a permanent record of who paid them. Bellaso makes payment links where the recipient privacy and the spend keys are both post-quantum, on a chain where post-quantum signatures are native.

## 7. Hackathon winners that support the idea

| Project | Event | Result | Relation to Bellaso |
|---|---|---|---|
| Squidl | ETHGlobal Singapore 2024 | Finalist, Oasis 3rd, Dynamic Best Consumer | Same user story (private payment links). |
| Specter | HackMoney 2026 | ENS prize pool | ML-KEM stealth payments. Bellaso adds post-quantum spend. |
| GrimSwap | HackMoney 2026 | Finalist | Stealth outputs for private swaps. |
| Cloak | Solana Cypherpunk | 3rd place, then a $250K pre-seed round | Private payments and payroll. |
| 17 private payment winners | Zama, Inco, Solana, Zypherpunk (2025–2026) | Various | Private payments, payroll and wallets are the second most common winning privacy product. |

## 8. Sources

[1] https://ethglobal.com/showcase/grimswap-ntdmp
[2] https://ethglobal.com/showcase/squidl-psquk
[3] https://ethglobal.com/showcase/specter-oky6k
[4] https://l2beat.com/privacy/projects/umbra
[5] https://checker.gitcoin.co/public/project/show/umbra-1
[6] https://l2beat.com/privacy/projects/fluidkey
[7] https://cryptobriefing.com/bnb-chain-fluidkey-private-payments/
[8] https://eips.ethereum.org/EIPS/eip-8441
[9] https://ethresear.ch/t/post-quantum-threats-to-ethereum-privacy/24450
[10] https://www.spark.money/research/bitcoin-silent-payment-adoption-wallet-support-2026
[11] https://l2beat.com/privacy/projects/railgun
[12] https://defillama.com/protocol/railgun
[13] https://l2beat.com/privacy/projects/privacy-pools
[14] https://l2beat.com/privacy/projects/tornado-cash
[15] https://zcash.github.io/ironwood/concepts/quantum-recoverability.html
[16] https://l2beat.com/privacy/projects/zcash-near-intents
[19] https://www.theblock.co/news/markets/2026-04-29-zcash-etf-volume-doubles-zec-shielded-supply-record-highs-399264
[20] https://gist.github.com/tevador/639d083c994c1ef9401832c08e2b7832
[21] https://l2beat.com/privacy/projects/monero-cake-wallet
[22] https://www.theblock.co/amp/post/409065/aztec-upgrades-v5-alpha-adding-private-execution-environment-decentralized-ethereum-l2
[23] https://l2beat.com/privacy/projects/zkmoneyv6
[24] https://penumbra.zone/blog/zkproofs-intro
[25] https://www.cryptotimes.io/2026/06/20/namadas-600k-masp-drain-goes-unnoticed-as-stale-indexer-masks-the-loss/
[26] https://defillama.com/protocol/hinkal
[27] https://blog.colosseum.com/announcing-the-winners-of-the-solana-cypherpunk-hackathon/
[28] https://range.org/blog/privacy-meets-compliance-the-winners-of-our-solana-privacy-hack-bounty
[29] https://l2beat.com/privacy/projects/zama-confidential-tokens
[30] https://www.theblock.co/news/ecosystems/2026-03-27-umbra-opens-privacy-wallet-to-the-public-on-solana-powered-by-arciums-encrypted-execution-engine-394892
[31] https://api.docs.oasis.io/sol/sapphire-contracts/contracts/Sapphire.sol/library.Sapphire.html
[32] https://notes.ethereum.org/@niard/KohakuRoadmap
[35] https://ethresear.ch/t/how-to-hard-fork-to-save-most-users-funds-in-a-quantum-emergency/18901
[37] https://ambcrypto.com/railgun-launches-plug-and-play-privacy-defi-layer-for-ethereum/
[38] https://research.google/blog/safeguarding-cryptocurrency-by-disclosing-quantum-vulnerabilities-responsibly/
[39] https://thequantuminsider.com/2026/09/10/researchers-and-ai-agents-cut-estimated-quantum-cost-of-attacking-bitcoin-encryption-by-86/
[40] https://postquantum.com/security-pqc/quantum-threat-timeline-report-2025/
[41] https://www.theblock.co/news/ecosystems/2026-05-06-project-eleven-warns-quantum-moment-all-at-once-q-day-early-2030-400274
[42] https://csrc.nist.gov/pubs/ir/8547/final
[43] https://digital-strategy.ec.europa.eu/en/policies/post-quantum-cryptography
[44] https://www.coindesk.com/tech/2026/03/25/ethereum-foundation-prepares-for-quantum-threat-with-new-cryptography-roadmap
[45] https://www.theblock.co/news/business/2026-11-20-dcgs-zcash-miner-fortitude-clears-vote-nasdaq-listing-zec-retreats-all-time-high-444784
[46] https://theblock.co/post/379149/vitalik-buterin-unveils-kohaku-privacy-focused-framework-ethereum
[47] https://ambcrypto.com/stablecoin-supply-has-stalled-in-2026-but-payments-rose-by-45-to-480b-report/
[48] https://stablecoininsider.org/stablecoin-supply-snapshot-2026-11-16/
[49] https://www.venable.com/insights/publications/2025/04/a-legal-whirlwind-settles-treasury-lifts-sanctions
[50] https://decrypt.co/376577/roman-storms-tornado-cash-retrial-pushed-to-april-2027
[51] https://www.justice.gov/usao-sdny/pr/founders-samourai-wallet-cryptocurrency-mixing-service-sentenced-five-and-four-years
[52] https://www.springlex.eu/en/packages/aml/amlr-regulation/article-79/
[53] https://www.sec.gov/newsroom/speeches-statements/atkins-121525-remarks-crypto-task-force-roundtable-financial-surveillance-privacy
[54] https://data.goodstats.id/statistic/berapa-pendapatan-pekerja-bebas-di-indonesia-pada-2026-etBp5
[55] https://rri.co.id/en/business/2684717/indonesias-crypto-users-reach-2293-million-as-of-july-2026
[56] https://e27.co/us2-36-trillion-asia-pacific-becomes-cryptos-growth-engine-20250904/
[57] https://ojk.go.id/en/berita-dan-kegiatan/siaran-pers/Pages/Bappebti-Transfers-Regulation-and-Supervision-Duties-on-Digital-Financial-Assets-Crypto-Assets-and-Derivatives-to-OJK-BI.aspx
[58] https://stripe.com/blog/why-global-workers-are-driving-demand-for-stablecoin-payouts
