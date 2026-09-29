#!/usr/bin/env node
/**
 * Deployment readiness check for SmartClass Zambia (SRS Chapter 14).
 *
 * This does NOT deploy anything — it can't, from a sandboxed build
 * environment, and it shouldn't run with production secrets in CI without
 * review. It just verifies the things that are easy to get wrong before a
 * deploy: env vars present, migrations in order, no obviously-missing
 * Edge Function secrets referenced in code but undocumented.
 *
 * Run with: node scripts/check-deploy-readiness.js
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;
let warnings = 0;

function ok(msg) { console.log(`  \x1b[32m\u2713\x1b[0m ${msg}`); }
function fail(msg) { console.log(`  \x1b[31m\u2717\x1b[0m ${msg}`); failures++; }
function warn(msg) { console.log(`  \x1b[33m!\x1b[0m ${msg}`); warnings++; }

console.log('\nSmartClass Zambia — deployment readiness check\n');

// 1. Frontend env vars
console.log('Frontend environment (.env):');
const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  fail('.env is missing — copy .env.example and fill in your Supabase project values.');
} else {
  const env = fs.readFileSync(envPath, 'utf8');
  ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].forEach((key) => {
    if (new RegExp(`^${key}=.+$`, 'm').test(env)) ok(`${key} is set`);
    else fail(`${key} is missing from .env`);
  });
}

// 2. Migrations are present and in a sane chronological order
console.log('\nDatabase migrations:');
const migrationsDir = path.join(root, 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir)) {
  fail('supabase/migrations/ directory not found.');
} else {
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    fail('No .sql migration files found.');
  } else {
    ok(`${files.length} migration(s) found, will run in this order:`);
    files.forEach((f) => console.log(`      ${f}`));
    warn('Run these against your Supabase project with `supabase db push`, the Supabase CLI, or pasted into the SQL editor in order — this script does not run them for you.');
  }
}

// 3. Edge Functions present, and a reminder about their secrets
console.log('\nEdge Functions:');
const functionsDir = path.join(root, 'supabase', 'functions');
if (!fs.existsSync(functionsDir)) {
  fail('supabase/functions/ directory not found.');
} else {
  const fns = fs.readdirSync(functionsDir)
    .filter((f) => fs.statSync(path.join(functionsDir, f)).isDirectory())
    .filter((f) => f !== '_shared'); // shared code, imported by the real functions — not deployable on its own
  fns.forEach((fn) => ok(`${fn} found — deploy with: supabase functions deploy ${fn}`));
  if (fs.existsSync(path.join(functionsDir, '_shared'))) {
    ok('_shared/ found — not a function itself; the Supabase CLI bundles it automatically when deploying the functions that import it.');
  }
  warn('Edge Function secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, RESEND_API_KEY, EMAIL_FROM) are NOT read from .env — set them via `supabase secrets set` or the dashboard. See .env.example for the full list.');
  warn('Email notifications also need one-time Postgres setup (app.settings.supabase_url / app.settings.supabase_service_role_key, pg_net + pg_cron enabled) — see the header comment in 20260720080000_email_notifications.sql.');
}

// 4. Netlify config
console.log('\nHosting config:');
if (fs.existsSync(path.join(root, 'netlify.toml'))) ok('netlify.toml found');
else warn('netlify.toml not found — required if deploying to Netlify.');

console.log(`\n${failures === 0 ? 'Ready' : 'Not ready'}: ${failures} failing check(s), ${warnings} warning(s).\n`);
process.exit(failures > 0 ? 1 : 0);
