// Thin wrapper around the Anthropic SDK.
// ALL Claude calls in the product go through askClaude() so that:
//  - the model name lives in one place (packages/core constants)
//  - a missing API key produces ONE friendly, consistent error
//  - usage is easy to log/limit later
import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL } from "@coursemind/core";

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI features aren't configured yet. Add your Anthropic API key as ANTHROPIC_API_KEY in apps/web/.env.local and restart the dev server. Get a key at https://console.anthropic.com/settings/keys - see README.md -> 'Enabling AI features'.";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function askClaude(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
}): Promise<string> {
  if (!isAiConfigured()) {
    throw new Error(AI_NOT_CONFIGURED_MESSAGE);
  }
  const response = await getClient().messages.create({
    model: AI_MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: opts.messages,
  });
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
