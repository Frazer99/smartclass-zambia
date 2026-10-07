import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { generateEmbedding, embeddingTextFor } from "../_shared/embeddings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname.replace("/content-materials", "");
    const method = req.method;

    // Verify the user is authenticated and is an admin
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, teacher_approved")
      .eq("id", userData.user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";
    const isApprovedTeacher = profile?.role === "teacher" && profile?.teacher_approved === true;
    const materialId = path.replace("/", "");
    let canManageOwnMaterial = false;
    if (!isAdmin && isApprovedTeacher && (method === "PUT" || method === "DELETE") && materialId) {
      const { data: ownedMaterial } = await supabase
        .from("content_materials")
        .select("uploaded_by")
        .eq("id", materialId)
        .maybeSingle();
      canManageOwnMaterial = ownedMaterial?.uploaded_by === userData.user.id;
    }

    // GET / — list all content materials (available to all authenticated users)
    if (method === "GET" && (path === "" || path === "/")) {
      await supabase.from("content_materials").update({ status: "approved" }).eq("status", "pending");
      const { data, error } = await supabase
        .from("content_materials")
        .select("*, subject:subjects(name, code, color)")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Teachers may create scoped study materials; only admins may edit/delete.
    if (!isAdmin && !((isApprovedTeacher && method === "POST") || canManageOwnMaterial)) {
      return new Response(JSON.stringify({ error: "Admin access required for this operation" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST / — create a new content material
    if (method === "POST" && (path === "" || path === "/")) {
      const body = await req.json();
      const { title, source, material_type, subject_id, topic_id, grade, source_reference, content_summary } = body;

      if (!title || !source) {
        return new Response(JSON.stringify({ error: "Title and source are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (material_type !== "curriculum" && material_type !== "syllabus") {
        if (!topic_id) {
          return new Response(JSON.stringify({ error: "A topic is required for uploaded study materials" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const { data: topic } = await supabase.from("topics").select("subject_id, grade").eq("id", topic_id).maybeSingle();
        if (!topic || topic.subject_id !== subject_id || Number(topic.grade) !== Number(grade)) {
          return new Response(JSON.stringify({ error: "The topic must belong to the selected subject and Form" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const normalizedTitle = String(title).trim();
      const normalizedSource = String(source).trim();
      let duplicateQuery = supabase
        .from("content_materials")
        .select("id, title")
        .ilike("title", normalizedTitle)
        .ilike("source", normalizedSource)
        .eq("material_type", material_type || "supplementary")
        .limit(1);
      duplicateQuery = subject_id ? duplicateQuery.eq("subject_id", subject_id) : duplicateQuery.is("subject_id", null);
      duplicateQuery = grade ? duplicateQuery.eq("grade", grade) : duplicateQuery.is("grade", null);
      const { data: duplicate, error: duplicateError } = await duplicateQuery.maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        return new Response(JSON.stringify({
          error: "Material already exists",
          duplicate: { id: duplicate.id, title: duplicate.title },
        }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("content_materials")
        .insert({
          title: normalizedTitle,
          source: normalizedSource,
          material_type: material_type || "supplementary",
          subject_id: subject_id || null,
          topic_id: topic_id || null,
          grade: grade || null,
          source_reference: source_reference || null,
          content_summary: content_summary || null,
          uploaded_by: userData.user.id,
          status: "approved",
        })
        .select()
        .single();

      if (error) throw error;

      // Embed immediately so this material is searchable by ai-teacher-chat
      // right away rather than waiting for the next admin-triggered backfill.
      // Never blocks the response — a failed embedding just leaves the row
      // for generate-embeddings to pick up later.
      const embeddingText = embeddingTextFor("content_material", data);
      const vector = await generateEmbedding(embeddingText);
      if (vector) {
        await supabase.from("content_materials").update({ embedding: vector }).eq("id", data.id);
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT /:id — update a content material
    if (method === "PUT") {
      const id = materialId;
      if (!id) {
        return new Response(JSON.stringify({ error: "Material ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const updates: Record<string, any> = {};
      const allowedFields = ["title", "source", "material_type", "subject_id", "topic_id", "grade", "source_reference", "content_summary", "status"];
      for (const field of allowedFields) {
        if (body[field] !== undefined) updates[field] = body[field];
      }
      if (updates.status === "pending") updates.status = "approved";

      if (updates.material_type === "video" || updates.topic_id !== undefined || updates.subject_id !== undefined || updates.grade !== undefined) {
        const { data: existing } = await supabase.from("content_materials").select("material_type, topic_id, subject_id, grade").eq("id", id).maybeSingle();
        const materialType = updates.material_type ?? existing?.material_type;
        const topicId = updates.topic_id ?? existing?.topic_id;
        const subjectId = updates.subject_id ?? existing?.subject_id;
        const materialGrade = updates.grade ?? existing?.grade;
        if (topicId) {
          const { data: topic } = await supabase.from("topics").select("subject_id, grade").eq("id", topicId).maybeSingle();
          if (!topic || topic.subject_id !== subjectId || Number(topic.grade) !== Number(materialGrade)) {
            return new Response(JSON.stringify({ error: "The topic must belong to the selected subject and Form" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      }

      const { data, error } = await supabase
        .from("content_materials")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Re-embed if the text that feeds the embedding changed. Cheap check
      // against a full re-embed on every metadata-only edit (e.g. status).
      if (updates.title !== undefined || updates.content_summary !== undefined) {
        const embeddingText = embeddingTextFor("content_material", data);
        const vector = await generateEmbedding(embeddingText);
        if (vector) {
          await supabase.from("content_materials").update({ embedding: vector }).eq("id", id);
        }
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE /:id — delete a content material
    if (method === "DELETE") {
      const id = materialId;
      if (!id) {
        return new Response(JSON.stringify({ error: "Material ID required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: material, error: materialLookupError } = await supabase
        .from("content_materials")
        .select("id, material_type")
        .eq("id", id)
        .maybeSingle();

      if (materialLookupError) throw materialLookupError;
      if (!material) {
        return new Response(JSON.stringify({ error: "Material not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (material.material_type === "syllabus" || material.material_type === "curriculum") {
        const { error: topicsError } = await supabase
          .from("topics")
          .delete()
          .eq("source_material_id", id);
        if (topicsError) throw topicsError;
      }

      const { error } = await supabase
        .from("content_materials")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Content materials error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
