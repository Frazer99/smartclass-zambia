/*
# Fix rebuild_search_index function

The function had `t.topic_id` instead of `l.topic_id` in the lessons INSERT.
This fixes the bug and rebuilds the index.
*/

CREATE OR REPLACE FUNCTION rebuild_search_index()
RETURNS void AS $$
BEGIN
  DELETE FROM search_index;

  INSERT INTO search_index (subject_id, topic_id, lesson_id, grade, searchable_text, item_type, display_title, description)
  SELECT t.subject_id, t.id, NULL, t.grade,
    lower(coalesce(t.name,'') || ' ' || coalesce(t.category,'') || ' ' || coalesce(t.description,'')),
    'topic', t.name, t.description
  FROM topics t WHERE t.subject_id IS NOT NULL;

  INSERT INTO search_index (subject_id, topic_id, lesson_id, grade, searchable_text, item_type, display_title, description)
  SELECT t.subject_id, l.topic_id, l.id, t.grade,
    lower(coalesce(l.title,'') || ' ' || coalesce(l.searchable_terms,'') || ' ' || coalesce(l.content::text,'')),
    'lesson', l.title, NULL
  FROM lessons l JOIN topics t ON l.topic_id = t.id
  WHERE t.subject_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT rebuild_search_index();
