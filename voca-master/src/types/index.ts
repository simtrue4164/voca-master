// ── 조직 ──────────────────────────────────────────
export type Branch = {
  id: string;
  name: string;
  created_at: string;
};

export type Class = {
  id: string;
  branch_id: string;
  name: string;
  start_date: string;
  end_date: string;
};

// ── 사용자 ───────────────────────────────────────
export type UserRole = 'student' | 'admin_super' | 'admin_branch' | 'admin_class';

export type Profile = {
  id: string;
  role: UserRole;
  name: string;
  exam_no: string | null;     // 학생 전용
  branch_id: string | null;
  class_id: string | null;
  is_active: boolean;
};

// ── 어휘 ─────────────────────────────────────────
export type Vocabulary = {
  id: string;
  day: number;        // 1–60
  word: string;
  exam_count: number;
};

export type WordMeaning = {
  id: string;
  vocab_id: string;
  pos: 'n.' | 'v.' | 'adj.' | 'adv.' | 'prep.' | 'conj.';
  meaning_ko: string;
  display_order: number;
};

export type WordSynonym = {
  id: string;
  vocab_id: string;
  synonym: string;
  display_order: number;
};

// 어휘 + 의미 + 동의어 조인 타입 (학습/시험 화면용)
export type VocabularyFull = Vocabulary & {
  meanings: WordMeaning[];
  synonyms: WordSynonym[];
};

// ── 학습 ─────────────────────────────────────────
export type LearningStatus = 'studied' | 'memorized' | 'failed';

export type LearningLog = {
  id: string;
  student_id: string;
  vocab_id: string;
  status: LearningStatus;
  reviewed_at: string;
};

export type StudentProgress = {
  student_id: string;
  total_words: number;
  studied_count: number;
  memorized_count: number;
  failed_count: number;
  progress_rate: number;    // 학습진도: 열람 단어 / 오늘까지 대상 단어 × 100
  learning_rate: number;    // 학습율: memorized / (memorized + failed) × 100
  streak_days: number;      // 연속 학습일
  current_day: number;
};

// ── 학생 대시보드 AI ──────────────────────────
export type StudentCoaching = {
  message: string;          // Gemini 생성 코멘트 (한국어 3문장 이내)
  generated_at: string;
};

export type StudyRecommendation = {
  steps: Array<{
    order: number;
    action: 'review' | 'study' | 'self_test';
    label: string;           // "복습 (12단어)"
    path: string;            // 클라이언트 라우팅 경로
  }>;
};

export type StudentGoalPrediction = {
  predicted_rate_current: number;   // 현재 추이 유지 시 예측 달성률
  predicted_rate_daily: number;     // 매일 학습 시 예측 달성률
  weak_exam_days: number[];         // 다음 시험 범위 중 학습율 70% 미만 day
};

// ── 시험 ─────────────────────────────────────────
export type ExamStatus = 'scheduled' | 'active' | 'closed';

export type Exam = {
  id: string;
  class_id: string;
  title: string;
  day_1: number;
  day_2: number;
  duration_min: number;       // 기본 8
  starts_at: string;
  ends_at: string;            // DB GENERATED (starts_at + duration_min)
  status: ExamStatus;
  created_by: string;
};

// 학생에게 전달하는 문항 (accepted_answers 제외)
export type ExamQuestion = {
  id: string;
  exam_id: string;
  vocab_id: string;
  question_no: number;
  word: string;               // vocabulary.word join
};

// 서버 내부용 (클라이언트 전달 금지)
export type ExamQuestionWithAnswers = ExamQuestion & {
  accepted_answers: Array<{ pos: string; meaning_ko: string }>;
};

// 학생 임시 답안 (localStorage)
export type DraftAnswers = Record<string, string>;
// { [question_id]: "학생 입력값" }

export type ExamResult = {
  id: string;
  exam_id: string;
  student_id: string;
  answers: Record<string, string>;
  scores: Record<string, boolean>;   // { question_id: true/false }
  score: number;                     // 0–50
  submitted_at: string;
  is_forced: boolean;
};

// 제출 직후 학생에게 반환
export type ExamResultDetail = ExamResult & {
  wrong_vocab_ids: string[];
  time_spent_sec: number | null;
};

// 관리자용 반 전체 현황
export type ExamResultSummary = {
  student_id: string;
  student_name: string;
  exam_no: string;
  score: number | null;           // null = 미제출
  submitted_at: string | null;
  time_spent_sec: number | null;
  is_forced: boolean;
};

export type ExamQuestionStat = {
  question_id: string;
  word: string;
  correct_rate: number;           // 0–100
};

export type ExamStats = {
  exam_id: string;
  total_students: number;
  submitted_count: number;
  avg_score: number;
  question_stats: ExamQuestionStat[];
};

// ── 상담 ─────────────────────────────────────────
export type RiskFactors = {
  progress_rate: number;
  score_trend: number;            // 최근 3회 점수 변화
  fail_rate: number;
  consecutive_absent: number;
};

export type CounselingRecommendation = {
  id: string;
  student_id: string;
  admin_id: string;
  risk_score: number;
  reason: string;
  factors: RiskFactors;
  created_at: string;
};

export type CounselingSlot = {
  id: string;
  admin_id: string;
  slot_date: string;
  slot_hour: number;              // 9–16
  is_active: boolean;
};

export type CounselingStatus = 'pending' | 'scheduled' | 'completed' | 'dismissed';
export type CounselingSource = 'student' | 'ai';

export type CounselingRequest = {
  id: string;
  student_id: string;
  admin_id: string;
  source: CounselingSource;
  recommendation_id: string | null;
  request_note: string | null;
  slot_id: string | null;
  status: CounselingStatus;
  created_at: string;
};

export type CounselingRecord = {
  id: string;
  request_id: string;
  admin_id: string;
  content: string;
  outcome: '정상복귀' | '집중관리' | '기타' | null;
  created_at: string;
};

// ── 대시보드 AI ───────────────────────────────
export type DashboardInsight = {
  summary: string;               // Gemini 생성 코멘트
  generated_at: string;
};

export type AnomalyAlert = {
  student_id: string;
  student_name: string;
  description: string;           // "3일 전까지 상위권 → 2일 연속 미학습"
};

export type GoalPrediction = {
  predicted_rate: number;        // 전체 예측 달성률
  at_risk_count: number;
  predicted_rate_excl_risk: number;
};
