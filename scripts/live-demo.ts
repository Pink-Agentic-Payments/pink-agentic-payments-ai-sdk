/**
 * Live demo: drives a real Gemini model through generateText, using
 * pinkTools() against the live Pink sandbox (test money only). Creates a
 * fresh sandbox workspace and runs three prompts designed to produce the
 * three decisions (allowed / pending_human / blocked), then approves the
 * pending hold via the admin key and has the model check status again.
 *
 * Run with: npx tsx scripts/live-demo.ts > TEST-OUTPUT.txt
 */
import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { approvePayment, createSandboxWorkspace } from "pink-agentic-payments";
import { pinkTools } from "../src/index.js";

const MODEL = "gemini-3.8-flash";

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function run() {
  console.log(`Pink Agentic AI Payments x Vercel AI SDK -- live demo`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Model: google(${MODEL}) via @ai-sdk/google`);

  const workspace = await createSandboxWorkspace({
    company: "AI SDK Live Demo",
    template: "startup",
  });
  const agentKey = workspace.agents[0].key;
  const adminKey = (workspace as any).admin_key;
  console.log(`Sandbox workspace created (template=startup). workspace_id excluded from this transcript.`);
  console.log(`Agent: ${workspace.agents[0].name}`);

  const tools = pinkTools({ agentKey });

  function logSteps(label: string, result: Awaited<ReturnType<typeof generateText>>) {
    section(label);
    for (const step of result.steps) {
      for (const call of step.toolCalls ?? []) {
        console.log(`tool_call: ${call.toolName}(${JSON.stringify(call.input)})`);
      }
      for (const res of step.toolResults ?? []) {
        console.log(`tool_result: ${res.toolName} -> ${JSON.stringify((res as any).output)}`);
      }
    }
    console.log(`final_text: ${result.text}`);
  }

  // 1. Allowed: small, known-vendor payment.
  const allowedResult = await generateText({
    model: google(MODEL),
    tools,
    stopWhen: stepCountIs(5),
    prompt:
      "Check the policy for paying payee id p_figma $50 USD for 'design tool renewal', then actually " +
      "request that payment using request_payment. Report the final decision and payment id in one short sentence.",
  });
  logSteps("1. allowed", allowedResult);

  // 2. Blocked: an amount far beyond the budget, same known vendor.
  const blockedResult = await generateText({
    model: google(MODEL),
    tools,
    stopWhen: stepCountIs(5),
    prompt:
      "Use request_payment to request a payment of $10000 USD to payee id p_figma for 'large annual license'. " +
      "Report the final decision in one short sentence, quoting the rule if it was blocked.",
  });
  logSteps("2. blocked", blockedResult);

  // 3. Pending human approval: mid-size payment that needs a human.
  const pendingResult = await generateText({
    model: google(MODEL),
    tools,
    stopWhen: stepCountIs(5),
    prompt:
      "Use request_payment to request a payment of $2000 USD to payee id p_figma for 'team license upgrade'. " +
      "Report the final decision and the payment id in one short sentence.",
  });
  logSteps("3. pending_human", pendingResult);

  const pendingPaymentId = pendingResult.steps
    .flatMap((s) => s.toolResults ?? [])
    .map((r) => String((r as any).output ?? ""))
    .find((out) => out.includes("payment_id="))
    ?.match(/payment_id=(\S+)/)?.[1];

  if (!pendingPaymentId) {
    throw new Error("Could not extract a pending payment_id from step 3's tool results");
  }

  console.log(`\nAdmin approving hold ${pendingPaymentId} out-of-band (not via the model)...`);
  await approvePayment(adminKey, pendingPaymentId, { by: "Live demo admin" });

  // 4. Model checks status after admin approval.
  const statusResult = await generateText({
    model: google(MODEL),
    tools,
    stopWhen: stepCountIs(3),
    prompt: `Use check_payment_status to look up payment id ${pendingPaymentId} and report its decision in one short sentence.`,
  });
  logSteps("4. check_payment_status after approval", statusResult);

  console.log("\n=== done ===");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
