# Voca-Master

> **AI 기반 편입영어 통합 학습 관리 시스템**  
> KIT 바이브코딩 공모전 2026 출품작

---

## 접속 정보

**접속 경로**

https://voca-master-5bkxfk7pe-simtrue4164s-projects.vercel.app/login?next=%2F

**테스트 계정**

| 역할 | 계정 | 비밀번호 |
|------|------|---------|
| 전체관리자 | SUPER01 | 1234 |
| 지점관리자 | A001 | 1234 |
| 반담임 | A002 | 1234 |
| 학생 | 수험번호 1007 | 1234 |

---

## 프로젝트 소개

**Voca-Master**는 편입영어 학원의 교육 현장 문제를 AI로 해결하는 통합 학습 관리 SaaS입니다.

편입 수험생은 60일 안에 3,000단어를 암기해야 하지만, 기존에는 학생의 암기 상태 추적·오답 관리·시험 대비가 분산되어 있었습니다. 관리자는 수십 명의 학습 현황을 수작업으로 파악해야 했고, 위험 학생(학습 포기 징후)을 조기에 발견하기 어려웠습니다.

Voca-Master는 **학생에게는 AI 개인 코치**를, **관리자에게는 AI 학급 운영 보조**를 제공해 이 문제를 해결합니다.

---

## AI 기능 — 서비스 핵심

> 이 프로젝트는 총 **6개의 AI 기능**을 Google Gemini 2.5 Flash 기반으로 구현했습니다.

### 학생 대상 AI

#### 1. AI 성과 예측 (`POST /api/student/dashboard/prediction`)

학생이 대시보드에 접속하면 당일 1회 자동으로 예측 결과를 생성합니다.

**분석 입력값:**
- 전체 커리큘럼 진도율
- 누적 정답률
- 연속 학습일 수
- 최근 시험 점수 추세
- 누적 오답 단어 수

**생성 결과:**
```json
{
  "scoreMin": 38,
  "scoreMax": 44,
  "completionPossibility": "보통",
  "actionItems": ["오늘 DAY 23 복습", "오답 단어 10개 재학습"],
  "summary": "꾸준한 학습 패턴이 유지되고 있습니다."
}
```

**UI:** `StudentPredictionCard` — 대시보드 최상단 자동 표시  
**캐시:** `dashboard_cache(student_prediction)` — 당일(KST) 1회

#### 2. AI 코칭 메시지 (`POST /api/student/exam/[id]/coaching`)

시험 제출 직후 해당 학생의 점수·오답 단어·진도율을 종합해 3~4문장의 맞춤 피드백을 생성합니다.

**분석 입력값:**
- 이번 시험 점수 (50점 만점)
- 오답 단어 목록
- 전체 학습 진도율

**UI:** `ExamCoachingCard` — 시험 결과 점수 카드 바로 하단 자동 표시  
**캐시:** `dashboard_cache(student_coaching)` — 시험별 1회 고정

---

### 관리자 대상 AI

#### 3. AI 학급 인사이트 (`POST /api/admin/dashboard/insight`)

관리자가 대시보드에 접속하면 당일 학급 현황을 Gemini가 자연어로 분석해 코멘트를 생성합니다.

**분석 입력값:**
- 담당 범위 내 총 학생 수 / 오늘 학습 학생 수
- 최근 3일 연속 미학습 학생 수 (위험 학생)
- 가장 최근 시험 평균 점수

**생성 결과 예시:**
> "오늘 A반 28명 중 19명(68%)이 학습에 참여했습니다. 최근 3일간 학습 기록이 없는 학생이 4명으로 개별 확인이 필요합니다."

**캐시:** `dashboard_cache(admin_insight)` — 날짜(KST) 변경 시 자동 재생성

#### 4. AI 위험 학생 상담 추천 (`POST /api/admin/counseling/recommend`)

진도율·오답률·연속미학습일·시험추세를 종합 분석해 위험도(risk_score)를 산출하고, 임계값 초과 시 상담 요청을 자동 생성합니다.

**분석 및 저장 구조:**
```typescript
// counseling_recommendations 테이블
{
  student_id: string,
  risk_score: number,           // 0.0 ~ 1.0
  reason: string,               // AI 생성 한국어 사유
  factors: {
    progress_rate: number,
    score_trend: number,
    fail_rate: number,
    consecutive_absent: number
  }
}
```

`risk_score > 0.5`인 경우 `counseling_requests(source='ai')`를 자동 생성합니다.

#### 5. 상담 이력 AI 요약 (`GET /api/counseling/[student_id]/history-summary`)

