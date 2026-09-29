import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { generateEmbedding, embeddingTextFor } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BackfillRequest {
  table?: "content_materials" | "search_index" | "past_paper_questions" | "all";
  limit?: number; // per table, per call — keeps each request within Edge Function time limits
}

const TABLES: Record<string, { kind: "content_material" | "search_index" | "past_paper_question" }> = {
  content_materials: { kind: "content_material" },
  search_index: { kind: "search_index" },
  past_paper_questions: { kind: "past_paper_question" },
};

/**
 * Admin-only backfill for rows created before pgvector embeddings existed
 * (or before OPENAI_API_KEY was configured). New rows get embedded
 * automatically going forward — see content-materials/index.ts and the
 * search_index / past_paper_questions triggers this doesn't cover yet
 * (those are written directly via SQL/admin tabs, not through an Edge
 * Function, so this backfill is also their main embedding path for now).
 *
 * Processes a bounded batch per call (default 20 rows per table) rather
 * than everything at once, since Edge Functions have a wall-clock time
 * limit and each row needs a real OpenAI API round-trip. Call it
 * repeatedly (the admin UI does this with a loop + progress display)
 * until it reports 0 remaining.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Deno.env.get("OPENAI_API_KEY")) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not configured — embeddings require it." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: BackfillRequest = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const targetTables = !body.table || body.table === "all" ? Object.keys(TABLES) : [body.table];
    const limit = Math.min(body.limit ?? 20, 50);

    const results: Record<string, { embedded: number; failed: number; remaining: number }> = {};

    for (const table of targetTables) {
      const { kind } = TABLES[table];
      const { data: rows, error: fetchError } = await supabase
        .from(table)
        .select("*")
        .is("embedding", null)
        .limit(limit);

      if (fetchError) {
        results[table] = { embedded: 0, failed: 0, remaining: -1 };
        continue;
      }

      let embedded = 0;
      let failed = 0;
      for (const row of rows || []) {
        const text = embeddingTextFor(kind, row);
        const vector = await generateEmbedding(text);
        if (!vector) {
          failed++;
          continue;
        }
        const { error: updateError } = await supabase.from(table).update({ embedding: vector }).eq("id", row.id);
        if (updateError) failed++;
        else embedded++;
      }

      const { count: remaining } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .is("embedding", null);

      results[table] = { embedded, failed, remaining: remaining ?? 0 };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-embeddings error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
