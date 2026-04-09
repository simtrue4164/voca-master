# Voca-Master

> AI 기반 편입영어 통합 학습 관리 시스템  
> KIT 바이브코딩 공모전 2026 출품작

---

## 개요

**Voca-Master**는 편입영어 학원을 위해 설계된 AI 기반 학습 관리 SaaS입니다.  
3,000단어 60일 커리큘럼 기반의 플래시카드 학습, CBT 시험, 관련단어(동의어·유의어·반의어) 학습,  
학생 진도 모니터링, AI 상담 추천, AI 성과 예측까지 학원 운영에 필요한 기능을 통합 제공합니다.

---

## 주요 기능

### 학생

| 기능 | 설명 |
|------|------|
| **AI 성과 예측** | 진도율·정답률·시험 추세 분석 → 다음 시험 예상 점수·완주 가능성·실천 행동 제시 |
| **AI 코칭 메시지** | 시험 직후 점수·오답 단어·학습 진도 기반 맞춤 피드백 자동 생성 |
| **플래시카드 학습** | DAY별 50단어, 카드 플립 애니메이션, 알겠어요/모르겠어요 상태 기록 |
| **관련단어 학습** | 어휘 완료 후 동의어·유의어·반의어 카드 연속 학습 |
| **오답 복습** | 틀린 단어만 모아서 반복 학습 |
| **CBT 시험** | 8분 실시간 타이머, 영어→한국어 서술형 입력, 자동 채점 |
| **진도 대시보드** | 60일 학습 현황 그리드, 연속 학습일, 다음 시험 안내 |
| **상담 신청** | 담임 상담 슬롯 선택 후 온라인 신청 |

### 관리자

| 기능 | 설명 |
|------|------|
| **AI 학급 인사이트** | 매일 학급 현황(학습률·위험학생·시험평균)을 Gemini가 자연어 코멘트로 자동 생성 |
| **AI 상담 추천** | 위험 학생의 진도율·오답률·연속미학습일·시험추세 분석 → risk_score 산출 + 상담 요청 자동 생성 |
| **AI 어휘 일괄 생성** | 3,000단어의 한국어 의미·동의어·유의어·반의어 AI 자동 입력 |
| **학년도 전역 관리** | 헤더 드롭다운으로 전체 메뉴 학년도 전환 |
| **학습 진도 관리** | 반별 요약 카드 + 학생별 어휘·관련단어 진도 + DAY별 상세 |
| **시험 출제** | 2개 DAY 선택 → 기출 횟수 기반 50문항 자동 생성 |
| **위험 학생 감지** | 3일 이상 미학습 학생 자동 감지 |
| **상담 관리** | 상담 신청 목록, 시간대 등록, 상담 기록 작성 |

---

## AI 기능 상세

| 기능 | API | 모델 | 캐시 |
|------|-----|------|------|
| 어휘 자동 생성 | `POST /api/admin/vocabulary/generate` | Gemini 2.5 Flash | 없음 |
| 관리자 학급 인사이트 | `POST /api/admin/dashboard/insight` | Gemini 2.5 Flash | 일 1회 (KST 기준) |
| AI 상담 추천 | `POST /api/admin/counseling/recommend` | Gemini 2.5 Flash | 없음 |
| 상담 이력 요약 | `GET /api/counseling/[id]/history-summary` | Gemini 2.5 Flash | 없음 (스트리밍) |
| 학생 AI 코칭 메시지 | `POST /api/student/exam/[id]/coaching` | Gemini 2.5 Flash | 시험별 저장 |
| 학생 성과 예측 | `POST /api/student/dashboard/prediction` | Gemini 2.5 Flash | 일 1회 (KST 기준) |

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| **Framework** | Next.js 16 App Router + TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Animation** | Motion (`motion/react`) |
| **Database** | Supabase (PostgreSQL + Auth) |
| **AI** | Google Gemini 2.5 Flash (Vercel AI SDK) |
| **Deploy** | Vercel |

> **Next.js 16 주의**: `middleware.ts` → `proxy.ts`, `framer-motion` → `motion/react`

---

## 시스템 구조

