# Voca-Master 코드베이스 심층 분석

> 작성일: 2026-04-10 | 분석 대상: 전체 소스코드 (80개 파일)

---

## 1. 시스템 전체 구조

### 기술 스택
| 레이어 | 기술 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 16 App Router | proxy.ts (middleware.ts 대신) |
| 스타일 | Tailwind CSS v4 | Apple 디자인 시스템 적용 |
| 애니메이션 | `motion/react` | framer-motion 대체 |
| 데이터베이스 | Supabase (PostgreSQL) | RLS + service_role 혼합 사용 |
| AI | Vercel AI SDK + Gemini 2.5 Flash | generateText / generateObject |
| 상태관리 | Server Actions + useActionState | TanStack Query 설치됐지만 미사용 |

### 디렉토리 역할 한눈에 보기
```
src/
├── proxy.ts                  ← 인증 게이트 (미인증 → /login, 역할별 리다이렉트)
├── types/index.ts            ← 전체 TypeScript 타입 정의
├── lib/supabase/
│   ├── client.ts             ← 브라우저용 (anon key, BrowserClient)
│   ├── server.ts             ← 서버용 SSR (anon key, 쿠키 기반)
│   ├── admin.ts              ← service_role (RLS 우회, 서버 전용)
│   └── middleware.ts         ← proxy.ts에서 호출, 세션 갱신 + 역할 리다이렉트
├── lib/adminYear.ts          ← admin_year 쿠키 읽기 유틸리티
├── app/
│   ├── page.tsx              ← / → /login 리다이렉트만
│   ├── layout.tsx            ← 루트 레이아웃 (Geist 폰트, metadata)
│   ├── (auth)/login/         ← 로그인 페이지 (학생/관리자 탭)
│   ├── actions/              ← 모든 Server Actions (12개 파일)
│   ├── api/                  ← Route Handlers (AI 기능 + 상담 REST)
│   ├── student/              ← 학생 영역 (layout + 5개 섹션)
│   └── admin/                ← 관리자 영역 (layout + 9개 섹션)
└── components/
    ├── admin/                ← 관리자 UI 컴포넌트 (17개)
    ├── exam/                 ← 시험 컴포넌트 (ExamRoom, ExamWaitRoom)
    ├── student/              ← 학생 UI 컴포넌트 (5개)
    ├── ui/                   ← 공통 UI (SlotCalendar)
    └── vocabulary/           ← 학습 세션 (StudySession)
```

---

## 2. 인증 & 라우팅 흐름

### 로그인 방식
```
학생:    수험번호 1001 → "{1001}@voca-master.internal" → signInWithPassword
관리자:  사번 SUPER01  → "{SUPER01}@voca-master.internal" → signInWithPassword
```

### proxy.ts 동작
1. 모든 요청 가로채기 (`/_next/static` 등 제외)
2. `updateSession()` 호출 → Supabase 세션 쿠키 갱신
3. 미인증 + 비공개 경로 → `/login?next={원래경로}` 리다이렉트
4. 인증된 상태로 `/login` 접근 → role 조회 → 대시보드 리다이렉트

### layout.tsx 역할 (추가 검증)
- `student/layout.tsx`: role !== 'student' → `/admin/dashboard`
- `admin/layout.tsx`: role === 'student' → `/student/dashboard`, `is_active === false` → `/login`

### 학생 로그인 특이사항
- `student_class_memberships` 이번 달 등록 여부 확인
- 등록 없으면 로그아웃 후 에러 반환 (수강 등록이 로그인 조건)

---

## 3. Supabase 클라이언트 사용 패턴

| 클라이언트 | 사용 위치 | 권한 |
|---|---|---|
| `createClient()` (server) | Server Component, Server Action, Route Handler | anon key + RLS |
| `createAdminClient()` | 크로스유저 조회, 관리자 기능, Auth 관리 | service_role (RLS 우회) |
| `createClient()` (client) | 클라이언트 컴포넌트 | anon key + RLS |

