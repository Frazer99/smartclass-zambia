#!/usr/bin/env node
/**
 * AI Evaluation Suite (SRS 12.16) — runs scripts/eval/test-cases.js
 * against a REAL, deployed ai-teacher-chat Edge Function (not a mock),
 * scores each response, prints a report, and optionally persists results
 * to ai_eval_runs / ai_eval_results so quality can be tracked over time.
 *
 * This cannot be run from inside the build sandbox that produced it — it
 * needs network access to a live Supabase project and (for full scoring)
 * OpenAI. It's meant to run from a developer machine or CI.
 *
 * Usage:
 *   node scripts/run-ai-evaluation.js
 *
 * Required env vars (reads the same .env your Next.js app uses, plus two more):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY  — already in .env
 *   EVAL_TEST_EMAIL, EVAL_TEST_PASSWORD                       — a real pupil
 *     account this script signs in as, so it exercises ai-teacher-chat
 *     exactly the way a pupil's browser does (same auth, same rate limits
 *     — see below). Create one via /register if you don't have one yet.
 *
 * Optional env vars:
 *   OPENAI_API_KEY        — enables LLM-judge scoring (see scoreWithLLMJudge
 *     below) alongside the heuristic checks. Without it, only heuristic
 *     scoring runs — still meaningful, just less nuanced on teaching_quality.
 *   SUPABASE_SERVICE_ROLE_KEY — if set, persists this run's results to
 *     ai_eval_runs/ai_eval_results (bypasses RLS; never used for anything
 *     except this write). Without it, the script still runs and prints a
 *     report, it just doesn't save history.
 *   EVAL_PASS_THRESHOLD   — score (0-100) a case must reach to count as
 *     "passed." Default 70.
 *
 * Respects the rate limits added to ai-teacher-chat — this script pauses
 * briefly between cases so a full run doesn't trip its own 8/minute burst
 * limit and get 429s instead of real answers to score.
 */

const { createClient } = require('@supabase/supabase-js');
const { cases } = require('./eval/test-cases');
const fs = require('fs');
const path = require('path');

// Minimal .env loader, no dependency added — Next.js loads .env
// automatically for the app itself, but a standalone `node` script like
// this one doesn't get that for free. Only fills in keys that aren't
// already set in the real environment, so a real `export FOO=bar` (e.g.
// in CI) always wins over anything in .env.
function loadDotEnvIfPresent() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}
loadDotEnvIfPresent();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const EVAL_EMAIL = process.env.EVAL_TEST_EMAIL;
const EVAL_PASSWORD = process.env.EVAL_TEST_PASSWORD;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASS_THRESHOLD = Number(process.env.EVAL_PASS_THRESHOLD || 70);
const DELAY_BETWEEN_CASES_MS = 4000; // keeps well under the 8/minute chat rate limit

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (require.main === module) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (same values as your .env).');
  }
  if (!EVAL_EMAIL || !EVAL_PASSWORD) {
    fail('EVAL_TEST_EMAIL and EVAL_TEST_PASSWORD must be set — a real pupil account this script signs in as. Create one via /register if needed.');
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Heuristic scoring — no API calls, deterministic, always runs. */
function scoreHeuristically(testCase, response) {
  const notes = [];
  let checksRun = 0;
  let checksPassed = 0;
  const text = response || '';
  const lower = text.toLowerCase();

  if (testCase.mustContain) {
    checksRun++;
    const hit = testCase.mustContain.some((s) => lower.includes(s.toLowerCase()));
    if (hit) checksPassed++;
    notes.push(hit ? 'contains an expected answer/phrase' : `missing all of: ${testCase.mustContain.join(' | ')}`);
  }
  if (testCase.mustNotContain) {
    checksRun++;
    const hit = testCase.mustNotContain.some((s) => lower.includes(s.toLowerCase()));
    if (!hit) checksPassed++;
    notes.push(hit ? `contains a disallowed phrase` : 'avoids disallowed phrases');
  }
  if (testCase.minLength) {
    checksRun++;
    const longEnough = text.trim().length >= testCase.minLength;
    if (longEnough) checksPassed++;
    notes.push(longEnough ? `length OK (${text.trim().length} chars)` : `too short (${text.trim().length} < ${testCase.minLength} chars) — looks like a bare answer, not an explanation`);
  }

  const score = checksRun === 0 ? 100 : Math.round((checksPassed / checksRun) * 100);
  return { score, notes: notes.join('; ') };
}

/**
 * Optional second opinion: asks OpenAI to grade the response against the
 * category's rubric. This is the closer analogue to SRS 12.16's "does the
 * AI explain clearly?" — a string-match can catch a missing answer or a
 * one-line non-explanation, but genuinely judging explanation quality
 * needs something that can actually read the response.
 */
async function scoreWithLLMJudge(testCase, response) {
  if (!OPENAI_API_KEY || !response) return null;

  const rubric = {
    accuracy: 'Is the final answer/value in this response mathematically correct for the question asked? Score 0 (wrong) to 100 (correct).',
    teaching_quality: 'Does this response teach the concept clearly — showing working/steps, using plain language appropriate for a Form 1-6 pupil, and an encouraging tone — rather than just stating an answer? Score 0 (poor) to 100 (excellent).',
    curriculum_alignment: 'Does this response stay relevant to the Zambian Mathematics/Physics curriculum and the question asked, using locally relevant examples where natural, rather than drifting off-topic? Score 0 (off-topic/irrelevant) to 100 (well-aligned).',
  }[testCase.category];

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are grading an AI tutor's response. ${rubric} Reply with ONLY a JSON object: {"score": <0-100 integer>, "reason": "<one short sentence>"}. No markdown, no other text.` },
          { role: 'user', content: `Question: ${testCase.message}\n\nAI tutor's response: ${response}` },
        ],
        max_tokens: 100,
        temperature: 0,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (typeof parsed.score === 'number') return parsed;
    return null;
  } catch {
    return null; // never blocks the run — heuristic score still stands alone
  }
}

