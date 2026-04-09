# HANDOFF.md — Voca-Master 학생 관리 개편

> 작성 기준: 2026-04-07  
> 이 문서는 이번 세션에서 변경된 내용, 설계 결정, 알려진 주의사항을 정리합니다.

---

## 1. 이번 세션에서 바뀐 것

### 1-1. 학생 다중 반 소속 지원

학생이 여러 반에 동시에 소속될 수 있도록 데이터 모델과 UI를 전면 개편했습니다.

**DB 구조 (Supabase에 이미 반영됨):**
```sql
-- 월별 반 배정 (PK: student_id + class_id + year_month)
CREATE TABLE student_class_memberships (
  student_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES classes(id)  ON DELETE CASCADE,
  year_month  TEXT NOT NULL,  -- 'YYYY-MM' 형식
  PRIMARY KEY (student_id, class_id, year_month)
);
```

- `profiles.class_id`는 하위 호환용 레거시 필드로 유지 (현재 월의 primary 반을 동기화)
- 실질적 소속 정보는 `student_class_memberships`가 주도

### 1-2. 반 배정 UI — 학년도 + 월 체크박스

**수정 모달** (`StudentEditModal`):
- 학년도 입력 (number input)
- 1~12월 체크박스 그리드 (4열)
- 반 체크박스 (다중 선택)
- 저장 시 해당 연도 전체를 삭제 후 (선택 월 × 선택 반) 조합으로 재등록

**목록 테이블** (`StudentTable`):
- 가로 스크롤 테이블에 1~12월 열 추가
- 헤더의 월별 체크박스 = 필터된 전체 학생 일괄 배정/해제
- 개별 체크박스 = 즉시 서버 반영 (낙관적 UI)
- 배정된 반이 없는 학생은 체크 불가 (disabled)

### 1-3. 관리자 로그인 — 사번(employee_no) 방식

관리자도 학생과 동일하게 내부 이메일 방식으로 로그인합니다.
- 입력: 사번 (예: `A001`)
- 실제 Auth 이메일: `A001@voca-master.internal`
- `profiles.employee_no` 컬럼에 저장

### 1-4. 반 관리 — 학년도 + 활성 여부

`classes` 테이블 컬럼 변경:
- `start_date`, `end_date` → `year TEXT`, `is_active BOOLEAN`

---

## 2. 주요 파일 목록

| 파일 | 역할 |
|------|------|
| `src/app/admin/students/page.tsx` | 학생 목록 서버 컴포넌트 (데이터 조회) |
| `src/components/admin/StudentTable.tsx` | 학생 테이블 + 수정 모달 (클라이언트) |
| `src/components/admin/CreateStudentForm.tsx` | 학생 추가 폼 |
| `src/app/actions/students.ts` | 학생 관련 Server Actions 전체 |
| `src/app/actions/admins.ts` | 관리자 생성/수정 (사번 처리) |
| `src/app/actions/classes.ts` | 반 추가/수정 (year, is_active) |
| `src/components/admin/ClassTable.tsx` | 반 목록 테이블 |
| `docs/seed_test_data.js` | 테스트 데이터 시드 스크립트 |

---

## 3. Server Actions — students.ts 함수 목록

| 함수 | 용도 |
|------|------|
| `createStudent` | 학생 생성 (Auth + profiles upsert + memberships) |
| `updateStudentFull` | 이름/활성 상태 + 연간 반 배정 통합 저장 |
| `updateStudentPassword` | 비밀번호 초기화 |
| `toggleStudentMonth` | 목록에서 특정 학생 특정 월 즉시 토글 |
| `setBulkMonthEnrollment` | 목록 헤더에서 전체 학생 특정 월 일괄 토글 |
| `deleteStudent` | 학생 삭제 (Auth 삭제 → CASCADE로 profiles 자동 삭제) |
| `updateStudent` | 단순 이름/반/활성 수정 (레거시, 현재 미사용) |
| `upsertMonthlyEnrollment` | 단월 배정 upsert (레거시) |
| `setMonthlyEnrollments` | 단월 배정 교체 (레거시) |
| `deleteMonthlyEnrollment` | 단월 배정 삭제 (레거시) |
| `moveStudentClass` | 반 이동 (레거시) |

