/**
 * Shared OpenAI embeddings helper, imported by ai-teacher-chat,
 * content-materials, and generate-embeddings.
 *
 * Uses text-embedding-3-small (1536 dimensions, matching the `vector(1536)`
 * columns from the pgvector migration) — OpenAI's cheapest current
 * embedding model, appropriate here since curriculum text and pupil
 * questions are short and don't need the larger model's extra nuance.
 *
 * Returns null on any failure (missing key, network error, malformed
 * response) rather than throwing, so callers can always fall back to
 * keyword search instead of breaking the pupil's request.
 */

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || !text?.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000), // stay well under the model's token limit
      }),
    });

    if (!response.ok) {
      console.error("Embedding request failed:", await response.text());
      return null;
    }

    const data = await response.json();
    const embedding = data?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding : null;
  } catch (e) {
    console.error("Embedding generation error (non-fatal):", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Builds the text an embedding should represent, consistently across
 *  every table that gets embedded — title/summary style content, not raw
 *  database rows. */
export function embeddingTextFor(kind: "content_material" | "search_index" | "past_paper_question", row: Record<string, unknown>): string {
  switch (kind) {
    case "content_material":
      return [row.title, row.content_summary, row.extracted_text].filter(Boolean).join(". ").slice(0, 8000);
    case "search_index":
      return [row.display_title, row.description].filter(Boolean).join(". ");
    case "past_paper_question":
      return [row.question_text, row.explanation].filter(Boolean).join(". ");
    default:
      return "";
  }
}
