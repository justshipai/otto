# Contributing to Otto

Thanks for looking under the hood. Otto is small on purpose — here's the map.

## The two extension points

Most contributions belong behind one of two interfaces:

1. **`LLMProvider`** (`lib/llm/provider.ts`, lands in milestone 2) — one adapter file per provider. The contract: given the user's message, the workspace state, and the operation JSON schema, return a list of operations. No vendor SDKs; plain `fetch` keeps adapters copyable. Don't assume tool calling or JSON mode — the operator validates output regardless.
2. **`Store`** (`lib/store/store.ts`) — one adapter file per backend. The default is a local SQLite file; that adapter (`lib/store/sqlite.ts`) is the only file in the repo allowed to contain SQL. New adapters get wired up in `lib/store/index.ts` and nowhere else.

## The line we don't cross

Otto **never generates or executes code** — the model only emits operations from the closed, typed set in `lib/core/operations.ts`, validated with zod before anything is applied. PRs that add code generation, `eval`, model-authored components, or model-authored HTML will be declined regardless of how useful they are. Widening the operation set is possible but deliberate: every new operation must be safely applicable, undoable (or approval-gated via `draftAction`), and generic across verticals.

Related invariants:

- **No per-vertical anything.** A job search and an invoice tracker are both just Surfaces. If a feature only makes sense for one domain, it's designed wrong.
- **Destructive or outbound = draft + approval.** Never applied directly.
- **Every applied change gets a change-log entry with its inverse.** Undo is a feature of the architecture, not a UI afterthought.
- **Local-first.** No telemetry, no cloud dependencies, no auth in this repo. Data and keys stay on the user's machine.

## Practical notes

- Stack: Next.js (App Router) + TypeScript + Tailwind. `npm run dev` runs everything, including the in-process scheduler.
- Keep modules small and readable; comment the *why*, not the *what*. Strangers read this code — that's the point of it being open source.
- `npm run lint` and `npm run build` should pass before you open a PR.
- Delete `data/` any time you want a fresh start (the first-run screen with starter chips).