**실제 패턴**: 대부분의 관리자 페이지에서 `createClient()` + `createAdminClient()` 를 함께 사용
- 현재 유저 확인: `createClient().auth.getUser()`
- 데이터 조회: `createAdminClient()` (RLS 우회 목적)

---

## 4. 학생 화면 동작 상세

### 대시보드 (`/student/dashboard`)
- `getStudentProgress()` Server Action → 학습 집계 (Day 계산, streak, progress_rate)
- AI 성과 예측 캐시 조회 (`dashboard_cache.student_prediction`)
- 60일 그리드 렌더링 (done/today/partial/missed/locked 5가지 상태)
- `StudentPredictionCard` 클라이언트 컴포넌트 → 캐시 없거나 당일 아니면 AI 자동 생성

### 학습 (`/student/study/[day]`)
- `StudySession` 컴포넌트: 플래시카드 → 셀프테스트 → 관련단어 3단계
- `upsertLearningLog()` / `upsertRelatedWordLog()` Server Action으로 상태 저장
- 상태: `studied`(열람) → `memorized`(정답) / `failed`(오답)

### 시험 흐름
```
/student/exam           → 시험 목록 (class_id 기준 조회)
/student/exam/[id]/wait → 대기 화면 (ExamWaitRoom: 5초 폴링으로 상태 감지)
/student/exam/[id]      → CBT 응시 (ExamRoom: ends_at 타이머, Realtime 강제 종료)
/student/exam/[id]/result → 결과 + AI 코칭 (ExamCoachingCard)
/student/exam/[id]/review → 오답 단어 복습 (StudySession 재사용)
```

### 오답 복습 (`/student/review`)
- `learning_logs.status === 'failed'` 단어만 필터
- Day별 그룹핑 후 전체 복습 시작 → `review/session` (StudySession 재사용)

### 상담 (`/student/counseling`)
- 담임 admin 조회 (`admin_class_assignments`)
- 예약 가능 슬롯: `is_active=true` + 날짜 >= 오늘 + 이미 예약된 슬롯 제외
- 중복 신청 방지: `pending/scheduled` 상태 기존 요청 확인 후 블록
- `POST /api/student/counseling/requests` 로 신청

---

## 5. 관리자 화면 동작 상세

### 대시보드 (`/admin/dashboard`)
- 역할별 담당 범위 계산 (super → 전체, branch → 지점, class → 배정된 반)
- `admin_year` 쿠키로 학년도 필터
- 통계 카드 6개 (총학생, 오늘학습, 위험학생, 상담신청, 학습률, 관련어)
- 위험 학생: 최근 3일 학습 로그 없고 기존 학습 이력 있는 학생
- AI 인사이트: `dashboard_cache.admin_insight` 당일 KST 기준 캐시

### 진도 관리 (`/admin/progress`)
- `ProgressFilterBar` (지점 → 연도 → 반 연계 필터)
- 학생별: 어휘진도(%), 관련단어진도(%), 최근학습일, 위험등급
- `/admin/progress/[id]`: 히트맵(60일) + 시험점수 차트 + 관련단어 DAY별 현황

### 시험 관리 (`/admin/exams`)
- 시험 생성 → `exam_count` 낮은 순 25+25개 자동 선택 → `increment_exam_count` RPC
- 상태 전이: `scheduled` → `active`(시작 시 실제 시각으로 starts_at/ends_at 갱신) → `closed`
- `ExamAutoClosePoller`: 관리자 화면에서 5초 폴링으로 자동 종료 감지
- 학생 강제 종료: Realtime broadcast → 클라이언트 자동 제출

### 어휘 관리 (`/admin/vocabulary`)
- Day 필터 (1~60), 단어별 의미/동의어/유의어/반의어 현황
- AI 일괄 생성: `/api/admin/vocabulary/generate` → Gemini → 최대 50개 배치
- 인라인 편집 모달 (`VocabularyManager` 클라이언트 컴포넌트)