> 레거시 함수들은 현재 UI에서 호출되지 않지만 삭제하지 않았습니다. 추후 정리 가능.

---

## 4. 학생 조회 로직 — admin 역할별 필터

`src/app/admin/students/page.tsx`:

```
admin_super  → 필터 없음 (전체 학생)
admin_branch → memberships.class_id ∈ 지점 반 목록
             + profiles.class_id ∈ 지점 반 목록  (합산, 중복 제거)
admin_class  → memberships.class_id ∈ 담당 반 목록
             + profiles.class_id ∈ 담당 반 목록  (합산, 중복 제거)
```

두 소스를 합산하는 이유: `profiles.class_id`만 있고 membership 레코드가 없는 구버전 학생 데이터도 누락 없이 표시하기 위함.

---

## 5. profiles.class_id 동기화 규칙

`student_class_memberships`가 진실 공급원이지만 `profiles.class_id`도 일부 쿼리에서 여전히 사용됩니다.  
변경 시마다 아래 규칙으로 동기화합니다:

- **이번 달 배정 저장 시**: `profiles.class_id = class_ids[0]` (primary 반)
- **이번 달 배정 해제 시**: `profiles.class_id = null`
- **다른 달 배정 수정 시**: `profiles.class_id` 건드리지 않음

---

## 6. Auth Trigger 주의사항

Supabase Auth에 `handle_new_user()` 트리거가 있습니다.  
`@voca-master.internal` 이메일로 유저 생성 시 `profiles` 행을 자동 삽입합니다.  
따라서 `createStudent` / `createAdmin` 액션에서 profiles 저장 시 반드시 **upsert** 를 사용해야 합니다. `insert`를 쓰면 `profiles_pkey` duplicate key 에러가 발생합니다.

```typescript
// ✅ 올바름
await admin.from('profiles').upsert({ id: ..., role: 'student', ... }, { onConflict: 'id' });

// ❌ 잘못됨
await admin.from('profiles').insert({ id: ..., role: 'student', ... });
```

---

## 7. RLS 주의사항

`profiles` 테이블에 자기 참조 RLS가 있었고, 이를 우회하는 `get_my_role()` SECURITY DEFINER 함수를 Supabase SQL Editor에서 실행하여 해결했습니다.  
모든 서버 데이터 쿼리는 `createAdminClient()` (service_role key)를 사용하므로 RLS를 bypass합니다.

```typescript
// 서버 컴포넌트 / Server Action 에서는 항상
import { createAdminClient } from '@/lib/supabase/admin';
const admin = createAdminClient();
```

---

## 8. 테스트 계정

| 역할 | 로그인 | 비밀번호 |
|------|--------|----------|
| 전체관리자 | 사번: `S001` | `1234` |
| 지점관리자 (대구본원) | 사번: `A001` | `1234` |
| 반담임 (대구본원 A반) | 사번: `A002` | `1234` |
| 학생 1~4 | 수험번호: `1001`~`1004` | `1234` |

> 로그인 화면 관리자 탭: 사번 입력 → 내부적으로 `{사번}@voca-master.internal` 변환

---

## 9. 남은 작업

- [ ] 어휘 의미 AI 자동 생성 실행 (어휘관리 → AI 의미 일괄 생성)
- [ ] AI 상담 추천 생성 기능
- [ ] 관리자 대시보드 고도화 (Gemini 인사이트, 실시간 시험 현황)
- [ ] `students.ts` 레거시 함수 정리 (updateStudent, upsertMonthlyEnrollment 등)
- [ ] SDD.md 업데이트 (classes 테이블 컬럼 변경, student_class_memberships PK 변경 반영)

---

## 10. Supabase에서 수동 실행 필요한 SQL

```sql
-- 기출 횟수 증가 RPC (시험 출제 시 필요)
CREATE OR REPLACE FUNCTION increment_exam_count(vocab_ids UUID[])
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE vocabulary SET exam_count = exam_count + 1 WHERE id = ANY(vocab_ids);
$$;

-- RLS 무한재귀 방지 함수 (이미 실행된 경우 재실행 불필요)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;
```