상담 기록이 2건 이상인 학생의 경우, 상담 상세 화면에서 이전 기록을 3문장 이내로 요약합니다.  
`streamText` 기반으로 실시간 스트리밍 표시됩니다.

#### 6. 어휘 의미 AI 일괄 생성 (`POST /api/admin/vocabulary/generate`)

3,000단어의 한국어 의미·동의어·유의어·반의어를 50개 단위 배치로 자동 생성합니다.  
`generateObject` + Zod 스키마로 구조화된 JSON 응답을 강제해 파싱 오류 없이 DB에 직접 저장합니다.

```typescript
// Zod 스키마 (AI 응답 강제 구조)
{
  words: Array<{
    word: string,
    entries: Array<{ pos: string, meaning_ko: string }>,
    synonyms: string[],
    similar: string[],
    antonyms: string[]
  }>
}
```

---

### AI 캐시 전략

AI API 비용을 최소화하기 위해 `dashboard_cache` 테이블에 결과를 저장합니다.

| cache_type | 대상 | 갱신 조건 |
|------------|------|----------|
| `admin_insight` | 관리자 | KST 날짜 변경 시 자동 재생성 |
| `student_prediction` | 학생 | KST 날짜 변경 시 자동 재생성 |
| `student_coaching` | 학생 | 시험 제출 시 1회 생성 후 고정 |

---

## 전체 기능 목록

### 학생 기능

| 기능 | 설명 |
|------|------|
| **플래시카드 학습** | DAY별 50단어, 3D 카드 플립 애니메이션(motion/react), 알겠어요/모르겠어요 상태 기록 |
| **관련단어 학습** | 어휘 완료 후 동의어·유의어·반의어 카드 연속 학습, 타입별 진도 독립 추적 |
| **오답 복습** | failed 단어 모아서 반복 학습 세션 |
| **CBT 시험** | 실시간 타이머, 영어→한국어 서술형 입력, 강제 종료 대응, 자동 채점 |
| **시험 결과** | 점수·정오답·AI 코칭 메시지 확인 |
| **진도 대시보드** | AI 성과 예측 카드, 60일 진도율, 연속 학습일, 다음 시험 안내 |
| **상담 신청** | 담임 상담 슬롯 달력 선택 → 신청·수정·취소 |

### 관리자 기능

| 기능 | 설명 |
|------|------|
| **AI 학급 인사이트** | 당일 학급 현황 자동 분석, 재생성 버튼 제공 |
| **AI 상담 추천** | 위험 학생 자동 감지 및 상담 요청 자동 생성 |
| **학습 진도 관리** | 반별 요약 카드 + 학생별 어휘·관련단어 진도 + DAY별 상세 + 학습 히트맵 |
| **시험 출제·관리** | 2개 DAY 선택 → 기출 횟수 기반 50문항 자동 생성, 실시간 활성화/종료 |
| **어휘 관리** | 품사별 의미·동의어·유의어·반의어 편집, AI 일괄 생성 |
| **상담 관리** | 상담 신청 목록, 시간대 등록, 상태 흐름 관리, 상담 기록 작성 |
| **위험 학생 감지** | 3일 이상 미학습 학생 자동 표시 |
| **지점/반/관리자/학생 관리** | 3단계 계층 구조 전체 CRUD |

### 상담 상태 흐름

```
pending (신청) → scheduled (슬롯 배정) → confirmed (담임 확정) → completed (상담 완료)
                                        ↘ dismissed (취소)
```

---

## AI 협업 개발 방법론

> 이 프로젝트는 **Claude Code**를 핵심 개발 파트너로 활용해 전체 시스템을 설계·구현했습니다.

### Schema-Driven Development

모든 개발의 시작점은 `docs/SDD.md`입니다.  
DB 스키마·TypeScript 타입·API 설계·페이지 구조를 코드 작성 전 문서로 먼저 확정하고,  
Claude Code가 이 문서를 단일 진실 공급원(Single Source of Truth)으로 삼아 코드를 생성했습니다.

```
docs/SDD.md (설계 확정)
    ↓
Claude Code가 SDD.md 참조 → 코드 생성
    ↓
docs/check_list.md로 AI 코드 검수 (47개 항목)
    ↓
이슈 발견 시 docs/issues/ISS-NNN.md 등록 → 수정
```

### CLAUDE.md — AI 작업 지침서

`CLAUDE.md` 파일에 프로젝트 전체 현황·Next.js 16 특이사항·주의사항을 집약했습니다.  
세션이 바뀌어도 이 파일 하나로 즉시 동일한 컨텍스트에서 작업이 재개됩니다.

**포함 내용:**
- 완료된 기능 목록 (체크리스트)
- Next.js 16 전용 주의사항 (`proxy.ts`, `motion/react` 등)
- Supabase 클라이언트 사용 패턴
- 역할별 라우팅 규칙

