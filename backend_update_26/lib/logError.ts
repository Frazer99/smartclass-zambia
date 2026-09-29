import { supabase } from './supabase-client';

/**
 * Client-side counterpart to the Edge Functions' logError() —
 * writes to the same app_error_log table (migration 20260804080000).
 * Never throws; a logging failure shouldn't compound whatever error
 * triggered the log in the first place.
 */
export async function logClientError(source: string, error: unknown, context: Record<string, unknown> = {}) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('app_error_log').insert({
      source,
      error_message: message,
      error_context: context,
      user_id: session?.user?.id || null,
      severity: 'error',
    });
  } catch (e) {
    console.error(`Failed to log client error for source "${source}" (non-fatal):`, e);
  }
}
