# Voca-Master AI 기능 명세서

> Google Gemini AI를 활용한 핵심 AI 기능  
> 최종 업데이트: 2026-04-12

---

## 목차

1. [AI 기술 기반](#1-ai-기술-기반)
2. [AI 학급 인사이트 자동 생성](#2-ai-학급-인사이트-자동-생성)
3. [어휘 데이터 AI 일괄 생성](#3-어휘-데이터-ai-일괄-생성)
4. [AI 위험 학생 감지 및 상담 추천](#4-ai-위험-학생-감지-및-상담-추천)
5. [상담 이력 AI 요약](#5-상담-이력-ai-요약)
6. [학생 AI 코칭 메시지](#6-학생-ai-코칭-메시지)
7. [학생 AI 성과 예측](#7-학생-ai-성과-예측)
8. [AI 데이터 캐시 구조](#8-ai-데이터-캐시-구조)

---

## 1. AI 기술 기반

| 항목 | 내용 |
|------|------|
| **AI 모델** | Google Gemini 2.5 Flash (`gemini-2.5-flash`, 전체 기능 공통) |
| **SDK** | Vercel AI SDK (`ai` v6) + `@ai-sdk/google` v3 |
| **구조화 출력** | `generateObject` + Zod 스키마로 JSON 응답 강제 |
| **텍스트 생성** | `generateText` / `streamText`로 자유형 문장 생성 |
| **호출 위치** | Next.js Route Handler (`/api/*`) — 서버에서만 호출 |
| **API Key** | `.env.local`의 `GOOGLE_GENERATIVE_AI_API_KEY` |

---

## 2. AI 학급 인사이트 자동 생성

### 개요

관리자 대시보드 접속 시, 당일 학급 현황을 기반으로  
Gemini 1.5 Pro가 **자연어 인사이트**를 자동으로 작성합니다.

### 트리거 방식

```
관리자 대시보드 접속
  │
  ▼
서버에서 dashboard_cache 조회
  │
  ├─ 캐시 생성일 == 오늘(KST)?  YES → 캐시된 인사이트 즉시 표시
  │
  └─ NO → isStale = true 클라이언트 전달
              │
              ▼
        DashboardInsightCard useEffect 자동 트리거
              │
              ▼
        POST /api/admin/dashboard/insight
              │
              ▼
        Gemini 2.5 Flash → 인사이트 생성
              │
              ▼
        dashboard_cache UPSERT → 화면 갱신
```

### 입력 데이터

```typescript
{
  totalStudents: number,       // 담당 범위 내 총 학생 수
  todayActive: number,         // 오늘 학습 활동이 있는 학생 수
  atRiskCount: number,         // 최근 3일 연속 미학습 학생 수
  recentExamAvg: number | null // 가장 최근 시험 평균 점수 (50점 만점)
}
```

### 생성 결과 예시

```
오늘 A반 28명 중 19명(68%)이 학습에 참여했습니다.
최근 3일간 학습 기록이 없는 학생이 4명으로, 개별 확인이 필요합니다.
지난 시험 평균 점수는 38점으로 전반적으로 양호한 수준입니다.
꾸준히 학습하는 학생들을 격려하고, 미학습 학생에게는 오늘 연락해 보세요.
```

### UI

- **자동 생성 중**: 스켈레톤 로딩 애니메이션
- **생성 완료**: 인사이트 텍스트 + 생성 시간 표시
- **재생성 버튼**: 언제든 수동으로 재생성 가능
- **캐시**: 같은 날 재접속 시 저장된 내용 즉시 표시

---

## 3. 어휘 데이터 AI 일괄 생성

### 개요

3,000단어 원본 데이터에서 **한국어 의미**, **동의어**, **유의어**, **반의어**를  
Gemini 2.5 Flash가 편입영어 기준으로 자동 생성합니다.

### 트리거

`admin_super`가 어휘 관리 페이지에서 **"AI 의미 일괄 생성"** 버튼 클릭 시 실행됩니다.

### 처리 흐름

```
"AI 의미 일괄 생성" 클릭
  │
  ▼
의미 없는 단어 목록 수집
  │
  ▼
50개씩 배치 분할
  │
  ▼
POST /api/admin/vocabulary/generate (배치별 반복)
  │
  ▼
Gemini 2.5 Flash → generateObject (Zod 스키마)
  │
  ▼
word_meanings / word_synonyms / word_similar / word_antonyms INSERT
```

### AI 응답 스키마 (Zod)

```typescript
{
  words: Array<{
    word: string,
    entries: Array<{
      pos: 'n.' | 'v.' | 'adj.' | 'adv.' | 'prep.' | 'conj.',
      meaning_ko: string,     // 한국어 핵심 뜻 (30자 이내)
    }>,                       // 1~4개 품사별 의미
    synonyms: string[],       // 동의어 (완전히 동일한 의미) 0~3개
    similar: string[],        // 유의어 (뜻이 비슷한 단어) 0~3개
    antonyms: string[],       // 반의어 (뜻이 반대인 단어) 0~3개
  }>
}
```

### 생성 결과 예시

| 단어 | 품사 | 한국어 의미 | 동의어 | 유의어 | 반의어 |
|------|------|-----------|--------|--------|--------|
| abandon | v. | 버리다, 포기하다 | forsake, desert | relinquish | keep, maintain |
| abundant | adj. | 풍부한, 많은 | plentiful, ample | copious | scarce, sparse |
| accelerate | v. | 가속하다 | hasten, quicken | expedite | decelerate |

### 저장 테이블

| 테이블 | 저장 내용 |
|--------|---------|
| `word_meanings` | 품사별 한국어 의미 |
| `word_synonyms` | 동의어 |
| `word_similar` | 유의어 |
| `word_antonyms` | 반의어 |

### 배치 처리

- 1회 API 호출당 최대 **50단어**
- 3,000단어 전체 생성 시 60회 배치 순차 실행
- 이미 의미가 있는 단어는 건너뜀 (중복 방지)

---

## 4. AI 위험 학생 감지 및 상담 추천

### 위험 학생 감지 (서버 사이드 계산)

```typescript
// 최근 3일간 학습 기록이 없는 학생 = 위험 학생
// learning_logs + related_word_logs 모두 체크
```

대시보드 **위험 학생** 카드에 자동으로 표시됩니다.

### AI 위험도 분석 데이터 구조

```typescript
// counseling_recommendations 테이블에 저장
{
  student_id: string,
  admin_id: string,
  risk_score: number,           // 0.0 ~ 1.0 (AI 산출 위험도)
  reason: string,               // AI 생성 한국어 사유
  factors: {
    progress_rate: number,      // 전체 진도율
    score_trend: number,        // 최근 시험 점수 추이
    fail_rate: number,          // 오답 비율
    consecutive_absent: number, // 연속 미학습 일수
  }
}
```

### 상담 상세 화면에서의 표시 (AI 추천 건)

```
신청 경로: AI 추천
위험도 점수:  0.85 / 1.00
사유:        최근 5일간 학습 기록 없음. 이전 시험 점수 하락 추세.
분석 요소:   진도율 42% / 오답율 68% / 연속 미학습 5일
```

---

## 5. 상담 이력 AI 요약

### 개요

상담 상세 화면에서 해당 학생의 이전 상담 기록들을 Gemini 2.5 Flash가 3문장 이내로 요약합니다.

### 조건

- 상담 기록(`counseling_records`)이 **2건 이상**인 경우에만 호출
- 1건 이하인 경우 원본 그대로 표시

### API

```
GET /api/counseling/[student_id]/history-summary
→ streamText로 스트리밍 반환
```

### 프롬프트 구조

```
System: 당신은 학생 상담 담당자를 돕는 AI 어시스턴트입니다.

User: 다음 학생의 상담 기록들을 3문장 이내로 요약하세요.
      상담 패턴, 주요 문제, 이전 조치 결과를 포함하세요.
      [{ date, content, outcome }, ...]
```

---

## 6. 학생 AI 코칭 메시지

### 개요

시험 결과 화면에서 해당 시험의 점수·오답 단어·학습 진도율을 기반으로  
Gemini 2.5 Flash가 **맞춤형 코칭 메시지** (3~4문장)를 자동으로 생성합니다.

### API

```
POST /api/student/exam/[id]/coaching
```

### 입력 데이터

```typescript
{
  score: number,              // 이번 시험 점수 (50점 만점)
  totalQuestions: number,     // 총 문항 수
  wrongWords: string[],       // 오답 단어 목록
  progressRate: number,       // 전체 커리큘럼 진도율 (0~1)
}
```

### UI

- **ExamCoachingCard**: 시험 결과 점수 카드 바로 아래 자동 표시
- **캐시**: `dashboard_cache(cache_type: student_coaching)` — 시험별 1회 저장

---

## 7. 학생 AI 성과 예측

### 개요

학생 대시보드 최상단에 표시되는 **다음 시험 점수 예측 + 완주 가능성** 카드입니다.  
진도율·정답률·연속학습일·오답수·시험추세를 종합해 Gemini 2.5 Flash가 분석합니다.

### API

```
POST /api/student/dashboard/prediction
```

### 생성 결과 구조

```typescript
{
  scoreMin: number,           // 예측 점수 하한
  scoreMax: number,           // 예측 점수 상한
  completionPossibility: '높음' | '보통' | '낮음',
  actionItems: string[],      // 실천 행동 2~3가지
  summary: string,            // 1문장 요약
}
```

### UI

- **StudentPredictionCard**: 학생 대시보드 최상단 자동 표시
- **캐시**: `dashboard_cache(cache_type: student_prediction)` — 당일(KST) 1회 캐시

---

## 8. AI 데이터 캐시 구조

### dashboard_cache 테이블

AI 생성 결과를 DB에 캐시하여 불필요한 API 호출을 방지합니다.

```sql
CREATE TABLE dashboard_cache (
  user_id      UUID NOT NULL,
  cache_type   TEXT NOT NULL,
  content      JSONB NOT NULL,
  generated_at TIMESTAMPTZ,
  UNIQUE (user_id, cache_type)
);
```

### 캐시 갱신 정책

| cache_type | 사용자 | 갱신 조건 |
|------------|--------|---------|
| `admin_insight` | 관리자 | 날짜(KST) 변경 시 자동 재생성 |
| `student_prediction` | 학생 | 날짜(KST) 변경 시 자동 재생성 |
| `student_coaching` | 학생 | 시험 제출 시 1회 생성 (시험별 고정) |

### KST 날짜 비교 로직

```typescript
const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
const cachedDate = new Date(new Date(cache.generated_at).getTime() + 9 * 60 * 60 * 1000)
  .toISOString().split('T')[0];
const isStale = cachedDate !== today;
```