### Memory 시스템

`memory/` 디렉토리에 개발 과정에서 확인된 결정사항·피드백·프로젝트 컨텍스트를 영속 저장합니다.  
반복적인 배경 설명 없이 일관된 방향으로 작업이 이어집니다.

### AI 코드 검수

`docs/check_list.md`에 47개 항목의 코드 검수 체크리스트를 작성하고, AI와 함께 전수 검토했습니다.

| 심각도 | 항목 수 | 예시 |
|--------|---------|------|
| CRITICAL | 4개 | KST 시간 계산 오류, null 체크 누락 |
| HIGH | 12개 | Open Redirect 취약점, 채점 로직 오류 |
| MEDIUM | 18개 | 타입 안정성, API 응답 구조 등 |
| LOW | 13개 | 하드코딩 상수, 접근성 등 |

---

## 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| **Framework** | Next.js App Router (SSR + RSC) | 16.2.2 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Animation** | Motion (`motion/react`) | 12.x |
| **State** | TanStack Query | 5.x |
| **Database** | Supabase (PostgreSQL + Auth + Realtime) | 2.x |
| **AI** | Google Gemini 2.5 Flash (Vercel AI SDK) | ai@6, @ai-sdk/google@3 |
| **Deploy** | Vercel | — |

> **Next.js 16 주요 변경사항**  
> `middleware.ts` → `proxy.ts` / `framer-motion` → `motion/react` (React 19 호환)

---

## 인프라 — Supabase & Vercel

### Supabase

Supabase를 백엔드 인프라 전체로 활용합니다.

| 기능 | 활용 방식 |
|------|----------|
| **PostgreSQL** | 전체 데이터 저장 (사용자·어휘·학습·시험·상담 등 18개 테이블) |
| **Auth** | JWT 기반 인증, 학생은 `수험번호@voca-master.internal` 형식으로 계정 관리 |
| **Row Level Security (RLS)** | 역할별 데이터 접근 제어. 서버에서는 `service_role` 키로 RLS 우회 |
| **Realtime** | 시험 진행 중 관리자의 강제 종료 이벤트를 학생 화면에 실시간 전달 |
| **SSR 클라이언트** | `@supabase/ssr` 기반으로 서버 컴포넌트·Server Actions·Route Handler에서 모두 활용 |

**클라이언트 분리 전략:**

```typescript
// 서버 컴포넌트 / Server Action / Route Handler
import { createClient } from '@/lib/supabase/server';    // 사용자 세션 기반
import { createAdminClient } from '@/lib/supabase/admin'; // service_role (RLS 우회)

// 클라이언트 컴포넌트
import { createClient } from '@/lib/supabase/client';
```

### Vercel

Next.js 앱을 Vercel로 배포해 서버리스 환경에서 운영합니다.

| 기능 | 활용 방식 |
|------|----------|
| **배포 자동화** | GitHub 연동, main 브랜치 push 시 자동 빌드·배포 |
| **서버리스 함수** | Route Handlers(`/api/*`)가 Vercel Edge Function으로 실행 |
| **환경 변수 관리** | Supabase URL/Key, Gemini API Key를 Vercel 환경 변수로 안전하게 관리 |
| **AI SDK 연동** | Vercel AI SDK(`ai` v6)로 Gemini API 호출 — `generateObject`, `generateText`, `streamText` |

---

## 시스템 아키텍처

```
┌───────────────────────────────────────────────────┐
│              Browser (Next.js Client)              │
│     TanStack Query + motion/react 애니메이션        │
└─────────────────────┬─────────────────────────────┘
                      │ HTTPS / WebSocket (Realtime)
┌─────────────────────▼─────────────────────────────┐
│      Vercel — Next.js 16 Server Layer              │
│  Server Components │ Server Actions │ Route Handlers│
│  src/proxy.ts — 인증 게이트 + 역할별 리다이렉트      │
└──────────┬──────────────────────┬──────────────────┘
           │ Supabase SSR Client  │ Vercel AI SDK
┌──────────▼──────────┐  ┌───────▼───────────────────┐
│ Supabase            │  │  Google Gemini 2.5 Flash   │
│ PostgreSQL + Auth   │  │  generateObject (Zod)      │
│ Realtime + RLS      │  │  generateText / streamText │
│ dashboard_cache     │  │                            │
└─────────────────────┘  └────────────────────────────┘
```

---

## 사용자 역할 및 접근 범위

