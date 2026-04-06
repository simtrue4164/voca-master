# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Voca-Master** is an AI-driven edtech platform for Korean 편입 (transfer exam) English vocabulary learning. Target: April 13, 2026 submission deadline for KIT 바이브코딩 공모전.

Two user roles:
- **Students:** 60-day curriculum, 50 words/day (3,000 total), CBT quizzes, progress tracking
- **Admins:** multi-branch/class management, exam creation, AI-powered counseling recommendations for at-risk students

## Current State

Data engineering is complete; application code has not been written yet.

- `MVP Vol. 1 어휘 목록★.xlsx` — source vocabulary data (original)
- `VOCA.csv` — processed dataset: 3,000 words across 60 days (Day,Word format)
- `import_voca.js` — Node.js script to re-extract words from xlsx → VOCA.csv (reads column B from row 3, max 50 words per sheet/day)
- `import_voca.py` — Python equivalent using openpyxl, outputs `words_summary.json`

## Tech Stack (Installed)

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | 16.2.2 |
| Styling | Tailwind CSS | ^4 |
| Animation | `motion` (motion/react) — React 19 호환 | ^12.38.0 |
| State/Data | TanStack Query (React Query) | ^5.96.2 |
| Backend/DB | Supabase (PostgreSQL) — `@supabase/ssr` 사용 | ^2.101.1 |
| AI | Vercel AI SDK + `@ai-sdk/google` (Gemini) | ai ^6, google ^3 |
| Deployment | Vercel | — |

> **Note:** `framer-motion` 대신 `motion` 패키지 사용 (React 19 호환). import: `from 'motion/react'`
> **Note:** `@supabase/auth-helpers-nextjs` deprecated → `@supabase/ssr` 사용

## Next.js 16 주요 변경점

- **Turbopack 기본:** `next dev` / `next build` 모두 Turbopack 사용 (별도 플래그 불필요)
- **Node.js 20.9+** 필요
- `middleware` 컨벤션 → `proxy` 로 변경
- `unstable_` 접두사 API 안정화
- 내장 문서: `voca-master/node_modules/next/dist/docs/` 참조

## Commands

```bash
# Re-extract vocabulary from xlsx source
node import_voca.js          # outputs VOCA.csv
python import_voca.py        # outputs words_summary.json

# Next.js app (voca-master/ subdirectory):
cd voca-master
npm install
npm run dev    # http://localhost:3000
npm run build
npm run lint   # eslint (not next lint — changed in v16)
```

## Architecture Design

The planned system:

```
Student learning logs + Exam scores
        ↓
   Supabase DB (PostgreSQL)
        ↓
  AI Analytics Engine (Gemini 1.5 Pro)
        ↓
Admin Dashboard: counseling priority recommendations
```

Key Supabase tables to design:
- `vocabulary` — the 3,000 words with day assignments (seed from VOCA.csv)
- `users` — students and admins with branch/class associations
- `learning_logs` — per-word study progress per student
- `exams` + `exam_results` — CBT test sessions and scores
- `counseling_records` — AI recommendations and consultation history

## AI Features

1. **Counseling Recommendation Engine:** Analyze multi-dimensional student data (progress rate, score trends, wrong-answer patterns) to surface at-risk students for admins
2. **Word lookup via LLM:** On-demand generation of synonyms, POS, Korean meaning, example sentences for vocabulary items — no static DB needed for this content
3. **Rubric-based sentence feedback:** Grammar / Context / Complexity scoring when students write example sentences

## Issue Tracking Protocol

모든 개발 이슈, 버그, 설계 충돌은 `docs/issues/`에 추적된다.

**소스 파일 수정 전:**
1. `docs/issues/INDEX.md` 읽기
2. "File → Issue Map" 섹션에서 대상 파일 확인
3. 연관 ISS-NNN.md 파일을 읽은 후 코드 작성

**신규 이슈 발견 시:**
1. `docs/issues/ISS-000-TEMPLATE.md`를 복사해 `docs/issues/ISS-NNN.md` 생성
2. `docs/issues/INDEX.md` 업데이트 (Open Issues 테이블 + File → Issue Map + SDD Cross-Reference)
3. 응답에 이슈 ID 명시

**이슈 해결 시:**
1. ISS-NNN.md 업데이트 (Status, Closed, Solution, Change Log)
2. INDEX.md에서 Open → Resolved로 이동
3. File → Issue Map 항목은 유지 (이력 보존)

이슈 ID는 순번: ISS-001, ISS-002, ...
Severity 기준: `CRITICAL`(데이터 손실/보안) → `HIGH`(주요 기능 불가) → `MED`(부분 저하) → `LOW`(UX/DX 경미)
