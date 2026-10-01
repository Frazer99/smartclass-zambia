'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { ArrowRight, Mic, PenTool, TrendingUp, MapPin, BookOpen, Sparkles, Mail, Phone } from 'lucide-react';
import { Wordmark, LogoMark } from '@/components/brand/Logo';

const FEATURE_ITEMS = [
  { icon: Mic, title: 'Voice Interactive', desc: 'Your AI teacher speaks and listens. Ask questions out loud and get spoken answers.' },
  { icon: PenTool, title: 'Smart Board', desc: 'Watch equations, diagrams, and step-by-step solutions appear on a digital smart board.' },
  { icon: TrendingUp, title: 'Progress Tracking', desc: 'See your mastery grow topic by topic. Get recommendations on what to study next.' },
  { icon: MapPin, title: 'Zambian Context', desc: 'Learn with examples you know — kwacha, mealie meal, local bus routes, and more.' },
  { icon: BookOpen, title: 'Zambian Curriculum Aligned', desc: 'Every lesson maps to the Zambian Curriculum syllabus for your subject and form.' },
  { icon: Sparkles, title: 'SmartTeach Engine', desc: 'An AI engine that teaches like a real teacher — not just a chatbot that answers.' },
] as const;

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [featureIndex, setFeatureIndex] = useState(0);
  const [featureDuration, setFeatureDuration] = useState(20000);

  useEffect(() => {
    if (!loading && user) router.push('/dashboard');
  }, [user, loading, router]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 639px)');
    const updateDuration = () => setFeatureDuration(mobileQuery.matches ? 15000 : 20000);
    updateDuration();
    mobileQuery.addEventListener('change', updateDuration);
    return () => mobileQuery.removeEventListener('change', updateDuration);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFeatureIndex((current) => (current + 1) % FEATURE_ITEMS.length);
    }, featureDuration);
    return () => window.clearInterval(timer);
  }, [featureDuration]);

  return (
    <div className="relative min-h-screen bg-board text-chalk overflow-x-hidden">
      <div className="chalk-noise" />
      <div className="dust" style={{ top: '12%', left: '8%', width: 4, height: 4, animationDelay: '0s' }} />
      <div className="dust" style={{ top: '30%', left: '88%', width: 5, height: 5, animationDelay: '2s' }} />
      <div className="dust" style={{ top: '70%', left: '15%', width: 3, height: 3, animationDelay: '4s' }} />
      <div className="dust" style={{ top: '55%', left: '92%', width: 4, height: 4, animationDelay: '6s' }} />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-4 border-b border-white/10">
          <Wordmark size="nav" />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/login')}
              className="text-[11px] sm:text-sm font-medium text-muted-board hover:text-chalk transition-colors"
            >
              Log In
            </button>
            <button onClick={() => router.push('/register')} className="btn-gold text-[11px] sm:text-sm px-2.5 sm:px-4 py-1 sm:py-2">
              Get Started <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-10 sm:pb-14 text-center">
          <Wordmark size="lg" className="justify-center" />
          <svg className="mx-auto mt-2 mb-4 sm:mb-6" width="180" height="12" viewBox="0 0 220 14">
            <path d="M2 10 Q 55 -2, 110 8 T 218 6" fill="none" stroke="hsl(41 76% 60%)" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p className="font-hand text-xl sm:text-2xl text-muted-board leading-snug mb-5 sm:mb-8">
            Your AI teacher, anytime, anywhere.
          </p>
          <p className="text-chalk/70 text-sm sm:text-base max-w-xl mx-auto mb-6 sm:mb-10">
            Learn Form 1–6 Mathematics (plus Science, Physics, and Chemistry) with an AI
            teacher that speaks, listens, and adapts to your pace — aligned to the
            Zambian Curriculum.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => router.push('/register')} className="btn-gold px-8 py-3 text-base">
              Start Learning Free <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-3 border-2 border-chalk/30 rounded-lg text-chalk font-semibold hover:border-chalk/60 transition-colors text-base"
            >
              I already have an account
            </button>
          </div>
        </section>

        {/* Features */}
        <section className="w-full overflow-hidden py-8 sm:py-10">
          <div className="min-h-[156px] flex items-center justify-center">
            {(() => {
              const feature = FEATURE_ITEMS[featureIndex];
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="card-board feature-card w-[min(32rem,calc(100vw-2rem))] p-4 sm:p-5"
                  aria-live="polite"
                >
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center text-gold mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display font-semibold text-chalk mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-board">{feature.desc}</p>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Forms */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <h2 className="font-display text-2xl font-semibold text-center mb-2">Form 1–6</h2>
          <p className="text-muted-board text-center mb-8 text-sm">
            Science and Mathematics for Form 1–3; Mathematics, Physics, and Chemistry for
            Form 4–6 — covering the full Zambian Curriculum, Junior to Senior Secondary.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { grade: 1, stage: 'Junior Secondary', topics: 'Integers, Algebra, Basic Science' },
              { grade: 2, stage: 'Junior Secondary', topics: 'Linear Equations, Ratios, Science' },
              { grade: 3, stage: 'Junior Secondary', topics: 'Geometry, Statistics, Science' },
              { grade: 4, stage: 'Senior Secondary', topics: 'Quadratics, Physics, Chemistry' },
              { grade: 5, stage: 'Senior Secondary', topics: 'Trigonometry, Physics, Chemistry' },
              { grade: 6, stage: 'Senior Secondary — Exam Prep', topics: 'Calculus, Advanced Physics, Past Papers' },
            ].map((g) => (
              <div key={g.grade} className="card-topic p-4 text-center">
                <div className="w-11 h-11 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-2 font-display text-lg font-bold text-ink">
                  {g.grade}
                </div>
                <p className="text-xs font-bold text-ink">Form {g.grade}</p>
                <p className="text-[11px] text-ink/60 mb-1">{g.stage}</p>
                <p className="text-[11px] text-ink/50">{g.topics}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="card-board p-6 sm:p-12 text-center">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-chalk mb-3">
              Ready to start learning?
            </h2>
            <p className="text-muted-board mb-7 max-w-md mx-auto">
              Create your free account, pick your grade, and start your first lesson in minutes.
            </p>
            <button onClick={() => router.push('/register')} className="btn-gold px-8 py-3 text-base">
              Create Free Account <ArrowRight className="inline h-4 w-4 ml-1" />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 py-6 text-center text-sm text-muted-board">
          <span className="inline-flex items-center gap-1.5 align-middle">
            <LogoMark size={16} />
            <span className="font-display font-semibold text-chalk">SmartClass Zambia</span>
          </span>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
            <span className="text-muted-board">Contact us:</span>
            <a href="mailto:smartclasszambia@gmail.com" className="inline-flex items-center gap-1 text-gold hover:text-chalk transition-colors">
              <Mail className="h-3.5 w-3.5" /> smartclasszambia@gmail.com
            </a>
            <a href="https://wa.me/260772585201" className="inline-flex items-center gap-1 text-gold hover:text-chalk transition-colors" target="_blank" rel="noreferrer">
              WhatsApp/calls: 0772585201
            </a>
            <a href="tel:0968866601" className="inline-flex items-center gap-1 text-gold hover:text-chalk transition-colors">
              <Phone className="h-3.5 w-3.5" /> Calls: 0968866601
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
