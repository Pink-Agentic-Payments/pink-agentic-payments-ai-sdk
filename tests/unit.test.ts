import { test, mock, before, after } from "node:test";
import assert from "node:assert/strict";
import { PinkClient, PinkApprovalPending, PinkPolicyDenied } from "pink-agentic-payments";
import { pinkTools } from "../src/index.js";

function getExecute(toolObj: any) {
  return toolObj.execute as (input: any) => Promise<string>;
}

let getBudgetMock: ReturnType<typeof mock.method>;
let checkPolicyMock: ReturnType<typeof mock.method>;
let requestPaymentMock: ReturnType<typeof mock.method>;
let getPaymentMock: ReturnType<typeof mock.method>;

before(() => {
  getBudgetMock = mock.method(PinkClient.prototype, "getBudget", async () => ({
    monthly_budget: 5000,
    spent_this_month: 1200,
    left_this_month: 3800,
    single_payment_cap: 1000,
    vault: { balances: { USD: 3800 } },
  }));
  checkPolicyMock = mock.method(PinkClient.prototype, "checkPolicy", async () => ({
    decision: "would_allow",
    reason: "Small supply orders go through",
  }));
  requestPaymentMock = mock.method(PinkClient.prototype, "requestPayment", async () => ({
    payment_id: "pay_unit1",
    decision: "allowed",
    credential: { type: "bank_transfer" },
  }));
  getPaymentMock = mock.method(PinkClient.prototype, "getPayment", async () => ({
    payment_id: "pay_unit1",
    decision: "approved",
    credential: { type: "bank_transfer" },
  }));
});

after(() => {
  getBudgetMock.mock.restore();
  checkPolicyMock.mock.restore();
  requestPaymentMock.mock.restore();
  getPaymentMock.mock.restore();
});

test("pinkTools returns the four expected tools", () => {
  const tools = pinkTools({ agentKey: "pk_sandbox_agent_unit" });
  assert.deepEqual(Object.keys(tools).sort(), [
    "check_payment_status",
    "check_policy",
    "get_budget",
    "request_payment",
  ]);
});

test("get_budget formats the mocked budget", async () => {
  const tools = pinkTools({ agentKey: "pk_sandbox_agent_unit" });
  const out = await getExecute(tools.get_budget)({});
  assert.match(out, /monthly_budget=5000/);
  assert.match(out, /left_this_month=3800/);
});

test("check_policy formats a would_allow dry run", async () => {
  const tools = pinkTools({ agentKey: "pk_sandbox_agent_unit" });
  const out = await getExecute(tools.check_policy)({ amount: 50, currency: "USD" });
  assert.match(out, /would_decision=would_allow/);
});

test("request_payment formats an allowed result", async () => {
  const tools = pinkTools({ agentKey: "pk_sandbox_agent_unit" });
  const out = await getExecute(tools.request_payment)({ amount: 50, currency: "USD" });
  assert.match(out, /decision=allowed/);
  assert.match(out, /credential_type=bank_transfer/);
});

test("request_payment surfaces PinkApprovalPending as pending_human text", async () => {
  requestPaymentMock.mock.mockImplementationOnce(async () => {
    throw new PinkApprovalPending({ payment_id: "pay_unit2", who: "Test Approver" });
  });
  const tools = pinkTools({ agentKey: "pk_sandbox_agent_unit" });
  const out = await getExecute(tools.request_payment)({ amount: 2000, currency: "USD" });
  assert.match(out, /decision=pending_human/);
  assert.match(out, /approver=Test Approver/);
});

test("request_payment surfaces PinkPolicyDenied as blocked text", async () => {
  requestPaymentMock.mock.mockImplementationOnce(async () => {
    throw new PinkPolicyDenied({ payment_id: "pay_unit3", rule: "Never: gift cards" });
  });
  const tools = pinkTools({ agentKey: "pk_sandbox_agent_unit" });
  const out = await getExecute(tools.request_payment)({ amount: 10000, currency: "USD" });
  assert.match(out, /decision=blocked/);
  assert.match(out, /Never: gift cards/);
});

test("check_payment_status formats an approved hold", async () => {
  const tools = pinkTools({ agentKey: "pk_sandbox_agent_unit" });
  const out = await getExecute(tools.check_payment_status)({ paymentId: "pay_unit1" });
  assert.match(out, /decision=approved/);
});
