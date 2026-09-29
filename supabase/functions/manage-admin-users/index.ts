import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type CreateRequest = {
  action: "create";
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "teacher";
  school?: string;
  grade?: number;
};

type DeleteRequest = {
  action: "delete";
  userId: string;
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return response({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);
    if (callerError || !callerData.user) return response({ error: "Invalid authentication" }, 401);

    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (callerProfileError || callerProfile?.role !== "admin") {
      return response({ error: "Admin access required" }, 403);
    }

    const payload = await req.json() as CreateRequest | DeleteRequest;

    if (payload.action === "create") {
      const email = payload.email?.trim().toLowerCase();
      const fullName = payload.fullName?.trim();
      const password = payload.password || "";
      if (!email || !fullName || !password || !["admin", "teacher"].includes(payload.role)) {
        return response({ error: "Email, password, name, and a valid role are required" }, 400);
      }
      if (password.length < 8) return response({ error: "Password must be at least 8 characters" }, 400);
      if (payload.role === "teacher" && !payload.school?.trim()) {
        return response({ error: "A school is required for teachers" }, 400);
      }

      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: payload.role,
          school: payload.school?.trim() || null,
          grade: payload.grade || 1,
        },
      });
      if (createError || !created.user) {
        return response({ error: createError?.message || "Could not create account" }, 400);
      }

      if (payload.role === "teacher") {
        await adminClient.from("profiles").update({ teacher_approved: true }).eq("id", created.user.id);
      }
      return response({ userId: created.user.id });
    }

    if (payload.action === "delete") {
      if (!payload.userId || payload.userId === callerData.user.id) {
        return response({ error: "An admin cannot delete their own account" }, 400);
      }
      const { data: targetProfile, error: targetProfileError } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", payload.userId)
        .maybeSingle();
      if (targetProfileError || !targetProfile || !["admin", "teacher"].includes(targetProfile.role)) {
        return response({ error: "Only admin and teacher accounts can be deleted here" }, 400);
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(payload.userId);
      if (deleteError) return response({ error: deleteError.message }, 400);
      return response({ deleted: true });
    }

    return response({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("manage-admin-users error:", error);
    return response({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
