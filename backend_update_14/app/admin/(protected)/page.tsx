'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase, Subject, Topic, Lesson, LessonContent, ContentMaterial, PracticeQuestion } from '@/lib/supabase-client';
import { Shield, Loader as Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { OverviewTab } from './tabs/overview-tab';
import { AnalyticsTab } from './tabs/analytics-tab';
import { MaterialsTab } from './tabs/materials-tab';
import { LessonsTab } from './tabs/lessons-tab';
import { QuestionsTab } from './tabs/questions-tab';
import { UsersTab } from './tabs/users-tab';
import { CurriculumTab } from './tabs/curriculum-tab';
import { ModerationTab } from './tabs/moderation-tab';
import { SchoolAnalyticsTab } from './tabs/school-analytics-tab';
import { SettingsTab } from './tabs/settings-tab';
import { UserProfile } from './tabs/constants';

type Tab = 'overview' | 'analytics' | 'school-analytics' | 'materials' | 'lessons' | 'questions' | 'users' | 'curriculum' | 'moderation' | 'settings';

type ActivityItem = {
  id: string;
  type: 'lesson_completed' | 'practice_attempt' | 'user_joined';
  user_name: string;
  detail: string;
  timestamp: string;
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'school-analytics', label: 'School Analytics', icon: <School className="h-4 w-4" /> },
  { id: 'materials', label: 'Materials', icon: <FileText className="h-4 w-4" /> },
  { id: 'lessons', label: 'Lessons', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'questions', label: 'Questions', icon: <HelpCircle className="h-4 w-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { id: 'curriculum', label: 'Curriculum', icon: <Layers className="h-4 w-4" /> },
  { id: 'moderation', label: 'Moderation', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

// Import icons used in TABS
import { ChartBar as BarChart3, TrendingUp, FileText, BookOpen, CircleHelp as HelpCircle, Users, Layers, Settings, ShieldAlert, School } from 'lucide-react';

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Shared data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<ContentMaterial[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);

  // Overview
  const [userCount, setUserCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [lessonCount, setLessonCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [usersByGrade, setUsersByGrade] = useState<Record<number, number>>({});
  const [topicsBySubject, setTopicsBySubject] = useState<{ subject: string; count: number; color: string }[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [recentSignups, setRecentSignups] = useState<UserProfile[]>([]);

  // Analytics
  const [sessionCount, setSessionCount] = useState(0);
  const [completedSessionCount, setCompletedSessionCount] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [correctAttemptCount, setCorrectAttemptCount] = useState(0);
  const [avgMastery, setAvgMastery] = useState(0);
  const [masteryDistribution, setMasteryDistribution] = useState<{ range: string; count: number }[]>([]);
  const [questionsBySubject, setQuestionsBySubject] = useState<{ subject: string; count: number; color: string }[]>([]);
  const [aiTotalMessages, setAiTotalMessages] = useState(0);
  const [aiFallbackRate, setAiFallbackRate] = useState(0);
  const [aiConfusionRate, setAiConfusionRate] = useState(0);
  const [aiRateLimitedCount, setAiRateLimitedCount] = useState(0);
  const [aiEvalRuns, setAiEvalRuns] = useState<{ id: string; run_at: string; total_cases: number; passed_cases: number; avg_score: number }[]>([]);
  const [moderationFlags, setModerationFlags] = useState<any[]>([]);
  const [moderationCleanupLog, setModerationCleanupLog] = useState<any[]>([]);
  const [moderationLoading, setModerationLoading] = useState(true);
  const [schoolList, setSchoolList] = useState<{ school: string; pupil_count: number }[]>([]);
  const [schoolTopicAnalytics, setSchoolTopicAnalytics] = useState<any[]>([]);
  const [commonMisconceptions, setCommonMisconceptions] = useState<any[]>([]);
  const [schoolFilter, setSchoolFilter] = useState<string>('');
  const [schoolGradeFilter, setSchoolGradeFilter] = useState<number | null>(null);
  const [schoolAnalyticsLoading, setSchoolAnalyticsLoading] = useState(true);
  const [aiTopTopics, setAiTopTopics] = useState<{ topic: string; count: number; confusionCount: number }[]>([]);

  // Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userGradeFilter, setUserGradeFilter] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [userSessions, setUserSessions] = useState<any[]>([]);

  // Lessons
  const [lessonSearch, setLessonSearch] = useState('');
  const [lessonTopicFilter, setLessonTopicFilter] = useState<string>('');
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonForm, setLessonForm] = useState({
    topic_id: '', title: '', difficulty: 'standard', display_order: 0,
    intro: '', summary: '',
  });

  // Questions
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionTopicFilter, setQuestionTopicFilter] = useState<string>('');
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<PracticeQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState({
    topic_id: '', question_text: '', question_type: 'multiple_choice',
    options: ['', '', '', ''], answer_key: '', explanation: '', difficulty: 'standard',
  });

  // Materials
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ source: string; message: string } | null>(null);
  const [embedding, setEmbedding] = useState(false);
  const [embeddingResult, setEmbeddingResult] = useState<{ embedded: number; failed: number; remaining: number } | null>(null);
  const [form, setForm] = useState({
    title: '', source: '', material_type: 'supplementary', subject_id: '',
    grade: '', source_reference: '', content_summary: '', status: 'pending',
  });

  // Curriculum
  const [curriculumSubjectFilter, setCurriculumSubjectFilter] = useState<string>('');

  useEffect(() => {
    if (!profile) return;
    checkAdmin();
  }, [profile]);

  // Re-run the school-analytics RPCs whenever the filter changes, but not
  // on first mount (isAdmin guards against firing before fetchAll's own
  // initial call, avoiding two overlapping requests for the same data).
  useEffect(() => {
    if (!isAdmin) return;
    fetchSchoolAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolFilter, schoolGradeFilter]);

  const checkAdmin = async () => {
    if (!profile) return;
    const { data } = await supabase.from('profiles').select('role').eq('id', profile.id).maybeSingle();
    if (data?.role !== 'admin') {
      toast.error('Admin access required.');
      router.push('/dashboard');
      return;
    }
    setIsAdmin(true);
    fetchAll();
  };

  const fetchAll = async () => {
    await Promise.all([
      fetchSubjects(), fetchMaterials(), fetchOverview(), fetchAnalytics(), fetchUsers(), fetchCurriculum(), fetchQuestions(), fetchModeration(), fetchSchoolAnalytics(),
    ]);
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('display_order');
    if (data) setSubjects(data as Subject[]);
  };

  const fetchMaterials = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/content-materials`, {
      headers: { ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) },
    });
    if (response.ok) { const { data } = await response.json(); setMaterials(data || []); }
  };

  const fetchOverview = async () => {
    const [usersRes, topicsRes, lessonsRes, questionsRes] = await Promise.all([
      supabase.from('profiles').select('grade, role, full_name, created_at, id'),
      supabase.from('topics').select('id, subject_id, subject:subjects(name, color)'),
      supabase.from('lessons').select('id', { count: 'exact', head: true }),
      supabase.from('practice_questions').select('id', { count: 'exact', head: true }),
    ]);

    setUserCount(usersRes.data?.length || 0);
    setTopicCount(topicsRes.data?.length || 0);
    setLessonCount(lessonsRes.count || 0);
    setQuestionCount(questionsRes.count || 0);

    const gradeMap: Record<number, number> = {};
    (usersRes.data || []).forEach((u: any) => { gradeMap[u.grade] = (gradeMap[u.grade] || 0) + 1; });
    setUsersByGrade(gradeMap);

    const subjMap: Record<string, { count: number; color: string }> = {};
    (topicsRes.data || []).forEach((t: any) => {
      const name = t.subject?.name || 'Unassigned';
      const color = t.subject?.color || '#888';
      if (!subjMap[name]) subjMap[name] = { count: 0, color };
      subjMap[name].count++;
    });
    setTopicsBySubject(Object.entries(subjMap).map(([subject, v]) => ({ subject, count: v.count, color: v.color })));

    const sorted = (usersRes.data || []).slice().sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, 5);
    setRecentSignups(sorted as UserProfile[]);

    // Activity feed
    const [sessionsRes, attemptsRes] = await Promise.all([
      supabase.from('lesson_sessions').select('id, user_id, lesson_id, status, completed_at, lesson:lessons(title)').eq('status', 'completed').order('completed_at', { ascending: false }).limit(10),
      supabase.from('practice_attempts').select('id, user_id, is_correct, created_at, question:practice_questions(question_text)').order('created_at', { ascending: false }).limit(10),
    ]);

    const userMap: Record<string, string> = {};
    (usersRes.data || []).forEach((u: any) => { userMap[u.id] = u.full_name; });

    const activities: ActivityItem[] = [];
    (sessionsRes.data || []).forEach((s: any) => {
      activities.push({
        id: s.id, type: 'lesson_completed', user_name: userMap[s.user_id] || 'Unknown',
        detail: s.lesson?.title || 'Lesson', timestamp: s.completed_at,
      });
    });
    (attemptsRes.data || []).forEach((a: any) => {
      activities.push({
        id: a.id, type: 'practice_attempt', user_name: userMap[a.user_id] || 'Unknown',
        detail: `${a.is_correct ? 'Correct' : 'Incorrect'}: ${a.question?.question_text?.slice(0, 50) || 'Question'}`,
        timestamp: a.created_at,
      });
    });
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivityFeed(activities.slice(0, 15));
  };

  const fetchAnalytics = async () => {
    const [sessionsRes, attemptsRes, progressRes] = await Promise.all([
      supabase.from('lesson_sessions').select('id, status'),
      supabase.from('practice_attempts').select('id, is_correct'),
      supabase.from('progress_records').select('mastery_percentage'),
    ]);

    const sessions = sessionsRes.data || [];
    const attempts = attemptsRes.data || [];
    const progress = progressRes.data || [];

    setSessionCount(sessions.length);
    setCompletedSessionCount(sessions.filter((s: any) => s.status === 'completed').length);
    setAttemptCount(attempts.length);
    setCorrectAttemptCount(attempts.filter((a: any) => a.is_correct).length);

    const masteryValues = progress.map((p: any) => Number(p.mastery_percentage));
    setAvgMastery(masteryValues.length > 0 ? Math.round(masteryValues.reduce((a: number, b: number) => a + b, 0) / masteryValues.length) : 0);

    const ranges = [
      { range: '0-20%', min: 0, max: 20 },
      { range: '21-40%', min: 21, max: 40 },
      { range: '41-60%', min: 41, max: 60 },
      { range: '61-80%', min: 61, max: 80 },
      { range: '81-100%', min: 81, max: 100 },
    ];
    setMasteryDistribution(ranges.map(r => ({
      range: r.range,
      count: masteryValues.filter((v: number) => v >= r.min && v <= r.max).length,
    })));

    const { data: qData } = await supabase.from('practice_questions').select('id, topic_id, topic:topics(subject_id, subject:subjects(name, color))');
    const qSubjMap: Record<string, { count: number; color: string }> = {};
    (qData || []).forEach((q: any) => {
      const name = q.topic?.subject?.name || 'Unassigned';
      const color = q.topic?.subject?.color || '#888';
      if (!qSubjMap[name]) qSubjMap[name] = { count: 0, color };
      qSubjMap[name].count++;
    });
    setQuestionsBySubject(Object.entries(qSubjMap).map(([subject, v]) => ({ subject, count: v.count, color: v.color })));

    // AI Teaching Insights — continuous learning pipeline, "analyze
    // performance" step (SRS 12.17). Aggregated client-side since this is
    // read via the anon/authenticated client, not a service-role RPC.
    const { data: aiLogs } = await supabase
      .from('ai_interaction_logs')
      .select('topic_id, source, detected_confusion, topic:topics(name)')
      .order('created_at', { ascending: false })
      .limit(1000);
    const logs = aiLogs || [];
    setAiTotalMessages(logs.length);
    // Fallback rate = "OpenAI wasn't used to answer" (no API key configured,
    // or the OpenAI call itself failed) — deliberately excludes rate_limited
    // and moderated, since being blocked on purpose (rate limit) or
    // intercepted before reaching the teaching LLM (moderation) isn't the
    // same signal as the AI being unavailable, and mixing them would make
    // the fallback rate look worse than it actually is without telling you
    // why.
    const answeredLogs = logs.filter((l: any) => l.source !== 'rate_limited' && l.source !== 'moderated');
    setAiFallbackRate(answeredLogs.length > 0 ? Math.round((answeredLogs.filter((l: any) => l.source !== 'openai').length / answeredLogs.length) * 100) : 0);
    setAiConfusionRate(logs.length > 0 ? Math.round((logs.filter((l: any) => l.detected_confusion).length / logs.length) * 100) : 0);
    setAiRateLimitedCount(logs.filter((l: any) => l.source === 'rate_limited').length);

    const topicMap: Record<string, { count: number; confusionCount: number }> = {};
    logs.forEach((l: any) => {
      const name = l.topic?.name || 'General / no topic';
      if (!topicMap[name]) topicMap[name] = { count: 0, confusionCount: 0 };
      topicMap[name].count++;
      if (l.detected_confusion) topicMap[name].confusionCount++;
    });
    setAiTopTopics(
      Object.entries(topicMap)
        .map(([topic, v]) => ({ topic, count: v.count, confusionCount: v.confusionCount }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    );

    // AI Evaluation Suite history (SRS 12.16) — populated by
    // scripts/run-ai-evaluation.js, run outside the app (a dev machine or
    // CI) against real curriculum test cases. Nothing in the deployed app
    // writes to these tables; this is read-only history.
    const { data: evalRunsData } = await supabase
      .from('ai_eval_runs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(10);
    setAiEvalRuns(evalRunsData || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setUsers(data as UserProfile[]);
  };

  const fetchCurriculum = async () => {
    const [topicsRes, lessonsRes] = await Promise.all([
      supabase.from('topics').select('*, subject:subjects(name, color)').order('grade, display_order'),
      supabase.from('lessons').select('*, topic:topics(name, subject:subjects(name, color))').order('display_order'),
    ]);
    setTopics(topicsRes.data as Topic[] || []);
    setLessons(lessonsRes.data as Lesson[] || []);
  };

  const fetchQuestions = async () => {
    const { data } = await supabase.from('practice_questions').select('*, topic:topics(name, subject:subjects(name, color))').order('difficulty');
    if (data) setQuestions(data as PracticeQuestion[]);
  };

  // Moderation — messages OpenAI's Moderation API flagged before they
  // reached the teaching LLM (see ai-teacher-chat's moderateMessage()).
  // Self-harm severity sorted first, unreviewed before reviewed, so the
  // thing most needing a human's attention is always at the top rather
  // than buried under routine flags in chronological order.
  const fetchModeration = async () => {
    setModerationLoading(true);
    const [flagsRes, cleanupRes] = await Promise.all([
      supabase
        .from('moderation_flags')
        .select('*, profile:profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('moderation_flags_cleanup_log')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(20),
    ]);
    const sorted = (flagsRes.data || []).sort((a: any, b: any) => {
      if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1;
      if (a.severity !== b.severity) return a.severity === 'self_harm' ? -1 : 1;
      return 0;
    });
    setModerationFlags(sorted);
    setModerationCleanupLog(cleanupRes.data || []);
    setModerationLoading(false);
  };

  const handleMarkReviewed = async (id: string) => {
    const { error } = await supabase
      .from('moderation_flags')
      .update({ reviewed: true, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Failed to update.'); return; }
    setModerationFlags((prev) => prev.map((f) => (f.id === id ? { ...f, reviewed: true } : f)));
  };

  // School/teacher analytics — aggregated mastery and common
  // misconceptions, filterable by school and Form. All three RPCs are
  // admin-gated server-side (get_school_topic_analytics,
  // get_common_misconceptions, get_distinct_schools all check the
  // caller's role themselves), so this isn't relying on RLS alone.
  const fetchSchoolAnalytics = async () => {
    setSchoolAnalyticsLoading(true);
    const [schoolsRes, topicRes, mistakesRes] = await Promise.all([
      supabase.rpc('get_distinct_schools'),
      supabase.rpc('get_school_topic_analytics', {
        p_school: schoolFilter || null,
        p_grade: schoolGradeFilter,
      }),
      supabase.rpc('get_common_misconceptions', {
        p_school: schoolFilter || null,
        p_grade: schoolGradeFilter,
        p_topic_id: null,
      }),
    ]);
    setSchoolList(schoolsRes.data || []);
    setSchoolTopicAnalytics(topicRes.data || []);
    setCommonMisconceptions(mistakesRes.data || []);
    setSchoolAnalyticsLoading(false);
  };

  // Materials handlers
  const handleAdd = async () => {
    if (!form.title || !form.source) { toast.error('Title and source are required.'); return; }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/content-materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) },
      body: JSON.stringify({
        title: form.title, source: form.source, material_type: form.material_type,
        subject_id: form.subject_id || null, grade: form.grade ? parseInt(form.grade) : null,
        source_reference: form.source_reference || null, content_summary: form.content_summary || null, status: form.status,
      }),
    });
    if (response.ok) {
      toast.success('Material added.');
      setForm({ title: '', source: '', material_type: 'supplementary', subject_id: '', grade: '', source_reference: '', content_summary: '', status: 'pending' });
      setShowAddForm(false); fetchMaterials();
    } else { toast.error('Failed to add.'); }
  };

  const handleUpdate = async (id: string, updates: Partial<ContentMaterial>) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/content-materials`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) },
      body: JSON.stringify({ id, ...updates }),
    });
    if (response.ok) { toast.success('Updated.'); setEditingId(null); fetchMaterials(); }
    else { toast.error('Failed to update.'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material?')) return;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/content-materials/${id}`, {
      method: 'DELETE',
      headers: { ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) },
    });
    if (response.ok) { toast.success('Deleted.'); fetchMaterials(); }
    else { toast.error('Failed to delete.'); }
  };

  const handleSync = async (source: 'moe' | 'ecz' | 'all') => {
    setSyncing(source); setSyncResult(null);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/moe-ecz-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) },
        body: JSON.stringify({ source }),
      });
      if (response.ok) {
        const data = await response.json();
        setSyncResult({ source: data.source, message: data.message });
        toast.success(data.message); fetchMaterials();
      } else { const err = await response.json(); toast.error(err.error || 'Sync failed.'); }
    } catch { toast.error('Sync failed.'); }
    setSyncing(null);
  };

  // Generates embeddings for any content_materials / search_index /
  // past_paper_questions rows missing one (SRS 12.6 — real pgvector
  // search). The Edge Function processes a bounded batch per call, so
  // this loops until every table reports 0 remaining, updating progress
  // as it goes rather than blocking on one giant request.
  const handleGenerateEmbeddings = async () => {
    setEmbedding(true);
    setEmbeddingResult(null);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json', ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) };

      let totalEmbedded = 0;
      let totalFailed = 0;
      let remaining = 1; // seed the loop
      let guard = 0; // hard stop in case something's stuck, rather than looping forever

      while (remaining > 0 && guard < 25) {
        guard++;
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-embeddings`, {
          method: 'POST', headers, body: JSON.stringify({ table: 'all', limit: 20 }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          toast.error(err.error || 'Embedding generation failed.');
          break;
        }
        const data = await response.json();
        remaining = 0;
        for (const table of Object.keys(data.results || {})) {
          const r = data.results[table];
          totalEmbedded += r.embedded;
          totalFailed += r.failed;
          remaining = Math.max(remaining, r.remaining);
        }
        setEmbeddingResult({ embedded: totalEmbedded, failed: totalFailed, remaining });
      }
      toast.success(`Embedded ${totalEmbedded} rows${totalFailed ? `, ${totalFailed} failed` : ''}.`);
    } catch {
      toast.error('Embedding generation failed.');
    }
    setEmbedding(false);
  };

  // Lesson handlers
  const handleLessonSubmit = async () => {
    if (!lessonForm.topic_id || !lessonForm.title) { toast.error('Topic and title are required.'); return; }
    const content: LessonContent = { intro: lessonForm.intro, steps: [], examples: [], summary: lessonForm.summary };
    if (editingLesson) {
      const { error } = await supabase.from('lessons').update({
        topic_id: lessonForm.topic_id, title: lessonForm.title, difficulty: lessonForm.difficulty,
        display_order: lessonForm.display_order, content,
      }).eq('id', editingLesson.id);
      if (error) { toast.error('Failed to update lesson.'); return; }
      toast.success('Lesson updated.');
    } else {
      const { error } = await supabase.from('lessons').insert({
        topic_id: lessonForm.topic_id, title: lessonForm.title, difficulty: lessonForm.difficulty,
        display_order: lessonForm.display_order, content,
      });
      if (error) { toast.error('Failed to create lesson.'); return; }
      toast.success('Lesson created.');
    }
    setShowLessonForm(false); setEditingLesson(null);
    setLessonForm({ topic_id: '', title: '', difficulty: 'standard', display_order: 0, intro: '', summary: '' });
    fetchCurriculum();
  };

  const handleLessonEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      topic_id: lesson.topic_id, title: lesson.title, difficulty: lesson.difficulty,
      display_order: lesson.display_order,
      intro: lesson.content?.intro || '', summary: lesson.content?.summary || '',
    });
    setShowLessonForm(true);
  };

  const handleLessonDelete = async (id: string) => {
    if (!confirm('Delete this lesson?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (error) { toast.error('Failed to delete.'); return; }
    toast.success('Lesson deleted.'); fetchCurriculum();
  };

  // Question handlers
  const handleQuestionSubmit = async () => {
    if (!questionForm.topic_id || !questionForm.question_text || !questionForm.answer_key) {
      toast.error('Topic, question text, and answer are required.'); return;
    }
    const payload = {
      topic_id: questionForm.topic_id,
      question_text: questionForm.question_text,
      question_type: questionForm.question_type,
      options: questionForm.question_type === 'multiple_choice' ? questionForm.options.filter((o: string) => o.trim()) : null,
      answer_key: questionForm.answer_key,
      explanation: questionForm.explanation || null,
      difficulty: questionForm.difficulty,
    };
    if (editingQuestion) {
      const { error } = await supabase.from('practice_questions').update(payload).eq('id', editingQuestion.id);
      if (error) { toast.error('Failed to update question.'); return; }
      toast.success('Question updated.');
    } else {
      const { error } = await supabase.from('practice_questions').insert(payload);
      if (error) { toast.error('Failed to create question.'); return; }
      toast.success('Question created.');
    }
    setShowQuestionForm(false); setEditingQuestion(null);
    setQuestionForm({ topic_id: '', question_text: '', question_type: 'multiple_choice', options: ['', '', '', ''], answer_key: '', explanation: '', difficulty: 'standard' });
    fetchQuestions();
  };

  const handleQuestionEdit = (q: PracticeQuestion) => {
    setEditingQuestion(q);
    setQuestionForm({
      topic_id: q.topic_id, question_text: q.question_text, question_type: q.question_type,
      options: (q.options as string[]) || ['', '', '', ''], answer_key: q.answer_key,
      explanation: q.explanation || '', difficulty: q.difficulty,
    });
    setShowQuestionForm(true);
  };

  const handleQuestionDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    const { error } = await supabase.from('practice_questions').delete().eq('id', id);
    if (error) { toast.error('Failed to delete.'); return; }
    toast.success('Question deleted.'); fetchQuestions();
  };

  // User handlers
  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'pupil' : 'admin';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { toast.error('Failed to update role.'); return; }
    toast.success(`Role set to ${newRole}.`); fetchUsers();
  };

  const openUserDetail = async (user: UserProfile) => {
    setSelectedUser(user);
    const [progressRes, sessionsRes] = await Promise.all([
      supabase.from('progress_records').select('*, topic:topics(name, subject:subjects(name, color))').eq('user_id', user.id),
      supabase.from('lesson_sessions').select('*, lesson:lessons(title)').eq('user_id', user.id).order('started_at', { ascending: false }).limit(10),
    ]);
    setUserProgress(progressRes.data || []);
    setUserSessions(sessionsRes.data || []);
  };

  // Search index rebuild
  const rebuildSearchIndex = async () => {
    if (!confirm('Rebuild the search index? This will reindex all topics and lessons.')) return;
    const { error } = await supabase.rpc('rebuild_search_index');
    if (error) { toast.error('Rebuild failed.'); return; }
    toast.success('Search index rebuilt successfully.');
  };

  if (!isAdmin || loading) {
    return <div className="flex h-72 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
          <Shield className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-chalk">Admin Dashboard</h1>
          <p className="text-muted-board text-sm">Manage platform content, users, curriculum, and analytics.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-white/10 overflow-x-auto scrollbar-thin">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'border-gold text-gold' : 'border-transparent text-muted-board hover:text-chalk'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          userCount={userCount} topicCount={topicCount} lessonCount={lessonCount} questionCount={questionCount}
          materialCount={materials.length} approvedMaterials={materials.filter((m) => m.status === 'approved').length}
          usersByGrade={usersByGrade} topicsBySubject={topicsBySubject}
          activityFeed={activityFeed} recentSignups={recentSignups}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          sessionCount={sessionCount} completedSessionCount={completedSessionCount}
          attemptCount={attemptCount} correctAttemptCount={correctAttemptCount}
          avgMastery={avgMastery} masteryDistribution={masteryDistribution}
          questionsBySubject={questionsBySubject} userCount={userCount}
          aiTotalMessages={aiTotalMessages} aiFallbackRate={aiFallbackRate}
          aiConfusionRate={aiConfusionRate} aiTopTopics={aiTopTopics}
          aiRateLimitedCount={aiRateLimitedCount} aiEvalRuns={aiEvalRuns}
        />
      )}

      {activeTab === 'materials' && (
        <MaterialsTab
          materials={materials} subjects={subjects} showAddForm={showAddForm} setShowAddForm={setShowAddForm}
          form={form} setForm={setForm} handleAdd={handleAdd} handleUpdate={handleUpdate} handleDelete={handleDelete}
          handleSync={handleSync} syncing={syncing} syncResult={syncResult} editingId={editingId} setEditingId={setEditingId}
          handleGenerateEmbeddings={handleGenerateEmbeddings} embedding={embedding} embeddingResult={embeddingResult}
        />
      )}

      {activeTab === 'lessons' && (
        <LessonsTab
          lessons={lessons} topics={topics} subjects={subjects}
          lessonSearch={lessonSearch} setLessonSearch={setLessonSearch}
          lessonTopicFilter={lessonTopicFilter} setLessonTopicFilter={setLessonTopicFilter}
          showLessonForm={showLessonForm} setShowLessonForm={setShowLessonForm}
          editingLesson={editingLesson} lessonForm={lessonForm} setLessonForm={setLessonForm}
          handleLessonSubmit={handleLessonSubmit} handleLessonEdit={handleLessonEdit} handleLessonDelete={handleLessonDelete}
        />
      )}

      {activeTab === 'questions' && (
        <QuestionsTab
          questions={questions} topics={topics} subjects={subjects}
          questionSearch={questionSearch} setQuestionSearch={setQuestionSearch}
          questionTopicFilter={questionTopicFilter} setQuestionTopicFilter={setQuestionTopicFilter}
          showQuestionForm={showQuestionForm} setShowQuestionForm={setShowQuestionForm}
          editingQuestion={editingQuestion} questionForm={questionForm} setQuestionForm={setQuestionForm}
          handleQuestionSubmit={handleQuestionSubmit} handleQuestionEdit={handleQuestionEdit} handleQuestionDelete={handleQuestionDelete}
        />
      )}

      {activeTab === 'users' && (
        <UsersTab
          users={users} userSearch={userSearch} setUserSearch={setUserSearch}
          userGradeFilter={userGradeFilter} setUserGradeFilter={setUserGradeFilter}
          toggleUserRole={toggleUserRole} currentUserId={profile?.id}
          selectedUser={selectedUser} setSelectedUser={setSelectedUser}
          openUserDetail={openUserDetail} userProgress={userProgress} userSessions={userSessions}
        />
      )}

      {activeTab === 'curriculum' && (
        <CurriculumTab
          subjects={subjects} topics={topics} lessons={lessons}
          curriculumSubjectFilter={curriculumSubjectFilter} setCurriculumSubjectFilter={setCurriculumSubjectFilter}
        />
      )}

      {activeTab === 'moderation' && (
        <ModerationTab flags={moderationFlags} loading={moderationLoading} onMarkReviewed={handleMarkReviewed} cleanupLog={moderationCleanupLog} />
      )}

      {activeTab === 'school-analytics' && (
        <SchoolAnalyticsTab
          schoolList={schoolList} topicAnalytics={schoolTopicAnalytics} misconceptions={commonMisconceptions}
          loading={schoolAnalyticsLoading} schoolFilter={schoolFilter} setSchoolFilter={setSchoolFilter}
          gradeFilter={schoolGradeFilter} setGradeFilter={setSchoolGradeFilter}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab profile={profile} rebuildSearchIndex={rebuildSearchIndex} />
      )}
    </div>
  );
}