async function callAiTeacherChat(accessToken, testCase) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-teacher-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      sessionId: 'eval-run',
      message: testCase.message,
      topicName: testCase.topicName,
      subjectName: testCase.subjectName,
      grade: testCase.grade,
      history: [],
    }),
  });
  if (res.status === 429) {
    return { error: 'rate_limited', response: null };
  }
  if (!res.ok) {
    return { error: `HTTP ${res.status}`, response: null };
  }
  const data = await res.json();
  if (
    !data ||
    typeof data.response !== 'string' ||
    !data.response.trim() ||
    (data.boardItems !== undefined && !Array.isArray(data.boardItems)) ||
    (data.checkRequired !== undefined && typeof data.checkRequired !== 'boolean')
  ) {
    return { error: 'invalid_response_contract', response: null };
  }
  return { error: null, response: data.response, source: data.source };
}

async function main() {
  console.log(`\nSmartClass Zambia — AI Evaluation Suite (${cases.length} cases)\n`);
  if (!OPENAI_API_KEY) console.log('  (OPENAI_API_KEY not set — running heuristic scoring only, no LLM-judge pass)\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: EVAL_EMAIL, password: EVAL_PASSWORD });
  if (authError || !authData.session) {
    fail(`Could not sign in as EVAL_TEST_EMAIL: ${authError?.message || 'no session returned'}`);
  }
  const accessToken = authData.session.access_token;

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i];
    process.stdout.write(`  [${i + 1}/${cases.length}] ${testCase.id}... `);

    const { error, response, source } = await callAiTeacherChat(accessToken, testCase);
    if (error) {
      console.log(`SKIPPED (${error})`);
      results.push({ ...testCase, response: null, score: 0, passed: false, notes: `Request failed: ${error}` });
      if (i < cases.length - 1) await sleep(DELAY_BETWEEN_CASES_MS);
      continue;
    }

    const heuristic = scoreHeuristically(testCase, response);
    const judged = await scoreWithLLMJudge(testCase, response);
    const finalScore = judged ? Math.round((heuristic.score + judged.score) / 2) : heuristic.score;
    const passed = finalScore >= PASS_THRESHOLD;

    const notes = judged ? `${heuristic.notes}; LLM judge: ${judged.reason} (${judged.score})` : heuristic.notes;
    console.log(`${passed ? 'PASS' : 'FAIL'} (${finalScore}, source: ${source})`);

    results.push({ ...testCase, response, score: finalScore, passed, notes });
    if (i < cases.length - 1) await sleep(DELAY_BETWEEN_CASES_MS);
  }

  // ---- report ----
  const byCategory = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = [];
    byCategory[r.category].push(r);
  }

  console.log('\n--- Results by category ---');
  for (const [category, rows] of Object.entries(byCategory)) {
    const avg = Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length);
    const passedCount = rows.filter((r) => r.passed).length;
    console.log(`  ${category}: ${passedCount}/${rows.length} passed, avg score ${avg}`);
  }

  const failedCases = results.filter((r) => !r.passed);
  if (failedCases.length > 0) {
    console.log('\n--- Failures ---');
    failedCases.forEach((r) => console.log(`  ✗ ${r.id} (${r.score}): ${r.notes}`));
  }

  const totalCases = results.length;
  const passedCases = results.filter((r) => r.passed).length;
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalCases);
  console.log(`\n=== ${passedCases}/${totalCases} passed, average score ${avgScore}/100 (threshold: ${PASS_THRESHOLD}) ===\n`);

  // ---- optional persistence ----
  if (SERVICE_ROLE_KEY) {
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
      const { data: run, error: runError } = await admin
        .from('ai_eval_runs')
        .insert({ total_cases: totalCases, passed_cases: passedCases, avg_score: avgScore })
        .select()
        .single();
      if (runError) throw runError;
      await admin.from('ai_eval_results').insert(
        results.map((r) => ({
          run_id: run.id, case_id: r.id, category: r.category, question: r.message,
          response: r.response, passed: r.passed, score: r.score, notes: r.notes,
        }))
      );
      console.log(`Saved to ai_eval_runs (id: ${run.id}) — view history in the admin Analytics tab.\n`);
    } catch (e) {
      console.error(`Warning: failed to persist results (run report above is still valid): ${e.message}\n`);
    }
  } else {
    console.log('SUPABASE_SERVICE_ROLE_KEY not set — results printed above only, not saved to history.\n');
  }

  process.exit(passedCases / totalCases >= 0.7 ? 0 : 1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('\nEvaluation run crashed:', e);
    process.exit(1);
  });
}

module.exports = { scoreHeuristically };
