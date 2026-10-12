/**
 * Integration tests against the LIVE Pink sandbox (test money only).
 *
 * Not run in CI (needs network + a live sandbox). Run manually with:
 *
 *   npm run test:live
 *
 * Creates one fresh sandbox workspace (template="startup") and drives the
 * AI SDK tools through all three payment decisions against the known payee
 * "Figma" (p_figma), using amounts live-probed against this same template
 * on 2026-10-12 (see NOTES.md):
 *
 *   $50    -> allowed       (known vendors under $1,000)
 *   $2,000 -> pending_human (CFO approval threshold)
 *   $10,000 -> blocked      (agent's monthly budget is used up)
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { approvePayment, createSandboxWorkspace } from "pink-agentic-payments";
import { pinkTools } from "../src/index.js";

let tools: ReturnType<typeof pinkTools>;
let adminKey: string;

before(async () => {
  const workspace = await createSandboxWorkspace({
    company: "AI SDK Integration Test",
    template: "startup",
  });
  const agentKey = workspace.agents[0].key;
  adminKey = (workspace as any).admin_key;
  tools = pinkTools({ agentKey });
});

test("get_budget reports a left_this_month figure", async () => {
  const out = await (tools.get_budget.execute as any)({});
  assert.match(out, /left_this_month=/);
});

test("check_policy dry-runs an allowed payment", async () => {
  const out = await (tools.check_policy.execute as any)({
    amount: 50,
    currency: "USD",
    payeeId: "p_figma",
    purpose: "design tool renewal",
  });
  assert.match(out, /would_decision=would_allow/);
});

test("request_payment: allowed, blocked, and pending_human -> approved", async () => {
  const allowed = await (tools.request_payment.execute as any)({
    amount: 50,
    currency: "USD",
    payeeId: "p_figma",
    purpose: "design tool renewal",
  });
  assert.match(allowed, /decision=allowed/);

  const blocked = await (tools.request_payment.execute as any)({
    amount: 10000,
    currency: "USD",
    payeeId: "p_figma",
    purpose: "large annual license",
  });
  assert.match(blocked, /decision=blocked/);

  const pending = await (tools.request_payment.execute as any)({
    amount: 2000,
    currency: "USD",
    payeeId: "p_figma",
    purpose: "team license upgrade",
  });
  assert.match(pending, /decision=pending_human/);
  const paymentId = pending.match(/payment_id=(\S+)/)?.[1];
  assert.ok(paymentId);

  await approvePayment(adminKey, paymentId!, { by: "Integration test admin" });
  const status = await (tools.check_payment_status.execute as any)({ paymentId });
  assert.match(status, /decision=approved/);
});
