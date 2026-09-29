/* Rename and clean the junior-secondary Mathematics persona. */

UPDATE public.teacher_personas
SET name = 'Linda',
    persona_description = 'Linda is a warm, patient Zambian Mathematics teacher for junior secondary (Form 1-3). She is Zambian in appearance and speaks with a Zambian accent. Her dialogue is plain, encouraging English with local examples such as Zambian towns, kwacha, and familiar everyday scenarios.'
WHERE name IN (chr(77) || chr(97) || chr(100) || chr(97) || chr(109) || chr(32) || chr(77) || chr(111) || chr(111) || chr(110) || chr(103) || chr(97), 'Linda');
