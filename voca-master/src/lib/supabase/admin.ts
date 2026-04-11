import { createClient } from '@supabase/supabase-js';

// service_role 키 사용 — 서버 전용, 절대 클라이언트에 노출 금지
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin 환경 변수가 설정되지 않았습니다.');
  return createClient(
    url,
    key,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
