import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteAccountRequest {
  userId: string;
  reason: string;
}

/**
 * Permanently deletes a pupil's account — the real auth.users row, not
 * just their profiles row. This has to be an Edge Function rather than a
 * plain SQL function: deleting from auth.users requires the Supabase
 * Auth Admin API, which only a service-role server context can call.
 *
 * Logs a snapshot to account_deletions_log BEFORE deleting anything —
 * who, why, and their warning count at the time — since that information
 * is gone once the account actually goes. Then explicitly deletes the
 * profiles row as a safety net in addition to calling
 * auth.admin.deleteUser() (which should cascade to profiles and
 * everything referencing it anyway via ON DELETE CASCADE, but this
 * doesn't rely solely on that assumption holding for every table).
 *
 * Irreversible. The frontend is expected to have already confirmed this
 * with the admin (a real "are you sure" step, not a single click) before
 * ever calling this function — this function itself does not ask again,
 * since by the time a request reaches here, confirmation already
 * happened client-side.
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
    const { data: adminUserData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !adminUserData.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminProfile } = await supabase.from("profiles").select("role").eq("id", adminUserData.user.id).maybeSingle();
    if (adminProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, reason }: DeleteAccountRequest = await req.json();
    if (!userId || !reason) {
      return new Response(JSON.stringify({ error: "userId and reason are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (userId === adminUserData.user.id) {
      return new Response(JSON.stringify({ error: "You cannot delete your own account this way" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Snapshot before anything is deleted.
    const { data: targetProfile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const { data: targetAuthUser } = await supabase.auth.admin.getUserById(userId);
    const { count: warningCount } = await supabase
      .from("user_warnings").select("id", { count: "exact", head: true }).eq("user_id", userId);

    await supabase.from("account_deletions_log").insert({
      deleted_user_id: userId,
      deleted_by: adminUserData.user.id,
      reason,
      warning_count_at_deletion: warningCount ?? 0,
      full_name_snapshot: targetProfile?.full_name || null,
      email_snapshot: targetAuthUser.user?.email || null,
    });

    await supabase.from("admin_action_log").insert({
      admin_id: adminUserData.user.id, action_type: "delete_user", target_user_id: userId,
      details: { reason, warning_count: warningCount ?? 0 },
    });

    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("auth.admin.deleteUser failed:", deleteError);
      return new Response(JSON.stringify({ error: `Failed to delete account: ${deleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Safety net — explicit delete in case ON DELETE CASCADE isn't set
    // up on profiles.id for some reason. A no-op if the cascade already
    // handled it (DELETE against a row that no longer exists just
    // affects zero rows, not an error).
    await supabase.from("profiles").delete().eq("id", userId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("delete-user-account error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
