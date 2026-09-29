const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before validating lessons.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const blockingIssues = [];
const warnings = [];

function text(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateLesson(lesson) {
  const content = lesson.content && typeof lesson.content === 'object' ? lesson.content : {};
  const label = `${lesson.title} (${lesson.id})`;
  const steps = Array.isArray(content.steps) ? content.steps : [];
  const examples = Array.isArray(content.examples) ? content.examples : [];
  const applications = Array.isArray(content.realWorldExamples) ? content.realWorldExamples : [];
  const practice = [
    ...(Array.isArray(content.guidedPractice) ? content.guidedPractice : []),
    ...(Array.isArray(content.independentPractice) ? content.independentPractice : []),
  ];

  if (!text(content.intro)) blockingIssues.push(`${label}: missing intro`);
  if (steps.length < 3) blockingIssues.push(`${label}: needs at least 3 teaching steps`);
  if (!text(content.summary)) blockingIssues.push(`${label}: missing summary`);
  if (examples.length < 2) warnings.push(`${label}: add at least 2 worked examples`);
  if (!Array.isArray(content.objectives) || content.objectives.length < 3) warnings.push(`${label}: add 3 learning objectives`);
  if (applications.length < 2) warnings.push(`${label}: add 2 Zambia-relevant real-world examples`);
  if (practice.length < 3) warnings.push(`${label}: add at least 3 practice questions`);
  if (!content.exitTicket?.prompt) warnings.push(`${label}: add an exit ticket`);
  if (content.estimatedMinutes < 40 || content.estimatedMinutes > 60) warnings.push(`${label}: duration should be between 40 and 60 minutes`);
}

(async () => {
  const { data: lessons, error } = await supabase
    .from('lessons')
    .select('id, title, content')
    .order('title');

  if (error) {
    console.error(`Could not load lessons: ${error.message}`);
    process.exit(1);
  }

  for (const lesson of lessons || []) validateLesson(lesson);

  console.log(`Validated ${lessons?.length || 0} lessons.`);
  if (blockingIssues.length) {
    console.error(`\nBlocking issues (${blockingIssues.length}):`);
    blockingIssues.forEach((issue) => console.error(`- ${issue}`));
  }
  if (warnings.length) {
    console.warn(`\nEnrichment warnings (${warnings.length}):`);
    warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
  if (!blockingIssues.length && !warnings.length) console.log('All lessons meet the complete lesson contract.');
  process.exit(blockingIssues.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
