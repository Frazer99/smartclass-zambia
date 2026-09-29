-- Pin SECURITY DEFINER dashboard functions to the application schema.
-- This preserves the existing RPC signatures while preventing search_path hijacking.

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.sync_parent_child_links() SET search_path = public;
ALTER FUNCTION public.trigger_sync_parent_links() SET search_path = public;
ALTER FUNCTION public.get_my_children() SET search_path = public;
ALTER FUNCTION public.get_child_progress(uuid) SET search_path = public;
ALTER FUNCTION public.get_school_topic_analytics(text, integer) SET search_path = public;
ALTER FUNCTION public.get_common_misconceptions(text, integer, uuid) SET search_path = public;
ALTER FUNCTION public.recompute_topic_mastery(uuid, uuid) SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_school_topic_analytics(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_common_misconceptions(text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_child_progress(uuid) TO authenticated;
