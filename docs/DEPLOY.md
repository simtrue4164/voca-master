# Vercel 배포 매뉴얼

> Voca-Master를 Vercel에 배포하는 전체 과정을 단계별로 설명합니다.

---

## 사전 준비

- GitHub 계정 (리포지토리 Push 완료 상태)
- Vercel 계정 (없으면 https://vercel.com 에서 GitHub로 가입)
- Supabase 프로젝트 (DB 설정 완료 상태)
- Google AI Studio API Key (Gemini)

---

## 1단계 — 환경 변수 값 미리 복사해두기

배포 전에 아래 4개 값을 준비합니다.

| 변수명 | 어디서 확인하나 |
|--------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role |
| `GOOGLE_GENERATIVE_AI_API_KEY` | https://aistudio.google.com → Get API Key |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY`는 절대 외부에 노출하지 마세요. Vercel 환경 변수에만 입력합니다.

---

## 2단계 — Vercel에 프로젝트 가져오기

1. https://vercel.com/dashboard 접속
2. **Add New → Project** 클릭
3. GitHub 리포지토리 목록에서 `voca-master` 선택 → **Import**

---

## 3단계 — 빌드 설정 구성

Import 화면에서 아래와 같이 설정합니다.

| 항목 | 값 |
|------|----|
| **Framework Preset** | Next.js |
| **Root Directory** | `voca-master` ← 반드시 변경 |
| **Build Command** | `next build` (기본값 유지) |
| **Output Directory** | `.next` (기본값 유지) |
| **Install Command** | `npm install` (기본값 유지) |

> ⚠️ **Root Directory를 `voca-master`로 반드시 변경해야 합니다.**  
> 리포지토리 루트가 아니라 `voca-master/` 하위 폴더가 Next.js 앱입니다.

---

## 4단계 — 환경 변수 입력

Import 화면 하단 **Environment Variables** 섹션에서 4개를 모두 입력합니다.

```
NEXT_PUBLIC_SUPABASE_URL        = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY       = eyJhbGci...
GOOGLE_GENERATIVE_AI_API_KEY    = AIzaSy...
```

Environment는 **Production, Preview, Development** 모두 체크합니다.

---

## 5단계 — 배포

**Deploy** 버튼 클릭 → 빌드 로그 확인 → 완료 시 배포 URL 발급

배포 URL 예시: `https://voca-master-xxx.vercel.app`

---

## 6단계 — Supabase URL 허용 설정

배포 후 Supabase에서 도메인을 허용해야 인증이 정상 동작합니다.

1. Supabase → **Authentication → URL Configuration**
2. **Site URL** → 발급된 Vercel URL 입력  
   예: `https://voca-master-xxx.vercel.app`
3. **Redirect URLs** → 동일한 URL 추가  
   예: `https://voca-master-xxx.vercel.app/**`
4. **Save** 클릭

---

## 7단계 — 배포 확인

| 확인 항목 | 방법 |
|----------|------|
| 로그인 동작 | 학생(수험번호 1001) / 관리자(admin@voca-master.com) 로그인 |
| AI 기능 동작 | 관리자 대시보드 → AI 학급 인사이트 재생성 |
| DB 연결 | 학생 대시보드 진도 데이터 표시 여부 |

---

## 이후 재배포

GitHub `main` 브랜치에 Push하면 Vercel이 자동으로 재배포합니다.  
별도 조작 없이 CI/CD가 작동합니다.

---

## 문제 해결

### 빌드 실패 — "Module not found"
- Root Directory가 `voca-master`로 설정되어 있는지 확인

### 로그인 후 리다이렉트 안 됨
- Supabase URL Configuration에 Vercel URL이 등록되어 있는지 확인

### AI 기능 응답 없음
- `GOOGLE_GENERATIVE_AI_API_KEY` 환경 변수 값 확인
- Vercel → Project → Settings → Environment Variables에서 재확인

### 환경 변수 수정 후 반영 안 됨
- Vercel → Project → Settings → Environment Variables 수정 후
- **Deployments → 최신 배포 → Redeploy** 클릭 필요
