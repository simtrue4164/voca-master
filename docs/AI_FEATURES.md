# Voca-Master AI 기능 명세서

> Google Gemini AI를 활용한 3가지 핵심 AI 기능

---

## 목차

1. [AI 기술 기반](#1-ai-기술-기반)
2. [AI 학급 인사이트 자동 생성](#2-ai-학급-인사이트-자동-생성)
3. [어휘 데이터 AI 일괄 생성](#3-어휘-데이터-ai-일괄-생성)
4. [AI 위험 학생 감지 및 상담 추천](#4-ai-위험-학생-감지-및-상담-추천)
5. [AI 데이터 캐시 구조](#5-ai-데이터-캐시-구조)

---

## 1. AI 기술 기반

| 항목 | 내용 |
|------|------|
| **AI 모델** | Google Gemini 2.5 Flash / Gemini 1.5 Pro |
| **SDK** | Vercel AI SDK (`ai` v6) + `@ai-sdk/google` v3 |
| **구조화 출력** | `generateObject` + Zod 스키마로 JSON 응답 강제 |
| **텍스트 생성** | `generateText`로 자유형 인사이트 문장 생성 |
| **호출 위치** | Next.js Route Handler (`/api/admin/*`) — 서버에서만 호출 |
| **API Key** | `.env.local`의 `GOOGLE_GENERATIVE_AI_API_KEY` |

---

## 2. AI 학급 인사이트 자동 생성

### 개요

관리자 대시보드 접속 시, 당일 학급 현황(학습률·위험 학생 수·시험 평균)을 기반으로  
Gemini AI가 **자연어 인사이트**를 자동으로 작성합니다.

### 트리거 방식

```
관리자 대시보드 접속
  │
  ▼
서버에서 dashboard_cache 조회
  │
  ├─ 캐시 생성일 == 오늘(KST)?
  │     └─ YES → 캐시된 인사이트 즉시 표시
  │
  └─ NO (날짜 변경 or 첫 생성)
        └─ isStale = true → DashboardInsightCard 전달
              │
              ▼
        useEffect 자동 트리거 (마운트 시 1회)
              │
              ▼
        POST /api/admin/dashboard/insight
              │
              ▼
        Gemini 1.5 Pro → 인사이트 생성
              │
              ▼
        dashboard_cache UPSERT → 화면 갱신
```

### 입력 데이터 (stats)

```typescript
{
  totalStudents: number,    // 담당 범위 내 총 학생 수
  todayActive: number,      // 오늘 학습 활동이 있는 학생 수
  atRiskCount: number,      // 최근 3일 연속 미학습 학생 수
  recentExamAvg: number | null,  // 가장 최근 시험 평균 점수 (50점 만점)
}
```

### API 명세

```
POST /api/admin/dashboard/insight
Content-Type: application/json

Body: { stats: { totalStudents, todayActive, atRiskCount, recentExamAvg } }

Response: { summary: string }  // 2~4문장 자연어 인사이트
```

### 생성 결과 예시

```
오늘 A반 28명 중 19명(68%)이 학습에 참여했습니다.
최근 3일간 학습 기록이 없는 학생이 4명으로, 개별 확인이 필요합니다.
지난 시험 평균 점수는 38점으로 전반적으로 양호한 수준입니다.
꾸준히 학습하는 학생들을 격려하고, 미학습 학생에게는 오늘 연락해 보세요.
```

### UI 특징

- **자동 생성 중**: 스켈레톤 로딩 애니메이션 (pulse 효과)
- **생성 완료**: 인사이트 텍스트 + 생성 시간 표시 (`n분 전`)
- **재생성 버튼**: 언제든 수동으로 재생성 가능
- **캐시 유지**: 같은 날 재접속 시 캐시된 내용 즉시 표시 (API 미호출)

---

## 3. 어휘 데이터 AI 일괄 생성

### 개요

3,000단어 원본 데이터에서 **한국어 의미**, **동의어**, **유의어**, **반의어**를  
Gemini 2.5 Flash가 편입영어 기준으로 자동 생성합니다.

### 트리거 방식

관리자(`admin_super`)가 어휘 관리 페이지에서 **"AI 의미 일괄 생성"** 버튼을 클릭 시 실행됩니다.

```
어휘 관리 페이지
  │
  ▼
"AI 의미 일괄 생성" 클릭
  │
  ▼
의미 없는 단어 목록 클라이언트에서 수집
  │
  ▼
50개씩 배치 분할
  │
  ▼
POST /api/admin/vocabulary/generate (배치별 반복)
  │
  ▼
Gemini 2.5 Flash → 구조화 JSON 응답 (generateObject)
  │
  ▼
word_meanings / word_synonyms / word_similar / word_antonyms 테이블 INSERT
```

### API 명세

```
POST /api/admin/vocabulary/generate
Content-Type: application/json

Body: {
  words: Array<{
    id: string,           // vocab_id
    word: string,         // 영어 단어
    needsMeaning: boolean,
    needsSynonym: boolean,
    needsSimilar: boolean,
    needsAntonym: boolean,
  }>
}

Response: { generated: number }  // 처리된 단어 수
```

### AI 응답 스키마 (Zod)

```typescript
{
  words: Array<{
    word: string,           // 원본 단어 (철자 그대로)
    entries: Array<{
      pos: 'n.' | 'v.' | 'adj.' | 'adv.' | 'prep.' | 'conj.',
      meaning_ko: string,   // 한국어 핵심 뜻 (30자 이내)
    }>,                     // 1~4개 품사별 의미
    synonyms: string[],     // 동의어 (완전히 동일한 의미) 0~3개
    similar: string[],      // 유의어 (뜻이 비슷한 단어) 0~3개
    antonyms: string[],     // 반의어 (뜻이 반대인 단어) 0~3개
  }>
}
```

### 생성 결과 예시

| 단어 | 품사 | 한국어 의미 | 동의어 | 유의어 | 반의어 |
|------|------|-----------|--------|--------|--------|
| abandon | v. | 버리다, 포기하다 | forsake, desert | relinquish | keep, maintain |
| abundant | adj. | 풍부한, 많은 | plentiful, ample | copious | scarce, sparse |
| accelerate | v. | 가속하다, 빠르게 하다 | hasten, quicken | expedite | decelerate, slow |

### 저장 테이블

| 테이블 | 저장 내용 |
|--------|---------|
| `word_meanings` | 품사별 한국어 의미 (`pos`, `meaning_ko`, `display_order`) |
| `word_synonyms` | 동의어 (`synonym`, `display_order`) |
| `word_similar` | 유의어 (`similar_word`, `display_order`) |
| `word_antonyms` | 반의어 (`antonym`, `display_order`) |

### 배치 처리 방식

- 1회 API 호출당 최대 **50단어** 처리
- 3,000단어 전체 생성 시 60회 배치 순차 실행
- 이미 의미가 있는 단어는 `needsMeaning: false`로 건너뜀 (중복 생성 방지)

---

## 4. AI 위험 학생 감지 및 상담 추천

### 개요

학습 데이터 분석을 통해 상담이 필요한 위험 학생을 자동 감지하고,  
AI 위험도 점수(`risk_score`)와 사유를 생성하여 상담 추천 데이터로 저장합니다.

### 위험 학생 감지 기준 (서버 사이드)

```typescript
// 최근 3일간 학습 기록이 없는 학생 = 위험 학생
const threeDaysAgo = new Date();
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

// learning_logs에 최근 3일 기록이 없고,
// 과거 학습 이력이 1건 이상 있는 학생 → atRiskStudents 목록에 포함
```

### AI 위험도 분석 데이터 구조

위험 학생에 대해 상담 추천이 생성될 때 저장되는 데이터:

```typescript
// counseling_recommendations 테이블
{
  student_id: string,
  admin_id: string,
  risk_score: number,      // 0.0 ~ 1.0 (AI가 산출한 위험도)
  reason: string,          // AI 생성 한국어 사유
  factors: {
    progress_rate: number,         // 전체 커리큘럼 진도율
    score_trend: number,           // 최근 시험 점수 추이
    fail_rate: number,             // 오답 비율
    consecutive_absent: number,    // 연속 미학습 일수
  }
}
```

### 대시보드 표시

관리자 대시보드의 **위험 학생** 카드:

```
위험 학생                    3일 이상 미학습
─────────────────────────────────────
홍길동         A반 · 1001     3일+ 미학습
김영희         A반 · 1002     3일+ 미학습
```

### 상담 상세 화면에서의 표시

AI 추천으로 생성된 상담 신청의 경우, 상담 상세 화면에서 위험도 정보를 확인할 수 있습니다:

```
신청 경로: AI 추천
─────────────────────────────────────
위험도 점수:  0.85 / 1.00
사유:        최근 5일간 학습 기록 없음. 이전 시험 점수 하락 추세.
분석 요소:   진도율 42% / 오답율 68% / 연속 미학습 5일
```

---

## 5. AI 데이터 캐시 구조

### dashboard_cache 테이블

AI 생성 결과를 DB에 캐시하여 불필요한 API 호출을 방지합니다.

```sql
CREATE TABLE dashboard_cache (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL,        -- 관리자 ID
  cache_type   TEXT NOT NULL,        -- 'admin_insight' 등
  content      JSONB NOT NULL,       -- { summary: "..." }
  generated_at TIMESTAMPTZ,
  UNIQUE (user_id, cache_type)       -- 사용자+타입 단일 캐시
);
```

### 캐시 갱신 정책

| cache_type | 갱신 조건 | 만료 기준 |
|------------|---------|----------|
| `admin_insight` | 날짜(KST) 변경 시 | 하루 1회 |

### KST 날짜 비교 로직

```typescript
// 서버: 오늘 KST 날짜
const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

// 캐시 생성일을 KST로 변환
const cachedDateKST = insightCache?.generated_at
  ? new Date(new Date(insightCache.generated_at).getTime() + 9 * 60 * 60 * 1000)
      .toISOString().split('T')[0]
  : null;

// 날짜가 다르면 stale → 자동 재생성
const isInsightStale = cachedDateKST !== today;
```

---

## 향후 확장 가능한 AI 기능 (미구현)

| 기능 | 설명 | cache_type |
|------|------|------------|
| **이상 감지 알림** | 급격한 학습 패턴 변화 자동 감지 | `admin_anomalies` |
| **목표 달성 예측** | 학생별 커리큘럼 완료 가능성 예측 | `admin_goal_prediction` |
| **학생 AI 코칭** | 개인 학습 패턴 분석 + 맞춤 학습 조언 | `student_coaching` |
| **시험 점수 예측** | 현재 학습 상태 기반 다음 시험 점수 예측 | `student_prediction` |

> `dashboard_cache` 테이블의 `cache_type` 컬럼에 이미 enum으로 정의되어 있어 DB 변경 없이 구현 가능합니다.
