# pink-agentic-payments-ai-sdk

**Pink Agentic AI Payments** checks every payment an agent requests against company spending rules (budgets, payee allow-lists, human approval) before any payment credential is issued. This package wraps the official [`pink-agentic-payments`](https://www.npmjs.com/package/pink-agentic-payments) client as [Vercel AI SDK](https://ai-sdk.dev) tools, so a `generateText`/`streamText`/`Agent` loop can request a payment, check its remaining budget, and poll a payment's status as part of its normal tool calls.

> **Sandbox preview.** Every tool here talks to the public Pink sandbox (`https://agentic-sandbox.pinkwallet.com`). It uses test money only — no real funds ever move. Workspaces and keys created in the sandbox can appear or disappear without notice; use it for development and demos, not production. See the [docs hub](https://pinkwallet.com/agentic/developers/) for production status.

## Install

```bash
npm install pink-agentic-payments-ai-sdk ai zod
```

## Quickstart

This really runs against the live sandbox (no signup, no API key to request in advance):

```ts
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { createSandboxWorkspace } from "pink-agentic-payments";
import { pinkTools } from "pink-agentic-payments-ai-sdk";

// 1. Spin up a free sandbox workspace (test money, seeded with agents/payees/rules)
const workspace = await createSandboxWorkspace({ company: "My Test Co", template: "startup" });
const agentKey = workspace.agents[0].key;

// 2. Hand the tools to an AI SDK agent
const { text } = await generateText({
  model: google("gemini-3.8-flash"),
  tools: pinkTools({ agentKey }),
  stopWhen: stepCountIs(5),
  prompt: "Check the budget, then pay Figma $50 for our design tool renewal.",
});

console.log(text);
```

`pinkTools({ agentKey, baseUrl? })` returns a plain object of four `ai` `tool()`s you can spread into any `tools: {...}` option, including a `streamText` call or an `Agent`.

## Tools

| Tool | Wraps | Decision |
|---|---|---|
| `request_payment` | `PinkClient.requestPayment` | `allowed`, `pending_human`, or `blocked`, with the reason |
| `check_policy` | `PinkClient.checkPolicy` | dry-run: `would_allow`, `would_ask`, or `would_block` — no spend |
| `get_budget` | `PinkClient.getBudget` | this agent's monthly budget, spend, and single-payment cap |
| `check_payment_status` | `PinkClient.getPayment` | poll a payment, e.g. a `pending_human` hold, by id |

Every tool maps 1:1 to a method already in the official `pink-agentic-payments` client — this package adds no new API surface, only AI SDK `tool()` wrappers with zod input schemas for the model to read. A blocked or pending result is returned as a plain string the model can read and act on, not thrown as an uncaught error.

## Links

- Docs hub: https://pinkwallet.com/agentic/developers/
- Official JS client: https://www.npmjs.com/package/pink-agentic-payments
- Sandbox (test money, no signup): https://agentic-sandbox.pinkwallet.com
- See `NOTES.md` in this repo for the live-verified field names and sandbox amounts used in testing.

## Development

```bash
npm install
npm run build
npm test            # unit tests, mocked client, no network
npm run test:live   # hits the live sandbox, creates a workspace
```

## License

MIT, see `LICENSE`.
