# Agent rules for Bellaso

## Read first

1. `SPEC.md`: product decisions, scope and acceptance criteria. It wins over every other document.
2. `docs/TECH_SPEC.md`: cryptography, data formats, chain integration, gates.
3. `docs/THREAT_MODEL.md`: what Bellaso protects and what it does not. Do not add a claim to UI copy or the README that this file does not support.
4. `docs/PLAN.md`: the day plan and the current gate status.
5. `docs/LANDSCAPE.md`: competitors, market and sources. Use it for the README and the pitch, not for code.

## Language

- Write all docs in English with ASD-STE100 Simplified Technical English. Use the terms in `SPEC.md` section 6, with one meaning for each term.
- Write replies to the user in Indonesian.
- Write UI copy, code and commit messages in English.

## Done means

- `bun run check` passes from the repo root.
- A behavior change is proven on QoreChain testnet `qorechain-diana` with a transaction hash or command output, not only by unit tests.
- A UI change is checked in the running app.

## Code

- No comments in the middle of code. A docblock directly above a declaration is the only allowed comment.
- Secret keys, seeds and shared secrets never leave the browser or the CLI process. No gateway route accepts them. The gateway handles public chain data only.
- The only secret in the gateway is the sponsor wallet phrase (`SPONSOR_MNEMONIC`), a team testnet account. Keep it in `.env`. Never commit `.env`.
- Use Bun for install, scripts and tests (`bun install`, `bun test`). Do not add a `pnpm` or `npm` lockfile.
- Workspace packages (`packages/*`) export TypeScript source through `"exports": { ".": "./src/index.ts" }`. Do not add a build or bundle step to them. Next.js compiles them through `transpilePackages`. Bun runs them directly.
- Keep TypeScript on 6.0.x. typescript-eslint 8.73 refuses TypeScript 7.
- Every hash and key derivation uses the domain labels in `docs/TECH_SPEC.md`. Do not invent new labels.
- Cryptographic changes need a test vector test that fails on the old behavior.
- Add a package, folder or dependency only when a feature needs it.

## Git

- Every commit is made during the fest (after 4 Nov 2026). Do not import code from older projects.
- Commit messages follow Conventional Commits: `type(scope): description`, for example `fix(gateway): refuse encoded path traversal`. Types: feat, fix, docs, test, refactor, chore, perf, ci, build. The scope is the package or area: web, gateway, core, chain, scripts, docs, deps.
- No AI attribution in commits, PR titles or PR bodies.
