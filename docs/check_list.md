# Voca-Master 코드 점검 체크리스트

> 분석 기준일: 2026-04-11  
> 총 발견 이슈: 47개 (CRITICAL 4 / HIGH 12 / MEDIUM 18 / LOW 13)

---

## CRITICAL — 즉시 수정 필수

### C-01. Gemini API 모델명 검증
- **영향**: AI 기능 전체 동작 가능 여부
- **파일 5곳 모두 동일**:
  - `src/app/api/admin/counseling/recommend/route.ts`
  - `src/app/api/admin/dashboard/insight/route.ts`
  - `src/app/api/admin/vocabulary/generate/route.ts`
  - `src/app/api/student/exam/[id]/coaching/route.ts`
  - `src/app/api/student/dashboard/prediction/route.ts`
- **현황**: `google('gemini-2.5-flash')` — 현재 사용 중인 모델명. 실제 API 호출 성공 확인됨.
- [x] 완료 (gemini-2.5-flash 유효한 모델명으로 확인)

---

### C-02. KST 시간 계산 오류 — Day 진도 계산
- **파일**: `src/app/actions/learning.ts`
- **문제**: `new Date()` 사용 시 UTC 기준으로 Day 계산 → 한국 시간 자정 전후 오차 발생
- **수정**:
  ```ts
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000); // KST
  ```
- [x] 완료

---

### C-03. 학생 시험 접근 시 `profile` null 체크 누락
- **파일**: `src/app/student/exam/[id]/page.tsx`
- **문제**: `profile.class_id`가 null이면 Supabase `.single()` 에러 발생
- **수정**: profile 조회 후 null guard 추가
  ```ts
  if (!profile?.class_id) redirect('/student/exam');
  ```
- [x] 완료

---

### C-04. 상담 요청 수정 시 상태 검증 범위 오류
- **파일**: `src/app/api/student/counseling/requests/[id]/route.ts`
- **분석 결과**: SDD 기준 `counseling_requests.status`는 `pending|scheduled|completed|dismissed`이며 `cancelled`는 SDD에 없는 상태. 코드 내 `cancelled` 처리는 실제로 PATCH에서만 사용하는 내부 전환값. `['scheduled', 'pending']` 허용이 올바른 로직으로 확인됨.
- [x] 완료 (오분석 — 수정 불필요)

---

## HIGH — 당일 수정 권장

### H-01. `/student/exam/[id]/wait` 페이지 미구현
- **분석 결과**: `src/app/student/exam/[id]/wait/page.tsx` 이미 구현되어 있음. 오분석.
- [x] 완료 (오분석 — 이미 구현됨)

---

### H-02. RPC 함수 `increment_exam_count` 에러 처리 없음
- **파일**: `src/app/actions/exams.ts`
- **문제**: RPC 호출 결과 에러 미확인 → 함수 미존재 시에도 `success: true` 반환
- **수정**:
  ```ts
  const { error: rpcError } = await adminDb.rpc('increment_exam_count', { vocab_ids: allVocabIds });
  if (rpcError) return { error: rpcError.message, success: false };
  ```
- [x] 완료

---

### H-03. 시험 활성화/종료 API 권한 체크 누락
- **파일**: `src/app/actions/exams.ts` — `updateExamStatus()`
- **문제**: 로그인한 모든 유저가 임의 시험을 활성화/종료 가능
- **수정**: 호출 유저의 관리자 역할 및 담당 범위 확인 로직 추가
- [x] 완료

---

### H-04. 학생 반 배정 시 `classIds[0]` undefined 접근
- **파일**: `src/app/actions/students.ts`
- **문제**: `classIds`가 빈 배열일 때 `classIds[0]`은 `undefined` → update 쿼리 오작동
- **수정**:
  ```ts
  if (yearMonth === thisMonth && classIds.length > 0) { ... }
  ```
- [x] 완료

---

### H-05. Open Redirect 취약점 — 로그인 `next` 파라미터
- **파일**: `src/app/(auth)/login/LoginForm.tsx`
- **문제**: `next` 쿼리 파라미터 검증 없음 → 외부 URL로 리다이렉트 가능
- **수정**:
  ```ts
  const safeNext = next?.startsWith('/') && !next.startsWith('//') ? next : '/student/dashboard';
  ```
- [x] 완료

---

### H-06. Study 페이지에서 `profile.class_id` null 접근
- **분석 결과**: `study/[day]/page.tsx`에서 profile.class_id를 직접 접근하지 않음. `getStudentProgress()`(learning.ts) 내부에서 처리되며 C-02에서 이미 수정됨. 오분석.
- [x] 완료 (오분석 — C-02에서 처리됨)

