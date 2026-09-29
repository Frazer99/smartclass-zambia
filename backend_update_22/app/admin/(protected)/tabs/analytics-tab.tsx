import { TrendingUp, Target, Award, Activity, Check, X, Bot, CircleAlert, ShieldAlert } from 'lucide-react';

export function AnalyticsTab({
  sessionCount, completedSessionCount, attemptCount, correctAttemptCount,
  avgMastery, masteryDistribution, questionsBySubject, userCount,
  aiTotalMessages, aiFallbackRate, aiConfusionRate, aiTopTopics, aiRateLimitedCount, aiEvalRuns,
  primaryAiProvider, onSetPrimaryProvider,
}: {
  sessionCount: number; completedSessionCount: number;
  attemptCount: number; correctAttemptCount: number;
  avgMastery: number; masteryDistribution: { range: string; count: number }[];
  questionsBySubject: { subject: string; count: number; color: string }[];
  userCount: number;
  aiTotalMessages: number; aiFallbackRate: number; aiConfusionRate: number;
  aiTopTopics: { topic: string; count: number; confusionCount: number }[];
  aiRateLimitedCount: number;
  aiEvalRuns: { id: string; run_at: string; total_cases: number; passed_cases: number; avg_score: number }[];
  primaryAiProvider: string;
  onSetPrimaryProvider: (provider: string) => void;
}) {
  const completionRate = sessionCount > 0 ? Math.round((completedSessionCount / sessionCount) * 100) : 0;
  const accuracy = attemptCount > 0 ? Math.round((correctAttemptCount / attemptCount) * 100) : 0;
  const maxMasteryCount = Math.max(...masteryDistribution.map((m) => m.count), 1);
  const maxQCount = Math.max(...questionsBySubject.map((q) => q.count), 1);

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard value={String(sessionCount)} label="Lesson Sessions" icon={<Activity className="h-4 w-4" />} />
        <MetricCard value={`${completionRate}%`} label="Completion Rate" icon={<Check className="h-4 w-4" />} color="text-teal" />
        <MetricCard value={String(attemptCount)} label="Practice Attempts" icon={<Target className="h-4 w-4" />} color="text-gold" />
        <MetricCard value={`${accuracy}%`} label="Accuracy" icon={<Award className="h-4 w-4" />} color="text-teal" />
        <MetricCard value={`${avgMastery}%`} label="Avg Mastery" icon={<TrendingUp className="h-4 w-4" />} color="text-gold" />
        <MetricCard value={String(userCount)} label="Active Users" icon={<Activity className="h-4 w-4" />} />
      </div>

      {/* Mastery distribution */}
      <div className="card-board p-5">
        <h3 className="font-display text-base font-semibold text-chalk mb-4">Mastery Distribution</h3>
        <div className="space-y-3">
          {masteryDistribution.map((m) => {
            const pct = (m.count / maxMasteryCount) * 100;
            const color = m.range === '81-100%' ? 'hsl(163 34% 36%)' : m.range === '61-80%' ? 'hsl(163 34% 45%)' : m.range === '41-60%' ? 'hsl(41 76% 60%)' : m.range === '21-40%' ? 'hsl(25 80% 55%)' : 'hsl(17 59% 45%)';
            return (
              <div key={m.range} className="flex items-center gap-3">
                <span className="text-xs text-muted-board font-mono-sc w-16 shrink-0">{m.range}</span>
                <div className="flex-1 track"><div className="track-fill" style={{ width: `${pct}%`, background: color }} /></div>
                <span className="text-xs text-chalk font-mono-sc w-8 text-right">{m.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Questions by subject + Accuracy breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-board p-5">
          <h3 className="font-display text-base font-semibold text-chalk mb-4">Questions by Subject</h3>
          <div className="space-y-3">
            {questionsBySubject.map((s) => {
              const pct = (s.count / maxQCount) * 100;
              return (
                <div key={s.subject} className="flex items-center gap-3">
                  <span className="text-xs text-muted-board w-24 shrink-0 truncate">{s.subject}</span>
                  <div className="flex-1 track"><div className="track-fill" style={{ width: `${pct}%`, background: s.color }} /></div>
                  <span className="text-xs text-chalk font-mono-sc w-8 text-right">{s.count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-board p-5">
          <h3 className="font-display text-base font-semibold text-chalk mb-4">Accuracy Breakdown</h3>
          <div className="flex items-center justify-center py-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(163 34% 36%)" strokeWidth="3"
                  strokeDasharray={`${accuracy}, 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono-sc text-2xl font-bold text-chalk">{accuracy}%</span>
                <span className="text-xs text-muted-board">accuracy</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-mono-sc text-lg font-bold text-teal">{correctAttemptCount}</p>
              <p className="text-xs text-muted-board">Correct</p>
            </div>
            <div className="text-center">
              <p className="font-mono-sc text-lg font-bold text-rust">{attemptCount - correctAttemptCount}</p>
              <p className="text-xs text-muted-board">Incorrect</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Teaching Insights — continuous learning pipeline (SRS 12.17) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-semibold text-chalk">AI Teaching Insights</h3>
          <span className="text-xs text-muted-board">From the last 1,000 teaching conversations, across all five personas</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <MetricCard value={String(aiTotalMessages)} label="AI Messages Logged" icon={<Bot className="h-4 w-4" />} />
          <MetricCard value={`${aiFallbackRate}%`} label="Fallback Rate (no AI provider)" icon={<Activity className="h-4 w-4" />} color={aiFallbackRate > 20 ? 'text-rust' : 'text-teal'} />
          <MetricCard value={`${aiConfusionRate}%`} label="Confusion Signals" icon={<CircleAlert className="h-4 w-4" />} color={aiConfusionRate > 30 ? 'text-rust' : 'text-gold'} />
          <MetricCard value={String(aiRateLimitedCount)} label="Rate Limited" icon={<ShieldAlert className="h-4 w-4" />} color={aiRateLimitedCount > 10 ? 'text-rust' : 'text-chalk'} />
        </div>

        <div className="card-board p-5 mb-4">
          <h4 className="font-display text-sm font-semibold text-chalk mb-1">AI Provider</h4>
          <p className="text-xs text-muted-board mb-3">
            Which provider ai-teacher-chat tries first for generating teaching responses. If the preferred
            provider isn&apos;t configured or fails, it automatically falls back to the other one — this only
            controls which is tried first, not which is allowed. Doesn&apos;t affect content moderation or search
            (embeddings), both of which stay on OpenAI regardless, since Anthropic doesn&apos;t offer a public
            equivalent for either.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onSetPrimaryProvider('openai')}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${primaryAiProvider === 'openai' ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}
            >
              OpenAI first
            </button>
            <button
              onClick={() => onSetPrimaryProvider('anthropic')}
              className={`text-sm px-4 py-2 rounded-lg border transition-colors ${primaryAiProvider === 'anthropic' ? 'border-gold text-gold bg-gold/10' : 'border-white/10 text-muted-board hover:text-chalk'}`}
            >
              Anthropic (Claude) first
            </button>
          </div>
        </div>

        <div className="card-board p-5">
          <h4 className="font-display text-sm font-semibold text-chalk mb-1">Most-discussed topics</h4>
          <p className="text-xs text-muted-board mb-4">
            High confusion counts here are a signal to review that topic&apos;s lesson content or add more
            content_materials for the AI to draw on.
          </p>
          {aiTopTopics.length === 0 ? (
            <p className="text-sm text-muted-board">No AI conversations logged yet.</p>
          ) : (
            <div className="space-y-3">
              {aiTopTopics.map((t) => {
                const confusionPct = t.count > 0 ? Math.round((t.confusionCount / t.count) * 100) : 0;
                return (
                  <div key={t.topic} className="flex items-center gap-3">
                    <span className="text-xs text-chalk w-40 shrink-0 truncate">{t.topic}</span>
                    <div className="flex-1 track">
                      <div className="track-fill" style={{ width: `${confusionPct}%`, background: confusionPct > 30 ? 'hsl(17 59% 45%)' : 'hsl(41 76% 60%)' }} />
                    </div>
                    <span className="text-xs text-muted-board font-mono-sc w-28 text-right shrink-0">
                      {t.count} msgs &middot; {confusionPct}% confused
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* AI Evaluation Suite history (SRS 12.16) — populated by
          scripts/run-ai-evaluation.js, run outside the app. */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base font-semibold text-chalk">AI Evaluation History</h3>
          <span className="text-xs text-muted-board">Run with: npm run eval:ai</span>
        </div>
        <div className="card-board p-5">
          {aiEvalRuns.length === 0 ? (
            <p className="text-sm text-muted-board">
              No evaluation runs yet. Run <code className="text-gold">npm run eval:ai</code> from a machine with
              network access to your Supabase project and OpenAI to test Mr. Chomba's answer accuracy, teaching
              quality, and curriculum alignment against real curriculum test cases — results will show up here.
            </p>
          ) : (
            <div className="space-y-2">
              {aiEvalRuns.map((run) => {
                const passRate = Math.round((run.passed_cases / run.total_cases) * 100);
                return (
                  <div key={run.id} className="flex items-center gap-3 text-sm">
                    <span className="text-muted-board font-mono-sc w-36 shrink-0">
                      {new Date(run.run_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex-1 track">
                      <div className="track-fill" style={{ width: `${run.avg_score}%`, background: run.avg_score >= 70 ? 'hsl(158 30% 45%)' : 'hsl(17 59% 45%)' }} />
                    </div>
                    <span className="text-chalk font-mono-sc w-20 text-right shrink-0">{run.avg_score}/100</span>
                    <span className="text-muted-board font-mono-sc w-20 text-right shrink-0">{run.passed_cases}/{run.total_cases} passed</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ value, label, icon, color = 'text-chalk' }: { value: string; label: string; icon: React.ReactNode; color?: string }) {
  return (
    <div className="card-board px-4 py-3 min-w-[120px]">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>{icon}</div>
      <div className="font-mono-sc text-xl font-bold text-chalk">{value}</div>
      <div className="text-xs text-muted-board">{label}</div>
    </div>
  );
}
