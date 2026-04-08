# CLAUDE.md

이 파일은 AI 코딩 어시스턴트(Claude, Gemini 등)가 이 프로젝트를 이어받을 때 즉시 맥락을 파악할 수 있도록 작성된 가이드입니다.

---

## 프로젝트 개요

**Voca-Master** — AI 기반 편입영어 통합 학습 관리 시스템
- 제출 마감: 2026년 4월 13일 (KIT 바이브코딩 공모전)
- 학생: 60일 커리큘럼, Day당 50단어(총 3,000단어), CBT 시험, 진도 추적
- 관리자: 지점/반/관리자 3단계 계층, 시험 생성, AI 상담 추천

**설계 원칙: Schema-Driven Development**
`docs/SDD.md`가 모든 개발의 단일 진실 공급원(Single Source of Truth)입니다.
코드를 작성하기 전에 반드시 SDD.md를 먼저 읽으세요.

---

## 현재 구현 상태 (2026-04-07 기준)

### 완료된 항목
- [x] `docs/SDD.md` — 전체 설계 확정 (DB 스키마, 타입, API, 페이지 구조)
- [x] Supabase DB 구성 완료 (DDL 실행, 3,000단어 시드 완료)
- [x] `src/types/index.ts` — TypeScript 타입 전체 정의
- [x] `src/lib/supabase/` — client/server/admin/middleware 클라이언트
- [x] `src/proxy.ts` — Next.js 16 Proxy (인증 게이트, 역할별 리다이렉트)
- [x] `src/app/actions/auth.ts` — 로그인/로그아웃 Server Actions
- [x] `src/app/(auth)/login/page.tsx` — 로그인 페이지 (학생/관리자 탭)
- [x] `/student/dashboard` — 진도 요약, 다음 시험, 오늘 학습 바로가기
- [x] `/student/study/[day]` — 플래시카드 + 셀프테스트 (motion/react 애니메이션)
- [x] `/student/review` + `/student/review/session` — 오답 복습
- [x] `/student/exam` + `/student/exam/[id]` — CBT 시험 (타이머, 답안 입력, 강제 종료)
- [x] `/student/exam/[id]/result` — 시험 결과
- [x] `/student/counseling` — 학생 상담 신청 (슬롯 선택, 신청 이력)
- [x] `/admin/dashboard` — 관리자 대시보드 (요약 카드)
- [x] `/admin/branches` — 지점 관리 (추가/인라인 수정/삭제)
- [x] `/admin/classes` — 반 관리 (지점 필터, 추가/삭제)
- [x] `/admin/admins` — 관리자 관리 (초대/비활성화)
- [x] `/admin/students` — 학생 관리 (추가/목록)
- [x] `/admin/exams` + `/admin/exams/[id]` — 시험 출제/관리 + 결과 조회
- [x] `/admin/vocabulary` — 어휘 관리 (Day 필터, AI 의미 일괄 생성, 편집 모달)
- [x] `/admin/counseling` + `/admin/counseling/[id]` — 상담 관리 (목록/시간대/상세)
- [x] `docs/seed_test_data.js` — 테스트 데이터 시드 (지점 2, 반 3, 관리자 2, 학생 4)

### Supabase에서 수동 실행 필요한 SQL
```sql
-- increment_exam_count RPC (시험 출제 시 기출 횟수 증가)
CREATE OR REPLACE FUNCTION increment_exam_count(vocab_ids UUID[])
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE vocabulary SET exam_count = exam_count + 1 WHERE id = ANY(vocab_ids);
$$;
```

### 테스트 계정
- 전체관리자: admin@voca-master.com / 1234
- 지점관리자: branch@voca-master.com / 1234 (대구본원)
- 반담임: class@voca-master.com / 1234 (대구본원 A반)
- 학생: 수험번호 1001~1004 / 비밀번호 1234

### 남은 작업
- [ ] 어휘 의미 AI 생성 실행 (관리자 로그인 → 어휘 관리 → AI 의미 일괄 생성)
- [ ] AI 상담 추천 생성 기능 (관리자 대시보드 → 위험 학생 감지)
- [ ] 관리자 대시보드 고도화 (Gemini 인사이트, 실시간 시험 현황)

---

