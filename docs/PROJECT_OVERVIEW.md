# Voca-Master: 기술 문서

> AI 기반 편입영어 통합 학습 관리 시스템  
> KIT 바이브코딩 공모전 출품작 (2026)  
> 최종 업데이트: 2026-04-09

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [시스템 아키텍처](#3-시스템-아키텍처)
4. [데이터베이스 구조](#4-데이터베이스-구조)
5. [사용자 역할 및 권한](#5-사용자-역할-및-권한)
6. [구현된 기능 목록](#6-구현된-기능-목록)
7. [페이지 라우팅 구조](#7-페이지-라우팅-구조)
8. [주요 컴포넌트](#8-주요-컴포넌트)
9. [AI 기능](#9-ai-기능)
10. [인증 및 보안](#10-인증-및-보안)
11. [개발 환경 및 배포](#11-개발-환경-및-배포)

---

## 1. 프로젝트 개요

**Voca-Master**는 편입영어 학원을 위한 AI 기반 통합 학습 관리 SaaS입니다.

### 핵심 가치

| 대상 | 제공 가치 |
|------|----------|
| 학생 | 60일 커리큘럼 플래시카드 학습, 동의어/유의어/반의어 관련단어 학습, CBT 시험, 오답 복습, 상담 신청 |
| 반담임 | 담당 학생 학습 진도 모니터링, 상담 일정 관리, AI 학급 인사이트 |
| 지점관리자 | 지점 전체 반·학생 현황 통합 조회, 학년도별 관리 |
| 전체관리자 | 지점·반·관리자 생성/관리, 어휘 데이터 관리, AI 의미 일괄 생성 |

### 규모

- 어휘 데이터: **3,000단어** (DAY 1~60, 하루 50단어)
- 관련단어: 동의어·유의어·반의어 별도 학습 및 진도 추적
- 시험: 2개 DAY × 25문항 = **총 50문항 CBT**
- 조직 계층: **지점 → 반(학년도별) → 학생** 3단계

---

## 2. 기술 스택

| 분류 | 기술 | 버전 |
|------|------|------|
| **프레임워크** | Next.js App Router (SSR + RSC) | 16.2.2 |
| **언어** | TypeScript | 5.x |
| **스타일링** | Tailwind CSS | 4.x |
| **애니메이션** | Motion (`motion/react`) | 12.x |
| **서버 상태** | TanStack Query | 5.x |
| **Backend / DB** | Supabase (PostgreSQL + Auth + Realtime) | 2.x |
| **Supabase SSR** | `@supabase/ssr` | 2.x |
| **AI** | Vercel AI SDK + Google Gemini | ai@6, @ai-sdk/google@3 |
| **배포** | Vercel | — |

### Next.js 16 특이사항

- `middleware.ts` → **`proxy.ts`** (파일명·함수명 변경)
- Turbopack 기본 활성화 (별도 플래그 불필요)
- `framer-motion` 대신 `motion/react` 사용 (React 19 호환)

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Client)                  │
│  Next.js App Router + TanStack Query + motion/react  │
└─────────────────┬───────────────────────────────────┘
                  │ HTTPS / WebSocket (Realtime)
┌─────────────────▼───────────────────────────────────┐
│               Next.js Server Layer                   │
│  Server Components │ Server Actions │ Route Handlers │
│  src/proxy.ts (인증 게이트 + 역할별 리다이렉트)        │
└─────────────────┬───────────────────────────────────┘
                  │ Supabase Client (SSR)
┌─────────────────▼───────────────────────────────────┐
│                    Supabase                          │
│  PostgreSQL │ Auth (JWT) │ Realtime │ RLS 정책       │
└─────────────────┬───────────────────────────────────┘
                  │ Vercel AI SDK
┌─────────────────▼───────────────────────────────────┐
│              Google Gemini 2.5 Flash / 1.5 Pro       │
│  학급 인사이트 │ 어휘 의미 일괄 생성 │ 위험 학생 분석  │
└─────────────────────────────────────────────────────┘
```

### 데이터 흐름

- **서버 컴포넌트**: `createAdminClient()`로 RLS 우회, 초기 데이터 SSR
- **클라이언트 컴포넌트**: `createBrowserClient()`로 직접 조회 또는 Route Handler 경유
- **Server Actions**: 폼 제출·상태 변경 (로그인/로그아웃, 학습 로그, 학년도 쿠키 등)
- **Route Handlers** (`/api/*`): 복잡한 비즈니스 로직 (시험 생성, AI 생성)

---

## 4. 데이터베이스 구조

### ERD 요약

```
branches ──< classes ──< profiles(student)
              │              │
              │         ─────┴──────────────────────────────
              │         │                                   │
              └──< exams│                            learning_logs
                    │   │                            related_word_logs
                    └──< exam_questions              student_class_memberships
                    └──< exam_results

profiles(admin) ──< counseling_slots
                ──< admin_class_assignments ──> classes
profiles(student) ──< counseling_requests ──< counseling_records
                       └── counseling_recommendations

vocabulary ──< word_meanings
           └──< word_synonyms
           └──< word_similar
           └──< word_antonyms

dashboard_cache (AI 인사이트 캐시)
```

### 주요 테이블

| 테이블 | 역할 |
|--------|------|
| `branches` | 지점 |
| `classes` | 반 (year, is_active, start_date, end_date) |
| `admin_class_assignments` | 담임↔반 다대다 배정 |
| `student_class_memberships` | 학생 월별 반 배정 이력 |
| `profiles` | 모든 사용자 (역할별 분기) |
| `vocabulary` | 3,000단어 |
| `word_meanings` | 품사별 한국어 의미 |
| `word_synonyms` | 동의어 |
| `word_similar` | 유의어 |
| `word_antonyms` | 반의어 |
| `learning_logs` | 어휘 학습 이력 (studied/memorized/failed) |
| `related_word_logs` | 관련단어 학습 이력 (synonym/similar/antonym) |
| `exams` | 시험 (scheduled→active→closed) |
| `exam_questions` | 시험 문항 스냅샷 (50문항) |
| `exam_results` | 학생 답안 + 채점 결과 |
| `counseling_slots` | 담임의 상담 가능 시간대 |
| `counseling_requests` | 상담 신청 |
| `counseling_records` | 상담 완료 기록 |
| `counseling_recommendations` | AI 위험도 분석 결과 |
| `dashboard_cache` | AI 인사이트 일일 캐시 |

---

## 5. 사용자 역할 및 권한

| 역할 | 로그인 방식 | 접근 범위 |
|------|------------|----------|
| `student` | 수험번호 → `{exam_no}@voca-master.internal` 변환 | 본인 학습·시험·상담만 |
| `admin_class` (반담임) | 이메일 + 비밀번호 | 담당 반 학생 전체 |
| `admin_branch` (지점관리자) | 이메일 + 비밀번호 | 담당 지점 내 전체 반 |
| `admin_super` (전체관리자) | 이메일 + 비밀번호 | 전체 지점·반·학생 |

---

## 6. 구현된 기능 목록

### 학생 기능

| 기능 | 설명 |
|------|------|
| **플래시카드 학습** | DAY별 50단어, 카드 뒤집기 애니메이션(motion/react), studied/memorized/failed 상태 기록 |
| **관련단어 학습** | 어휘 학습 완료 후 동의어·유의어·반의어 카드 학습, 타입별 진도 추적 |
| **셀프테스트** | 학습 완료 후 자체 점검 모드 |
| **오답 복습** | failed 상태 단어 모아보기 + 복습 세션 |
| **CBT 시험** | 실시간 타이머, 영어 단어 → 한국어 뜻 입력, 강제 종료 대응 |
| **시험 결과** | 점수·정오답·정답 비교 확인 |
| **진도 대시보드** | 전체 60일 진도율, 다음 시험, 오늘 학습 바로가기 |
| **상담 신청** | 담임의 상담 슬롯 달력 선택 → 신청, 수정, 취소 |

### 관리자 공통 기능

| 기능 | 설명 |
|------|------|
| **학년도 전역 선택** | 헤더 드롭다운으로 전체 메뉴 학년도 전환 (쿠키 저장) |
| **지점/학년도/반 필터** | 반관리·학생관리·학습진도·시험관리 공통 연계 필터 |
| **대시보드** | 총 학생·오늘 학습·위험 학생·상담 건수 요약 카드 |
| **위험 학생 감지** | 최근 3일 연속 미학습 학생 자동 표시 |
| **AI 학급 인사이트** | 날짜 변경 시 자동 생성, 재생성 버튼 제공 |

### 관리자 역할별 기능

| 기능 | 대상 역할 |
|------|----------|
| **지점 관리** (추가·수정·삭제) | admin_super |
| **반 관리** (학년도 필터, 추가·수정·삭제·비활성화·담임배정) | admin_super, admin_branch |
| **관리자 계정 관리** (초대·비활성화) | admin_super |
| **학생 관리** (추가·수정·월별 배정 체크박스·상세) | admin_super, admin_branch, admin_class |
| **학습 진도 관리** (반별 요약·학생별 어휘/관련단어 진도·Day별 상세) | 전체 역할 |
| **시험 출제** (DAY 2개 선택, 50문항 자동 생성) | admin_super, admin_branch, admin_class |
| **시험 결과 조회** (학생별 점수·정오답) | admin_super, admin_branch, admin_class |
| **어휘 관리** (편집, AI 의미 일괄 생성) | admin_super |
| **상담 관리** (목록, 시간대, 상세) | 전체 역할 (상세는 admin_class 전용) |

---

## 7. 페이지 라우팅 구조

```
/login                          → 로그인 (학생 탭 / 관리자 탭)

── 학생 (/student) ──────────────────────────────────
/student/dashboard              → 진도 요약 + 오늘 학습 바로가기
/student/study/[day]            → 플래시카드 + 셀프테스트 + 관련단어 학습
/student/review                 → 오답 목록
/student/review/session         → 오답 복습 세션
/student/exam                   → 시험 목록
/student/exam/[id]              → 시험 응시 (CBT)
/student/exam/[id]/result       → 시험 결과
/student/counseling             → 상담 신청

── 관리자 (/admin) ──────────────────────────────────
/admin/dashboard                → 통합 대시보드
/admin/branches                 → 지점 관리
/admin/classes                  → 반 관리 (지점/학년도 필터)
/admin/admins                   → 관리자 계정 관리
/admin/students                 → 학생 관리 (지점/학년도/반 필터)
/admin/students/[id]            → 학생 상세 (히트맵, 어휘/관련단어 진도)
/admin/progress                 → 학습 진도 관리 (반별 요약 + 학생 목록)
/admin/progress/[id]            → 학생별 상세 진도 (Day별 현황)
/admin/exams                    → 시험 관리 (지점/학년도/반 필터)
/admin/exams/[id]               → 시험 관리 + 결과 조회
/admin/vocabulary               → 어휘 관리
/admin/counseling               → 상담 관리 (목록 탭 + 시간대 탭)
/admin/counseling/[id]          → 상담 상세 (admin_class 전용)
```

---

## 8. 주요 컴포넌트

### 공용 관리자 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `AdminNav` | 역할별 사이드 네비게이션 |
| `YearSelector` | 헤더 학년도 전역 선택 드롭다운 (쿠키 저장) |
| `ProgressFilterBar` | 지점/학년도/반 연계 필터 (4개 페이지 공용, hideClass prop 지원) |
| `StudentRelatedProgress` | 관련단어 타입별 요약 카드 + DAY별 진도 테이블 |
| `StudentHeatmap` | 학생 학습 히트맵 (GitHub 스타일) |
| `ClassTable` | 반 목록 + 인라인 수정 + 담임 배정 |
| `StudentTable` | 학생 목록 + 월별 배정 체크박스 (12개월) |
| `CreateStudentForm` | 학생 추가 폼 |
| `ExamStatusButton` | 시험 상태 전환 버튼 (시작/종료/강제종료) |
| `ExamQRButton` | QR 코드 표시 |

### 학생 컴포넌트

| 컴포넌트 | 역할 |
|---------|------|
| `StudySession` | 플래시카드 학습 + 셀프테스트 + 관련단어 학습 (mode: flash/test/related) |

---

## 9. AI 기능

| 기능 | 모델 | 상태 |
|------|------|------|
| **어휘 의미/관련단어 일괄 생성** | Gemini 2.5 Flash | ✅ 구현됨 |
| **관리자 학급 인사이트** | Gemini 1.5 Pro | ✅ 구현됨 |
| **상담 이력 요약** | Gemini 1.5 Pro | ✅ 구현됨 |
| **AI 위험 학생 상담 추천** | Gemini 1.5 Pro | 미구현 |
| **학생 AI 코칭 메시지** | Gemini 1.5 Pro | 미구현 |

---

## 10. 인증 및 보안

### Supabase Auth

- 학생: `{수험번호}@voca-master.internal` 형식으로 이메일 계정 생성
- 관리자: 일반 이메일 + 비밀번호

### Row Level Security (RLS)

- `profiles`: 학생은 본인만, 관리자는 담당 범위만 조회
- 서버 컴포넌트에서 `createAdminClient()` (service role key)로 RLS 우회

### 역할별 접근 제어

- `proxy.ts`: URL 패턴으로 역할 검증 → 불일치 시 리다이렉트
- 상담 상세 페이지: `admin_class`만 접근, 그 외 목록으로 리다이렉트

---

## 11. 개발 환경 및 배포

### 환경 변수 (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

### 로컬 실행

```bash
cd voca-master
npm install
npm run dev     # http://localhost:3000
```

### 테스트 계정

| 역할 | 계정 | 비밀번호 |
|------|------|---------|
| 전체관리자 | admin@voca-master.com | 1234 |
| 지점관리자 | branch@voca-master.com | 1234 |
| 반담임 | class@voca-master.com | 1234 |
| 학생 | 수험번호 1001~1004 | 1234 |