### 상담 관리 (`/admin/counseling`)
- 탭: 상담 신청 목록 / 슬롯 관리
- `/admin/counseling/[id]`: admin_class 전용 상담 상세 + 기록 작성
- 슬롯 관리: `POST/PATCH /api/admin/counseling/slots`, 일괄: `POST/DELETE /api/admin/counseling/slots/bulk`

---

## 6. AI 기능 상세

### 6-1. 어휘 AI 자동 채우기 (`POST /api/admin/vocabulary/generate`)
- 입력: 단어 배열 (최대 50개)
- 출력: pos별 한국어 뜻 + 동의어 + 유의어 + 반의어
- Gemini `generateObject` + Zod 스키마 검증
- 결과 → `word_meanings`, `word_synonyms`, `word_similar`, `word_antonyms` insert

### 6-2. 학생 AI 성과 예측 (`POST /api/student/dashboard/prediction`)
- 입력: progressRate, learningRate, streakDays, currentDay, failedCount
- 추가: 최근 시험 3회 점수 조회
- 출력 (Zod 스키마): next_exam_score_min/max, completion_probability, message, action
- 당일 KST 캐시 (`dashboard_cache.student_prediction`)

### 6-3. 학생 AI 코칭 메시지 (`POST /api/student/exam/[id]/coaching`)
- 입력: score, total, wrongWords
- 추가: 학생 전체 학습 진도율 계산
- 출력: 3~4문장 맞춤 코칭 메시지
- 캐시: `dashboard_cache.student_coaching` (exam별 구분 없이 1개만 유지)

### 6-4. 관리자 AI 학급 인사이트 (`POST /api/admin/dashboard/insight`)
- 입력: totalStudents, todayActive, atRiskCount, recentExamAvg
- 출력: 3문장 이내 학급 현황 인사이트
- 당일 KST 캐시 (`dashboard_cache.admin_insight`)

### 6-5. AI 상담 추천 (`POST /api/admin/counseling/recommend`)
- 입력: studentIds 배열
- 학생별: 학습진도율, 오답률, 연속미학습일, 최근5회 시험점수 조회
- 출력 (Zod 스키마): 학생별 risk_score(0~1) + reason
- risk_score > 0.5 → `counseling_requests(source='ai')` 자동 생성

---

## 7. 발견된 문제점 및 중복/불필요 코드

### 7-1. 미사용 타입 (index.ts)
다음 타입들이 정의됐지만 어디에서도 import되지 않음:
- `StudyRecommendation` — 단계별 추천 시스템 설계됐지만 미구현
- `StudentGoalPrediction` — 실제 예측 카드는 별도 스키마 사용
- `AnomalyAlert` — 관리자 대시보드 알림 기능 미구현
- `GoalPrediction` — 관리자용 예측 기능 미구현
- `ExamStats`, `ExamQuestionStat` — 집계 타입이지만 사용 페이지 없음
- `ExamResultDetail.time_spent_sec` — 시험 시스템이 소요 시간을 기록하지 않음
- `RelatedWordLog` — 관련단어 로그 타입이지만 `learning.ts`가 자체 정의한 타입 사용

### 7-2. 패키지 설치됐지만 미사용
- `@tanstack/react-query` — package.json에 있으나 어떤 파일도 import하지 않음

### 7-3. Server Actions 중 하위호환 래퍼 (counseling.ts)
```ts
// 아래 3개는 새 함수의 단순 래퍼로 중복:
export async function confirmSchedule(requestId, slotId) { return reserveSlot(requestId, slotId); }
export async function dismissRequest(requestId) { return cancelRequest(requestId); }
export async function saveCounselingRecord(...) { return completeSession(...); }
```

### 7-4. canManageTeacher 함수 중복
`/api/admin/counseling/slots/route.ts`와 `/api/admin/counseling/slots/bulk/route.ts`에
완전히 동일한 `canManageTeacher()` 함수가 복사되어 있음.

### 7-5. students.ts — 유사 기능 중복
`updateStudent()`와 `updateStudentFull()`가 겹치는 기능:
- `updateStudent`: 이름/반/is_active만 수정
- `updateStudentFull`: 이름/반/is_active + 연간 월별 배정 통합 수정
- `updateStudent`는 `StudentTable`에서만 사용 (인라인 수정용)

