# Voca-Master System Design Document (SDD)

> 이 문서는 모든 개발의 단일 진실 공급원(Single Source of Truth)입니다.
> 코드를 작성하기 전에 반드시 이 문서를 먼저 읽으세요.
> 최종 업데이트: 2026-04-09

---

## 1. 시스템 개요

**Voca-Master** — AI 기반 편입영어 통합 학습 관리 시스템

- 학생: 60일 커리큘럼, Day당 50단어(총 3,000단어), 동의어/유의어/반의어 학습, CBT 시험, 진도 추적
- 관리자: 지점/반/관리자 3단계 계층, 학년도별 반 관리, 학습진도 모니터링, 시험 생성, AI 상담 추천

---

## 2. DB 스키마

### 2-1. 조직 구조

```sql
CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  year       INTEGER,              -- 학년도 (예: 2026)
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,        -- start_date + 60일
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 반담임(admin_class)과 반의 N:M 배정
CREATE TABLE admin_class_assignments (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  UNIQUE (admin_id, class_id)
);

-- 학생의 월별 반 배정 이력 (한 학생이 월마다 다른 반 수강 가능)
CREATE TABLE student_class_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,        -- 'YYYY-MM' 형식
  UNIQUE (student_id, class_id, year_month)
);
```

### 2-2. 사용자

```sql
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN (
               'student', 'admin_super', 'admin_branch', 'admin_class'
             )),
  name       TEXT NOT NULL,
  exam_no    TEXT UNIQUE,          -- 학생 전용 수험번호
  branch_id  UUID REFERENCES branches(id),
  class_id   UUID REFERENCES classes(id),  -- 학생의 현재 소속 반
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2-3. 어휘 데이터

```sql
CREATE TABLE vocabulary (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day        SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 60),
  word       TEXT NOT NULL,
  exam_count SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (day, word)
);

CREATE INDEX idx_vocabulary_day ON vocabulary(day);

-- 품사별 한국어 뜻
CREATE TABLE word_meanings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  pos           TEXT NOT NULL CHECK (pos IN ('n.','v.','adj.','adv.','prep.','conj.')),
  meaning_ko    TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);

-- 동의어 (synonym)
CREATE TABLE word_synonyms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  synonym       TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);

-- 유의어 (similar)
CREATE TABLE word_similar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  similar       TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);

-- 반의어 (antonym)
CREATE TABLE word_antonyms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  antonym       TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);
```

### 2-4. 학습 로그

```sql
-- 어휘 학습 로그
CREATE TABLE learning_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vocab_id    UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('studied', 'memorized', 'failed')),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, vocab_id)
);

CREATE INDEX idx_learning_logs_student ON learning_logs(student_id);

-- 관련 단어(동의어/유의어/반의어) 학습 로그
CREATE TABLE related_word_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  related_id   UUID NOT NULL,              -- word_synonyms / word_similar / word_antonyms의 id
  related_type TEXT NOT NULL CHECK (related_type IN ('synonym', 'similar', 'antonym')),
  status       TEXT NOT NULL CHECK (status IN ('studied', 'memorized', 'failed')),
  reviewed_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, related_id, related_type)
);

CREATE INDEX idx_related_word_logs_student ON related_word_logs(student_id);
```

### 2-5. 시험 시스템

```sql
-- 문항 형식: 영어 단어 제시 → 학생이 한국어 뜻 직접 입력 (서술형)
-- 출제 방식: day_1에서 25문항 + day_2에서 25문항 = 총 50문항
CREATE TABLE exams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  day_1        SMALLINT NOT NULL CHECK (day_1 BETWEEN 1 AND 60),
  day_2        SMALLINT NOT NULL CHECK (day_2 BETWEEN 1 AND 60),
  duration_min SMALLINT NOT NULL DEFAULT 8,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,  -- 트리거로 자동 계산
  status       TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'active', 'closed')),
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE exam_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  vocab_id         UUID NOT NULL REFERENCES vocabulary(id),
  question_no      SMALLINT NOT NULL,
  accepted_answers JSONB NOT NULL
  -- [{ "pos": "v.", "meaning_ko": "버리다" }, ...]
);

