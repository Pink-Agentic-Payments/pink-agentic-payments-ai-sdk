# Listing draft: Vercel AI SDK Tools Registry

## The route (verified 2026-10-12)

The AI SDK (ai-sdk.dev, maintained in `vercel/ai`) has an official **Tools Registry** at
https://ai-sdk.dev/resources/tools ("Browse community-built tools that add web search, extraction,
code execution, and more" — 19 tools listed at time of writing). It links a "Submit a tool" flow to:

https://github.com/vercel/ai/blob/main/contributing/add-new-tool-to-registry.md

That doc (fetched verbatim 2026-10-12 from `raw.githubusercontent.com/vercel/ai/main/contributing/add-new-tool-to-registry.md`)
specifies: fork `vercel/ai`, add one object to the `tools` array in `content/tools-registry/registry.ts`,
then open a PR titled `feat(tools-registry): add <slug>`.

**Prerequisites it states explicitly, before a PR will be accepted:**
1. The tool package must already be **published to npm**.
2. The integration must be tested against the current AI SDK.
3. Documentation explaining the AI SDK integration must be published on the package's own site/docs
   (the registry's `docsUrl` must point at that integration guide, not a generic homepage).

**This blocks opening the PR right now**: this task explicitly excludes `npm publish`, so prerequisite
(1) is not met yet. The entry below is ready to submit as soon as `pink-agentic-payments-ai-sdk` is
published to npm (see `NOTES.md` — `publish.yml` is wired for npm OIDC trusted publishing but dormant).

## Other frameworks checked (facts only, not building for these)

- **Mastra**: no public community tool registry or submission route was found. Mastra ships its own
  first-party tool providers (Composio, Arcade) for third-party-app tools; nothing resembling the AI
  SDK's registry/PR flow turned up in `mastra.ai` docs or search. (Searched 2026-10-12.)
- **OpenAI Agents SDK (JS, `@openai/agents`)**: no official third-party tools listing/registry was
  found either. The SDK documents its own built-in tool categories (hosted OpenAI tools, function
  tools, MCP servers, etc.) but has no community-contribution page analogous to the AI SDK's registry.
  (Searched 2026-10-12.)

So of the three, only the Vercel AI SDK has a verified official listing route.

## Exact entry to add to `content/tools-registry/registry.ts`

```typescript
{
  slug: 'pink-agentic-payments',
  name: 'Pink Agentic AI Payments',
  description:
    'Lets an AI SDK agent request payments that are checked against company spending rules ' +
    '(budgets, payee allow-lists, human-approval thresholds) before any payment credential is issued. ' +
    'Sandbox preview, test money only.',
  packageName: 'pink-agentic-payments-ai-sdk',
  tags: ['payments', 'agents', 'finance'],
  installCommand: {
    pnpm: 'pnpm install pink-agentic-payments-ai-sdk',
    npm: 'npm install pink-agentic-payments-ai-sdk',
    yarn: 'yarn add pink-agentic-payments-ai-sdk',
    bun: 'bun add pink-agentic-payments-ai-sdk',
  },
  codeExample: `import { generateText, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { createSandboxWorkspace } from 'pink-agentic-payments';
import { pinkTools } from 'pink-agentic-payments-ai-sdk';

const workspace = await createSandboxWorkspace({ company: 'My Test Co', template: 'startup' });
const agentKey = workspace.agents[0].key;

const { text } = await generateText({
  model: google('gemini-3.8-flash'),
  tools: pinkTools({ agentKey }),
  stopWhen: stepCountIs(5),
  prompt: 'Check the budget, then pay Figma $50 for our design tool renewal.',
});

console.log(text);`,
  docsUrl: 'https://github.com/Pink-Agentic-Payments/pink-agentic-payments-ai-sdk#readme',
  websiteUrl: 'https://pinkwallet.com/agentic/developers/',
  npmUrl: 'https://www.npmjs.com/package/pink-agentic-payments-ai-sdk',
}
```

Notes on fields the PM should sanity-check before the real PR:
- `docsUrl` should ideally point at a dedicated AI SDK integration guide page on pinkwallet.com rather
  than the GitHub README, per the doc's guidance ("should point directly to the relevant AI SDK
  integration guide rather than to a homepage"). Using the README is a reasonable placeholder until
  such a page exists.
- No `apiKeyEnvName`/`apiKeyUrl` — the sandbox needs no signup or API key request; the agent key comes
  from `createSandboxWorkspace()` at runtime, so these fields don't apply.

## PR mechanics (not executed — draft only, per task boundaries)

- Branch name: `feat/add-tool-pink-agentic-payments`
- Commit message: `feat(tools-registry): add pink-agentic-payments` (file: `content/tools-registry/registry.ts`)
- PR title: `feat(tools-registry): add pink-agentic-payments`
- Target repo: `vercel/ai` (do NOT open; this task excludes PRs on other repos and requires npm publish first)
