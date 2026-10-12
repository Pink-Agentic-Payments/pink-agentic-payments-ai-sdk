# Notes

Built 2026-10-12 against `pink-agentic-payments@0.1.0` and `ai@7.0.138`.

## Field/behavior facts verified live against the sandbox

- Budget object fields: `monthly_budget`, `spent_this_month`, `left_this_month`, `single_payment_cap` (plus `vault.balances`).
- `requestPayment()` resolves to `{ payment_id, decision: "allowed", credential: { type } }` or throws `PinkPolicyDenied` (blocked, HTTP 403) / `PinkApprovalPending` (pending_human, HTTP 202).
- A hold that a human has approved (via `approvePayment(adminKey, paymentId)`) is reported by `getPayment()` as `decision="approved"` — distinct from the immediate `"allowed"` a fresh `requestPayment()` call returns.
- On the `template: "startup"` sandbox template, against payee `p_figma` ("Figma"), observed on 2026-10-12:
  - $50 -> `allowed` (reason: "Known vendors under $1,000")
  - $2,000 -> `pending_human` (approver: a named CFO persona)
  - $10,000 -> `blocked` (rule: the agent's monthly budget is used up)
  - These are sandbox seed data for the `startup` template and may change if the sandbox reseeds; see `TEST-OUTPUT.txt` for one real run's exact payment ids and reasons (workspace id intentionally omitted).

## Why this package exists

`langchain-pink` (same org, Python/LangChain) already wraps the same four client methods as `BaseTool`s. This package mirrors that same 1:1 tool surface (`request_payment`, `check_policy`, `get_budget`, `check_payment_status`) for the Vercel AI SDK's `tool()`/`generateText`/`streamText` shape instead of LangChain's `BaseTool`.

## What is intentionally NOT in this repo

- No npm publish — `0.1.0` is built and tested locally only; the GitHub Actions `publish.yml` is wired for npm OIDC trusted publishing but marked dormant until a human sets up the npm trusted publisher and cuts a GitHub Release.
- No PR opened against `vercel/ai`'s tools registry — see `LISTING-DRAFT.md` for the prepared submission. Note the registry's own prerequisites require the package to already be live on npm, so that PR cannot be opened before this package is published.
