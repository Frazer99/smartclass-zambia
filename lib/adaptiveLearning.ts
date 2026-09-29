import { Topic, Lesson, PracticeQuestion, ProgressRecord } from './supabase-client';

/**
 * Adaptive Learning Engine — implements SRS Chapter 12.9 (Student
 * Personalization AI) and 12.10 (Adaptive Learning Algorithm).
 *
 * Flow: student performance -> analyze weak areas -> select appropriate
 * lesson -> recommend learning path. Every recommendation carries a
 * human-readable `reason` so the pupil (and, later, a parent dashboard)
 * can see *why* something was suggested, not just that it was.
 *
 * Inputs are plain data (topics/progress/recent attempts) rather than
 * Supabase queries, so this stays framework-agnostic and unit-testable —
 * pages are responsible for fetching and passing the data in.
 */

export interface RecentAttempt {
  topic_id: string;
  is_correct: boolean;
  created_at: string;
}

export type Severity = 'high' | 'medium' | 'low';

export interface WeakArea {
  topicId: string;
  topicName: string;
  subjectId: string | null;
  masteryPercentage: number;
  reason: string;
  severity: Severity;
}

export interface LessonRecommendation {
  lesson: Lesson | null;
  topic: Topic | null;
  reason: string;
}

export interface PracticeResult {
  questionId: string;
  isCorrect: boolean;
}

const RECENT_WINDOW = 5;
const LOW_MASTERY_THRESHOLD = 40;
const DEVELOPING_MASTERY_THRESHOLD = 70;
const STRUGGLE_STREAK_THRESHOLD = 2;

/**
 * Chooses the next unseen practice question from the difficulty bucket that
 * best matches the pupil's current performance. Recent wrong answers take
 * priority over all-time mastery so a learner who is suddenly struggling
 * gets a gentler next question instead of being pushed ahead.
 */
export function selectNextAdaptiveQuestion(
  questions: PracticeQuestion[],
  results: PracticeResult[],
  masteryPercentage: number | null | undefined
): PracticeQuestion | null {
  const answeredIds = new Set(results.map((result) => result.questionId));
  const remaining = questions.filter((question) => !answeredIds.has(question.id));
  if (!remaining.length) return null;

  const recentResults = results.slice(-3);
  const recentWrongCount = recentResults.filter((result) => !result.isCorrect).length;
  let wrongStreak = 0;
  for (const result of [...results].reverse()) {
    if (result.isCorrect) break;
    wrongStreak++;
  }
  const mastery = typeof masteryPercentage === 'number' && Number.isFinite(masteryPercentage)
    ? masteryPercentage
    : results.length ? (results.filter((result) => result.isCorrect).length / results.length) * 100 : 0;

  const targetDifficulty = recentWrongCount >= 2 || wrongStreak >= 2
    ? 'introductory'
    : mastery >= 80 && recentResults.length > 0 && recentResults.every((result) => result.isCorrect)
    ? 'advanced'
    : mastery >= 40
    ? 'standard'
    : 'introductory';

  const difficultyOrder = targetDifficulty === 'introductory'
    ? ['introductory', 'standard', 'advanced']
    : targetDifficulty === 'standard'
    ? ['standard', 'introductory', 'advanced']
    : ['advanced', 'standard', 'introductory'];

  for (const difficulty of difficultyOrder) {
    const match = remaining.find((question) => question.difficulty === difficulty);
    if (match) return match;
  }
  return remaining[0];
}

/**
 * Ranks every topic the pupil could be working on and explains, in plain
 * language, why each one deserves attention. Topics at or above the
 * "developing" mastery threshold with no recent trouble are left out
 * entirely — this is a *weak areas* list, not a full topic index.
 */
export function analyzeWeakAreas(
  topics: Topic[],
  progress: ProgressRecord[],
  recentAttempts: RecentAttempt[]
): WeakArea[] {
  const areas: WeakArea[] = [];

  for (const topic of topics) {
    const record = progress.find((p) => p.topic_id === topic.id);
    const mastery = record ? Number(record.mastery_percentage) : 0;
    const attempted = !!record && record.total_attempts > 0;

    const topicRecent = recentAttempts
      .filter((a) => a.topic_id === topic.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, RECENT_WINDOW);

    let trailingWrongStreak = 0;
    for (const a of topicRecent) {
      if (!a.is_correct) trailingWrongStreak++;
      else break;
    }
    const recentWrongCount = topicRecent.filter((a) => !a.is_correct).length;

    let reason = '';
    let severity: Severity | null = null;

    if (trailingWrongStreak >= STRUGGLE_STREAK_THRESHOLD) {
      reason = `Missed the last ${trailingWrongStreak} practice questions in a row`;
      severity = 'high';
    } else if (attempted && mastery < LOW_MASTERY_THRESHOLD) {
      reason = `Mastery is still low (${mastery}%)`;
      severity = 'high';
    } else if (attempted && recentWrongCount >= STRUGGLE_STREAK_THRESHOLD) {
      reason = `Got ${recentWrongCount} of the last ${topicRecent.length} practice questions wrong`;
      severity = 'medium';
    } else if (attempted && mastery < DEVELOPING_MASTERY_THRESHOLD) {
      reason = `Mastery is still developing (${mastery}%)`;
      severity = 'medium';
    } else if (!attempted) {
      reason = 'Not started yet';
      severity = 'low';
    }
    // else: mastered and no recent trouble — not a weak area, skip it

    if (severity) {
      areas.push({
        topicId: topic.id,
        topicName: topic.name,
        subjectId: topic.subject_id,
        masteryPercentage: mastery,
        reason,
        severity,
      });
    }
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
  return areas.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.masteryPercentage - b.masteryPercentage
  );
}

/**
 * Selects the single best next lesson across every subject/topic the
 * pupil has for their grade, prioritizing the weakest areas first, and
 * resuming a topic at the pupil's next uncompleted lesson rather than
 * restarting it from lesson 1.
 */
export function recommendNextLesson(
  topics: Topic[],
  lessons: Lesson[],
  progress: ProgressRecord[],
  recentAttempts: RecentAttempt[]
): LessonRecommendation {
  const weakAreas = analyzeWeakAreas(topics, progress, recentAttempts);

  for (const area of weakAreas) {
    const topicLessons = lessons
      .filter((l) => l.topic_id === area.topicId)
      .sort((a, b) => a.display_order - b.display_order);
    if (!topicLessons.length) continue;

    const record = progress.find((p) => p.topic_id === area.topicId);
    const completedCount = record?.lessons_completed || 0;
    const lesson = topicLessons[Math.min(completedCount, topicLessons.length - 1)];
    const topic = topics.find((t) => t.id === area.topicId) || null;

    return { lesson, topic, reason: area.reason };
  }

  // No weak areas identified (e.g. everything mastered, or no attempts yet
  // anywhere) — fall back to the first lesson of the first topic that has one.
  for (const topic of topics) {
    const topicLessons = lessons
      .filter((l) => l.topic_id === topic.id)
      .sort((a, b) => a.display_order - b.display_order);
    if (topicLessons.length) {
      return { lesson: topicLessons[0], topic, reason: 'A good place to start' };
    }
  }

  return { lesson: null, topic: null, reason: '' };
}
