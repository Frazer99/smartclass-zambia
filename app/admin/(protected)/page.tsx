'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { supabase, Subject, Topic, Lesson, LessonContent, ContentMaterial, PracticeQuestion, PastPaper, UserFeedback, Announcement } from '@/lib/supabase-client';
import { Shield, Loader as Loader2, Menu, X } from 'lucide-react';
import { toast } from 'sonner';

import { OverviewTab } from './tabs/overview-tab';
import { AnalyticsTab } from './tabs/analytics-tab';
import { MaterialsTab } from './tabs/materials-tab';
import { LessonsTab } from './tabs/lessons-tab';
import { QuestionsTab } from './tabs/questions-tab';
import { UsersTab } from './tabs/users-tab';
import { CurriculumTab } from './tabs/curriculum-tab';
import { ModerationTab } from './tabs/moderation-tab';
import { SettingsTab } from './tabs/settings-tab';
import { PastPapersTab } from './tabs/past-papers-tab';
import { PaymentsTab } from './tabs/payments-tab';
import { PersonasTab, TeacherPersona } from './tabs/personas-tab';
import { FeedbackTab } from './tabs/feedback-tab';
import { SystemHealthTab, ErrorLogEntry } from './tabs/system-health-tab';
import { UserProfile } from './tabs/constants';
import { createClientId } from '@/lib/client-id';

type Tab = 'overview' | 'analytics' | 'materials' | 'lessons' | 'questions' | 'past-papers' | 'billing' | 'personas' | 'users' | 'curriculum' | 'moderation' | 'feedback' | 'system-health' | 'settings';

type ActivityItem = {
  id: string;
  type: 'lesson_completed' | 'practice_attempt' | 'user_joined';
  user_name: string;
  detail: string;
  timestamp: string;
};