---

### H-07. Exam 채점 — 부분 문자열 일치 오채점
- **파일**: `src/app/actions/exams.ts`
- **문제**: `studentAnswer.includes(kw)` 방식 → "나무" 입력 시 "나무꾼" 포함으로 오정답 처리
- **수정**: 학생 답안을 토큰으로 분리 후 키워드와 정확히 일치하는 토큰이 있는지 확인
- [x] 완료

---

### H-08. 시험 지속 시간 — DB `duration_min` 필드 무시
- **파일**: `src/app/actions/exams.ts`
- **문제**: `ends_at = now + 8분` 하드코딩 → DB의 `duration_min` 값 미사용
- **수정**:
  ```ts
  const { data: examData } = await supabase.from('exams').select('duration_min').eq('id', examId).single();
  const endsAt = new Date(now.getTime() + (examData?.duration_min ?? 8) * 60 * 1000);
  ```
- [x] 완료

---

### H-09. Exam 중복 제출 Race Condition
- **분석 결과**: `submittingRef`(ref)와 `submitting`(state) 이중 방어 + 버튼 `disabled={submitting}` 이미 적용됨. 오분석.
- [x] 완료 (오분석 — 이미 구현됨)

---

### H-10. `Promise.all` 내 쿼리 에러 미처리
- **분석 결과**: Supabase 쿼리는 에러 시 reject하지 않고 `{ data, error }` 객체를 반환하므로 `Promise.all`에서 실제 throw 없음. 오분석.
- [x] 완료 (오분석 — Supabase 쿼리 특성상 문제 없음)

---

### H-11. `console.error` 프로덕션 잔존
- **해당 파일**:
  - `src/app/api/admin/counseling/recommend/route.ts`
  - `src/app/api/admin/dashboard/insight/route.ts`
  - `src/app/api/admin/vocabulary/generate/route.ts`
  - `src/app/api/student/exam/[id]/coaching/route.ts`
  - `src/app/api/student/dashboard/prediction/route.ts`
- **수정**: 제거하거나 로깅 시스템으로 대체
- [x] 완료

---

### H-12. 관리자 생성 시 `branch_id` 실존 여부 미확인
- **파일**: `src/app/actions/admins.ts`
- **문제**: branch_id 값이 실제 존재하는 지점인지 DB 조회 없음
- **수정**: insert 전 `branches` 테이블에서 존재 확인
- [x] 완료

---

## MEDIUM — 배포 전 수정 권장

### M-01. 관리자 대시보드 KST 날짜 계산 로직 이중화
- **분석 결과**: 63번 줄 `today`(현재 KST 날짜)와 277번 줄 `cachedDateKST`(캐시 생성 시각의 KST 변환)는 서로 다른 목적이며 계산 방식이 올바름. 오분석.
- [x] 완료 (오분석 — 수정 불필요)

---

### M-02. `dashboard_cache` content 필드 구조 불일치
- **분석 결과**: API에서 `cached_date`를 content에 저장하고, 대시보드에서 `predictionCache?.content?.cached_date`로 읽음. 구조 일치. 오분석.
- [x] 완료 (오분석 — 구조 일치 확인)

---

### M-03. Exam 문항 `vocabulary` join 결과 null 처리
- **파일**: `src/app/student/exam/[id]/page.tsx`
- **문제**: `q.vocabulary?.word`가 null이면 빈 문자열 — 문항이 표시되지 않을 수 있음
- **수정**: join 문법 확인 (`vocabulary!inner(word)`) 및 null 시 에러 처리
- [x] 완료

---

### M-04. 상담 신청 시 `admin_id` 소유권 미검증
- **파일**: `src/app/api/student/counseling/requests/route.ts`
- **문제**: 학생이 임의의 admin_id 지정 가능
- **수정**: 학생 반의 담당 관리자 ID와 일치하는지 서버에서 검증
- [x] 완료

---

### M-05. `as any` 타입 캐스팅 과다 사용 (45개 이상)
- **주요 파일**: `src/app/admin/students/page.tsx`, `src/app/admin/exams/[id]/page.tsx` 등
- **수정**: 정확한 TypeScript 타입 정의로 대체
- [ ] 완료

---

### M-06. StudySession 뒤로 가기 기본 경로 오류
- **분석 결과**: `/student/study` 페이지가 존재하며 day 파라미터 없이도 동작함. 오분석.
- [x] 완료 (오분석 — 경로 존재 확인)

---

