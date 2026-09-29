#!/usr/bin/env node
/**
 * Deployment smoke test for public routes and the authenticated tutor contract.
 * Public checks always run. The tutor check runs when E2E_TEST_EMAIL and
 * E2E_TEST_PASSWORD are supplied in the environment.
 */

const baseUrl = (process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

async function expectRoute(path, expectedStatuses = [200]) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${path} returned HTTP ${response.status}; expected ${expectedStatuses.join(' or ')}`);
  }
  return response;
}

async function checkTutorContract() {
  if (!supabaseUrl || !anonKey || !email || !password) {
    console.log('  Tutor contract: skipped (E2E_TEST_EMAIL/PASSWORD or Supabase env missing)');
    return;
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!authResponse.ok) throw new Error(`Supabase test sign-in returned HTTP ${authResponse.status}`);
  const authData = await authResponse.json();
  if (typeof authData.access_token !== 'string' || !authData.access_token) {
    throw new Error('Supabase test sign-in returned no access token');
  }

  const tutorResponse = await fetch(`${supabaseUrl}/functions/v1/ai-teacher-chat`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${authData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId: 'smoke-test',
      message: 'What is 2 + 2? Please explain briefly.',
      topicName: 'Numbers',
      subjectName: 'Mathematics',
      grade: 1,
      history: [],
    }),
  });
  if (!tutorResponse.ok) throw new Error(`ai-teacher-chat returned HTTP ${tutorResponse.status}`);
  const data = await tutorResponse.json();
  if (typeof data.response !== 'string' || !data.response.trim()) {
    throw new Error('ai-teacher-chat returned an invalid response contract');
  }
  if (data.boardItems !== undefined && !Array.isArray(data.boardItems)) {
    throw new Error('ai-teacher-chat returned invalid boardItems metadata');
  }
  if (data.checkRequired !== undefined && typeof data.checkRequired !== 'boolean') {
    throw new Error('ai-teacher-chat returned invalid checkRequired metadata');
  }
  console.log(`  Tutor contract: passed (${data.source || 'unknown'} response)`);
}

(async () => {
  try {
    await expectRoute('/');
    console.log('  /: passed');
    await expectRoute('/login');
    console.log('  /login: passed');
    await checkTutorContract();
    console.log(`Smoke test passed for ${baseUrl}`);
  } catch (error) {
    console.error(`Smoke test failed: ${error.message}`);
    process.exitCode = 1;
  }
})();
