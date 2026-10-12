/**
 * Vercel AI SDK tools around the pink-agentic-payments sandbox client.
 *
 * Each tool maps 1:1 to one method of PinkClient (see that package's
 * README/NOTES.md for the endpoint-by-method mapping). No new capability
 * is invented here: every tool just gives an AI SDK agent a typed,
 * model-readable way to call a method that already exists in the official
 * client.
 *
 * Sandbox only, test money: see https://pinkwallet.com/agentic/developers/.
 */
import { tool } from "ai";
import { z } from "zod";
import {
  PinkApprovalPending,
  PinkClient,
  PinkError,
  PinkPolicyDenied,
} from "pink-agentic-payments";

export interface PinkToolsOptions {
  /** Sandbox agent key (pk_sandbox_agent_...) for the agent making requests. */
  agentKey: string;
  /** Override the sandbox base URL. Defaults to the public sandbox. */
  baseUrl?: string;
}

const paymentShape = {
  amount: z
    .number()
    .describe("Payment amount, in the given currency's smallest common unit (e.g. dollars for USD)."),
  currency: z.string().default("USD").describe("Three-letter currency code, e.g. USD."),
  payeeId: z
    .string()
    .optional()
    .describe("Exact payee id from list_payees, if known. Preferred over payeeName when available."),
  payeeName: z
    .string()
    .optional()
    .describe("Payee name to pay, e.g. 'Figma'. Use this or payeeId, whichever you know."),
  purpose: z.string().optional().describe("Short free-text reason for the payment, e.g. 'design tool renewal'."),
};

function describePending(e: PinkApprovalPending): string {
  const who = (e.payload as Record<string, unknown>).who ?? "a workspace owner";
  const paymentId = (e.payload as Record<string, unknown>).payment_id ?? (e.payload as Record<string, unknown>).hold_id;
  return (
    `decision=pending_human payment_id=${paymentId} approver=${who}. ` +
    "This request is on hold until a human approves or declines it; do not resubmit it."
  );
}

function describeBlocked(e: PinkPolicyDenied): string {
  const rule = (e.payload as Record<string, unknown>).rule ?? "a spending rule";
  const paymentId = (e.payload as Record<string, unknown>).payment_id;
  return (
    `decision=blocked payment_id=${paymentId} rule=${JSON.stringify(rule)}. ` +
    "This exact request will never be allowed; do not retry it unchanged."
  );
}

function describeApiError(e: PinkError): string {
  return `error status=${e.statusCode} message=${e.message}`;
}

/**
 * Build the four Pink Agentic AI Payments tools for use with
 * generateText/streamText/Agent from the `ai` package.
 *
 * ```ts
 * import { generateText } from "ai";
 * import { pinkTools } from "pink-agentic-payments-ai-sdk";
 *
 * const { text } = await generateText({
 *   model,
 *   tools: pinkTools({ agentKey }),
 *   prompt: "Pay Figma $50 for our design tool renewal, check the budget first.",
 * });
 * ```
 */
export function pinkTools(options: PinkToolsOptions) {
  const client = new PinkClient(options.agentKey, options.baseUrl ? { baseUrl: options.baseUrl } : undefined);

  const requestPayment = tool({
    description:
      "Request a payment from Pink Agentic AI Payments (sandbox preview, test money only). " +
      "The company's rules (per-agent budget caps, allowed payees, human-approval thresholds) " +
      "are checked before any money moves. Returns one of three decisions: " +
      "'allowed' (a one-time sandbox payment credential was issued), " +
      "'pending_human' (a human must approve this exact request before it can proceed), or " +
      "'blocked' (this exact request will never be allowed; do not retry it unchanged).",
    inputSchema: z.object(paymentShape),
    execute: async ({ amount, currency, payeeId, payeeName, purpose }) => {
      try {
        const result = await client.requestPayment({
          amount,
          currency,
          payeeId,
          payeeName,
          purpose,
        });
        const credentialType = (result as Record<string, any>).credential?.type ?? "unknown";
        return `decision=allowed payment_id=${(result as Record<string, unknown>).payment_id} credential_type=${credentialType}`;
      } catch (e) {
        if (e instanceof PinkApprovalPending) return describePending(e);
        if (e instanceof PinkPolicyDenied) return describeBlocked(e);
        if (e instanceof PinkError) return describeApiError(e);
        throw e;
      }
    },
  });

  const checkPolicy = tool({
    description:
      "Check, without spending anything, what decision a payment would get from Pink Agentic AI " +
      "Payments' spending rules (sandbox preview). Use this before request_payment to see whether " +
      "an amount or payee would be allowed, blocked, or need human approval, so the agent can explain " +
      "the outcome or try a different amount/payee first.",
    inputSchema: z.object(paymentShape),
    execute: async ({ amount, currency, payeeId, payeeName, purpose }) => {
      try {
        const result = await client.checkPolicy({ amount, currency, payeeId, payeeName, purpose });
        return `would_decision=${(result as Record<string, unknown>).decision} reason=${(result as Record<string, unknown>).reason}`;
      } catch (e) {
        if (e instanceof PinkError) return describeApiError(e);
        throw e;
      }
    },
  });

  const getBudget = tool({
    description:
      "Get this agent's current budget from Pink Agentic AI Payments (sandbox preview): the monthly " +
      "cap, amount already spent, amount remaining, and the single-payment cap. Use this before " +
      "proposing a payment to check whether there's enough budget left.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const budget = (await client.getBudget()) as Record<string, any>;
        const balances = budget.vault?.balances ?? {};
        const currencyCode = Object.keys(balances)[0] ?? "USD";
        return (
          `monthly_budget=${budget.monthly_budget} ` +
          `spent_this_month=${budget.spent_this_month} ` +
          `left_this_month=${budget.left_this_month} ` +
          `single_payment_cap=${budget.single_payment_cap} ` +
          `currency=${currencyCode}`
        );
      } catch (e) {
        if (e instanceof PinkError) return describeApiError(e);
        throw e;
      }
    },
  });

  const checkPaymentStatus = tool({
    description:
      "Look up the current status of a payment previously requested via request_payment (sandbox " +
      "preview). Useful for polling a 'pending_human' hold to see if a human has approved or declined " +
      "it yet. Returns the decision and, once allowed, the credential type.",
    inputSchema: z.object({
      paymentId: z.string().describe("The payment id returned by request_payment, e.g. 'pay_abc123'."),
    }),
    execute: async ({ paymentId }) => {
      try {
        const payment = (await client.getPayment(paymentId)) as Record<string, any>;
        const credentialType = payment.credential?.type;
        // The sandbox reports a human-approved hold as decision="approved"
        // (distinct from the immediate, no-human-needed "allowed" a fresh
        // requestPayment() call returns), live-verified 2026-10-12.
        return `decision=${payment.decision} payment_id=${paymentId} credential_type=${credentialType}`;
      } catch (e) {
        if (e instanceof PinkError) return describeApiError(e);
        throw e;
      }
    },
  });

  return {
    request_payment: requestPayment,
    check_policy: checkPolicy,
    get_budget: getBudget,
    check_payment_status: checkPaymentStatus,
  };
}

export { PinkApprovalPending, PinkClient, PinkError, PinkPolicyDenied };