월별 배정 관련 Server Actions 5개 (`upsertMonthlyEnrollment`, `setMonthlyEnrollments`,
`toggleStudentMonth`, `setBulkMonthEnrollment`, `deleteMonthlyEnrollment`) — 각각 약간씩 다른
시나리오를 처리하지만 비슷한 delete+insert 패턴을 반복

### 7-6. 상담 상태 스키마 불일치 (잠재적 버그)
DB 스키마: `CHECK (status IN ('pending','scheduled','completed','dismissed'))`
코드에서 실제 사용: `'confirmed'`, `'cancelled'` 도 사용

- `counseling.ts`: `confirmAppointment()` → status를 `'confirmed'`로 업데이트
- `CounselingTabs`: `'confirmed'` 상태 표시
- `cancelRequest()` → status를 `'cancelled'`로 업데이트
- 관리자 대시보드: `'confirmed'`, `'cancelled'` 필터

→ DB CHECK 제약이 실제로 적용되어 있으면 런타임 오류 발생 가능

### 7-7. dashboard_cache 구조 문제
- UNIQUE (user_id, cache_type) 이므로 student_coaching은 1개만 유지
- 여러 시험을 응시하면 가장 최근 시험 코칭만 남음 (의도된 동작이지만 exam_id를 content에 저장해 혼란)

### 7-8. AdminToggleButton.tsx — 디자인 시스템 미반영
```tsx
// Apple 디자인 토큰이 아닌 색상 클래스 사용:
className={`... ${isActive ? 'text-red-400 hover:text-red-600' : 'text-blue-500 hover:text-blue-700'}`}
```

### 7-9. StudentScoreChart.tsx — 디자인 시스템 미반영
`bg-green-400`, `bg-blue-400`, `bg-yellow-400`, `bg-red-400` 사용
Apple 디자인 시스템과 불일치

### 7-10. SlotCalendar.tsx — 디자인 시스템 미반영
`bg-blue-600`, `bg-blue-50`, `bg-blue-100`, `bg-blue-200` 사용
Apple 디자인 시스템과 불일치

### 7-11. admin/progress/page.tsx — 부분 미반영
반별 요약 카드: `bg-red-50`, `text-red-600` 사용
진도 바: `bg-blue-500`, `bg-purple-500` (Apple 토큰은 `bg-[#1d1d1f]`)

### 7-12. admin/counseling/page.tsx — 통계 카드 미반영
`bg-blue-50`, `bg-indigo-50`, `bg-green-50` 색상 통계 카드

### 7-13. admin/progress/[id]/page.tsx — 부분 미반영
`bg-blue-50 text-blue-700`, `bg-green-50 text-green-700`, `bg-purple-50 text-purple-700`

### 7-14. forceCloseExam 클라이언트 권한 이슈
```ts
// exams.ts의 forceCloseExam이 createClient()(RLS 적용)를 사용
// admin이 자신이 만들지 않은 시험을 종료할 때 RLS로 막힐 수 있음
export async function forceCloseExam(examId: string) {
  const supabase = await createClient(); // ← adminClient 사용 필요
  ...
}
```

### 7-15. classes.ts — year 타입 불일치
```ts
// formData.get('year') → string이지만 DB 컬럼은 INTEGER
const { error } = await admin.from('classes').insert({ name, branch_id: branchId, year, ... });
// year가 문자열로 전달됨 (Supabase가 암묵적 변환하므로 실제로 동작하지만 위험)
```

---

## 8. 데이터 흐름 핵심 요약

### 학습 진도 계산 (`getStudentProgress`)
```
classes.start_date → currentDay 계산
learning_logs → studied/memorized/failed 집계
progress_rate = studied / (currentDay × 50) × 100
learning_rate = memorized / (memorized + failed) × 100
streak_days = 연속 학습일 (오늘부터 역순으로 날짜 세기)
```

