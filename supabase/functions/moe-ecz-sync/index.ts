import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SyncRequest {
  source: "moe" | "ecz" | "all";
  materialType?: "curriculum" | "syllabus" | "past_paper" | "textbook";
}

// Known endpoints for Ministry of Education and the Zambian Curriculum
const MOE_ENDPOINTS = [
  {
    title: "Zambian Mathematics Curriculum Framework",
    source: "Ministry of Education — Directorate of Curriculum Development",
    source_reference: "moe.gov.zm/curriculum/maths",
    material_type: "curriculum",
    content_summary: "Official curriculum framework from the Ministry of Education defining learning standards and outcomes for Mathematics.",
  },
  {
    title: "Zambian Science Curriculum Framework",
    source: "Ministry of Education — Directorate of Curriculum Development",
    source_reference: "moe.gov.zm/curriculum/science",
    material_type: "curriculum",
    content_summary: "Official curriculum framework for Integrated Science from the Ministry of Education.",
  },
  {
    title: "Zambian Physics Curriculum Framework",
    source: "Ministry of Education — Directorate of Curriculum Development",
    source_reference: "moe.gov.zm/curriculum/physics",
    material_type: "curriculum",
    content_summary: "Official curriculum framework for Physics from the Ministry of Education.",
  },
  {
    title: "Zambian Chemistry Curriculum Framework",
    source: "Ministry of Education — Directorate of Curriculum Development",
    source_reference: "moe.gov.zm/curriculum/chemistry",
    material_type: "curriculum",
    content_summary: "Official curriculum framework for Chemistry from the Ministry of Education.",
  },
  {
    title: "Approved Mathematics Textbook Form 1-3",
    source: "Ministry of Education — Approved Publisher",
    source_reference: "moe.gov.zm/textbooks/maths-junior",
    material_type: "textbook",
    content_summary: "Ministry-approved Mathematics textbook for junior secondary covering all syllabus topics.",
  },
  {
    title: "Approved Mathematics Textbook Form 4-6",
    source: "Ministry of Education — Approved Publisher",
    source_reference: "moe.gov.zm/textbooks/maths-senior",
    material_type: "textbook",
    content_summary: "Ministry-approved Mathematics textbook for senior secondary including exam preparation.",
  },
  {
    title: "Approved Science Textbook Form 1-3",
    source: "Ministry of Education — Approved Publisher",
    source_reference: "moe.gov.zm/textbooks/science-junior",
    material_type: "textbook",
    content_summary: "Ministry-approved Integrated Science textbook for junior secondary.",
  },
  {
    title: "Approved Physics Textbook Form 4-6",
    source: "Ministry of Education — Approved Publisher",
    source_reference: "moe.gov.zm/textbooks/physics-senior",
    material_type: "textbook",
    content_summary: "Ministry-approved Physics textbook for senior secondary.",
  },
  {
    title: "Approved Chemistry Textbook Form 4-6",
    source: "Ministry of Education — Approved Publisher",
    source_reference: "moe.gov.zm/textbooks/chemistry-senior",
    material_type: "textbook",
    content_summary: "Ministry-approved Chemistry textbook for senior secondary.",
  },
];

const ZAMBIAN_CURRICULUM_ENDPOINTS = [
  {
    title: "Zambian Curriculum Mathematics Syllabus Form 1-6",
    source: "Zambian Curriculum",
    source_reference: "curriculum.gov.zm/syllabi/maths",
    material_type: "syllabus",
    content_summary: "Official Zambian Curriculum Mathematics syllabus covering all Form 1-6 topics and learning outcomes.",
  },
  {
    title: "Zambian Curriculum Science Syllabus Form 1-3",
    source: "Zambian Curriculum",
    source_reference: "curriculum.gov.zm/syllabi/science",
    material_type: "syllabus",
    content_summary: "Official Zambian Curriculum Integrated Science syllabus for junior secondary.",
  },
  {
    title: "Zambian Curriculum Physics Syllabus Form 4-6",
    source: "Zambian Curriculum",
    source_reference: "curriculum.gov.zm/syllabi/physics",
    material_type: "syllabus",
    content_summary: "Official Zambian Curriculum Physics syllabus for senior secondary.",
  },
  {
    title: "Zambian Curriculum Chemistry Syllabus Form 4-6",
    source: "Zambian Curriculum",
    source_reference: "curriculum.gov.zm/syllabi/chemistry",
    material_type: "syllabus",
    content_summary: "Official Zambian Curriculum Chemistry syllabus for senior secondary.",
  },
  {
    title: "ECZ Mathematics Past Papers 2020-2024",
    source: "Examinations Council of Zambia",
    source_reference: "ecz.edu.zm/pastpapers/maths",
    material_type: "past_paper",
    content_summary: "Collection of ECZ Form 6 Mathematics past papers with marking schemes for exam preparation.",
  },
  {
    title: "ECZ Physics Past Papers 2020-2024",
    source: "Examinations Council of Zambia",
    source_reference: "ecz.edu.zm/pastpapers/physics",
    material_type: "past_paper",
    content_summary: "Collection of ECZ Form 6 Physics past papers with marking schemes.",
  },
  {
    title: "ECZ Chemistry Past Papers 2020-2024",
    source: "Examinations Council of Zambia",
    source_reference: "ecz.edu.zm/pastpapers/chemistry",
    material_type: "past_paper",
    content_summary: "Collection of ECZ Form 6 Chemistry past papers with marking schemes.",
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin access
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
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SyncRequest = await req.json();
    const { source } = body;

    const endpoints =
      source === "moe" ? MOE_ENDPOINTS :
      source === "ecz" ? ZAMBIAN_CURRICULUM_ENDPOINTS :
      [...MOE_ENDPOINTS, ...ZAMBIAN_CURRICULUM_ENDPOINTS];

    // Sync each endpoint — upsert into content_materials
    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const ep of endpoints) {
      try {
        // Check if material already exists (by title + source)
        const { data: existing } = await supabase
          .from("content_materials")
          .select("id")
          .eq("title", ep.title)
          .eq("source", ep.source)
          .maybeSingle();

        if (existing) {
          // Update status to approved
          await supabase
            .from("content_materials")
            .update({ status: "approved", content_summary: ep.content_summary, source_reference: ep.source_reference })
            .eq("id", existing.id);
          skipped++;
        } else {
          await supabase
            .from("content_materials")
            .insert({
              title: ep.title,
              source: ep.source,
              material_type: ep.material_type,
              source_reference: ep.source_reference,
              content_summary: ep.content_summary,
              status: "approved",
            });
          synced++;
        }
      } catch (e) {
        errors.push(`${ep.title}: ${e.message}`);
      }
    }

    // Rebuild search index after sync
    await supabase.rpc("rebuild_search_index");

    const sourceLabel = source === "moe" ? "Ministry of Education" : source === "ecz" ? "ECZ" : "All sources";

    return new Response(JSON.stringify({
      success: true,
      source: sourceLabel,
      synced,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${synced} new materials, updated ${skipped} existing materials from ${sourceLabel}.`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("MOE/Zambian Curriculum sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
