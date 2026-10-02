DROP FUNCTION IF EXISTS public.match_content_materials(vector, integer, uuid, integer);
DROP FUNCTION IF EXISTS public.match_search_index(vector, integer, integer);
DROP FUNCTION IF EXISTS public.match_past_paper_questions(vector, integer);

CREATE OR REPLACE FUNCTION public.match_content_materials(
  query_embedding vector(1536),
  match_grade integer DEFAULT NULL,
  match_subject_id uuid DEFAULT NULL,
  match_topic_id uuid DEFAULT NULL,
  match_count integer DEFAULT 4
)
RETURNS TABLE (id uuid, title text, source text, material_type text, content_summary text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT cm.id, cm.title, cm.source, cm.material_type, cm.content_summary,
    1 - (cm.embedding <=> query_embedding) AS similarity
  FROM public.content_materials cm
  WHERE cm.embedding IS NOT NULL
    AND (match_grade IS NULL OR cm.grade = match_grade)
    AND (match_subject_id IS NULL OR cm.subject_id = match_subject_id)
    AND (match_topic_id IS NULL OR cm.topic_id = match_topic_id)
    AND cm.status IN ('approved', 'ingested')
  ORDER BY
    CASE WHEN match_topic_id IS NOT NULL AND cm.topic_id = match_topic_id THEN 0 ELSE 1 END,
    cm.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_search_index(
  query_embedding vector(1536),
  match_grade integer DEFAULT NULL,
  match_subject_id uuid DEFAULT NULL,
  match_topic_id uuid DEFAULT NULL,
  match_count integer DEFAULT 4
)
RETURNS TABLE (id uuid, display_title text, description text, item_type text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT si.id, si.display_title, si.description, si.item_type,
    1 - (si.embedding <=> query_embedding) AS similarity
  FROM public.search_index si
  WHERE si.embedding IS NOT NULL
    AND (match_grade IS NULL OR si.grade = match_grade)
    AND (match_subject_id IS NULL OR si.subject_id = match_subject_id)
    AND (match_topic_id IS NULL OR si.topic_id = match_topic_id)
  ORDER BY si.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_past_paper_questions(
  query_embedding vector(1536),
  match_grade integer DEFAULT NULL,
  match_subject_id uuid DEFAULT NULL,
  match_topic_id uuid DEFAULT NULL,
  match_count integer DEFAULT 2
)
RETURNS TABLE (id uuid, question_text text, explanation text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT ppq.id, ppq.question_text, ppq.explanation,
    1 - (ppq.embedding <=> query_embedding) AS similarity
  FROM public.past_paper_questions ppq
  JOIN public.past_papers pp ON pp.id = ppq.past_paper_id
  WHERE ppq.embedding IS NOT NULL
    AND ppq.explanation IS NOT NULL
    AND (match_grade IS NULL OR pp.grade - 7 = match_grade OR pp.grade = match_grade)
    AND (match_subject_id IS NULL OR pp.subject_id = match_subject_id)
    AND (match_topic_id IS NULL OR ppq.topic_id = match_topic_id)
  ORDER BY
    CASE WHEN match_topic_id IS NOT NULL AND ppq.topic_id = match_topic_id THEN 0 ELSE 1 END,
    ppq.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_content_materials(vector, integer, uuid, uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_search_index(vector, integer, uuid, uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_past_paper_questions(vector, integer, uuid, uuid, integer) TO anon, authenticated, service_role;