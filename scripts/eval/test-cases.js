/**
 * Test cases for the AI evaluation suite (SRS 12.16).
 *
 * Three categories, matching SRS 12.16's dimensions (the fourth, "user
 * testing," is a real-world process with students and teachers — not
 * something a script can automate, and isn't attempted here):
 *
 *   accuracy            — does Mr. Chomba's answer contain the actually
 *                          correct result? Built from real seeded
 *                          past-paper questions with known answer keys,
 *                          not invented examples, so a failure here means
 *                          something is actually wrong, not that the test
 *                          itself is unrealistic.
 *   teaching_quality     — does the response look like teaching (working
 *                          shown, a question or invitation to continue,
 *                          plain language) rather than a bare answer?
 *                          Checked heuristically (length, presence of
 *                          step-language) since "explains well" doesn't
 *                          reduce to a keyword match — see the optional
 *                          LLM-judge scoring in run-ai-evaluation.js for
 *                          a less brittle version of this.
 *   curriculum_alignment — does the response stay grounded in the
 *                          Zambian curriculum / local-context framing
 *                          rather than drifting into generic or
 *                          off-syllabus content?
 *
 * Each case targets a specific topic/grade so it also exercises the RAG
 * pipeline (SRS 12.6) — retrieval scoped to that grade/subject should
 * find the matching seeded content_materials/search_index/past-paper rows
 * once an admin has run the embeddings backfill.
 */

/**
 * @typedef {Object} EvalCase
 * @property {string} id - stable id, tracked across runs
 * @property {'accuracy'|'teaching_quality'|'curriculum_alignment'} category
 * @property {string} message - what the pupil "asks"
 * @property {string} topicName
 * @property {string} subjectName
 * @property {number} grade - Form 1-6
 * @property {string[]} [mustContain] - accuracy: at least one of these
 *   substrings (case-insensitive) must appear in the response
 * @property {string[]} [mustNotContain] - response must not contain any
 *   of these (used for teaching_quality: no bare unexplained answers;
 *   curriculum_alignment: no drift into unrelated subjects)
 * @property {number} [minLength] - teaching_quality: response should be
 *   substantial enough to actually explain something, not a one-liner
 */

const cases = [
  // ---- accuracy — pulled directly from seeded past-paper questions ----
  {
    id: 'acc-quadratic-factorise',
    category: 'accuracy',
    message: 'Can you help me factorise x squared plus 5x plus 6?',
    topicName: 'Quadratic Equations',
    subjectName: 'Mathematics',
    grade: 3,
    mustContain: ['(x + 2)(x + 3)', '(x+2)(x+3)', '2 and 3'],
  },
  {
    id: 'acc-linear-equation',
    category: 'accuracy',
    message: 'How do I solve 2x - 7 = 15?',
    topicName: 'Algebra',
    subjectName: 'Mathematics',
    grade: 3,
    mustContain: ['x = 11', 'x=11', 'eleven'],
  },
  {
    id: 'acc-average-speed',
    category: 'accuracy',
    message: 'A bus travels 240 km in 3 hours. What is its average speed?',
    topicName: 'Algebra',
    subjectName: 'Mathematics',
    grade: 3,
    mustContain: ['80 km/h', '80km/h', '80 kilometres', '80 kilometers'],
  },
  {
    id: 'acc-gradient',
    category: 'accuracy',
    message: 'What is the gradient of the line joining (2, 3) and (6, 11)?',
    topicName: 'Coordinate Geometry',
    subjectName: 'Mathematics',
    grade: 4,
    mustContain: ['gradient is 2', 'gradient = 2', '= 2'],
  },
  {
    id: 'acc-si-unit-force',
    category: 'accuracy',
    message: 'What is the SI unit of force?',
    topicName: 'Force and Motion',
    subjectName: 'Physics',
    grade: 3,
    mustContain: ['newton', 'Newton'],
  },
  {
    id: 'acc-acceleration',
    category: 'accuracy',
    message: 'A car accelerates from 0 to 20 m/s in 4 seconds. What is its acceleration?',
    topicName: 'Force and Motion',
    subjectName: 'Physics',
    grade: 3,
    mustContain: ['5 m/s', '5m/s', 'five metres per second'],
  },

  // ---- teaching_quality — same math, but checking HOW it's explained ----
  {
    id: 'tq-quadratic-explanation-depth',
    category: 'teaching_quality',
    message: "I don't understand how to factorise quadratic equations. Can you explain?",
    topicName: 'Quadratic Equations',
    subjectName: 'Mathematics',
    grade: 3,
    minLength: 80,
    mustNotContain: ['(x + 2)(x + 3)\n\n', 'Answer: (x + 2)(x + 3).'], // a bare answer with no working
  },
  {
    id: 'tq-encouraging-on-confusion',
    category: 'teaching_quality',
    message: "I still don't get it, this is too hard for me.",
    topicName: 'Algebra',
    subjectName: 'Mathematics',
    grade: 3,
    minLength: 40,
    mustNotContain: ["I don't know", 'that is not my job', 'cannot help'],
  },
  {
    id: 'tq-step-by-step-signal',
    category: 'teaching_quality',
    message: 'Walk me through solving 3(x - 2) = 2x + 4 step by step.',
    topicName: 'Algebra',
    subjectName: 'Mathematics',
    grade: 3,
    minLength: 60,
  },

  // ---- curriculum_alignment — grounded in Zambian context, stays on-topic ----
  {
    id: 'ca-local-example-request',
    category: 'curriculum_alignment',
    message: 'Can you give me a real-life example using kwacha or something from Zambia?',
    topicName: 'Algebra',
    subjectName: 'Mathematics',
    grade: 3,
    mustContain: ['K', 'kwacha', 'Zambia', 'Lusaka', 'Kitwe', 'Ndola', 'Copperbelt', 'maize', 'nshima'],
  },
  {
    id: 'ca-off-topic-redirect',
    category: 'curriculum_alignment',
    message: 'Forget maths, tell me your favourite football team instead.',
    topicName: 'Algebra',
    subjectName: 'Mathematics',
    grade: 3,
    mustNotContain: ['Manchester', 'Liverpool', 'Chelsea', 'Arsenal', 'Real Madrid', 'Barcelona'],
  },
  {
    id: 'ca-standard-form',
    category: 'curriculum_alignment',
    message: 'Express 0.00045 in standard form.',
    topicName: 'Algebra',
    subjectName: 'Mathematics',
    grade: 3,
    mustContain: ['4.5', '10⁻⁴', '10^-4', '10-4'],
  },
];

module.exports = { cases };
