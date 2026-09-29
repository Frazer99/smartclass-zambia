/* Give existing lessons an explicit 40-60 minute teaching contract. */
UPDATE public.lessons
SET content = content || jsonb_build_object(
  'estimatedMinutes', 50,
  'objectives', COALESCE(
    content->'objectives',
    jsonb_build_array(
      'Explain the key ideas in this lesson using correct vocabulary.',
      'Apply the method to a worked example and a new problem.',
      'Check your reasoning and explain why each step is valid.'
    )
  ),
  'realWorldExamples', COALESCE(
    content->'realWorldExamples',
    COALESCE(
      (SELECT jsonb_agg(example->>'problem')
       FROM jsonb_array_elements(COALESCE(content->'examples', '[]'::jsonb)) AS example),
      '[]'::jsonb
    )
  ),
  'guidedPractice', COALESCE(
    content->'guidedPractice',
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'prompt', example->>'problem',
        'answer', example->>'solution',
        'explanation', 'Try the first step before checking the worked solution.'
      )) FROM jsonb_array_elements(COALESCE(content->'examples', '[]'::jsonb)) AS example),
      '[]'::jsonb
    )
  ),
  'independentPractice', COALESCE(content->'independentPractice', '[]'::jsonb),
  'exitTicket', COALESCE(
    content->'exitTicket',
    jsonb_build_object(
      'prompt', 'Explain the main rule in your own words and solve one new example without looking at the worked solution.',
      'answer', null,
      'explanation', 'A strong answer states the rule, shows the steps, and checks the result.'
    )
  )
)
WHERE content IS NOT NULL;