| 역할 | 로그인 방식 | 접근 범위 |
|------|-----------|----------|
| `student` | 수험번호 + 비밀번호 | 본인 학습·시험·상담만 |
| `admin_class` (반담임) | 사번 | 담당 반 전체 학생 |
| `admin_branch` (지점관리자) | 사번 | 담당 지점 내 전체 반 |
| `admin_super` (전체관리자) | 관리자계정 | 전체 지점·반·학생 |

---

## DB 주요 테이블

```
branches                지점
classes                 반 (학년도·활성화 여부)
admin_class_assignments 담임↔반 다대다 배정
profiles                모든 사용자 (역할별 분기)
vocabulary              3,000단어 (DAY 1~60)
word_meanings           품사별 한국어 의미
word_synonyms / word_similar / word_antonyms
learning_logs           어휘 학습 이력 (studied/memorized/failed)
related_word_logs       관련단어 학습 이력
exams                   시험 (scheduled → active → closed)
exam_questions          50문항 스냅샷
exam_results            답안 + 채점 결과
counseling_slots        담임 상담 가능 시간대
counseling_requests     상담 신청 (pending → scheduled → confirmed → completed)
counseling_records      상담 완료 기록
counseling_recommendations  AI 위험도 분석 결과
dashboard_cache         AI 결과 일일 캐시
```

---

## 페이지 라우팅

```
/login

── 학생 ──────────────────────────────────────────
/student/dashboard              진도 요약 + AI 성과 예측
/student/study/[day]            플래시카드 + 셀프테스트 + 관련단어
/student/review                 오답 목록
/student/review/session         오답 복습 세션
/student/exam                   시험 목록
/student/exam/[id]              CBT 시험 응시
/student/exam/[id]/result       시험 결과 + AI 코칭 메시지
/student/counseling             상담 신청

── 관리자 ────────────────────────────────────────
/admin/dashboard                통합 대시보드 + AI 인사이트 + AI 상담 추천
/admin/branches                 지점 관리
/admin/classes                  반 관리
/admin/admins                   관리자 계정 관리
/admin/students                 학생 관리
/admin/students/[id]            학생 상세 (히트맵·진도)
/admin/progress                 학습 진도 관리
/admin/progress/[id]            학생별 상세 진도
/admin/exams                    시험 관리
/admin/exams/[id]               시험 상세·결과
/admin/vocabulary               어휘 관리 + AI 일괄 생성
/admin/counseling               상담 관리 (목록·시간대)
/admin/counseling/[id]          상담 상세 (반담임 전용)
```

---

## 프로젝트 구조

```
voca-master/                    ← 리포지토리 루트
├── CLAUDE.md                   ← AI 개발 지침서 (컨텍스트 복원용)
├── docs/
│   ├── SDD.md                  ← 시스템 설계 문서 (Single Source of Truth)
│   ├── AI_FEATURES.md          ← AI 기능 상세 명세
│   ├── PROJECT_OVERVIEW.md     ← 기술 문서
│   ├── USER_MANUAL.md          ← 사용자 매뉴얼
│   ├── check_list.md           ← AI 코드 검수 체크리스트 (47개 항목)
│   ├── DEPLOY.md               ← 배포 매뉴얼
│   └── issues/                 ← 이슈 추적 (ISS-NNN 포맷)
├── memory/                     ← Claude Code 영속 메모리
└── voca-master/                ← Next.js 앱 (여기서 npm run dev)
    └── src/
        ├── app/
        │   ├── (auth)/login/
        │   ├── student/
        │   ├── admin/
        │   ├── api/
        │   │   ├── admin/      (vocabulary/generate, dashboard/insight, counseling/recommend)
        │   │   ├── student/    (exam/[id]/coaching, dashboard/prediction)
        │   │   └── counseling/ (history-summary)
        │   └── actions/        (auth, learning, exams, counseling, ...)
        ├── components/
        │   ├── admin/          (CounselingDetail, DashboardInsightCard, DashboardRiskCard, ...)
        │   ├── student/        (StudentPredictionCard, ExamCoachingCard, StudySession, ...)
        │   └── ui/             (ConfirmModal)
        ├── lib/supabase/       (client / server / admin)
        ├── types/index.ts
        └── proxy.ts            ← Next.js 16 인증 게이트
```

---

## 관련 문서

- [시스템 설계 문서 (SDD.md)](docs/SDD.md)
- [AI 기능 명세 (AI_FEATURES.md)](docs/AI_FEATURES.md)
- [코드 검수 체크리스트 (check_list.md)](docs/check_list.md)
- [배포 매뉴얼 (DEPLOY.md)](docs/DEPLOY.md)
- [사용자 매뉴얼 (USER_MANUAL.md)](docs/USER_MANUAL.md)

---

## 라이선스

MIT