```
┌─────────────────────────────────────────────┐
│           Browser (Next.js Client)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│     Next.js Server (RSC + Server Actions)    │
│         src/proxy.ts (인증 게이트)            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│   Supabase (PostgreSQL + Auth)               │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Google Gemini AI (Vercel AI SDK)     │
└─────────────────────────────────────────────┘
```

---

## 사용자 역할

| 역할 | 로그인 | 접근 범위 |
|------|--------|----------|
| `student` | 수험번호 + 비밀번호 | 본인 학습·시험·상담 |
| `admin_class` (반담임) | 이메일 + 비밀번호 | 담당 반 학생 전체 |
| `admin_branch` (지점관리자) | 이메일 + 비밀번호 | 담당 지점 전체 반 |
| `admin_super` (전체관리자) | 이메일 + 비밀번호 | 전체 지점·반·학생 |

---

## DB 주요 테이블

```
branches              지점
classes               반 (학년도, 활성화 여부 포함)
profiles              사용자 (역할별 분기)
vocabulary            3,000단어 (DAY 1~60)
word_meanings         품사별 한국어 의미
word_synonyms         동의어
word_similar          유의어
word_antonyms         반의어
learning_logs         어휘 학습 이력
related_word_logs     관련단어 학습 이력
exams                 시험 (scheduled → active → closed)
exam_questions        50문항 스냅샷
exam_results          답안 + 채점 결과
counseling_*          상담 슬롯·신청·기록·AI 추천
dashboard_cache       AI 결과 일일 캐시 (admin_insight, student_coaching, student_prediction)
```

---

## 로컬 실행

### 환경 변수 설정

`voca-master/.env.local` 파일을 생성합니다:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

### Supabase 설정

1. `docs/supabase_ddl.sql` 실행 (테이블 생성)
2. `docs/supabase_seed_vocabulary.sql` 실행 (3,000단어 시드)
3. `docs/seed_test_data.js` 실행 (테스트 계정 생성)
4. Supabase SQL Editor에서 아래 RPC 함수 실행:

```sql
CREATE OR REPLACE FUNCTION increment_exam_count(vocab_ids UUID[])
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE vocabulary SET exam_count = exam_count + 1 WHERE id = ANY(vocab_ids);
$$;
```

5. 관리자 로그인 → `/admin/vocabulary` → "AI 의미 일괄 생성" (3,000단어 의미 입력)

### 개발 서버 시작

```bash
cd voca-master
npm install
npm run dev
# http://localhost:3000
```

### 테스트 계정

| 역할 | 계정 | 비밀번호 |
|------|------|---------|
| 전체관리자 | admin@voca-master.com | 1234 |
| 지점관리자 | branch@voca-master.com | 1234 |
| 반담임 | class@voca-master.com | 1234 |
| 학생 | 수험번호 1001~1004 | 1234 |

---

## 프로젝트 구조

```
voca-master/              ← 리포지토리 루트
├── docs/
│   ├── SDD.md            ← 시스템 설계 문서 (Single Source of Truth)
│   ├── supabase_ddl.sql
│   ├── supabase_seed_vocabulary.sql
│   └── seed_test_data.js
└── voca-master/          ← Next.js 앱 (여기서 npm run dev)
    └── src/
        ├── app/
        │   ├── (auth)/login/
        │   ├── student/          (대시보드·학습·시험·상담)
        │   ├── admin/            (대시보드·반·학생·진도·시험·어휘·상담)
        │   ├── api/
        │   │   ├── admin/        (vocabulary, dashboard/insight, counseling/recommend)
        │   │   └── student/      (exam/[id]/coaching, dashboard/prediction)
        │   └── actions/          (auth, learning, exams, classes, students)
        ├── components/
        │   ├── admin/            (DashboardInsightCard, DashboardRiskCard, ...)
        │   ├── student/          (ExamCoachingCard, StudentPredictionCard)
        │   └── vocabulary/       (StudySession)
        └── lib/supabase/
```

---

## 문서

- [시스템 설계 문서 (SDD)](docs/SDD.md)

---

## 라이선스

MIT
