# SDD (Schema-Driven Design Document)
# Voca-Master: AI 기반 통합 편입영어 학습 관리 시스템

> 본 문서는 개발에 앞서 DB 스키마 → TypeScript 타입 → API 계약 → 컴포넌트 구조 순으로
> 설계를 완전히 확정하는 Schema-Driven Development 방식으로 작성됩니다.
> 코드는 항상 이 문서의 계약(Contract)을 따릅니다.

---

## 1. 시스템 경계 (System Boundary)

```
[Browser: Next.js App]
    ↕ HTTPS / Supabase Realtime (WebSocket)
[Supabase: PostgreSQL + Auth + Realtime + Storage]
    ↕ Server Action / Route Handler
[Vercel AI SDK → Gemini 1.5 Pro]
```

**사용자 역할:**

| Role | 설명 |
|------|------|
| `student` | 수험번호로 로그인, 특정 반 소속 |
| `admin_super` | 전체 지점/반 접근, 지점/관리자 관리 가능 |
| `admin_branch` | 담당 지점 내 모든 반 접근 |
| `admin_class` | 담당 반만 접근 (반 담임) |

---

## 2. 데이터베이스 스키마 (Supabase PostgreSQL DDL)

### 2-1. 조직 구조

```sql
-- 지점 (예: 대구본원, 서울캠퍼스)
CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 반 (예: 2026 상반기 A반)
CREATE TABLE classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,  -- start_date + 60일
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2-2. 사용자 (Supabase Auth 연동)

```sql
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN (
               'student', 'admin_super', 'admin_branch', 'admin_class'
             )),
  name       TEXT NOT NULL,
  exam_no    TEXT UNIQUE,   -- 학생 전용. {exam_no}@voca-master.internal 로 Auth 등록
  branch_id  UUID REFERENCES branches(id),  -- admin_branch/class 필수, super NULL
  class_id   UUID REFERENCES classes(id),   -- admin_class/student 필수, 나머지 NULL
  is_active  BOOLEAN NOT NULL DEFAULT true, -- 관리자 비활성화용
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_view_self" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "admin_view_students" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_super'
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_branch'
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_class'
      AND class_id = (SELECT class_id FROM profiles WHERE id = auth.uid())
    )
  );
```

---

### 2-3. 어휘 데이터

```sql
-- VOCA.csv 기반 3,000단어
CREATE TABLE vocabulary (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day        SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 60),
  word       TEXT NOT NULL,
  exam_count SMALLINT NOT NULL DEFAULT 0,  -- 기출 횟수 (문항 생성 시 낮은 순 우선)
  UNIQUE (day, word)
);

CREATE INDEX idx_vocabulary_day ON vocabulary(day);

-- 품사별 의미 (1단어 N개, 채점 기준)
CREATE TABLE word_meanings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  pos           TEXT NOT NULL CHECK (pos IN ('n.','v.','adj.','adv.','prep.','conj.')),
  meaning_ko    TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_word_meanings_vocab ON word_meanings(vocab_id);

-- 동의어 (1단어 N개 영어 동의어)
CREATE TABLE word_synonyms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  synonym       TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_word_synonyms_vocab ON word_synonyms(vocab_id);
```

---

### 2-4. 학습 로그

```sql
CREATE TABLE learning_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vocab_id    UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('studied', 'memorized', 'failed')),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, vocab_id)
);

CREATE INDEX idx_learning_logs_student ON learning_logs(student_id);
```

---

### 2-5. 시험 시스템

```sql
-- 관리자가 생성하는 시험 (실시간 CBT)
-- 문제 형식: 영어 단어 제시 → 학생이 한국어 뜻 직접 입력 (서술형)
-- 출제 방식: day_1에서 25문항 + day_2에서 25문항 = 총 50문항
CREATE TABLE exams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  day_1        SMALLINT NOT NULL CHECK (day_1 BETWEEN 1 AND 60),
  day_2        SMALLINT NOT NULL CHECK (day_2 BETWEEN 1 AND 60),
  -- 총 50문항 고정 (day당 25문항)
  duration_min SMALLINT NOT NULL DEFAULT 8,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,  -- 트리거로 자동 계산: starts_at + duration_min분
  status       TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'active', 'closed')),
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 시험 문항 (서버에서 자동 생성)
-- accepted_answers: word_meanings 스냅샷 (시험 생성 시점 의미 보존)
CREATE TABLE exam_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  vocab_id         UUID NOT NULL REFERENCES vocabulary(id),
  question_no      SMALLINT NOT NULL,  -- 1~50
  accepted_answers JSONB NOT NULL
  -- [{ "pos": "v.", "meaning_ko": "버리다, 포기하다" }, ...]
);

CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id);

-- 학생 답안 및 채점 결과
CREATE TABLE exam_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL,   -- { question_id: "학생 입력값" }
  scores       JSONB NOT NULL,   -- { question_id: true | false }
  score        SMALLINT NOT NULL DEFAULT 0,  -- 맞힌 문항 수 (0~50)
  submitted_at TIMESTAMPTZ DEFAULT now(),
  is_forced    BOOLEAN NOT NULL DEFAULT false,  -- 관리자 강제 종료로 제출된 경우
  UNIQUE (exam_id, student_id)
);

CREATE INDEX idx_exam_results_student ON exam_results(student_id);
CREATE INDEX idx_exam_results_exam    ON exam_results(exam_id);
```

---

### 2-6. 상담 시스템

```sql
-- AI 위험도 분석 결과
CREATE TABLE counseling_recommendations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id   UUID NOT NULL REFERENCES profiles(id),
  risk_score NUMERIC(4,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
  reason     TEXT NOT NULL,   -- AI 생성 한국어 사유
  factors    JSONB NOT NULL,  -- { progress_rate, score_trend, fail_rate, consecutive_absent }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 담당자별 상담 가능 시간대 (날짜 × 시간)
CREATE TABLE counseling_slots (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_hour SMALLINT NOT NULL CHECK (slot_hour BETWEEN 9 AND 16),
  -- 9=09:00~10:00, 10=10:00~11:00 ... 16=16:00~17:00
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (admin_id, slot_date, slot_hour)
);

-- 상담 신청 (학생 직접 신청 or AI 추천에서 전환)
CREATE TABLE counseling_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id          UUID NOT NULL REFERENCES profiles(id),
  source            TEXT NOT NULL CHECK (source IN ('student', 'ai')),
  recommendation_id UUID REFERENCES counseling_recommendations(id),
  request_note      TEXT,   -- 학생이 작성한 상담 요청 내용
  slot_id           UUID REFERENCES counseling_slots(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','scheduled','completed','dismissed')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_counseling_requests_student ON counseling_requests(student_id);
CREATE INDEX idx_counseling_requests_admin   ON counseling_requests(admin_id);

-- 상담 기록 (담당자가 상담 완료 후 작성)
CREATE TABLE counseling_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES counseling_requests(id),
  admin_id   UUID NOT NULL REFERENCES profiles(id),
  content    TEXT NOT NULL,
  outcome    TEXT CHECK (outcome IN ('정상복귀','집중관리','기타')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2-7. 대시보드 AI 캐시

```sql
-- AI 인사이트/코칭/예측 결과 캐시 (학생·관리자 공용, 매일 갱신)
CREATE TABLE dashboard_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cache_type   TEXT NOT NULL CHECK (cache_type IN (
                 'admin_insight','admin_anomalies','admin_goal_prediction',
                 'student_coaching','student_prediction'
               )),
  content      JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, cache_type)
);
```

---

## 3. TypeScript 타입 계약 (Types Contract)

> 모든 컴포넌트와 API는 이 타입을 import하여 사용합니다.
> 파일 위치: `src/types/index.ts`

```typescript
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
  learning_rate: number;    // 학습율: memorized / (memorized + failed) × 100, 테스트 안 한 경우 null
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
```

---

## 4. API 계약 (Next.js App Router Route Handlers)

```
── Auth ──────────────────────────────────────────────────
POST   /api/auth/login                    → Session (수험번호 or 이메일)
POST   /api/auth/logout

── 어휘 ──────────────────────────────────────────────────
GET    /api/vocabulary?day={1-60}         → VocabularyFull[]
GET    /api/vocabulary/[id]               → VocabularyFull
PUT    /api/vocabulary/[id]/meanings      → WordMeaning[] (admin)
PUT    /api/vocabulary/[id]/synonyms      → WordSynonym[] (admin)
POST   /api/vocabulary/ai-fill            → bulk Gemini 의미/동의어 생성 (admin)
PATCH  /api/vocabulary/[id]/exam-count    → { exam_count: 0 } 리셋 (admin)

── 학습 ──────────────────────────────────────────────────
POST   /api/learning/log                  → upsert LearningLog
GET    /api/learning/progress             → StudentProgress (본인)
GET    /api/learning/review               → VocabularyFull[] (복습 대상: failed + 미학습)

── 학생 대시보드 AI ──────────────────────────────────────
GET    /api/student/dashboard/coaching    → StudentCoaching (캐시 or Gemini 생성)
GET    /api/student/dashboard/recommendation → StudyRecommendation (서버 계산)
GET    /api/student/dashboard/prediction  → StudentGoalPrediction (서버 계산)

── 시험 ──────────────────────────────────────────────────
GET    /api/exams?class_id=               → Exam[]
POST   /api/exams                         → Exam + 문항 50개 자동 생성 (admin)
GET    /api/exams/[id]/questions          → ExamQuestion[] (accepted_answers 제외, active만)
POST   /api/exams/[id]/submit             → ExamResultDetail (서버 채점 후 즉시 반환)
GET    /api/exams/[id]/results            → ExamResultSummary[] (admin)
GET    /api/exams/[id]/stats              → ExamStats (admin)
PATCH  /api/exams/[id]/status             → Exam (admin: active | closed)

── 관리자 ────────────────────────────────────────────────
GET    /api/admin/students                → Profile[] + StudentProgress[]
GET    /api/admin/students/[id]/progress  → StudentProgress + ExamResult[]

── 상담 ──────────────────────────────────────────────────
POST   /api/counseling/generate           → CounselingRecommendation[] (Gemini, admin)
GET    /api/counseling/requests           → CounselingRequest[] (admin: 담당 범위)
POST   /api/counseling/requests           → CounselingRequest (학생 직접 신청)
GET    /api/counseling/requests/[id]      → CounselingRequest + CounselingRecord
PATCH  /api/counseling/requests/[id]      → CounselingRequest (status, slot_id 변경)
POST   /api/counseling/records            → CounselingRecord (상담 기록 작성)
GET    /api/counseling/[student_id]/history-summary → Gemini 요약 (streaming)

GET    /api/counseling/slots              → CounselingSlot[] (담당자 본인)
PUT    /api/counseling/slots              → CounselingSlot[] (날짜별 슬롯 일괄 저장)
PATCH  /api/counseling/slots/[id]         → CounselingSlot (is_active 토글)

── 대시보드 AI ───────────────────────────────────────────
GET    /api/admin/dashboard/insight       → DashboardInsight (캐시 or Gemini 생성)
GET    /api/admin/dashboard/anomalies     → AnomalyAlert[]
GET    /api/admin/dashboard/goal-prediction → GoalPrediction
```

---

## 5. 페이지 구조 (Next.js App Router)

```
src/app/
├── (auth)/
│   └── login/page.tsx              # 수험번호 로그인(학생) / 이메일 로그인(관리자) 탭
│
├── (student)/
│   ├── layout.tsx                  # 하단 네비게이션 (대시보드/학습/복습/시험/상담)
│   ├── dashboard/page.tsx
│   │   # 요약 카드 (학습진도, 학습율, 연속학습일, 다음시험)
│   │   # AI 학습 코치 메시지 (Gemini, 1일 캐시)
│   │   # 오늘 추천 학습 순서 (서버 계산)
│   │   # 60일 목표 달성 예측
│   │   # 60일 학습 히트맵
│   ├── study/
│   │   ├── page.tsx                # Day 목록 (전체/미완료/복습필요, 진도·학습율 표시)
│   │   └── [day]/page.tsx
│   │       # 모드 선택: [플래시카드] [셀프 테스트]
│   │       # 플래시카드: 카드 플립 + 알겠어요/모르겠어요 → status 업데이트
│   │       # 셀프 테스트: 단어 표시 + 뜻 입력 → 즉시 채점 → 학습율 반영
│   │       # 완료 화면: 학습율 표시, 오답 복습 바로가기
│   ├── review/
│   │   ├── page.tsx                # 복습 목록 (오답/미학습/Day별, 학습율 표시)
│   │   └── session/page.tsx
│   │       # 학습과 동일한 플래시카드/셀프 테스트 UI
│   │       # 완료 화면: 학습율 변화 (Before→After) 표시
│   ├── exam/
│   │   ├── page.tsx                # 시험 목록 (상태별: 진행중/예정/종료)
│   │   └── [id]/
│   │       ├── page.tsx
│   │       │   # active + 미제출: 입장 확인 모달 → 응시 화면
│   │       │   #   문항 네비게이터 + 단어 표시 + 뜻 입력 + 8분 타이머
│   │       │   # active + 제출완료 / closed: 결과 화면으로 redirect
│   │       └── result/page.tsx
│   │           # 점수(n/50), 소요시간, 문항별 정오 표시
│   │           # 오답 단어 목록 + [오답 복습하기]
│   └── counseling/
│       ├── page.tsx                # 내 상담 목록 (상태별: 대기/예약/완료)
│       ├── [id]/page.tsx           # 상담 상세 (요청내용, 예약일시, 완료 결과 태그)
│       └── new/page.tsx            # 상담 신청 (월별 캘린더 → 시간 선택 → 요청 내용)
│
└── (admin)/
    ├── layout.tsx                  # 역할별 메뉴 필터링
    ├── dashboard/page.tsx          # AI 인사이트, 이상감지, 목표예측, 시험현황, 상담알림
    ├── branches/page.tsx           # 지점 관리 (super만)
    ├── classes/page.tsx            # 반 관리 (super, branch)
    ├── admins/page.tsx             # 관리자 관리 (super, branch)
    ├── students/
    │   ├── page.tsx                # 학생 목록 (수험번호/이름 검색, 진행률/위험도 정렬)
    │   └── [id]/page.tsx           # 학생 상세 (히트맵, 점수추이, 취약단어, 상담이력)
    ├── exams/
    │   ├── page.tsx                # 시험 목록 (상태/반 필터)
    │   ├── new/page.tsx            # 시험 출제 (day_1, day_2, 시작 시각)
    │   └── [id]/page.tsx           # 실시간 제출 현황(Realtime) + 종료 후 성적 분석
    ├── vocabulary/page.tsx         # 3,000단어 편집 (의미/동의어 모달, AI 일괄 생성)
    └── counseling/
        ├── page.tsx                # 탭: [상담 신청 목록] [시간대 관리]
        └── [id]/page.tsx           # 상담 상세 (요청내용, 이력요약, 기록작성)
```

---

## 6. 컴포넌트 설계 원칙

**Server Component (기본값):** 데이터 fetch가 있는 페이지 단위
**Client Component (`'use client'`):** 인터랙션이 있는 말단 컴포넌트만

```
src/components/
├── ui/
│   └── Button, Badge, Card, Modal, Tabs, Toast
│
├── vocabulary/
│   ├── FlashCard.tsx           # 'use client' - 플립 애니메이션 (motion/react)
│   │                           #   앞: 영어 단어 / 뒤: 품사별 의미 + 동의어
│   │                           #   버튼: 알겠어요(memorized) / 모르겠어요(failed)
│   ├── SelfTestCard.tsx        # 'use client' - 셀프 테스트 카드
│   │                           #   영어 단어 표시 + 뜻 입력 + 즉시 채점
│   │                           #   정답/오답 표시 후 다음 이동
│   ├── StudyModeToggle.tsx     # 'use client' - [플래시카드] [셀프 테스트] 탭
│   ├── StudyProgress.tsx       # 'use client' - 문항 네비게이터 (완료/미완료)
│   ├── StudyComplete.tsx       # 'use client' - 완료 화면 (학습율, 오답 바로가기)
│   ├── DayList.tsx             # Server - Day 목록 (진도·학습율 표시)
│   ├── WordList.tsx            # Server - 단어 목록
│   └── WordEditModal.tsx       # 'use client' - 의미/동의어 CRUD (관리자용)
│
├── exam/
│   ├── QuestionCard.tsx        # 'use client' - 영어 단어 + 한국어 뜻 입력
│   ├── QuestionNavigator.tsx   # 'use client' - 문항 번호 패널
│   ├── Timer.tsx               # 'use client' - ends_at 기준 카운트다운 + 자동 제출
│   ├── SubmitModal.tsx         # 'use client' - 미답 확인 후 최종 제출
│   ├── ResultSummary.tsx       # Server - 점수 카드 (n/50)
│   ├── ResultChart.tsx         # 'use client' - 정답/오답 시각화
│   ├── WrongAnswerList.tsx     # Server - 오답 단어 목록 + 복습 링크
│   └── MonitorTable.tsx        # 'use client' - 실시간 제출 현황 (Supabase Realtime)
│
├── dashboard/
│   ├── InsightCard.tsx           # 'use client' - 관리자 AI 인사이트 (스트리밍)
│   ├── AnomalyList.tsx           # Server - 이상 감지 학생 목록
│   ├── GoalPredictionCard.tsx    # Server - 관리자용 목표 달성 예측
│   ├── CoachingCard.tsx          # 'use client' - 학생 AI 코치 메시지
│   ├── StudyRecommendation.tsx   # Server - 오늘 추천 학습 순서
│   ├── StudentPrediction.tsx     # Server - 학생 개인 달성 예측
│   ├── ProgressRing.tsx          # 'use client' - 원형 진행률 (학습진도)
│   ├── LearningRateRing.tsx      # 'use client' - 원형 진행률 (학습율)
│   └── HeatMap.tsx               # 'use client' - 60일 학습 캘린더
│
└── counseling/
    ├── SlotCalendar.tsx        # 'use client' - 슬롯 선택 캘린더 (학생 신청용)
    ├── SlotManager.tsx         # 'use client' - 시간대 활성화 토글 (담당자용)
    ├── RequestForm.tsx         # 'use client' - 상담 신청 폼
    ├── HistorySummary.tsx      # 'use client' - Gemini 이력 요약 (스트리밍)
    └── RecordForm.tsx          # 'use client' - 상담 기록 작성
```

---

## 7. AI 통합 설계 (Gemini 1.5 Pro)

### 7-1. 상담 추천 엔진

```
System: 당신은 편입 영어 교육 전문가입니다. 학생의 학습 데이터를 분석하여
        상담이 필요한 학생을 선별하고 한국어로 상담 사유를 작성합니다.

User: 다음 학생들의 데이터를 분석하고 위험도(0-1)와 상담 사유를 반환하세요.
      [{ student_id, name, progress_rate, score_trend, fail_rate, consecutive_absent }]

Response schema (streamObject):
[{
  "student_id": string,
  "risk_score": number,       // 0.00–1.00
  "reason": string,           // 한국어 2–3문장
  "factors": RiskFactors
}]

→ risk_score > 0.5 인 학생만 counseling_recommendations에 upsert
```

### 7-2. 상담 이력 요약

```
GET /api/counseling/[student_id]/history-summary

조건: counseling_records 2건 이상일 때만 호출 (1건은 그대로 표시)

System: 당신은 학생 상담 담당자를 돕는 AI 어시스턴트입니다.

User: 다음 학생의 상담 기록들을 3문장 이내로 요약하세요.
      상담 패턴, 주요 문제, 이전 조치 결과를 포함하세요.
      [{ date, content, outcome }, ...]

→ streamText로 스트리밍 반환
```

### 7-3. 어휘 AI 자동 채우기

```
POST /api/vocabulary/ai-fill

System: 당신은 편입 영어 전문가입니다.

User: 다음 영어 단어들의 품사별 한국어 뜻과 편입 빈출 동의어를 JSON으로 반환하세요.
      ["abandon", "abhor", ...]

Response schema (streamObject):
[{
  "word": string,
  "meanings": [{ "pos": string, "meaning_ko": string }],
  "synonyms": [string]
}]

→ word_meanings, word_synonyms 테이블에 일괄 upsert
```

### 7-4. 관리자 대시보드 AI 인사이트

```
GET /api/admin/dashboard/insight

캐시 전략:
  1. dashboard_cache WHERE user_id = X AND cache_type = 'admin_insight'
     AND generated_at > now() - interval '24h'
  2. 캐시 있으면 반환, 없으면 Gemini 호출 후 캐시 저장

System: 당신은 학원 교육 관리 AI입니다.

User: 다음 반의 어제 학습 현황을 분석하고 담당 교사를 위한 실행 가능한 인사이트를
      3문장 이내로 한국어로 작성하세요.
      { class_name, avg_progress, absent_count, common_wrong_words: [string] }

→ 매일 06:00 cron 또는 수동 요청 시 생성
```

### 7-5. 이상 감지 로직 (서버 계산, Gemini 미사용)

```
GET /api/admin/dashboard/anomalies

조건: 최근 7일 평균 학습 단어 수 대비 최근 2일 연속 0 학습인 학생
SQL:
  WITH avg_7d AS (
    SELECT student_id, AVG(daily_count) as avg_count
    FROM learning_logs_daily  -- 일별 집계 뷰
    WHERE date >= now() - interval '7 days'
    GROUP BY student_id
  )
  SELECT p.id, p.name
  FROM profiles p
  JOIN avg_7d a ON a.student_id = p.id
  WHERE a.avg_count > 5   -- 평소 학습하던 학생
    AND [최근 2일 학습 0]
```

### 7-6. 학생 AI 학습 코치

```
GET /api/student/dashboard/coaching

캐시 전략:
  dashboard_cache WHERE user_id = student_id AND cache_type = 'student_coaching'
  AND generated_at > now() - interval '24h'
  → 캐시 없으면 Gemini 호출 후 저장

입력 데이터:
  {
    name: string,
    current_day: number,
    progress_rate: number,       // 학습진도
    learning_rate: number,       // 학습율
    streak_days: number,
    failed_words: string[],      // 최근 오답 단어 최대 10개
    next_exam: { day_1, day_2, starts_at } | null,
    weak_exam_days: number[]     // 다음 시험 범위 중 학습율 70% 미만 day
  }

System: 당신은 편입 영어 수험생의 AI 학습 코치입니다.
        학생의 데이터를 분석하여 오늘 해야 할 학습을 구체적으로 안내합니다.

User: 다음 학생의 학습 현황을 분석하고 오늘의 학습 코칭 메시지를
      3문장 이내 한국어로 작성하세요.
      반복 오답 단어, 다음 시험 대비 취약 범위, 학습 연속성을 고려하세요.
      [입력 데이터]

→ 매일 첫 대시보드 접속 시 생성
```

### 7-7. 학생 목표 달성 예측 (서버 계산, Gemini 미사용)

```
GET /api/student/dashboard/prediction

계산 로직:
  현재 추이 예측:
    daily_avg = memorized_count / days_elapsed   // 하루 평균 암기 단어 수
    predicted_rate_current = (memorized_count + daily_avg × remaining_days)
                             / 3000 × 100

  매일 학습 시 예측:
    ideal_daily = 50 words/day
    predicted_rate_daily = MIN(100,
      (memorized_count + ideal_daily × remaining_days) / 3000 × 100
    )

  weak_exam_days:
    다음 시험의 day_1, day_2 중
    해당 day의 학습율(memorized / 50) < 70% 인 day 목록
```

### 7-8. 오늘 추천 학습 순서 (서버 계산, Gemini 미사용)

```
GET /api/student/dashboard/recommendation

우선순위 로직:
  1. failed_count > 0  → 복습 추가 (/student/review)
  2. 오늘 day 미학습   → 학습 추가 (/student/study/{today_day})
  3. 오늘 day 학습율 < 70% → 셀프 테스트 추가 (/student/study/{today_day}?mode=test)
  4. 다음 시험 weak_exam_days 존재 → 해당 day 복습 추가
```

---

## 8. CBT 시험 시스템 상세 설계

### 8-1. 문항 형식 및 생성 로직

**문항 형식:** 영어 단어 제시 → 학생이 한국어 뜻 직접 입력 (서술형)

```
Q.  [ 1 / 50 ]           남은 시간: 07:32

    abandon

    정답: [                              ]
```

**문항 자동 생성 알고리즘** (`POST /api/exams` 내부):
```
1. day_1의 vocabulary 50개를 exam_count 오름차순으로 조회
2. 상위 25개 선택 (낮은 기출 빈도 우선)
3. day_2 동일 방식으로 25개 선택
4. 50개 합쳐 셔플 후 question_no 1~50 부여
5. 각 단어의 word_meanings 전체를 accepted_answers에 JSONB 스냅샷
6. exam_questions에 INSERT
7. 선택된 50개 vocabulary.exam_count += 1 (batch UPDATE)
```

> 기출 빈도 순환: 50개 모두 1회 이상 출제되면 다시 낮은 순서부터 순환

---

### 8-2. 시험 상태 전이

```
scheduled ──(관리자 활성화)──► active ──(ends_at 도달 or 강제 종료)──► closed
```

| Status | 학생 접근 | 문항 공개 | 제출 | 관리자 모니터링 |
|--------|----------|----------|------|----------------|
| `scheduled` | 예고 화면 | ✗ | ✗ | ✗ |
| `active` | 응시 가능 | ✓ | ✓ | 실시간 ✓ |
| `closed` | 결과 조회 | ✗ | ✗ | 성적 분석 ✓ |

---

### 8-3. 학생 응시 흐름

```
시험 목록 → active 시험 클릭
  ↓
입장 확인 모달 (시험명, 총 50문항, 8분, 시작 버튼)
  ↓
CBT 응시 화면
  - 상단: 문항 번호 네비게이터 (입력 완료=초록, 미입력=회색)
  - 중앙: 현재 문항 (영어 단어 + 한국어 입력란)
  - 우상: 8분 카운트다운 타이머
  - 하단: 이전/다음 + 최종 제출
  ↓
제출 확인 모달 ("미입력 N문항. 제출하시겠습니까?")
  ↓
서버 즉시 채점 → 결과 화면 (점수 n/50, 오답 목록)
```

**자동 제출:** `ends_at` 도달 시 현재 draft 답안 그대로 submit (빈 답안 포함)

---

### 8-4. 타이머 (서버 권위적)

```typescript
// Timer.tsx ('use client')
const remaining = Math.max(0, new Date(endsAt).getTime() - Date.now());
// remaining === 0 → autoSubmit(draftAnswers)
```

**서버 검증 (`POST /api/exams/[id]/submit`):**
- `now() > ends_at + 10초` → 409
- UNIQUE 중복 제출 → 409
- 정상 → 즉시 채점 후 ExamResultDetail 반환

---

### 8-5. 실시간 모니터링 (Supabase Realtime)

```typescript
// MonitorTable.tsx — 관리자 시험 상세 페이지
supabase
  .channel(`exam:${examId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'exam_results',
    filter: `exam_id=eq.${examId}`,
  }, (payload) => {
    setResults(prev => [...prev, payload.new]);
  })
  .subscribe();
```

---

### 8-6. 채점 로직 (서버)

```
1. exam_questions WHERE exam_id 전체 조회 (accepted_answers 포함)
2. 각 question_id별:
   student_answer = answers[question_id].trim()
   accepted = accepted_answers의 모든 meaning_ko
   정답 조건: student_answer가 accepted 중 하나의 핵심 키워드 포함
   (공백, 조사 제거 후 비교)
3. scores = { q_id: true/false, ... }
4. score = true 개수 (0~50)
5. exam_results upsert
6. 오답 vocab_id → learning_logs status='failed' upsert
7. ExamResultDetail 즉시 반환
```

---

### 8-7. 관리자 강제 종료

```
PATCH /api/exams/[id]/status → { status: 'closed' }
  1. DB status = 'closed'
  2. Supabase Realtime broadcast → 'exam_force_close' 이벤트
  3. 클라이언트 수신 → 현재 draft 자동 submit (is_forced: true)
  4. 미접속 학생 → score = 0, is_forced = true로 처리
```

---

### 8-8. 엣지케이스

| 상황 | 처리 |
|------|------|
| 브라우저 닫기/새로고침 | `localStorage`에 draft 저장, 재진입 시 복원 |
| 네트워크 단절 후 재접속 | ends_at 기준 잔여 시간 재계산, draft 복원 |
| 이미 제출 후 재접속 | 409 → 결과 화면 redirect |
| ends_at 이후 제출 | grace period 10초 이후 409 |
| 관리자 강제 종료 | Realtime broadcast → 자동 제출 |
