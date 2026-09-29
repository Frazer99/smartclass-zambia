/**
 * Shared multi-provider chat completion helper — OpenAI and Anthropic
 * (Claude), with automatic fallback if the primary provider is
 * unavailable or fails. Real resilience, not a cosmetic "pick one"
 * toggle: if OpenAI has an outage, a configured Anthropic key picks up
 * automatically, and vice versa, without the pupil ever seeing a
 * failure as long as at least one provider is working.
 *
 * Deliberately scoped to CHAT completions only. OpenAI's Moderation API
 * (moderateMessage() in ai-teacher-chat) and OpenAI's embeddings
 * (embeddings.ts, powering RAG) stay OpenAI-only — Anthropic doesn't
 * offer a public moderation endpoint or an embeddings API, so there's
 * no real "swap the provider" story for either of those; they aren't
 * touched by this file.
 *
 * Anthropic's Messages API details below were verified against current
 * documentation before writing this, not assumed from training data —
 * the endpoint (POST /v1/messages), both required headers (x-api-key,
 * anthropic-version: 2023-06-01), and the response shape (a `content`
 * array of typed blocks, not a single string like OpenAI's
 * choices[0].message.content) are all genuinely different from OpenAI's
 * API, not just a model-name swap.
 */

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  text: string | null;
  /** Which provider actually produced the response — callers that log
   *  interactions can record this, useful for seeing in practice how
   *  often fallback actually triggers. */
  provider: "openai" | "anthropic" | null;
}

const OPENAI_MODEL = "gpt-4o-mini";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: LlmMessage[],
  maxTokens: number,
  temperature: number
): Promise<string | null> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) {
      console.error("OpenAI chat completion failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error("OpenAI chat completion request failed:", e);
    return null;
  }
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: LlmMessage[],
  maxTokens: number,
  temperature: number
): Promise<string | null> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        system: systemPrompt,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) {
      console.error("Anthropic chat completion failed:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    // content is an array of typed blocks (text, tool_use, etc.) — join
    // just the text blocks, since a plain chat completion like this
    // shouldn't produce anything else, but being defensive costs nothing.
    const textBlocks = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text);
    const text = textBlocks.join("").trim();
    return text || null;
  } catch (e) {
    console.error("Anthropic chat completion request failed:", e);
    return null;
  }
}

/**
 * Tries the preferred provider first, falls back to the other one if it
 * fails or isn't configured, and returns null (never throws) if neither
 * works — callers already have their own rule-based fallback for that
 * case (e.g. ai-teacher-chat's generateFallbackResponse()), so this
 * function's job is only to try both real providers, not to invent a
 * third fallback layer of its own.
 */
export async function generateChatCompletion(
  systemPrompt: string,
  messages: LlmMessage[],
  options: { maxTokens?: number; temperature?: number; preferredProvider?: "openai" | "anthropic" } = {}
): Promise<ChatCompletionResult> {
  const maxTokens = options.maxTokens ?? 300;
  const temperature = options.temperature ?? 0.7;
  const preferred = options.preferredProvider === "anthropic" ? "anthropic" : "openai";

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  const order: ("openai" | "anthropic")[] = preferred === "anthropic"
    ? ["anthropic", "openai"]
    : ["openai", "anthropic"];

  for (const provider of order) {
    if (provider === "openai" && openaiKey) {
      const text = await callOpenAI(openaiKey, systemPrompt, messages, maxTokens, temperature);
      if (text) return { text, provider: "openai" };
    }
    if (provider === "anthropic" && anthropicKey) {
      const text = await callAnthropic(anthropicKey, systemPrompt, messages, maxTokens, temperature);
      if (text) return { text, provider: "anthropic" };
    }
  }

  return { text: null, provider: null };
}
