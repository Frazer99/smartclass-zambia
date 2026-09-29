import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Profile = {
  id: string;
  full_name: string;
  grade: number;
  school: string | null;
  role: string;
  created_at: string;
  parent_email: string | null;
  email_notifications_enabled: boolean;
  teacher_approved?: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  grades: number[];
  icon: string;
  color: string;
  display_order: number;
};

export type Topic = {
  id: string;
  grade: number;
  name: string;
  category: string;
  syllabus_reference: string | null;
  display_order: number;
  description: string | null;
  subject_id: string | null;
  source_material_id?: string | null;
  parent_topic_id?: string | null;
};

export type SearchResult = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  lesson_id: string | null;
  grade: number;
  item_type: string;
  display_title: string;
  description: string | null;
};

export type LessonContent = {
  intro: string;
  steps: { title: string; body: string; board: string }[];
  examples: { problem: string; solution: string }[];
  summary: string;
  estimatedMinutes?: number;
  objectives?: string[];
  keyTerms?: { term: string; meaning: string }[];
  realWorldExamples?: string[];
  misconceptions?: string[];
  guidedPractice?: { prompt: string; answer?: string; explanation?: string }[];
  independentPractice?: { prompt: string; answer?: string; explanation?: string }[];
  exitTicket?: { prompt: string; answer?: string; explanation?: string };
};

export type Lesson = {
  id: string;
  topic_id: string;
  title: string;
  content: LessonContent;
  difficulty: string;
  display_order: number;
};

export type LessonSession = {
  id: string;
  user_id: string;
  lesson_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  transcript: any[];
  lesson_phase?: 'intro' | 'steps' | 'examples' | 'summary' | 'complete';
  lesson_step_index?: number;
  board_items?: { type: 'heading' | 'body' | 'formula' | 'step' | 'example'; content: string; done?: boolean }[];
  awaiting_understanding_check?: boolean;
};

export type PracticeQuestion = {
  id: string;
  topic_id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  answer_key: string;
  explanation: string | null;
  difficulty: string;
};

export type PracticeAttempt = {
  id: string;
  user_id: string;
  question_id: string;
  submitted_answer: string;
  is_correct: boolean;
  created_at: string;
};

export type ProgressRecord = {
  id: string;
  user_id: string;
  topic_id: string;
  mastery_percentage: number;
  lessons_completed: number;
  total_attempts: number;
  correct_attempts: number;
  last_updated: string;
};

export type ContentMaterial = {
  id: string;
  subject_id: string | null;
  grade: number | null;
  material_type: string;
  title: string;
  source: string;
  source_reference: string | null;
  content_summary: string | null;
  status: string;
  uploaded_at: string;
  storage_path?: string | null;
  extracted_text?: string | null;
  ingestion_error?: string | null;
  subject?: { name: string; code: string; color: string } | null;
};

export type PastPaper = {
  id: string;
  subject_id: string;
  grade: number;
  year: number;
  term: string | null;
  title: string;
  total_marks: number | null;
  duration_minutes: number | null;
  source: string;
  storage_path?: string | null;
  answer_storage_path?: string | null;
  extracted_text?: string | null;
  source_material_id?: string | null;
  subject?: Subject;
};

export type PastPaperQuestion = {
  id: string;
  past_paper_id: string;
  question_number: number;
  question_text: string;
  question_type: string;
  options: string[] | null;
  answer_key: string;
  explanation: string | null;
  marks: number;
  topic_id: string | null;
};

export type PastPaperAttempt = {
  id: string;
  user_id: string;
  question_id: string;
  submitted_answer: string;
  is_correct: boolean;
  created_at: string;
};

export type UserFeedback = {
  id: string;
  user_id: string;
  category: 'complaint' | 'suggestion' | 'system_performance' | 'other';
  message: string;
  contact_allowed: boolean;
  audio_path: string | null;
  status: 'new' | 'in_review' | 'resolved';
  created_at: string;
};

export type TestSubmission = {
  id: string;
  user_id: string;
  topic_id: string;
  source: 'online' | 'upload';
  submitted_text: string | null;
  marks: { question: string; awarded: number; maximum: number; feedback: string }[];
  score: number;
  maximum_score: number;
  created_at: string;
};
