/* Keep uploaded syllabus topics under the subject and Form of their source material. */

UPDATE public.topics AS topics
SET
  subject_id = materials.subject_id,
  grade = materials.grade
FROM public.content_materials AS materials
WHERE topics.source_material_id = materials.id
  AND materials.subject_id IS NOT NULL
  AND materials.grade IS NOT NULL
  AND (
    topics.subject_id IS DISTINCT FROM materials.subject_id
    OR topics.grade IS DISTINCT FROM materials.grade
  );