## 파일 구조

```
voca-master/              ← 리포지토리 루트
├── docs/
│   ├── SDD.md            ← ★ 핵심 설계 문서 (반드시 먼저 읽기)
│   ├── supabase_ddl.sql  ← 실행 완료된 DDL
│   ├── supabase_seed_vocabulary.sql ← 실행 완료된 시드
│   └── issues/           ← 이슈 추적
├── VOCA.csv              ← 3,000단어 원본
└── voca-master/          ← Next.js 앱 루트 (여기서 npm run dev)
    ├── src/
    │   ├── app/
    │   │   ├── (auth)/login/page.tsx
    │   │   ├── (student)/         ← 미구현
    │   │   ├── (admin)/           ← 미구현
    │   │   └── actions/auth.ts
    │   ├── lib/supabase/
    │   ├── types/index.ts
    │   └── proxy.ts               ← Next.js 16 Proxy 파일
    └── .env.local                 ← Supabase URL/Key, Gemini API Key
```

---

## Tech Stack

| Layer | 패키지 | 버전 |
|---|---|---|
| Frontend | Next.js App Router + TypeScript | 16.2.2 |
| Styling | Tailwind CSS | ^4 |
| Animation | `motion` (`from 'motion/react'`) | ^12.38.0 |
| State | TanStack Query | ^5.96.2 |
| Backend/DB | Supabase + `@supabase/ssr` | ^2.101.1 |
| AI | Vercel AI SDK + `@ai-sdk/google` | ai ^6, google ^3 |

---

## ⚠️ Next.js 16 필수 주의사항

훈련 데이터의 Next.js(14/15)와 다릅니다. 코드 작성 전에 반드시 확인:

```
node_modules/next/dist/docs/   ← 내장 공식 문서
```

### 핵심 변경점

| 항목 | Next.js 14/15 | Next.js 16 |
|---|---|---|
| Proxy 파일명 | `middleware.ts` | `proxy.ts` |
| Proxy 함수명 | `export function middleware` | `export function proxy` |
| Lint 명령 | `next lint` | `eslint` (package.json scripts 참조) |
| Turbopack | `--turbo` 플래그 필요 | 기본값 (플래그 불필요) |

### proxy.ts 예시

```ts
// src/proxy.ts
import { type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // ...
}

export const config = { matcher: ['...'] };
```

### 패키지 주의사항

```ts
// ❌ 잘못된 import
import { motion } from 'framer-motion';     // React 19 비호환
import { createClient } from '@supabase/auth-helpers-nextjs'; // deprecated

// ✅ 올바른 import
import { motion } from 'motion/react';
import { createBrowserClient } from '@supabase/ssr';
import { createServerClient } from '@supabase/ssr';
```

---

## 사용자 역할 및 라우팅

| Role | 로그인 방식 | 리다이렉트 |
|---|---|---|
| `student` | 수험번호 → `{exam_no}@voca-master.internal` 변환 | `/student/dashboard` |
| `admin_super` | 이메일 + 비밀번호 | `/admin/dashboard` |
| `admin_branch` | 이메일 + 비밀번호 | `/admin/dashboard` |
| `admin_class` | 이메일 + 비밀번호 | `/admin/dashboard` |

---

## Supabase 클라이언트 사용 패턴

```ts
// 서버 컴포넌트 / Route Handler / Server Action
import { createClient } from '@/lib/supabase/server';
const supabase = await createClient();

// 클라이언트 컴포넌트
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
```

---

## Commands

```bash
cd voca-master   # Next.js 앱 디렉토리
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build
npm run lint
```

---

## Issue Tracking Protocol

모든 이슈는 `docs/issues/`에 추적한다.

**소스 파일 수정 전:**
1. `docs/issues/INDEX.md` 읽기
2. 연관 ISS-NNN.md 파일 확인 후 코드 작성

**신규 이슈 발견 시:**
1. `docs/issues/ISS-000-TEMPLATE.md` 복사 → `ISS-NNN.md` 생성
2. `docs/issues/INDEX.md` 업데이트

Severity: `CRITICAL`(데이터 손실/보안) → `HIGH`(주요 기능 불가) → `MED`(부분 저하) → `LOW`(UX 경미)
