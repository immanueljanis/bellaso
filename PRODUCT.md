# Product

## Register

product

## Users

- **Recipient (primary):** a freelancer, for example Rina, a designer in Bandung. Clients in other countries pay her in stablecoins. She wants one payment link that does not show her income and balance to every client. She uses Bellaso on a laptop browser: setup one time, then the inbox and the spend screen from time to time.
- **Payer (secondary):** a client or a donor who opens the link, types an amount and signs one transaction with the QoreX wallet. The payer is not a Bellaso user and must finish in less than one minute without help.
- **Jury of the fest:** opens the deployed app and the video. Checks that each flow works as described and that each privacy claim is true.

## Product Purpose

Bellaso is a private payment link. Each payment goes to a new one-time account. The recipient stays hidden with ML-KEM-1024, also after a quantum computer breaks elliptic-curve cryptography. The funds can be spent only with a hybrid secp256k1 + ML-DSA-87 signature. All secret keys stay in the browser or the CLI of the user.

Success: a payer pays in one QoreX transaction, the recipient finds the payment in the inbox and spends it, and nobody can link the payment to the recipient. The interface never claims more privacy than `docs/THREAT_MODEL.md` supports.

## Brand Personality

Scientific, witty, trustworthy. The voice of a good lab notebook or of the book "Ignition!": exact about the facts, light in tone, never hype. Explain the cryptography with real values (1,570 bytes, ML-KEM-1024) and plain sentences. A small joke is acceptable in empty states and in the name story. It is never acceptable in a warning or in a privacy claim.

## Anti-references

- Neon crypto dashboards: dark background, purple glow, gradients, big metric numbers.
- Generic fintech SaaS: navy and white, metric cards, icons in circles.
- Cypherpunk terminals: green on black, monospace everywhere, glitch effects.
- Web3 glassmorphism: blurred transparent cards and color blobs.

## Design Principles

1. **Show the mechanism, not a shield icon.** Privacy is shown with what the chain actually sees: a new address, a ciphertext of 1,570 bytes, no link to the recipient.
2. **Honest about what is public.** Every screen that makes a privacy claim also says what stays public (payer address, amount, time).
3. **The task first, the drawing second.** The technical linework is the brand. It stays in the margins of task screens and never competes with a form or a list.
4. **One sentence per state.** Each step (sealing, registering, scanning, spending) has one plain sentence that says what happens now and why.
5. **Motion explains the state.** Motion is elegant and quiet. It shows progress, a scan or a completed seal. It is never decoration only.

## Accessibility & Inclusion

- WCAG 2.2 AA: text contrast 4.5:1 or more, keyboard access for every control, visible focus.
- The user asked for elegant motion. Every animation also has a `prefers-reduced-motion: reduce` alternative.
- Colors that carry meaning also differ in lightness and have a text label.