const TABS: { id: Tab; label: string; icon: React.ReactNode; group?: string }[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'materials', label: 'Materials', icon: <FileText className="h-4 w-4" /> },
  { id: 'lessons', label: 'Lessons', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'questions', label: 'Questions', icon: <HelpCircle className="h-4 w-4" /> },
  { id: 'past-papers', label: 'Past Papers', icon: <FileText className="h-4 w-4" />, group: 'Materials' },
  { id: 'billing', label: 'Billing', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'personas', label: 'Personas', icon: <Users className="h-4 w-4" /> },
  { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { id: 'curriculum', label: 'Curriculum', icon: <Layers className="h-4 w-4" />, group: 'Materials' },
  { id: 'moderation', label: 'Moderation', icon: <ShieldAlert className="h-4 w-4" /> },
  { id: 'feedback', label: 'Feedback', icon: <MessageSquare className="h-4 w-4" /> },
  { id: 'system-health', label: 'System Health', icon: <Activity className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

async function edgeFunctionErrorMessage(error: any, fallback: string): Promise<string> {
  if (error?.context instanceof Response) {
    const payload = await error.context.clone().json().catch(() => null);
    if (typeof payload?.error === 'string' && payload.error.trim()) return payload.error;
  }
  return error?.message || fallback;
}

// Import icons used in TABS
import { ChartBar as BarChart3, TrendingUp, FileText, BookOpen, CircleHelp as HelpCircle, CreditCard, Users, Layers, Settings, ShieldAlert, MessageSquare, Activity } from 'lucide-react';

export default function AdminPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab | null>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Shared data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [materials, setMaterials] = useState<ContentMaterial[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [pastPapers, setPastPapers] = useState<PastPaper[]>([]);
  const [personas, setPersonas] = useState<TeacherPersona[]>([]);
  const [personasLoading, setPersonasLoading] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [isPlatformFree, setIsPlatformFree] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);

  // Overview
  const [userCount, setUserCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [lessonCount, setLessonCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [materialCount, setMaterialCount] = useState(0);
  const [approvedMaterialCount, setApprovedMaterialCount] = useState(0);
  const [moderationFlags, setModerationFlags] = useState<any[]>([]);
  const [moderationLoading, setModerationLoading] = useState(true);
  const [feedback, setFeedback] = useState<(UserFeedback & { profile?: { full_name: string } | null; audio_url?: string | null })[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [usersByGrade, setUsersByGrade] = useState<Record<number, number>>({});
  const [topicsBySubject, setTopicsBySubject] = useState<{ subject: string; count: number; color: string }[]>([]);
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);
  const [recentSignups, setRecentSignups] = useState<UserProfile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogEntry[]>([]);
  const [errorLogsLoading, setErrorLogsLoading] = useState(false);

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
    grade: '', source_reference: '', content_summary: '', status: 'approved',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Curriculum
  const [curriculumSubjectFilter, setCurriculumSubjectFilter] = useState<string>('');
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [topicForm, setTopicForm] = useState({ subject_id: '', grade: '', name: '', category: '', syllabus_reference: '', display_order: 0, description: '' });
  const [syllabusUpload, setSyllabusUpload] = useState<any>({ subject_id: '', grade: '', file: null, title: '' });
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);
  const [showPastPaperForm, setShowPastPaperForm] = useState(false);
  const [editingPastPaper, setEditingPastPaper] = useState<PastPaper | null>(null);
  const [pastPaperForm, setPastPaperForm] = useState({
    subject_id: '', grade: '', year: String(new Date().getFullYear()), term: '', title: '',
    total_marks: '', duration_minutes: '', source: 'ECZ',
  });
  const [pastPaperFile, setPastPaperFile] = useState<File | null>(null);
  const [pastPaperAnswerFile, setPastPaperAnswerFile] = useState<File | null>(null);

  useEffect(() => {
    if (!profile) return;
    checkAdmin();
  }, [profile]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'users') return;
    const refreshTimer = window.setInterval(fetchUsers, 10000);
    return () => window.clearInterval(refreshTimer);
  }, [activeTab, isAdmin]);

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
    const results = await Promise.allSettled([
      fetchSubjects(), fetchMaterials(), fetchOverview(), fetchAnnouncements(), fetchAnalytics(), fetchUsers(), fetchCurriculum(), fetchQuestions(), fetchPastPapers(), fetchPayments(), fetchPersonas(), fetchModeration(), fetchFeedback(), fetchErrorLogs(), fetchAccessSettings(),
    ]);
    if (results.some((result) => result.status === 'rejected')) {
      console.error('Some admin dashboard data failed to load:', results.filter((result) => result.status === 'rejected'));
      toast.error('Some admin data could not be loaded. The available sections are still ready.');
    }
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from('subjects').select('*').order('display_order');
    if (data) setSubjects(data as Subject[]);
  };

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      toast.error(`Failed to load announcements: ${error.message}`);
      return;
    }
    setAnnouncements((data || []) as Announcement[]);
  };

  const postAnnouncement = async (title: string, body: string) => {
    if (!profile) return false;
    const { error } = await supabase.from('announcements').insert({ title, body, created_by: profile.id });
    if (error) {
      toast.error(`Failed to post announcement: ${error.message}`);
      return false;
    }
    toast.success('Announcement posted. Pupils can see it now.');
    await fetchAnnouncements();
    return true;
  };

  const deleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast.error(`Failed to delete announcement: ${error.message}`);
      return false;
    }
    toast.success('Announcement deleted.');
    await fetchAnnouncements();
    return true;
  };

  const fetchMaterials = async () => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(`${supabaseUrl}/functions/v1/content-materials`, {
        headers: { ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Content materials request failed (${response.status})`);
      }
      const { data } = await response.json();
      setMaterials(data || []);
    } catch (error) {
      console.error('Failed to load content materials:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load content materials.');
    }
  };

  const fetchOverview = async () => {
    const [usersRes, topicsRes, uploadedTopicsRes, uploadedLessonsRes, uploadedPracticeQuestionsRes, uploadedPastPaperQuestionsRes, materialsRes] = await Promise.all([
      supabase.from('profiles').select('grade, role, full_name, created_at, id'),
      supabase.from('topics').select('id, subject_id, subject:subjects(name, color)').not('source_material_id', 'is', null),
      supabase.from('topics').select('id', { count: 'exact', head: true }).not('source_material_id', 'is', null),
      supabase.from('lessons').select('id, topic:topics!inner(source_material_id)').not('topics.source_material_id', 'is', null),
      supabase.from('practice_questions').select('id, topic:topics!inner(source_material_id)').not('topics.source_material_id', 'is', null),
      supabase.from('past_paper_questions').select('id, past_paper:past_papers!inner(source_material_id)').not('past_papers.source_material_id', 'is', null),
      supabase.from('content_materials').select('id, status'),
    ]);

    setUserCount(usersRes.data?.length || 0);
    setTopicCount(uploadedTopicsRes.count || 0);
    setLessonCount(uploadedLessonsRes.data?.length || 0);
    setQuestionCount((uploadedPracticeQuestionsRes.data?.length || 0) + (uploadedPastPaperQuestionsRes.data?.length || 0));
    setMaterialCount(materialsRes.data?.length || 0);
    setApprovedMaterialCount((materialsRes.data || []).filter((material: any) => ['approved', 'ingested'].includes(material.status)).length);

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

    const { data: qData } = await supabase
      .from('practice_questions')
      .select('id, topic_id, topic:topics!inner(subject_id, source_material_id, subject:subjects(name, color))')
      .not('topics.source_material_id', 'is', null);
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
    // or the OpenAI call itself failed) — deliberately excludes rate_limited,
    // since being blocked on purpose isn't the same signal as the AI being
    // unavailable, and mixing them would make the fallback rate look worse
    // than it actually is without telling you why.
    const answeredLogs = logs.filter((l: any) => l.source !== 'rate_limited');
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
    const { data: syncedUsers, error: syncError } = await supabase.rpc('admin_sync_registered_pupils');
    if (!syncError && syncedUsers) {
      setUsers(syncedUsers as UserProfile[]);
      return;
    }

    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error(`Failed to load registered users: ${syncError?.message || error.message}`);
      return;
    }
    if (data) setUsers(data as UserProfile[]);
  };

  const fetchFeedback = async () => {
    setFeedbackLoading(true);
    const { data, error } = await supabase
      .from('user_feedback')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(`Failed to load feedback: ${error.message}`);
      setFeedbackLoading(false);
      return;
    }

    const userIds = [...new Set((data || []).map((item) => item.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const names = new Map((profiles || []).map((item) => [item.id, item.full_name]));
    const feedbackWithAudio = await Promise.all((data || []).map(async (item) => {
      const { data: signedAudio } = item.audio_path
        ? await supabase.storage.from('feedback-recordings').createSignedUrl(item.audio_path, 3600)
        : { data: null };
      return {
      ...(item as UserFeedback),
      profile: { full_name: names.get(item.user_id) || 'Unknown pupil' },
        audio_url: signedAudio?.signedUrl || null,
      };
    }));
    setFeedback(feedbackWithAudio);
    setFeedbackLoading(false);
  };

  const fetchCurriculum = async () => {
    const [topicsRes, lessonsRes] = await Promise.all([
      supabase.from('topics').select('*, subject:subjects(name, color)').not('source_material_id', 'is', null).order('grade, display_order'),
      supabase.from('lessons').select('*, topic:topics!inner(name, source_material_id, subject:subjects(name, color))').not('topics.source_material_id', 'is', null).order('display_order'),
    ]);
    setTopics(topicsRes.data as Topic[] || []);
    setLessons(lessonsRes.data as Lesson[] || []);
  };

  const fetchQuestions = async () => {
    const { data } = await supabase
      .from('practice_questions')
      .select('*, topic:topics!inner(name, source_material_id, subject:subjects(name, color))')
      .not('topics.source_material_id', 'is', null)
      .order('difficulty');
    if (data) setQuestions(data as PracticeQuestion[]);
  };

  const fetchPastPapers = async () => {
    const { data, error } = await supabase
      .from('past_papers')
      .select('*, subject:subjects(name, code, color)')
      .not('source_material_id', 'is', null)
      .order('year', { ascending: false });
    if (error) { toast.error(`Failed to load past papers: ${error.message}`); return; }
    setPastPapers((data || []) as PastPaper[]);
  };

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    const [{ data: paymentData, error: paymentError }, { data: revenueData, error: revenueError }] = await Promise.all([
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.rpc('get_revenue_summary'),
    ]);
    if (paymentError) toast.error(`Failed to load payments: ${paymentError.message}`);
    if (revenueError) toast.error(`Failed to load revenue: ${revenueError.message}`);
    const userIds = [...new Set((paymentData || []).map((payment) => payment.user_id))];
    const { data: profiles } = userIds.length ? await supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] };
    const names = new Map((profiles || []).map((profile) => [profile.id, profile.full_name]));
    setPayments((paymentData || []).map((payment) => ({ ...payment, profile: { full_name: names.get(payment.user_id) || 'Unknown pupil' } })));
    setRevenue(revenueData || []);
    setPaymentsLoading(false);
  };

  const fetchAccessSettings = async () => {
    const { data, error } = await supabase.from('platform_settings').select('value').eq('key', 'is_platform_free').maybeSingle();
    if (error) { toast.error(`Failed to load access settings: ${error.message}`); return; }
    setIsPlatformFree(Boolean(data?.value));
  };

  const togglePlatformFree = async (enabled: boolean) => {
    setAccessLoading(true);
    const { error } = await supabase.rpc('set_platform_free_mode', { p_enabled: enabled });
    if (error) toast.error(`Failed to update free mode: ${error.message}`);
    else { setIsPlatformFree(enabled); toast.success(enabled ? 'Free access enabled for everyone.' : 'Subscription mode enabled.'); }
    setAccessLoading(false);
  };

  const grantBonusAccess = async (userId: string, days: number | null) => {
    setAccessLoading(true);
    const { error } = await supabase.rpc('grant_bonus_subscription', { p_user_id: userId, p_days: days });
    if (error) toast.error(`Failed to grant bonus access: ${error.message}`);
    else toast.success(days ? `Free access granted for ${days} days.` : 'Free access granted with no expiry.');
    setAccessLoading(false);
  };

  const fetchPersonas = async () => {
    setPersonasLoading(true);
    const { data, error } = await supabase
      .from('teacher_personas')
      .select('*, subject:subjects(name, color)')
      .order('grade_min');
    if (error) toast.error(`Failed to load personas: ${error.message}`);
    setPersonas((data || []) as TeacherPersona[]);
    setPersonasLoading(false);
  };

  const handleSavePersona = async (id: string, avatarId: string, voiceId: string): Promise<boolean> => {
    const { error } = await supabase.from('teacher_personas').update({
      liveavatar_avatar_id: avatarId || null,
      liveavatar_voice_id: voiceId || null,
    }).eq('id', id);
    if (error) { toast.error(`Failed to save persona: ${error.message}`); return false; }
    toast.success('Persona updated.');
    fetchPersonas();
    return true;
  };

  const fetchModeration = async () => {
    setModerationLoading(true);
    const { data } = await supabase.from('moderation_flags').select('*, profile:profiles(full_name)').order('created_at', { ascending: false }).limit(200);
    const sorted = (data || []).sort((a: any, b: any) => {
      if (a.reviewed !== b.reviewed) return a.reviewed ? 1 : -1;
      if (a.severity !== b.severity) return a.severity === 'self_harm' ? -1 : 1;
      return 0;
    });
    setModerationFlags(sorted);
    setModerationLoading(false);
  };

  const fetchErrorLogs = async () => {
    setErrorLogsLoading(true);
    const { data, error } = await supabase.from('app_error_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) toast.error(`Failed to load error logs: ${error.message}`);
    setErrorLogs((data || []) as ErrorLogEntry[]);
    setErrorLogsLoading(false);
  };

  const handleMarkReviewed = async (id: string) => {
    const { error } = await supabase.from('moderation_flags').update({ reviewed: true, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Failed to update.'); return; }
    setModerationFlags((flags) => flags.map((flag) => flag.id === id ? { ...flag, reviewed: true } : flag));
  };

  // Materials handlers
  const handleAdd = async () => {
    if (!form.title || !form.source) { toast.error('Title and source are required.'); return; }
    if (!selectedFile) { toast.error('Select a PDF or video file to upload.'); return; }
    const isPdf = selectedFile.type === 'application/pdf' || /\.pdf$/i.test(selectedFile.name);
    const isVideo = selectedFile.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv)$/i.test(selectedFile.name);
    if (!isPdf && !isVideo) { toast.error('Only PDF or supported video files can be uploaded.'); return; }
    if (isVideo && selectedFile.size > 25 * 1024 * 1024) { toast.error('Video files must be 25 MB or smaller for transcription.'); return; }
    if (selectedFile && (form.material_type === 'curriculum' || form.material_type === 'syllabus') && !form.grade) {
      toast.error('Select the Form for a syllabus or curriculum PDF so its topics are assigned correctly.');
      return;
    }
    let duplicateQuery = supabase
      .from('content_materials')
      .select('id, title')
      .ilike('title', form.title.trim())
      .ilike('source', form.source.trim())
      .eq('material_type', form.material_type)
      .limit(1);
    duplicateQuery = form.subject_id ? duplicateQuery.eq('subject_id', form.subject_id) : duplicateQuery.is('subject_id', null);
    duplicateQuery = form.grade ? duplicateQuery.eq('grade', parseInt(form.grade)) : duplicateQuery.is('grade', null);
    const { data: duplicate, error: duplicateCheckError } = await duplicateQuery.maybeSingle();
    if (duplicateCheckError) { toast.error(`Could not check for duplicates: ${duplicateCheckError.message}`); return; }
    if (duplicate) { toast.error(`Material already exists: ${duplicate.title}`); return; }
    const { data: material, error: materialError } = await supabase.functions.invoke('content-materials', {
      body: {
        title: form.title, source: form.source, material_type: form.material_type,
        subject_id: form.subject_id || null, grade: form.grade ? parseInt(form.grade) : null,
        source_reference: form.source_reference || null, content_summary: form.content_summary || null,
      },
    });
    if (materialError || !material?.data) {
      toast.error(`Failed to add material: ${await edgeFunctionErrorMessage(materialError, 'No material was returned.')}`);
      return;
    }
    let storagePath: string | null = null;
    let ingestionStarted = false;
    try {
      if (selectedFile) {
        if (isVideo) {
          storagePath = `${createClientId()}-${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
          const { error: uploadError } = await supabase.storage.from('content-materials').upload(storagePath, selectedFile, { contentType: selectedFile.type || 'video/mp4', upsert: false });
          if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);
          ingestionStarted = true;
          const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-video-material', {
            body: { material_id: material.data.id, storage_path: storagePath },
          });
          if (ingestError) throw new Error(`Video transcription failed: ${await edgeFunctionErrorMessage(ingestError, 'The video could not be transcribed.')}`);
          if (!ingestResult?.success || !ingestResult.transcribed_characters) throw new Error('Video was uploaded but no transcript was created.');
        } else {
        storagePath = `${createClientId()}-${selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from('content-materials').upload(storagePath, selectedFile, { contentType: 'application/pdf', upsert: false });
        if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);
        ingestionStarted = true;
        const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-material', {
          body: { material_id: material.data.id, storage_path: storagePath, extracted_text: null, subject_id: form.subject_id || null, grade: form.grade ? parseInt(form.grade) : null, material_type: form.material_type },
        });
        if (ingestError) throw new Error(`PDF processing failed: ${await edgeFunctionErrorMessage(ingestError, 'The PDF could not be processed.')}`);
        if (!ingestResult?.success || !ingestResult.extracted_characters) {
          throw new Error('PDF was uploaded but could not be indexed for AI use.');
        }
        }
      }
      toast.success('Material added.');
      setForm({ title: '', source: '', material_type: 'supplementary', subject_id: '', grade: '', source_reference: '', content_summary: '', status: 'approved' });
      setSelectedFile(null);
      setShowAddForm(false); fetchMaterials();
    } catch (error) {
      if (!ingestionStarted) {
        if (storagePath) await supabase.storage.from('content-materials').remove([storagePath]);
        await supabase.from('content_materials').delete().eq('id', material.data.id);
        toast.error(error instanceof Error ? error.message : 'Material upload failed.');
      } else {
        toast.error(`${error instanceof Error ? error.message : 'Material processing failed.'} The PDF was kept in Materials for retry or manual summarization.`);
      }
    }
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
    const material = materials.find((item) => item.id === id) as any;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const response = await fetch(`${supabaseUrl}/functions/v1/content-materials/${id}`, {
      method: 'DELETE',
      headers: { ...(authSession ? { Authorization: `Bearer ${authSession.access_token}` } : {}) },
    });
    if (response.ok) {
      if (material?.storage_path) {
        const { error: storageError } = await supabase.storage.from('content-materials').remove([material.storage_path]);
        if (storageError) toast.error(`Material deleted, but its PDF could not be removed: ${storageError.message}`);
      }
      toast.success('Deleted.'); fetchMaterials();
    }
    else { toast.error('Failed to delete.'); }
  };

  const handlePastPaperSubmit = async () => {
    if (!pastPaperFile) { toast.error('Select the past paper PDF.'); return; }
    const isPdf = pastPaperFile.type === 'application/pdf' || /\.pdf$/i.test(pastPaperFile.name);
    if (!isPdf) { toast.error('Only PDF files can be uploaded.'); return; }
    if (pastPaperAnswerFile && !(pastPaperAnswerFile.type === 'application/pdf' || /\.pdf$/i.test(pastPaperAnswerFile.name))) { toast.error('The answer file must be a PDF.'); return; }
    try {
      const storagePath = `past-papers/${createClientId()}-${pastPaperFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('content-materials').upload(storagePath, pastPaperFile, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw new Error(`PDF storage upload failed: ${uploadError.message}`);
      let answerStoragePath: string | null = null;
      if (pastPaperAnswerFile) {
        answerStoragePath = `past-paper-answers/${createClientId()}-${pastPaperAnswerFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const { error: answerUploadError } = await supabase.storage.from('content-materials').upload(answerStoragePath, pastPaperAnswerFile, { contentType: 'application/pdf', upsert: false });
        if (answerUploadError) throw new Error(`Answer PDF upload failed: ${answerUploadError.message}`);
      }

      const { data: material, error: materialError } = await supabase.from('content_materials').insert({
        title: pastPaperFile.name.replace(/\.pdf$/i, ''), source: 'Uploaded PDF', material_type: 'past_paper', status: 'approved',
      }).select('id').single();
      if (materialError || !material) throw new Error(`Paper record creation failed: ${materialError?.message || 'No material was returned.'}`);

      const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-material', {
        body: { material_id: material.id, past_paper_id: editingPastPaper?.id || null, storage_path: storagePath, extracted_text: null, answer_storage_path: answerStoragePath, answer_extracted_text: null, material_type: 'past_paper' },
      });
      if (ingestError) {
        throw new Error(await edgeFunctionErrorMessage(ingestError, 'The past paper PDF could not be processed.'));
      }
      if (!ingestResult.past_paper_id) throw new Error('The PDF did not contain enough paper details to create a past paper.');
      const { error: linkError } = await supabase.from('past_papers').update({ storage_path: storagePath, source_material_id: material.id }).eq('id', ingestResult.past_paper_id);
      if (linkError) throw linkError;
      toast.success(`PDF processed: ${ingestResult.questions_created || 0} questions extracted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Past paper PDF upload failed.');
      return;
    }
    toast.success(editingPastPaper ? 'Past paper updated.' : 'Past paper added.');
    setPastPaperForm({ subject_id: '', grade: '', year: String(new Date().getFullYear()), term: '', title: '', total_marks: '', duration_minutes: '', source: 'ECZ' });
    setPastPaperFile(null); setPastPaperAnswerFile(null); setEditingPastPaper(null); setShowPastPaperForm(false); fetchPastPapers();
  };

  const handlePastPaperEdit = (paper: PastPaper) => {
    setEditingPastPaper(paper);
    setPastPaperForm({
      subject_id: paper.subject_id, grade: String(paper.grade), year: String(paper.year), term: paper.term || '',
      title: paper.title, total_marks: paper.total_marks ? String(paper.total_marks) : '',
      duration_minutes: paper.duration_minutes ? String(paper.duration_minutes) : '', source: paper.source,
    });
    setShowPastPaperForm(true);
  };

  const handlePastPaperDelete = async (id: string) => {
    if (!confirm('Delete this past paper and its questions?')) return;
    const { error } = await supabase.from('past_papers').delete().eq('id', id);
    if (error) { toast.error(`Failed to delete past paper: ${error.message}`); return; }
    toast.success('Past paper deleted.'); fetchPastPapers();
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

  const handleTopicSubmit = async () => {
    if (!topicForm.subject_id || !topicForm.grade || !topicForm.name) {
      toast.error('Subject, form, and topic name are required.');
      return;
    }
    const { error } = await supabase.from('topics').insert({
      subject_id: topicForm.subject_id, grade: Number(topicForm.grade), name: topicForm.name,
      category: topicForm.category || 'General', syllabus_reference: topicForm.syllabus_reference || null,
      display_order: topicForm.display_order, description: topicForm.description || null,
    });
    if (error) { toast.error(`Failed to create topic: ${error.message}`); return; }
    toast.success('Topic created.');
    setTopicForm({ subject_id: '', grade: '', name: '', category: '', syllabus_reference: '', display_order: 0, description: '' });
    setShowTopicForm(false); fetchCurriculum();
  };

  const handleSyllabusUpload = async () => {
    const { subject_id, grade, file } = syllabusUpload;
    if (!subject_id || !grade || !file) { toast.error('Subject, Form, and a PDF file are required.'); return; }
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) { toast.error('Only PDF files can be uploaded.'); return; }
    setUploadingSyllabus(true);
    let materialId: string | null = null;
    let storagePath: string | null = null;
    let ingestionStarted = false;
    try {
      const title = syllabusUpload.title || `${subjects.find((subject) => subject.id === subject_id)?.name || 'Curriculum'} Syllabus Form ${grade}`;
      const { data: material, error: materialError } = await supabase.functions.invoke('content-materials', {
        body: { title, source: 'Admin syllabus upload', material_type: 'syllabus', subject_id, grade: Number(grade), status: 'approved' },
      });
      if (materialError || !material?.data) throw new Error(materialError?.message || 'Could not create syllabus record.');
      materialId = material.data.id;
      storagePath = `${createClientId()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from('content-materials').upload(storagePath, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      ingestionStarted = true;
      const { data: ingestResult, error: ingestError } = await supabase.functions.invoke('ingest-material', {
        body: { material_id: material.data.id, storage_path: storagePath, extracted_text: null, subject_id, grade: Number(grade), material_type: 'syllabus' },
      });
      if (ingestError) throw new Error(`Syllabus processing failed: ${await edgeFunctionErrorMessage(ingestError, 'The syllabus PDF could not be processed.')}`);
      if (!ingestResult?.success || !ingestResult.extracted_characters) throw new Error('Syllabus was uploaded but could not be indexed for AI use.');
      toast.success(`Syllabus processed. ${ingestResult.topics_created || 0} topics generated.`);
      setSyllabusUpload({ subject_id: '', grade: '', file: null, title: '' });
      fetchMaterials(); fetchCurriculum();
    } catch (error) {
      if (!ingestionStarted) {
        if (storagePath) await supabase.storage.from('content-materials').remove([storagePath]);
        if (materialId) await supabase.from('content_materials').delete().eq('id', materialId);
        toast.error(error instanceof Error ? error.message : 'Syllabus upload failed.');
      } else {
        toast.error(`${error instanceof Error ? error.message : 'Syllabus processing failed.'} The PDF was kept in Materials for retry after OCR is available.`);
      }
    } finally {
      setUploadingSyllabus(false);
    }
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

  const createManagedUser = async (input: { email: string; password: string; fullName: string; role: 'admin' | 'teacher'; school: string; grade: number }) => {
    const { error } = await supabase.functions.invoke('manage-admin-users', {
      body: { action: 'create', ...input },
    });
    if (error) {
      toast.error(error.message || 'Failed to register account.');
      return false;
    }
    toast.success(`${input.role === 'admin' ? 'Admin' : 'Teacher'} account registered.`);
    await fetchUsers();
    return true;
  };

  const deleteManagedUser = async (userId: string) => {
    const { error } = await supabase.functions.invoke('manage-admin-users', {
      body: { action: 'delete', userId },
    });
    if (error) {
      toast.error(error.message || 'Failed to delete account.');
      return false;
    }
    toast.success('Staff account deleted.');
    if (selectedUser?.id === userId) setSelectedUser(null);
    await fetchUsers();
    return true;
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
            <Shield className="h-5 w-5 text-gold" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-chalk">Admin Dashboard</h1>
            <p className="text-muted-board text-sm">Manage platform content, users, curriculum, and analytics.</p>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Open admin menu"
            aria-expanded={menuOpen}
            title="Menu"
            className="flex items-center justify-center rounded-lg px-2 py-2 text-muted-board transition-colors hover:bg-white/5 hover:text-chalk sm:px-3"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100dvh-8rem)] w-[min(16rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-white/15 bg-board-deep p-2 shadow-xl" role="menu" aria-label="Admin sections">
              {TABS.map((tab) => {
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="menuitem"
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => { setActiveTab(selected ? null : tab.id); setMenuOpen(false); }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${selected ? 'bg-gold/10 text-gold' : 'text-muted-board hover:bg-white/5 hover:text-chalk'}`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activeTab === 'overview' && (
        <OverviewTab
          userCount={userCount} topicCount={topicCount} lessonCount={lessonCount} questionCount={questionCount}
          materialCount={materialCount} approvedMaterials={approvedMaterialCount}
          usersByGrade={usersByGrade} topicsBySubject={topicsBySubject}
          activityFeed={activityFeed} recentSignups={recentSignups}
          announcements={announcements} onPostAnnouncement={postAnnouncement}
          onDeleteAnnouncement={deleteAnnouncement}
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
          selectedFile={selectedFile} setSelectedFile={setSelectedFile}
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

      {activeTab === 'past-papers' && (
        <PastPapersTab
          papers={pastPapers} subjects={subjects} showForm={showPastPaperForm} setShowForm={setShowPastPaperForm}
          editingPaper={editingPastPaper}
          onSubmit={handlePastPaperSubmit} onEdit={handlePastPaperEdit} onDelete={handlePastPaperDelete}
          selectedFile={pastPaperFile} setSelectedFile={setPastPaperFile}
          selectedAnswerFile={pastPaperAnswerFile} setSelectedAnswerFile={setPastPaperAnswerFile}
        />
      )}

      {activeTab === 'billing' && (
        <PaymentsTab payments={payments} revenue={revenue} loading={paymentsLoading} />
      )}

      {activeTab === 'personas' && (
        <PersonasTab personas={personas} loading={personasLoading} onSave={handleSavePersona} />
      )}

      {activeTab === 'users' && (
        <UsersTab
          users={users} userSearch={userSearch} setUserSearch={setUserSearch}
          userGradeFilter={userGradeFilter} setUserGradeFilter={setUserGradeFilter}
          toggleUserRole={toggleUserRole} currentUserId={profile?.id}
          createManagedUser={createManagedUser} deleteManagedUser={deleteManagedUser}
          selectedUser={selectedUser} setSelectedUser={setSelectedUser}
          openUserDetail={openUserDetail} userProgress={userProgress} userSessions={userSessions} refreshUsers={fetchUsers}
        />
      )}

      {activeTab === 'curriculum' && (
        <CurriculumTab
          subjects={subjects} topics={topics} lessons={lessons}
          curriculumSubjectFilter={curriculumSubjectFilter} setCurriculumSubjectFilter={setCurriculumSubjectFilter}
          showTopicForm={showTopicForm} setShowTopicForm={setShowTopicForm}
          topicForm={topicForm} setTopicForm={setTopicForm} onTopicSubmit={handleTopicSubmit}
          syllabusUpload={syllabusUpload} setSyllabusUpload={setSyllabusUpload}
          onSyllabusUpload={handleSyllabusUpload} uploadingSyllabus={uploadingSyllabus}
        />
      )}

      {activeTab === 'moderation' && (
        <ModerationTab flags={moderationFlags} loading={moderationLoading} onMarkReviewed={handleMarkReviewed} />
      )}

      {activeTab === 'feedback' && (
        <FeedbackTab feedback={feedback} loading={feedbackLoading} />
      )}

      {activeTab === 'system-health' && (
        <SystemHealthTab errors={errorLogs} loading={errorLogsLoading} />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          profile={profile}
          users={users}
          isPlatformFree={isPlatformFree}
          accessLoading={accessLoading}
          onTogglePlatformFree={togglePlatformFree}
          onGrantBonus={grantBonusAccess}
          rebuildSearchIndex={rebuildSearchIndex}
        />
      )}
    </div>
  );
}