CREATE TABLE exam_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL,
  scores       JSONB NOT NULL,
  score        SMALLINT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  is_forced    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (exam_id, student_id)
);
```

### 2-6. 상담 시스템

```sql
CREATE TABLE counseling_recommendations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id   UUID NOT NULL REFERENCES profiles(id),
  risk_score NUMERIC(4,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
  reason     TEXT NOT NULL,
  factors    JSONB NOT NULL,  -- { progress_rate, score_trend, fail_rate, consecutive_absent }
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE counseling_slots (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_hour SMALLINT NOT NULL CHECK (slot_hour BETWEEN 9 AND 16),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (admin_id, slot_date, slot_hour)
);

CREATE TABLE counseling_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id          UUID NOT NULL REFERENCES profiles(id),
  source            TEXT NOT NULL CHECK (source IN ('student', 'ai')),
  recommendation_id UUID REFERENCES counseling_recommendations(id),
  request_note      TEXT,
  slot_id           UUID REFERENCES counseling_slots(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','scheduled','completed','dismissed')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE counseling_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES counseling_requests(id),
  admin_id   UUID NOT NULL REFERENCES profiles(id),
  content    TEXT NOT NULL,
  outcome    TEXT CHECK (outcome IN ('정상복귀','집중관리','기타')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2-7. 대시보드 AI 캐시

```sql
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

### 2-8. 수동 실행 필요한 SQL

```sql
-- 시험 출제 시 기출 횟수 증가 RPC
CREATE OR REPLACE FUNCTION increment_exam_count(vocab_ids UUID[])
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE vocabulary SET exam_count = exam_count + 1 WHERE id = ANY(vocab_ids);
$$;
```

---

## 3. TypeScript 타입 계약

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
  year: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

// ── 사용자 ───────────────────────────────────────
export type UserRole = 'student' | 'admin_super' | 'admin_branch' | 'admin_class';

export type Profile = {
  id: string;
  role: UserRole;
  name: string;
  exam_no: string | null;
  branch_id: string | null;
  class_id: string | null;
  is_active: boolean;
};

// ── 어휘 ─────────────────────────────────────────
export type Vocabulary = {
  id: string;
  day: number;
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

export type WordSimilar = {
  id: string;
  vocab_id: string;
  similar: string;
  display_order: number;
};

export type WordAntonym = {
  id: string;
  vocab_id: string;
  antonym: string;
  display_order: number;
};

export type RelatedType = 'synonym' | 'similar' | 'antonym';

export type VocabularyFull = Vocabulary & {
  meanings: WordMeaning[];
  synonyms: WordSynonym[];
  similar: WordSimilar[];
  antonyms: WordAntonym[];
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

export type RelatedWordLog = {
  id: string;
  student_id: string;
  related_id: string;
  related_type: RelatedType;
  status: LearningStatus;
  reviewed_at: string;
};

export type StudentProgress = {
  student_id: string;
  total_words: number;
  studied_count: number;
  memorized_count: number;
  failed_count: number;
  progress_rate: number;
  learning_rate: number;
  streak_days: number;
  current_day: number;
};

// ── 시험 ─────────────────────────────────────────
export type ExamStatus = 'scheduled' | 'active' | 'closed';

export type Exam = {
  id: string;
  class_id: string;
  title: string;
  day_1: number;
  day_2: number;
  duration_min: number;
  starts_at: string;
  ends_at: string;
  status: ExamStatus;
  created_by: string;
};

export type ExamQuestion = {
  id: string;
  exam_id: string;
  vocab_id: string;
  question_no: number;
  word: string;
};

export type ExamResult = {
  id: string;
  exam_id: string;
  student_id: string;
  answers: Record<string, string>;
  scores: Record<string, boolean>;
  score: number;
  submitted_at: string;
  is_forced: boolean;
};

// ── 상담 ─────────────────────────────────────────
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
```

---

## 4. 페이지 구조 (Next.js App Router)

```
src/app/
├── (auth)/
│   └── login/page.tsx              ✅ 수험번호(학생) / 이메일(관리자) 탭
│
├── student/
│   ├── dashboard/page.tsx          ✅ 진도 요약, 다음 시험, 오늘 학습 바로가기
│   ├── study/
│   │   ├── page.tsx                ✅ Day 목록
│   │   └── [day]/page.tsx          ✅ 플래시카드 + 셀프테스트 + 관련단어 학습
│   ├── review/
│   │   ├── page.tsx                ✅ 오답 복습 목록
│   │   └── session/page.tsx        ✅ 복습 세션
│   ├── exam/
│   │   ├── page.tsx                ✅ 시험 목록
│   │   └── [id]/
│   │       ├── page.tsx            ✅ CBT 응시 (타이머, 답안 입력, 강제 종료)
│   │       └── result/page.tsx     ✅ 시험 결과
│   └── counseling/
│       └── page.tsx                ✅ 상담 신청 (슬롯 선택, 신청 이력)
│
└── admin/
    ├── layout.tsx                  ✅ 역할별 메뉴 필터 + 학년도 전역 선택(YearSelector)
    ├── dashboard/page.tsx          ✅ 요약 카드, 오늘 상담 현황
    ├── branches/page.tsx           ✅ 지점 관리 (추가/수정/삭제)
    ├── classes/page.tsx            ✅ 반 관리 (지점/학년도 필터, 추가/수정/삭제/담임배정)
    ├── admins/page.tsx             ✅ 관리자 관리 (초대/비활성화)
    ├── students/
    │   ├── page.tsx                ✅ 학생 관리 (지점/학년도/반 필터, 월별 배정 체크박스)
    │   └── [id]/page.tsx           ✅ 학생 상세 (히트맵, 어휘진도, 관련단어 진도)
    ├── progress/
    │   ├── page.tsx                ✅ 학습 진도 관리 (반별 요약 + 학생별 진도 테이블)
    │   └── [id]/page.tsx           ✅ 학생별 상세 진도 (Day별 어휘/관련단어 현황)
    ├── exams/
    │   ├── page.tsx                ✅ 시험 관리 (지점/학년도/반 필터, 시험 출제)
    │   └── [id]/page.tsx           ✅ 시험 결과 조회
    ├── vocabulary/page.tsx         ✅ 어휘 관리 (Day 필터, AI 의미 일괄 생성, 편집 모달)
    └── counseling/
        ├── page.tsx                ✅ 상담 목록 + 시간대 관리
        └── [id]/page.tsx           ✅ 상담 상세 (admin_class 전용)
```

---

## 5. 컴포넌트 구조

```
src/components/
│
├── admin/
│   ├── AdminNav.tsx                # 'use client' - 역할별 사이드 네비게이션
│   ├── YearSelector.tsx            # 'use client' - 헤더 학년도 전역 선택 드롭다운
│   ├── ProgressFilterBar.tsx       # 'use client' - 지점/학년도/반 연계 필터 (공용)
│   │                               #   props: branches, years, classes, selected*, showBranch, hideClass
│   ├── ClassTable.tsx              # 'use client' - 반 목록 + 인라인 수정 + 담임 배정
│   ├── StudentTable.tsx            # 'use client' - 학생 목록 + 월별 배정 체크박스
│   ├── StudentRelatedProgress.tsx  # 'use client' - 관련단어 타입별 요약 + DAY별 테이블
│   ├── StudentHeatmap.tsx          # 'use client' - 60일 학습 히트맵
│   ├── CreateStudentForm.tsx       # 'use client' - 학생 추가 폼
│   ├── ExamStatusButton.tsx        # 'use client' - 시험 상태 전환 버튼
│   └── ExamQRButton.tsx            # 'use client' - QR 코드 표시
│
└── vocabulary/
    └── StudySession.tsx            # 'use client' - 플래시카드 + 셀프테스트 + 관련단어 학습
                                    #   mode: 'flash' | 'test' | 'related'
                                    #   관련단어 모드: 동의어/유의어/반의어 카드 플립
```

---

## 6. Server Actions

```
src/app/actions/
├── auth.ts          # login, logout
├── classes.ts       # createClass, updateClass, deleteClass, assignTeacher
├── students.ts      # createStudent, updateStudentFull, updateStudentPassword,
│                    # toggleStudentMonth, setBulkMonthEnrollment
├── learning.ts      # upsertLearningLog, upsertRelatedWordLog
├── exams.ts         # createExam, updateExamStatus
└── year.ts          # setAdminYear (admin_year 쿠키 저장)
```

---

## 7. 학년도 필터 설계

관리자 화면 전반에 걸친 두 가지 필터 레이어:

| 레이어 | 방식 | 적용 범위 |
|---|---|---|
| **전역 학년도** | `admin_year` 쿠키 (`getAdminYear()`) | 헤더 YearSelector로 전체 변경 |
| **페이지 로컬 필터** | URL searchParams (`branch_id`, `year`, `class_id`) | 각 페이지 독립적 |

**필터 연계 규칙 (ProgressFilterBar):**
- 지점 변경 → 학년도·반 초기화
- 학년도 변경 → 반 초기화
- 비활성 반(`is_active = false`)은 필터 옵션에서 제외

**적용 페이지:** 반관리, 학생관리, 학습진도, 시험관리

---

## 8. 역할별 접근 권한

| 기능 | admin_super | admin_branch | admin_class |
|---|---|---|---|
| 지점 관리 | ✅ | ✗ | ✗ |
| 반 관리 | ✅ 전체 | ✅ 담당 지점 | ✗ |
| 관리자 관리 | ✅ | ✗ | ✗ |
| 학생 관리 | ✅ 전체 | ✅ 담당 지점 | ✅ 담당 반 |
| 학습 진도 | ✅ 전체 | ✅ 담당 지점 | ✅ 담당 반 |
| 시험 관리 | ✅ 전체 | ✅ 담당 지점 | ✅ 담당 반 |
| 어휘 관리 | ✅ | ✗ | ✗ |
| 상담 관리 | ✅ | ✅ | ✅ |
| 상담 상세 | ✅ 읽기 | ✅ 읽기 | ✅ 전체 |

---

## 9. AI 통합 설계 (Gemini)

### 9-1. 어휘 AI 자동 채우기 ✅ 구현됨

```
POST /api/vocabulary/ai-fill

System: 당신은 편입 영어 전문가입니다.
User: 다음 영어 단어들의 품사별 한국어 뜻과 동의어/유의어/반의어를 JSON으로 반환하세요.

→ word_meanings, word_synonyms, word_similar, word_antonyms 테이블에 일괄 upsert
```

### 9-2. 상담 추천 엔진 (미구현)

```
위험도(risk_score > 0.5) 학생 자동 선별
→ counseling_recommendations 테이블에 upsert
```

### 9-3. 상담 이력 요약 ✅ 구현됨

```
GET /api/counseling/[student_id]/history-summary
→ streamText로 스트리밍 반환 (상담 상세 페이지)
```

### 9-4. 관리자 대시보드 AI 인사이트 (미구현)

```
dashboard_cache 24시간 캐시 전략
→ 반 학습 현황 분석 코멘트 생성
```

---

## 10. CBT 시험 시스템

### 시험 상태 전이

```
scheduled ──(관리자 활성화)──► active ──(ends_at 도달 or 강제 종료)──► closed
```

### 문항 자동 생성 알고리즘

```
1. day_1의 vocabulary 50개를 exam_count 오름차순 조회 → 상위 25개 선택
2. day_2 동일 방식 25개 선택
3. 50개 셔플 후 question_no 1~50 부여
4. word_meanings 스냅샷 → accepted_answers JSONB 저장
5. vocabulary.exam_count += 1 (RPC: increment_exam_count)
```

### 채점 로직

```
student_answer.trim() 이 accepted_answers의 meaning_ko 핵심 키워드 포함 → 정답
score = 정답 개수 (0~50)
오답 vocab_id → learning_logs status='failed' upsert
```

### 강제 종료

```
PATCH /api/exams/[id]/status → { status: 'closed' }
→ Supabase Realtime broadcast → 클라이언트 자동 제출 (is_forced: true)
```

---

## 11. 테스트 계정

| 역할 | 계정 | 비밀번호 |
|---|---|---|
| 전체관리자 | admin@voca-master.com | 1234 |
| 지점관리자 | branch@voca-master.com | 1234 (대구본원) |
| 반담임 | class@voca-master.com | 1234 (대구본원 A반) |
| 학생 | 수험번호 1001~1004 | 1234 |

---

## 12. 남은 작업

- [ ] AI 상담 추천 생성 기능 (위험 학생 자동 감지 → counseling_recommendations)
- [ ] 관리자 대시보드 AI 인사이트 (Gemini 24h 캐시)
- [ ] 학생 대시보드 AI 코치 메시지
