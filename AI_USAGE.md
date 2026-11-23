# AI usage

This file states how the team used AI tools to build Bellaso for the QoreChain "Build Before Q-Day" fest.

## Tools

| Tool | Use |
|---|---|
| Claude Code (Anthropic) | Coding agent in the terminal. It wrote most of the code, the tests, the scripts and the documents, under the direction of the team. It also ran the checks and the testnet transactions of the CLI test accounts. |
| ChatGPT image generation (OpenAI) | Six logo concepts from a written brand brief. The team chose concept 6, "The Orbit". Claude Code redrew it as a vector SVG. |

## What the team decided

- The product: private payment links for freelancers, with two methods (payment link and stealth address).
- The design choices in `SPEC.md`: own instance of code 865 instead of a new contract, a separate gateway on Railway, the sponsor, the chalkboard visual style and the rejected design elements.
- Each acceptance criterion, and the approval of each design screen on the design canvas.
- The tests with real wallets: the QoreX mobile payments and the funding of the test accounts.

## How the team checked the AI output

- Each cryptographic derivation has a fixed test vector in `packages/core/test`. A change that breaks a vector fails `bun run check`.
- Each claim in the README has a transaction hash or a command output on testnet `qorechain-diana`. `docs/PLAN.md` section 3 lists them.
- `scripts/link-attempt.ts` attacks the privacy claim with public data only.
- The team reviewed each change before it went to `main`.

## Secrets

The AI tools never received a recovery phrase of a person. The CLI test phrases live only in the local `.env` file, which git ignores. The scripts print addresses only. The sponsor phrase went to Railway through standard input and was never printed.
