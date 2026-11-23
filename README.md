# Bellaso

Private payment links that stay private after Q-Day.

Bellaso hides the recipient of a payment with ML-KEM-1024 and protects the funds with a hybrid secp256k1 + ML-DSA-87 signature. All secret keys stay in the browser or the CLI of the user. It runs on the QoreChain testnet `qorechain-diana`.

> Status: scaffold. The product is not built yet. Read `SPEC.md` first.

## Two ways to get paid

1. **Payment link.** One link for all payers. The payer opens it and pays with QoreX.
2. **Stealth address.** A new address for one client. The client pays from any wallet.

## Repository

| Path | Contents |
|---|---|
| `apps/web` | Next.js web app (Vercel) |
| `apps/gateway` | Bun + Fastify gateway (Railway). Public chain data only, never a secret. |
| `packages/core` | Pure TypeScript cryptography and formats. No network, no DOM. |
| `packages/chain` | Network constants and chain clients |
| `scripts` | CLI scripts. They read the chain directly, without the gateway. |
| `docs` | Technical spec, threat model, plan, landscape |

Workspace packages export TypeScript source. They have no build or bundle step.

## Run

Requirements: Bun 1.3.3 or later.

```sh
bun install
cp .env.example .env
bun run dev            # web app on http://localhost:3000
bun run gateway        # gateway on http://localhost:8080
bun run check          # typecheck, lint, test, build
bun scripts/chain-status.ts
```

## Documents

- `SPEC.md`: product decisions and acceptance criteria
- `docs/TECH_SPEC.md`: cryptography, formats, gateway, gates
- `docs/THREAT_MODEL.md`: what Bellaso protects and what it does not
- `docs/PLAN.md`: day plan and gate status
- `docs/LANDSCAPE.md`: other projects, market and sources
- `PRODUCT.md`, `DESIGN.md`: product and design context

## Licence

Apache-2.0. See `LICENSE`.
