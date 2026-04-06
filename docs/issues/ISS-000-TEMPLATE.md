# ISS-NNN: [제목 — 명령형, 최대 60자]

> **이 파일은 템플릿입니다.** 실제 이슈 작성 시 이 파일을 복사하여 `ISS-NNN.md`로 저장하세요.
> 복사 후 이 안내 블록을 삭제하고, INDEX.md를 업데이트하세요.

| Field | Value |
|-------|-------|
| **ID** | ISS-NNN |
| **Status** | `OPEN` \| `INVESTIGATING` \| `BLOCKED` \| `RESOLVED` \| `WONTFIX` |
| **Severity** | `CRITICAL` \| `HIGH` \| `MED` \| `LOW` |
| **Opened** | YYYY-MM-DD |
| **Closed** | YYYY-MM-DD 또는 — |
| **SDD Reference** | §N.N [섹션명] 또는 N/A |
| **Reporter** | `human` \| `claude` \| `both` |

---

## Affected Files

> 이슈와 직접 관련된 파일과 라인 번호를 기록한다.

| File | Lines | Role in Issue |
|------|-------|---------------|
| `voca-master/src/path/to/file.ts` | 42–67 | 증상이 나타나는 위치 |
| `voca-master/src/path/to/other.ts` | 12 | 근본 원인 위치 |

---

## Problem Description

> 무슨 일이 일어났는가? 기대 동작 vs 실제 동작을 구체적으로 기술한다.
> 사용자 액션 → 시스템 응답 → 에러 메시지(원문 그대로) 순서로 작성.

[이슈 설명]

**Error output (있는 경우):**
```
에러 메시지 원문 붙여넣기
```

---

## Root Cause Analysis

> 왜 이 문제가 발생했는가? 코드 경로를 추적하여 원인을 설명한다.

[원인 분석]

---

## Solution / Workaround

> 무엇을 했거나 해야 하는가? 실제 코드 변경 내용을 포함한다.

**Status:** `Implemented` | `Proposed` | `Workaround only`

```typescript
// Before (문제 코드)
// voca-master/src/path/to/file.ts:42

// After (수정 코드)
```

**Migration notes:** Supabase 스키마 변경, 환경변수 추가 등 부가 작업이 있으면 기록.

---

## Appeal Anchors

> AI 세션 시작 시 컨텍스트 로딩용 문장. 복붙하여 사용.

- "Before editing `src/path/to/file.ts`, review ISS-NNN in `docs/issues/ISS-NNN.md`."
- "This relates to SDD §N.N — check the schema contract before proposing a fix."
- "ISS-NNN is BLOCKED on [의존성]. Do not implement the naive fix."

---

## Related

- **Blocks / Blocked by:** ISS-XXX 또는 N/A
- **See also:** ISS-XXX 또는 N/A
- **SDD sections:** §N.N, §N.N

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| YYYY-MM-DD | human/claude | 이슈 등록 |
| YYYY-MM-DD | human/claude | 원인 파악 |
| YYYY-MM-DD | human/claude | 해결 — 커밋 또는 PR 참조 |
