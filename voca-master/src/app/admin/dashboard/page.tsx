import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import DashboardInsightCard from '@/components/admin/DashboardInsightCard';
import DashboardRiskCard from '@/components/admin/DashboardRiskCard';
import { getAdminYear } from '@/lib/adminYear';

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('name, role, branch_id, class_id')
    .eq('id', user!.id)
    .single();

  const role = profile?.role ?? '';

  // ── 담당 범위 계산 ──────────────────────────────────────
  const selectedYear = await getAdminYear();

  let classIds: string[] = [];
  let studentIds: string[] = [];

  if (role === 'admin_super') {
    const { data } = await admin.from('classes').select('id').eq('year', selectedYear);
    classIds = (data ?? []).map((c) => c.id);
  } else if (role === 'admin_branch') {
    const { data } = await admin.from('classes').select('id')
      .eq('branch_id', profile!.branch_id!)
      .eq('year', selectedYear);
    classIds = (data ?? []).map((c) => c.id);
  } else if (role === 'admin_class') {
    const { data: assignments } = await admin
      .from('admin_class_assignments')
      .select('class_id')
      .eq('admin_id', user!.id);
    const allClassIds = (assignments ?? []).map((a) => a.class_id);
    // admin_class는 assignments 기반이므로 year 필터를 별도로 적용
    if (allClassIds.length > 0) {
      const { data: yearFiltered } = await admin
        .from('classes')
        .select('id')
        .in('id', allClassIds)
        .eq('year', selectedYear);
      classIds = (yearFiltered ?? []).map((c) => c.id);
    }
  }

  if (classIds.length > 0) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('role', 'student')
      .in('class_id', classIds);
    studentIds = (data ?? []).map((s) => s.id);
  }

  // ── 요약 통계 ────────────────────────────────────────────
  // 한국 시간(UTC+9) 기준 오늘 날짜
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 총 학생 수
  const totalStudents = studentIds.length;

  // 오늘 학습한 학생 수
  let todayActive = 0;
  if (studentIds.length > 0) {
    const { data: todayLogs } = await admin
      .from('learning_logs')
      .select('student_id')
      .in('student_id', studentIds)
      .gte('reviewed_at', `${today}T00:00:00`);
    todayActive = new Set((todayLogs ?? []).map((l) => l.student_id)).size;
  }

  // 진행 중 시험
  const { data: activeExams } = await admin
    .from('exams')
    .select('id, title, classes(name)')
    .in('class_id', classIds)
    .eq('status', 'active');

  // 관련 단어 학습 평균 진도율
  let relatedProgressAvg = 0;
  if (studentIds.length > 0) {
    const [{ count: totalRelated }, { data: relatedLogRows }] = await Promise.all([
      admin.from('word_synonyms').select('id', { count: 'exact', head: true })
        .then(async (r) => {
          const [s, sim, ant] = await Promise.all([
            Promise.resolve(r),
            admin.from('word_similar').select('id', { count: 'exact', head: true }),
            admin.from('word_antonyms').select('id', { count: 'exact', head: true }),
          ]);
          return { count: (s.count ?? 0) + (sim.count ?? 0) + (ant.count ?? 0) };
        }),
      admin.from('related_word_logs').select('student_id').in('student_id', studentIds),
    ]);

    if ((totalRelated ?? 0) > 0 && studentIds.length > 0) {
      const perStudent: Record<string, number> = {};
      for (const r of relatedLogRows ?? []) {
        perStudent[r.student_id] = (perStudent[r.student_id] ?? 0) + 1;
      }
      const rates = studentIds.map((sid) => Math.round(((perStudent[sid] ?? 0) / totalRelated) * 100));
      relatedProgressAvg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    }
  }

  // 상담 신청 건수 (예약 상태)
  let activeCounselingCount = 0;
  if (studentIds.length > 0) {
    const { count } = await admin
      .from('counseling_requests')
      .select('id', { count: 'exact', head: true })
      .in('student_id', studentIds)
      .eq('status', 'scheduled');
    activeCounselingCount = count ?? 0;
  }

  // 당일 상담 예약 (scheduled + confirmed, slot_date = today)
  let todayCounselings: {
    id: string;
    status: string;
    slot_hour: number;
    student_name: string;
    student_exam_no: string | null;
    class_name: string;
  }[] = [];

  // 당일 상담: 조인 없이 raw 조회 → 슬롯/학생 별도 조회
  {
    // Step 1: 오늘 슬롯 ID 목록
    const { data: todaySlots } = await admin
      .from('counseling_slots')
      .select('id, slot_hour')
      .eq('slot_date', today);

    const todaySlotIds = (todaySlots ?? []).map((s) => s.id);

    if (todaySlotIds.length > 0) {
      // Step 2: 오늘 슬롯에 연결된 상담 요청 (raw)
      let reqQuery = admin
        .from('counseling_requests')
        .select('id, status, slot_id, student_id')
        .in('slot_id', todaySlotIds)
        .in('status', ['scheduled', 'confirmed', 'completed', 'cancelled']);

      if (role === 'admin_class') {
        reqQuery = reqQuery.eq('admin_id', user!.id);
      } else if (studentIds.length > 0) {
        reqQuery = reqQuery.in('student_id', studentIds);
      } else {
        // 범위 없음 → 조회 생략
        reqQuery = reqQuery.eq('id', '00000000-0000-0000-0000-000000000000');
      }

      const { data: rawReqs } = await reqQuery;

      if ((rawReqs ?? []).length > 0) {
        // Step 3: 학생 정보 별도 조회
        const studentIdList = [...new Set((rawReqs ?? []).map((r) => r.student_id).filter(Boolean))];
        const { data: studentRows } = await admin
          .from('profiles')
          .select('id, name, exam_no, class_id')
          .in('id', studentIdList);

        const classIdList = [...new Set((studentRows ?? []).map((s) => s.class_id).filter(Boolean))];
        const { data: classRows } = classIdList.length > 0
          ? await admin.from('classes').select('id, name').in('id', classIdList)
          : { data: [] };

        const studentMap: Record<string, { name: string; exam_no: string | null; class_name: string }> = {};
        for (const s of studentRows ?? []) {
          const cls = (classRows ?? []).find((c) => c.id === s.class_id);
          studentMap[s.id] = { name: s.name, exam_no: s.exam_no, class_name: cls?.name ?? '-' };
        }

        const slotHourMap: Record<string, number> = {};
        for (const s of todaySlots ?? []) slotHourMap[s.id] = s.slot_hour;

        todayCounselings = (rawReqs ?? [])
          .map((r) => ({
            id: r.id,
            status: r.status,
            slot_hour: slotHourMap[r.slot_id] ?? 0,
            student_name: studentMap[r.student_id]?.name ?? '-',
            student_exam_no: studentMap[r.student_id]?.exam_no ?? null,
            class_name: studentMap[r.student_id]?.class_name ?? '-',
          }))
          .sort((a, b) => a.slot_hour - b.slot_hour);
      }
    }
  }

  const todayCounselingCount = todayCounselings.length;

  // ── 위험 학생 감지 (최근 3일 연속 미학습) ──────────────
  const atRiskStudents: { id: string; name: string; exam_no: string | null; className: string; missedDays: number }[] = [];

  if (studentIds.length > 0) {
    const { data: allStudents } = await admin
      .from('profiles')
      .select('id, name, exam_no, class_id, classes(name)')
      .in('id', studentIds);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const { data: recentLogs } = await admin
      .from('learning_logs')
      .select('student_id, reviewed_at')
      .in('student_id', studentIds)
      .gte('reviewed_at', threeDaysAgo.toISOString());

    const recentStudentSet = new Set((recentLogs ?? []).map((l) => l.student_id));

    for (const s of allStudents ?? []) {
      if (!recentStudentSet.has(s.id)) {
        // 로그 자체가 있는 학생만 (신규 미학습은 제외)
        const { count } = await admin
          .from('learning_logs')
          .select('id', { count: 'exact', head: true })
          .eq('student_id', s.id);
        if ((count ?? 0) > 0) {
          atRiskStudents.push({
            id: s.id,
            name: s.name,
            exam_no: s.exam_no,
            className: (s.classes as any)?.name ?? '-',
            missedDays: 3,
          });
        }
      }
    }
  }

  // ── 최근 시험 결과 요약 ───────────────────────────────────
  const { data: recentExams } = await admin
    .from('exams')
    .select('id, title, status, starts_at, classes(name)')
    .in('class_id', classIds)
    .eq('status', 'closed')
    .order('starts_at', { ascending: false })
    .limit(3);

  const examSummaries: { title: string; className: string; avgScore: number; submitCount: number; totalStudents: number }[] = [];

  for (const exam of recentExams ?? []) {
    const { data: results } = await admin
      .from('exam_results')
      .select('score, student_id')
      .eq('exam_id', exam.id);

    const scores = (results ?? []).map((r) => r.score);
    examSummaries.push({
      title: exam.title,
      className: (exam.classes as any)?.name ?? '-',
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      submitCount: scores.length,
      totalStudents,
    });
  }

  // ── AI 인사이트 캐시 조회 ──────────────────────────────
  const { data: insightCache } = await admin
    .from('dashboard_cache')
    .select('content, generated_at')
    .eq('user_id', user!.id)
    .eq('cache_type', 'admin_insight')
    .maybeSingle();

  // 오늘(KST) 기준 캐시 신선도 판단
  const cachedDateKST = insightCache?.generated_at
    ? new Date(new Date(insightCache.generated_at).getTime() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
    : null;
  const isInsightStale = cachedDateKST !== today;

  const roleLabel: Record<string, string> = {
    admin_super: '전체 관리자',
    admin_branch: '지점 관리자',
    admin_class: '반 담임',
  };

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">대시보드</h1>
        <p className="text-[13px] text-[#6e6e73] mt-0.5">{profile?.name} · {roleLabel[role] ?? role}</p>
      </div>

      {/* AI 인사이트 */}
      <DashboardInsightCard
        userId={user!.id}
        cachedInsight={insightCache?.content?.summary ?? null}
        cachedAt={insightCache?.generated_at ?? null}
        isStale={isInsightStale}
        stats={{
          totalStudents,
          todayActive,
          atRiskCount: atRiskStudents.length,
          recentExamAvg: examSummaries[0]?.avgScore ?? null,
        }}
      />

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="총 학생" value={String(totalStudents)} sub="명" />
        <StatCard label="오늘 학습" value={String(todayActive)} sub={`/ ${totalStudents}명`} />
        <StatCard label="위험 학생" value={String(atRiskStudents.length)} sub="3일 이상 미학습" />
        <StatCard label="상담 신청" value={String(activeCounselingCount)} sub="건 진행 중" />
        <StatCard label="오늘 학습률" value={`${totalStudents > 0 ? Math.round((todayActive / totalStudents) * 100) : 0}%`} sub="활성 학생 기준" />
        <StatCard label="관련어 학습" value={`${relatedProgressAvg}%`} sub="평균 진도율" />
      </div>

      {/* 진행 중 시험 */}
      {(activeExams ?? []).length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-[#ff3b30] animate-pulse" />
            <p className="text-[13px] font-semibold text-[#1d1d1f]">진행 중인 시험</p>
          </div>
          <div className="space-y-2">
            {activeExams!.map((exam) => (
              <div key={exam.id} className="flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-medium text-[#1d1d1f]">{exam.title}</span>
                  <span className="text-[12px] text-[#6e6e73] ml-2">{(exam.classes as any)?.name}</span>
                </div>
                <Link
                  href={`/admin/exams/${exam.id}`}
                  className="text-[12px] bg-[#1d1d1f] text-white px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                >
                  관리
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 위험 학생 목록 */}
        <DashboardRiskCard atRiskStudents={atRiskStudents} />

        {/* 당일 상담 예약 목록 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-[#1d1d1f]">당일 상담 예약</h2>
            <Link href="/admin/counseling" className="text-[12px] text-[#0071e3]">전체 보기</Link>
          </div>
          {todayCounselings.length === 0 ? (
            <p className="text-[13px] text-[#6e6e73] text-center py-6">오늘 예약된 상담 없음</p>
          ) : (
            <div className="space-y-2">
              {todayCounselings.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#f5f5f7] last:border-0">
                  <div>
                    <p className="text-[13px] font-medium text-[#1d1d1f]">
                      {c.slot_hour}:00 · {c.student_name}
                    </p>
                    <p className="text-[12px] text-[#6e6e73]">{c.class_name} · {c.student_exam_no ?? '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      c.status === 'confirmed'  ? 'bg-[#1d1d1f] text-white' :
                      c.status === 'completed'  ? 'bg-[#f5f5f7] text-[#6e6e73]' :
                      c.status === 'cancelled'  ? 'bg-[#f5f5f7] text-[#c7c7cc]' :
                      'bg-[#f5f5f7] text-[#1d1d1f]'
                    }`}>
                      {c.status === 'confirmed' ? '확정' :
                       c.status === 'completed' ? '완료' :
                       c.status === 'cancelled' ? '취소' : '예약'}
                    </span>
                    <Link
                      href={`/admin/counseling/${c.id}`}
                      className="text-[12px] text-[#0071e3]"
                    >
                      상세 →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 시험 결과 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-[#1d1d1f]">최근 시험 결과</h2>
            <Link href="/admin/exams" className="text-[12px] text-[#0071e3]">전체 보기</Link>
          </div>
          {examSummaries.length === 0 ? (
            <p className="text-[13px] text-[#6e6e73] text-center py-6">종료된 시험 없음</p>
          ) : (
            <div className="space-y-3">
              {examSummaries.map((e, i) => (
                <div key={i} className="py-2 border-b border-[#f5f5f7] last:border-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[13px] font-medium text-[#1d1d1f] truncate flex-1 mr-2">{e.title}</p>
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">
                      평균 {e.avgScore}점
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#f5f5f7] rounded-full h-1">
                      <div
                        className="bg-[#1d1d1f] h-1 rounded-full"
                        style={{ width: `${Math.round((e.avgScore / 50) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-[#6e6e73]">{e.submitCount}명 제출</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <p className="text-[11px] text-[#6e6e73] mb-1">{label}</p>
      <p className="text-[24px] font-semibold text-[#1d1d1f] leading-none">{value}</p>
      <p className="text-[11px] text-[#6e6e73] mt-1">{sub}</p>
    </div>
  );
}