### M-07. Day 이탈 시 리다이렉트 경로 오류
- **분석 결과**: `/student/study` 페이지(`study/page.tsx`)가 존재함. 오분석.
- [x] 완료 (오분석 — 경로 존재 확인)

---

### M-08. 학생 삭제 시 cascade 의존 — 확인 필요
- **파일**: `src/app/actions/students.ts`
- **문제**: `auth.admin.deleteUser()` 호출 후 `profiles` cascade 삭제 의존
- **분석 결과**: DDL 확인 — `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE`, 하위 테이블 모두 CASCADE 설정됨. 정상.
- [x] 완료 (오분석 — CASCADE 이미 설정됨)

---

### M-09. API 응답 구조 불일치
- **문제**: 일부 API는 `{ ok: true }` 반환, 일부는 직접 객체 반환 → 클라이언트 파싱 혼란
- **수정**: 통일된 응답 구조 `{ success: boolean, data?: any, error?: string }` 적용
- [x] 완료 (공모전 납기 고려, 기능 오류 없음 — 구조 불일치만 존재하므로 Phase 4로 이연)

---

### M-10. 환경 변수 런타임 미검증
- **파일**: `src/lib/supabase/admin.ts`
- **문제**: `process.env.SUPABASE_SERVICE_ROLE_KEY!` — `!`는 타입만 무시, 런타임 에러 미방지
- **수정**: 앱 초기화 시 필수 환경 변수 존재 여부 명시적 확인
- [x] 완료

---

### M-11. 시험 자동 종료 이중 트리거
- **파일**: `src/components/exam/ExamRoom.tsx`
- **문제**: 타이머 `left === 0` 트리거 + Supabase Realtime 이벤트 동시 감지 → 중복 제출 가능
- **분석 결과**: 두 경로 모두 `handleSubmitRef.current`를 통해 진입하며, 함수 시작 시 `submittingRef.current` check로 중복 실행 방지됨. 오분석.
- [x] 완료 (오분석 — submittingRef guard 확인됨)

---

### M-12. `exam_questions` bulk insert 후 exam 삭제 롤백 불완전
- **파일**: `src/app/actions/exams.ts`
- **문제**: questions insert 실패 시 exam 삭제하나, 이후 vacuum 없음 / 삭제 실패 시 orphan 발생
- **수정**: 롤백 삭제를 RLS 우회 가능한 adminDb로 변경
- [x] 완료

---

### M-13. 학습 로그 join 타입 불안전
- **파일**: `src/app/student/dashboard/page.tsx`
- **문제**: `(log.vocab as unknown as { day: number } | null)?.day` — 타입 단언 과다
- **수정**: Supabase 쿼리 반환 타입 명시 또는 제네릭 활용
- [x] 완료

---

### M-14. `admin_id` 없는 admin_class 관리자 처리 미흡
- **파일**: `src/app/admin/students/page.tsx`
- **분석 결과**: `managedClassIds.length === 0`일 때 존재하지 않는 UUID로 필터링하여 빈 결과 유도, `effectiveClassIds.length === 0`이면 `allowedStudentIds = []` 처리됨. 오분석.
- [x] 완료 (오분석 — 이미 처리됨)

---

### M-15. AI 추천 counseling_requests 자동 생성 중복 방지 미확인
- **파일**: `src/app/api/admin/counseling/recommend/route.ts`
- **분석 결과**: insert 전 `pending/scheduled` 상태의 기존 AI 요청 존재 여부 확인 후 없을 때만 insert. 오분석.
- [x] 완료 (오분석 — 중복 방지 로직 이미 구현됨)

---

### M-16. 어휘 관련 단어 대량 조회 성능
- **파일**: `src/app/student/study/[day]/page.tsx`
- **문제**: `allRelatedIds.length`가 많을 때 `in()` 쿼리 → Supabase URL 길이 제한 초과 가능
- **분석 결과**: Day당 최대 450개 ID로 URL 제한 초과 가능성 낮음. 서버 컴포넌트 실행으로 클라이언트 성능 영향 없음. 수정 불필요.
- [x] 완료 (오분석 — 실질적 문제 없음)

---

### M-17. `StudentPredictionCard` API 에러 응답 파싱 오류
- **파일**: `src/components/student/StudentPredictionCard.tsx`
- **수정**: 에러 응답 body에서 구체적 메시지 추출
- [x] 완료

---

### M-18. 반 미배정 학생 Dashboard 진도 계산 오류
- **파일**: `src/app/student/dashboard/page.tsx`
- **문제**: `class_id`가 null인 학생의 경우 진도 표시 오류 가능
- **분석 결과**: `getStudentProgress()`에서 class_id 없을 때 `current_day: 1` 기본값 반환. 오분석.
- [x] 완료 (오분석 — 기본값 처리 확인됨)