### 시험 문항 생성 알고리즘
```
day_1 vocabulary → exam_count 오름차순 → 상위 25개
day_2 vocabulary → exam_count 오름차순 → 상위 25개
word_meanings 스냅샷 → accepted_answers JSONB 저장
increment_exam_count RPC 호출 → 기출 횟수 증가
```

### 채점 로직
```
student_answer.trim().toLowerCase() 포함 검사
accepted_answers의 meaning_ko를 `,/、/` 등으로 분리한 키워드 중 하나라도 포함 → 정답
오답 vocab_id → learning_logs.status = 'failed' upsert
```

---

## 9. 컴포넌트 재사용 구조

| 컴포넌트 | 재사용 위치 |
|---|---|
| `StudySession` | `/student/study/[day]`, `/student/review/session`, `/student/exam/[id]/review` |
| `ProgressFilterBar` | `/admin/progress`, `/admin/exams`, `/admin/students` |
| `StudentRelatedProgress` | `/admin/students/[id]`, `/admin/progress/[id]` |
| `ExamCoachingCard` | `/student/exam/[id]/result` |
| `StudentPredictionCard` | `/student/dashboard` |

---

## 10. API 라우트 vs Server Action 분리 원칙

| 유형 | 방식 | 이유 |
|---|---|---|
| CRUD 뮤테이션 (단순) | Server Action + useActionState | 폼 기반, revalidatePath |
| AI 생성 (시간 소요) | Route Handler (POST) | 클라이언트에서 fetch, 로딩 UI 필요 |
| 상담 슬롯 관리 | Route Handler | 클라이언트 컴포넌트에서 직접 호출 |
| 상담 신청/수정 (학생) | Route Handler | 클라이언트 컴포넌트에서 직접 호출 |
| 상담 처리 (관리자) | Server Action | CounselingDetail 서버 컴포넌트 연동 |

---

## 11. 정리: 제거/통합 가능한 항목

### 즉시 제거 가능
1. `types/index.ts`의 미사용 타입 7개
2. `counseling.ts`의 하위호환 래퍼 함수 3개 (`confirmSchedule`, `dismissRequest`, `saveCounselingRecord`)
3. `@tanstack/react-query` 패키지 (package.json에서 제거)

### 통합 가능
4. `canManageTeacher()` → 공통 유틸 파일로 추출
5. `updateStudent()` → `updateStudentFull()`로 통합 (인라인 수정도 updateStudentFull 사용)

### 버그 수정 필요
6. 상담 상태 enum 정리 (`'confirmed'`/`'cancelled'` DB 스키마에 추가 또는 코드에서 제거)
7. `forceCloseExam()` → `createAdminClient()` 사용으로 변경

### 디자인 시스템 통일 (선택적)
8. `AdminToggleButton.tsx` 버튼 스타일
9. `StudentScoreChart.tsx` 차트 색상
10. `SlotCalendar.tsx` 색상
11. `admin/progress`, `admin/counseling` 통계/진도 색상

---

## 12. 전체 파일 목록 (역할 정리)

