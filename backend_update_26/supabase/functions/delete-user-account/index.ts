import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { logError } from "../_shared/errorLog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeleteAccountRequest {
  userId: string;
  reason?: string;
}

/**
 * Permanently deletes an account — the real auth.users row, not just the
 * profiles row. This has to be an Edge Function rather than a plain SQL
 * function: deleting from auth.users requires the Supabase Auth Admin
 * API, which only a service-role server context can call.
 *
 * Two callers, one function: an admin deleting someone else's account
 * (existing behavior — requires a reason, logged to admin_action_log),
 * or a pupil deleting their OWN account (self-service — no admin role
 * needed, since anyone is entitled to delete their own data; reason is
 * optional, since a pupil shouldn't have to justify a decision about
 * their own account to themselves). Sharing one function for both keeps
 * the actually-sensitive part — the audit snapshot and the real
 * deletion — in exactly one place rather than risking the two paths
 * drifting apart later.
 *
 * Logs a snapshot to account_deletions_log BEFORE deleting anything —
 * who, why, and their warning count at the time — since that information
 * is gone once the account actually goes. deleted_by === deleted_user_id
 * is how a later admin reading this log can tell it was self-service,
 * not something to look for a separate "reason" from.
 *
 * Irreversible either way. The frontend is expected to have already
 * confirmed this with the person taking the action (a real "are you
 * sure", not a single click) before ever calling this function — it
 * does not ask again itself.
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
    const { data: callerData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = callerData.user.id;

    const { userId, reason }: DeleteAccountRequest = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSelfDeletion = userId === callerId;

    if (!isSelfDeletion) {
      // Deleting someone ELSE's account — must be an admin, and must
      // give a reason (accountability for acting on someone else's data).
      const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", callerId).maybeSingle();
      if (callerProfile?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Admin access required to delete another account" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!reason) {
        return new Response(JSON.stringify({ error: "A reason is required when deleting another account" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const finalReason = reason || "Self-service account deletion";

    // Snapshot before anything is deleted.
    const { data: targetProfile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    const { data: targetAuthUser } = await supabase.auth.admin.getUserById(userId);
    const { count: warningCount } = await supabase
      .from("user_warnings").select("id", { count: "exact", head: true }).eq("user_id", userId);

    await supabase.from("account_deletions_log").insert({
      deleted_user_id: userId,
      deleted_by: callerId,
      reason: finalReason,
      warning_count_at_deletion: warningCount ?? 0,
      full_name_snapshot: targetProfile?.full_name || null,
      email_snapshot: targetAuthUser.user?.email || null,
    });

    // Only a real admin action if it's being done TO someone else —
    // logging a pupil's own self-deletion here would misleadingly imply
    // an admin acted on their account when none did.
    if (!isSelfDeletion) {
      await supabase.from("admin_action_log").insert({
        admin_id: callerId, action_type: "delete_user", target_user_id: userId,
        details: { reason: finalReason, warning_count: warningCount ?? 0 },
      });
    }

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
    try {
      const errSupabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await logError(errSupabase, "edge_function:delete-user-account", err);
    } catch (logErr) {
      console.error("Failed to log error (non-fatal):", logErr);
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