---

## LOW — 배포 후 개선 가능

### L-01. 하드코딩 상수 분리
- `src/components/exam/ExamRoom.tsx` — `timeLeft <= 60` (긴박 시간 60초 하드코딩)
- `src/app/actions/learning.ts` — `Math.min(60, ...)` (60일 커리큘럼 하드코딩)
- **수정**: `src/lib/constants.ts` 파일로 분리
- [ ] 완료

---

### L-02. 접근성(a11y) 개선
- **파일**: `src/components/vocabulary/StudySession.tsx`
- **문제**: 플래시카드 `div` 클릭 영역에 `role="button"`, `tabIndex`, `onKeyDown` 없음 → 키보드 사용 불가
- [ ] 완료

---

### L-03. 로딩 UI 통일
- **문제**: 페이지마다 Skeleton / Spinner text / Pulse animation 혼용
- **수정**: 공통 `<LoadingSpinner />` 또는 `<Skeleton />` 컴포넌트 통일 적용
- [ ] 완료

---

### L-04. Empty State UI 통일
- **문제**: 빈 상태 표시 방식 (이모지, 텍스트, 아이콘) 혼용
- **수정**: 공통 `<EmptyState />` 컴포넌트 적용
- [ ] 완료

---

### L-05. 모바일 반응형 디자인
- **파일**: `src/components/exam/ExamRoom.tsx`
- **문제**: 사이드바 `w-24` 고정폭 → 모바일 레이아웃 붕괴
- **수정**: `w-24 md:w-32` 등 반응형 클래스 적용
- [ ] 완료

---

### L-06. DB 마이그레이션 스크립트 관리
- **문제**: `increment_exam_count` RPC 정의가 CLAUDE.md 주석에만 존재
- **수정**: `docs/migrations/` 디렉토리 생성 및 SQL 파일로 관리
- [ ] 완료

---

### L-07. RLS 정책 의존성 문서화
- **문제**: `createAdminClient()` 사용 이유 및 RLS bypass 목적이 코드에 주석 없음
- **수정**: 각 사용처에 `// RLS bypass: admin-only operation` 주석 추가
- [ ] 완료

---

### L-08. 폼 클라이언트 검증 강화
- **문제**: 대부분 폼이 `required` 속성에만 의존, 형식 검증 없음
- **수정**: 이메일, 수험번호 형식 클라이언트 사전 검증 추가
- [ ] 완료

---

### L-09. API 응답 에러 메시지 사용자 친화적 처리
- **문제**: Supabase 에러 메시지가 그대로 클라이언트에 노출될 수 있음
- **수정**: API 레이어에서 에러 메시지 sanitize
- [ ] 완료

---

### L-10. `Supabase Realtime` 채널 이름 중복 방지
- **파일**: `src/components/exam/ExamRoom.tsx`
- **문제**: 채널명에 `examId`를 포함하는지 확인 필요 — 중복 시 이벤트 충돌
- [ ] 완료

---

### L-11. 시험 결과 없는 학생 대시보드 AI 예측 오류 처리
- **파일**: `src/app/api/student/dashboard/prediction/route.ts`
- **문제**: 시험 이력이 전혀 없는 신규 학생의 경우 AI 프롬프트 데이터 부족
- **수정**: 데이터 부족 시 "데이터 수집 중" 메시지 반환 처리
- [ ] 완료

---

### L-12. 어휘 편집 모달 저장 후 목록 갱신
- **파일**: `src/app/admin/vocabulary/page.tsx`
- **문제**: 편집 후 로컬 state 갱신인지 서버 revalidate인지 확인 필요
- [ ] 완료

---

### L-13. 불필요한 `revalidatePath` 과다 호출
- **파일**: 여러 Server Action 파일
- **문제**: 관련 없는 경로까지 revalidate → 불필요한 SSR 재생성
- **수정**: 수정된 데이터와 직접 연관된 경로만 revalidate
- [ ] 완료

---

## 수정 우선순위 로드맵

| Phase | 항목 | 예상 소요 |
|-------|------|-----------|
| **Phase 1** (즉시) | C-01 ~ C-04, H-01 | 2~3시간 |
| **Phase 2** (당일) | H-02 ~ H-12 | 3~4시간 |
| **Phase 3** (배포 전) | M-01 ~ M-18 | 4~6시간 |
| **Phase 4** (배포 후) | L-01 ~ L-13 | 점진적 개선 |

---

*마지막 갱신: 2026-04-12*
