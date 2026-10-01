/* Content materials are system-approved; admin approval is not required. */

UPDATE public.content_materials
SET status = 'approved'
WHERE status = 'pending';

ALTER TABLE public.content_materials
  ALTER COLUMN status SET DEFAULT 'approved';
