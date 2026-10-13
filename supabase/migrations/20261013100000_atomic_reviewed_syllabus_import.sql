/* Atomically commit an administrator-reviewed syllabus import. */

CREATE OR REPLACE FUNCTION public.import_reviewed_syllabus(
  p_material_id uuid,
  p_subject_id uuid,
  p_grade integer,
  p_actor_id uuid,
  p_storage_path text,
  p_extracted_text text,
  p_content_summary text,
  p_topics jsonb,
  p_confirmed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material_record public.content_materials%ROWTYPE;
  topic_record jsonb;
  topic_name text;
  topic_reference text;
  topic_level integer;
  topic_parent_index integer;
  topic_id uuid;
  topic_position integer;
  existing_topic boolean;
  topics_created integer := 0;
  lessons_created integer := 0;
BEGIN
  IF NOT p_confirmed THEN
    RAISE EXCEPTION 'Syllabus import requires explicit confirmation';
  END IF;
  IF p_material_id IS NULL OR p_subject_id IS NULL OR p_grade IS NULL THEN
    RAISE EXCEPTION 'Material, subject, and Form are required';
  END IF;
  IF p_actor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_actor_id
      AND (role = 'admin' OR (role = 'teacher' AND teacher_approved = true))
  ) THEN
    RAISE EXCEPTION 'Admin or approved teacher access required';
  END IF;
  IF p_extracted_text IS NULL OR btrim(p_extracted_text) = '' THEN
    RAISE EXCEPTION 'Extracted syllabus text is required';
  END IF;
  IF jsonb_typeof(p_topics) <> 'array' OR jsonb_array_length(p_topics) = 0 THEN
    RAISE EXCEPTION 'At least one reviewed syllabus topic is required';
  END IF;

  SELECT * INTO material_record
  FROM public.content_materials
  WHERE id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Material record was not found';
  END IF;
  IF material_record.material_type NOT IN ('syllabus', 'curriculum') THEN
    RAISE EXCEPTION 'Material is not a syllabus or curriculum record';
  END IF;
  IF material_record.subject_id IS NOT NULL AND material_record.subject_id <> p_subject_id THEN
    RAISE EXCEPTION 'Subject does not match the material record';
  END IF;
  IF material_record.grade IS NOT NULL AND material_record.grade <> p_grade THEN
    RAISE EXCEPTION 'Form does not match the material record';
  END IF;

  CREATE TEMP TABLE import_topic_map (
    position integer PRIMARY KEY,
    topic_id uuid NOT NULL,
    is_new boolean NOT NULL
  ) ON COMMIT DROP;

  topic_position := 0;
  FOR topic_record IN SELECT value FROM jsonb_array_elements(p_topics)
  LOOP
    topic_position := topic_position + 1;
    topic_name := regexp_replace(btrim(topic_record->>'name'), '\s+', ' ', 'g');
    topic_reference := NULLIF(btrim(topic_record->>'reference'), '');
    topic_level := GREATEST(0, LEAST(10, COALESCE((topic_record->>'level')::integer, 0)));
    topic_parent_index := NULLIF(topic_record->>'parentIndex', '')::integer;

    IF topic_name IS NULL OR char_length(topic_name) < 2 OR char_length(topic_name) > 160 THEN
      RAISE EXCEPTION 'Reviewed topic at position % has an invalid name', topic_position;
    END IF;
    IF topic_parent_index IS NOT NULL AND (topic_parent_index < 0 OR topic_parent_index >= topic_position - 1) THEN
      RAISE EXCEPTION 'Reviewed topic % has an invalid parent index', topic_name;
    END IF;
    IF EXISTS (
      SELECT 1 FROM import_topic_map m
      JOIN public.topics t ON t.id = m.topic_id
      WHERE lower(regexp_replace(t.name, '\s+', ' ', 'g')) = lower(topic_name)
    ) THEN
      RAISE EXCEPTION 'Reviewed topics contain a duplicate name: %', topic_name;
    END IF;

    SELECT id INTO topic_id
    FROM public.topics
    WHERE subject_id = p_subject_id
      AND grade = p_grade
      AND source_material_id = p_material_id
      AND lower(regexp_replace(name, '\s+', ' ', 'g')) = lower(topic_name)
    LIMIT 1
    FOR UPDATE;

    IF topic_id IS NULL THEN
      SELECT id INTO topic_id
      FROM public.topics
      WHERE subject_id = p_subject_id
        AND grade = p_grade
        AND source_material_id IS NULL
        AND lower(regexp_replace(name, '\s+', ' ', 'g')) = lower(topic_name)
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF topic_id IS NULL AND EXISTS (
      SELECT 1 FROM public.topics
      WHERE subject_id = p_subject_id
        AND grade = p_grade
        AND source_material_id IS NOT NULL
        AND source_material_id <> p_material_id
        AND lower(regexp_replace(name, '\s+', ' ', 'g')) = lower(topic_name)
    ) THEN
      RAISE EXCEPTION 'Topic name already belongs to another syllabus source: %', topic_name;
    END IF;

    existing_topic := topic_id IS NOT NULL;
    IF topic_id IS NULL THEN
      INSERT INTO public.topics (
        subject_id, grade, name, category, syllabus_reference,
        description, display_order, source_material_id
      ) VALUES (
        p_subject_id, p_grade, topic_name,
        CASE WHEN topic_level > 0 THEN 'Subtopic' ELSE 'Topic' END,
        topic_reference,
        'Derived from reviewed syllabus import: ' || topic_name,
        topic_position - 1,
        p_material_id
      )
      RETURNING id INTO topic_id;
      topics_created := topics_created + 1;
      ELSE
        UPDATE public.topics
        SET category = CASE WHEN topic_level > 0 THEN 'Subtopic' ELSE 'Topic' END,
          syllabus_reference = COALESCE(topic_reference, syllabus_reference),
          display_order = topic_position - 1,
          source_material_id = COALESCE(source_material_id, p_material_id)
        WHERE id = topic_id;
    END IF;

    INSERT INTO import_topic_map(position, topic_id, is_new)
    VALUES (topic_position, topic_id, NOT existing_topic);
  END LOOP;

  FOR topic_position IN SELECT position FROM import_topic_map ORDER BY position
  LOOP
    topic_record := p_topics->(topic_position - 1);
    topic_parent_index := NULLIF(topic_record->>'parentIndex', '')::integer;
    UPDATE public.topics child
    SET parent_topic_id = parent.topic_id
    FROM import_topic_map parent
    JOIN import_topic_map child_map ON child_map.position = topic_position
    WHERE child.id = child_map.topic_id
      AND parent.position = topic_parent_index + 1;
    IF topic_parent_index IS NULL THEN
      UPDATE public.topics
      SET parent_topic_id = NULL
      WHERE id = (SELECT child_map.topic_id FROM import_topic_map child_map WHERE child_map.position = topic_position);
    END IF;
  END LOOP;

  FOR topic_id IN SELECT m.topic_id FROM import_topic_map m WHERE m.is_new
  LOOP
    INSERT INTO public.lessons (
      topic_id, title, difficulty, display_order, content
    )
    SELECT
      topic_id,
      'Understanding ' || t.name,
      'standard',
      0,
      jsonb_build_object(
        'intro', 'This lesson is based on the reviewed syllabus topic: ' || t.name || '.',
        'steps', jsonb_build_array(jsonb_build_object(
          'title', t.name,
          'body', 'Let us begin with ' || t.name || '. Ask the teacher about any word, rule, process, or example from this topic.',
          'board', t.name
        )),
        'examples', jsonb_build_array(),
        'summary', 'Review the key ideas in ' || t.name || ' before moving on.'
      )
    FROM public.topics t
    WHERE t.id = topic_id
      AND NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.topic_id = t.id);
    lessons_created := lessons_created + 1;
  END LOOP;

  UPDATE public.content_materials
  SET subject_id = p_subject_id,
      grade = p_grade,
      storage_path = p_storage_path,
      extracted_text = p_extracted_text,
      content_summary = p_content_summary,
      status = 'ingested',
      ingestion_error = NULL,
      needs_review = false,
      reviewed_at = now()
  WHERE id = p_material_id;

  RETURN jsonb_build_object(
    'topics_created', topics_created,
    'lessons_created', lessons_created,
    'topics_reviewed', (SELECT count(*) FROM import_topic_map)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_reviewed_syllabus(uuid, uuid, integer, uuid, text, text, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_reviewed_syllabus(uuid, uuid, integer, uuid, text, text, text, jsonb, boolean) TO service_role;

NOTIFY pgrST, 'reload schema';
