# Otto

**A local-first personal operator for people who don't write code.**

You tell Otto what you're juggling — "clients who owe me money", "my content plan", "a job search", "planning a house move" — in plain language. Otto builds you a *surface* to run it: a clean table, board, or list, plus optional automations like reminders. You reshape it by talking. There is no builder, no field configurator, no template gallery — describing what you need **is** the interface.

Everything runs on your machine. Your data lives in a local SQLite file, your API key goes only to the model endpoint you chose, and you can plug in any LLM: Anthropic, OpenAI, Groq, OpenRouter, or a fully local model via Ollama or LM Studio.

> **Status: early.** Built in public, milestone by milestone. The data model, storage layer, and seeded demo work today; the conversational operator is landing next. See [Roadmap](#roadmap).

## The one rule that shapes everything

**Otto never generates code. Ever.**

Most AI app-builders have the model write code, which the user is then supposed to trust — but Otto's users *can't read code*, so asking them to trust it is meaningless. Otto takes a different, deliberately less powerful approach:

> The LLM translates natural language into a **constrained, typed config** — a surface schema, records, and automations — and a **fixed, pre-built renderer** that humans wrote and reviewed draws it.

Concretely, the model can only emit operations from a closed, typed set (`createSurface`, `addRecord`, `updateRecord`, …) defined in [`lib/core/operations.ts`](lib/core/operations.ts). Every operation is validated server-side against those schemas **regardless of which model produced it**. Nothing the model outputs is ever executed, `eval`'d, rendered as HTML, or interpreted as code of any kind. Its blast radius is bounded by design.

On top of that:

- **Trivial, reversible changes apply instantly.** Destructive or outbound ones (deleting, sending a message) become *drafts* the user approves first.
- **Everything is undoable.** Every applied change is recorded in an append-only change log along with its pre-computed inverse.

Trust comes from *visibility and undo*, not from inspecting anything.

**To future contributors: please don't "improve" this into a code-gen tool.** Emitting components, generating scripts, evaluating model output — any of it would break the core promise this project makes to non-technical users. The constraint is the product.

## How it works

```
 "I need to track who owes me money"
        │
        ▼
 ┌─────────────┐   operations (validated JSON)   ┌──────────────┐
 │ LLMProvider │ ──────────────────────────────▶ │   Operator    │
 │  (any model)│                                 │ validate·apply│
 └─────────────┘                                 └──────┬───────┘
                                                        │
                                   ┌────────────────────┼────────────────┐
                                   ▼                    ▼                ▼
                              ┌─────────┐        ┌────────────┐   ┌───────────┐
                              │  Store  │        │ change log │   │  renderer │
                              │ (SQLite)│        │ (undoable) │   │ (fixed UI)│
                              └─────────┘        └────────────┘   └───────────┘
```

Five generic entities, defined in [`lib/core/types.ts`](lib/core/types.ts): **Surface** (title, icon, view type, fields), **Field**, **Record**, **Automation**, and the **ChangeLog**. A job-search board and an invoice tracker are the same thing with different fields — Otto has no per-vertical tables and never will.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/justshipai/otto.git
cd otto
npm install
npm run dev
```

Open http://localhost:3000. Otto creates `data/otto.db` on first start and seeds a demo surface so you have something to look at. To start fresh, delete the `data/` folder.

No API key is needed to browse; you'll add one in Settings (or `.env`, see [`.env.example`](.env.example)) when you want to talk to Otto.

## Bring your own model

Otto is provider-agnostic through one small interface, `LLMProvider`. Two adapters ship in the box:

| Adapter | Covers |
| --- | --- |
| `anthropic` | Claude models via the Anthropic API (native tool calling) |
| `openai-compatible` | OpenAI, Groq, OpenRouter, and local models via Ollama / LM Studio — anything speaking the OpenAI chat API, configured by base URL |

Adapters do **not** need native tool calling or JSON mode. The contract is simply "given the user's message, the workspace state, and the operation JSON schema, return operations" — each adapter achieves that however its API allows, and the operator validates the result server-side anyway (with one retry, then a graceful "please rephrase" fallback). A plain-text-only local model and Claude go through exactly the same validation.

### Adding a provider

Write one file implementing `LLMProvider` (see `lib/llm/provider.ts`), register it in the provider index, done. The two shipped adapters are intentionally small and heavily commented — copy whichever is closer to your API.

### Adding a storage backend

Same idea: the app only talks to the `Store` interface in [`lib/store/store.ts`](lib/store/store.ts). The default adapter is one local SQLite file ([`lib/store/sqlite.ts`](lib/store/sqlite.ts)) — the only file in the repo that contains SQL. A Postgres (or anything else) adapter is one new file wired up in [`lib/store/index.ts`](lib/store/index.ts).

## Privacy

- All data stays in `data/` on your machine.
- Your API key is stored locally and sent only to the model endpoint you configured.
- **No telemetry.** If any is ever proposed it must be opt-in and documented here first.

## Roadmap

- [x] **M1** — data model, `Store` interface + SQLite adapter, seeded demo surface
- [ ] **M2** — `LLMProvider` interface, Anthropic + OpenAI-compatible adapters, Settings
- [ ] **M3** — real renderer (table / board / list), Home + Library navigation
- [ ] **M4** — the operator: natural language → surfaces, end to end
- [ ] **M5** — reliability pass across multiple providers, incl. local models
- [ ] **M6** — trust layer: approvals, undo, version history
- [ ] **M7** — automations + proactive "needs attention"
- [ ] **M8** — first-run experience

Not planned in this repo: code generation (see above), hosted multi-user service, auth, plugin marketplace, real email/SMS sending (outbound actions are stubbed behind an interface a contributor can implement).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: the `LLMProvider` and `Store` interfaces are the intended extension points, the operation set is the safety boundary, and small readable modules beat clever ones.

## License

[MIT](LICENSE)