### 페이지 (25개)
| 경로 | 역할 |
|---|---|
| `app/page.tsx` | → /login 리다이렉트 |
| `app/(auth)/login/page.tsx` | 로그인 페이지 (학생/관리자 탭) |
| `app/student/layout.tsx` | 학생 레이아웃 + role 검증 + BottomNav |
| `app/student/dashboard/page.tsx` | 학생 대시보드 (진도요약, AI예측, 60일그리드) |
| `app/student/study/page.tsx` | Day 목록 (60개) |
| `app/student/study/[day]/page.tsx` | 플래시카드 + 셀프테스트 + 관련단어 |
| `app/student/review/page.tsx` | 오답 단어 목록 |
| `app/student/review/session/page.tsx` | 오답 복습 세션 |
| `app/student/exam/page.tsx` | 시험 목록 |
| `app/student/exam/[id]/wait/page.tsx` | 시험 대기 화면 |
| `app/student/exam/[id]/page.tsx` | CBT 응시 |
| `app/student/exam/[id]/result/page.tsx` | 시험 결과 + AI 코칭 |
| `app/student/exam/[id]/review/page.tsx` | 시험 문항 복습 |
| `app/student/counseling/page.tsx` | 상담 신청 + 이력 |
| `app/admin/layout.tsx` | 관리자 레이아웃 + role/활성 검증 |
| `app/admin/dashboard/page.tsx` | 관리자 대시보드 (통계, 위험학생, AI) |
| `app/admin/branches/page.tsx` | 지점 관리 |
| `app/admin/classes/page.tsx` | 반 관리 (담임 배정) |
| `app/admin/admins/page.tsx` | 관리자 관리 |
| `app/admin/students/page.tsx` | 학생 관리 (월별 배정) |
| `app/admin/students/[id]/page.tsx` | 학생 상세 (히트맵, 점수차트, 관련단어) |
| `app/admin/progress/page.tsx` | 학습 진도 목록 |
| `app/admin/progress/[id]/page.tsx` | 진도 상세 (어휘+관련단어 DAY별) |
| `app/admin/exams/page.tsx` | 시험 출제/목록 |
| `app/admin/exams/[id]/page.tsx` | 시험 결과 조회 |
| `app/admin/vocabulary/page.tsx` | 어휘 관리 |
| `app/admin/counseling/page.tsx` | 상담 목록 + 슬롯 관리 |
| `app/admin/counseling/[id]/page.tsx` | 상담 상세 (admin_class 전용) |

### Server Actions (12개 파일, 40+ 함수)
| 파일 | 주요 함수 |
|---|---|
| `auth.ts` | loginStudent, loginAdmin, logout |
| `learning.ts` | upsertLearningLog, upsertRelatedWordLog, getStudentProgress |
| `exams.ts` | createExam, updateExamStatus, autoCloseIfExpired, submitExam, forceCloseExam, getExamStatus |
| `branches.ts` | createBranch, updateBranch, deleteBranch |
| `classes.ts` | createClass, updateClass, deleteClass, assignTeacher |
| `students.ts` | createStudent, updateStudentPassword, updateStudentFull, updateStudent, upsertMonthlyEnrollment, setMonthlyEnrollments, toggleStudentMonth, setBulkMonthEnrollment, deleteMonthlyEnrollment, moveStudentClass, deleteStudent |
| `admins.ts` | createAdmin, updateAdmin, deactivateAdmin, activateAdmin |
| `counseling.ts` | reserveSlot, confirmAppointment, completeSession, cancelRequest (+ 래퍼 3개) |
| `vocabulary.ts` | getVocabularyByDay, getWordDetail, addWordMeaning, updateWordMeaning, deleteWordMeaning, addWordSynonym, deleteWordSynonym, addWordSimilar, deleteWordSimilar, addWordAntonym, deleteWordAntonym, resetExamCount, getWordsWithoutMeanings |
| `year.ts` | setAdminYear |

### API Route Handlers (10개)
| 경로 | 메서드 | 역할 |
|---|---|---|
| `/api/admin/vocabulary/generate` | POST | AI 어휘 생성 |
| `/api/admin/dashboard/insight` | POST | AI 학급 인사이트 |
| `/api/admin/counseling/recommend` | POST | AI 상담 추천 |
| `/api/admin/counseling/slots` | POST, PATCH | 슬롯 생성/수정 |
| `/api/admin/counseling/slots/bulk` | POST, DELETE | 슬롯 일괄 생성/비활성화 |
| `/api/admin/counseling/records` | POST, PUT | 상담 기록 생성/수정 |
| `/api/admin/counseling/requests/[id]` | PATCH | 상담 요청 상태 변경 |
| `/api/student/counseling/requests` | POST | 학생 상담 신청 |
| `/api/student/counseling/requests/[id]` | PATCH | 학생 상담 수정/취소 |
| `/api/student/dashboard/prediction` | POST | AI 성과 예측 |
| `/api/student/exam/[id]/coaching` | POST | AI 코칭 메시지 |
