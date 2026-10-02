-- Keep every material topic inside the material's exact subject and Form.
-- Existing invalid links are detached so their material remains available
-- under its own subject/Form without inheriting another topic's scope.

UPDATE public.content_materials AS materials
SET topic_id = NULL
FROM public.topics AS topics
WHERE materials.topic_id = topics.id
  AND (
    materials.subject_id IS DISTINCT FROM topics.subject_id
    OR materials.grade IS DISTINCT FROM topics.grade
  );

CREATE OR REPLACE FUNCTION public.validate_content_material_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  topic_subject_id uuid;
  topic_grade integer;
BEGIN
  IF NEW.topic_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subject_id, grade
  INTO topic_subject_id, topic_grade
  FROM public.topics
  WHERE id = NEW.topic_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material topic does not exist';
  END IF;

  IF NEW.subject_id IS DISTINCT FROM topic_subject_id
     OR NEW.grade IS DISTINCT FROM topic_grade THEN
    RAISE EXCEPTION 'Material subject and Form must match its topic';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_materials_scope_trigger ON public.content_materials;
CREATE TRIGGER content_materials_scope_trigger
  BEFORE INSERT OR UPDATE OF subject_id, grade, topic_id
  ON public.content_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_content_material_scope();