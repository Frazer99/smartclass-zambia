/**
 * Writes to app_error_log (migration 20260804080000) — the actually
 * buildable part of "production observability" from this environment.
 * Not a replacement for a real third-party service like Sentry (this
 * build environment can't create that account); a real, queryable
 * record of what broke, when, and for whom, in the same database
 * everything else already lives in.
 *
 * Never throws, never blocks the caller — a logging failure (the
 * insert itself failing) is swallowed and console.error'd, not allowed
 * to cascade into the actual response the pupil/admin is waiting on.
 * The whole point of this function is to make failures visible, not to
 * become a new source of them.
 */
export async function logError(
  supabase: any,
  source: string,
  error: unknown,
  context: Record<string, unknown> = {},
  userId?: string | null
): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("app_error_log").insert({
      source,
      error_message: message,
      error_context: context,
      user_id: userId || null,
      severity: "error",
    });
  } catch (e) {
    console.error(`Failed to write to app_error_log for source "${source}" (non-fatal):`, e);
  }
}
