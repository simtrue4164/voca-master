/**
 * 테스트 데이터 시드 스크립트
 * 실행: node docs/seed_test_data.js
 * (voca-master 루트 디렉토리에서 실행)
 *
 * 생성 내용:
 *  - 지점 2개 (부산캠퍼스, 서울캠퍼스)
 *  - 반 6개 (지점당 3개)
 *  - 학생 120명 (반당 20명)
 *  - 관리자 2명 (지점/반 담임)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../voca-master/.env.local') });

const { createClient } = require('../voca-master/node_modules/@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 데이터 정의 ────────────────────────────────────────────

const BRANCHES = [
  { name: '부산캠퍼스' },
  { name: '서울캠퍼스' },
];

const CLASSES = [
  { name: '2026 상반기 A반', branch: '부산캠퍼스', start_date: '2026-02-01' },
  { name: '2026 상반기 B반', branch: '부산캠퍼스', start_date: '2026-02-01' },
  { name: '2026 상반기 C반', branch: '부산캠퍼스', start_date: '2026-02-01' },
  { name: '2026 상반기 A반', branch: '서울캠퍼스', start_date: '2026-03-01' },
  { name: '2026 상반기 B반', branch: '서울캠퍼스', start_date: '2026-03-01' },
  { name: '2026 상반기 C반', branch: '서울캠퍼스', start_date: '2026-03-01' },
];

const ADMINS = [
  {
    name: '김지점',
    employee_no: 'A001',
    password: '1234',
    role: 'admin_branch',
    branch: '부산캠퍼스',
  },
  {
    name: '이담임',
    employee_no: 'A002',
    password: '1234',
    role: 'admin_class',
    branch: '부산캠퍼스',
    classes: ['2026 상반기 A반', '2026 상반기 B반'], // 여러 반 담당
  },
];

// 학생 120명 생성 (반당 20명)
// 부산캠퍼스: 1001~1060, 서울캠퍼스: 2001~2060
const STUDENT_GROUPS = [
  { branch: '부산캠퍼스', class: '2026 상반기 A반', startNo: 1001 },
  { branch: '부산캠퍼스', class: '2026 상반기 B반', startNo: 1021 },
  { branch: '부산캠퍼스', class: '2026 상반기 C반', startNo: 1041 },
  { branch: '서울캠퍼스', class: '2026 상반기 A반', startNo: 2001 },
  { branch: '서울캠퍼스', class: '2026 상반기 B반', startNo: 2021 },
  { branch: '서울캠퍼스', class: '2026 상반기 C반', startNo: 2041 },
];

const LAST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const FIRST_NAMES = ['민준', '서연', '도윤', '서아', '지우', '지아', '준서', '하은', '예준', '수아',
                     '현우', '지유', '건우', '채원', '민재', '지민', '우진', '수빈', '시우', '유진'];

function makeName(index) {
  return LAST_NAMES[index % 10] + FIRST_NAMES[index % 20];
}

// ── 실행 ──────────────────────────────────────────────────

async function seed() {
  console.log('🌱 테스트 데이터 시드 시작\n');

  // 1. 지점 생성
  console.log('📍 지점 생성...');
  const { data: existingBranches } = await admin.from('branches').select('id, name');
  const existingBranchNames = new Set((existingBranches ?? []).map(b => b.name));
  const newBranches = BRANCHES.filter(b => !existingBranchNames.has(b.name));
  if (newBranches.length > 0) await admin.from('branches').insert(newBranches);
  const { data: branches } = await admin.from('branches').select('id, name');
  const branchMap = Object.fromEntries((branches ?? []).map(b => [b.name, b.id]));
  console.log(`  ✓ ${Object.keys(branchMap).length}개 지점:`, Object.keys(branchMap).join(', '));

  // 2. 반 생성
  console.log('\n🏫 반 생성...');
  const { data: existingClasses } = await admin.from('classes').select('id, name, branch_id');
  const existingClassKeys = new Set((existingClasses ?? []).map(c => `${c.name}__${c.branch_id}`));

  const classData = CLASSES.map(c => {
    const start = new Date(c.start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + 60);
    return {
      name: c.name,
      branch_id: branchMap[c.branch],
      start_date: c.start_date,
      end_date: end.toISOString().split('T')[0],
    };
  }).filter(c => !existingClassKeys.has(`${c.name}__${c.branch_id}`));

  if (classData.length > 0) await admin.from('classes').insert(classData);
  const { data: classes } = await admin.from('classes').select('id, name, branch_id');
  const classMap = Object.fromEntries((classes ?? []).map(c => [`${c.name}__${c.branch_id}`, c.id]));
  console.log(`  ✓ 총 ${(classes ?? []).length}개 반 (지점당 3개)`);

  // 3. 관리자 계정 생성
  console.log('\n👔 관리자 계정 생성...');
  for (const adm of ADMINS) {
    const branchId = branchMap[adm.branch];

    const email = `${adm.employee_no}@voca-master.internal`;
    const { data: auth, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: adm.password,
      email_confirm: true,
    });

    if (authErr) {
      if (authErr.message.includes('already registered')) {
        console.log(`  ⚠ ${adm.name} (${adm.employee_no}) 이미 존재 — 건너뜀`);
        continue;
      }
      console.error(`  ✗ ${adm.name} 오류:`, authErr.message);
      continue;
    }

    // 첫 번째 반을 primary class_id로
    const primaryClassId = adm.classes
      ? classMap[`${adm.classes[0]}__${branchId}`]
      : null;

    const { error: profErr } = await admin.from('profiles').upsert({
      id: auth.user.id,
      role: adm.role,
      name: adm.name,
      employee_no: adm.employee_no,
      branch_id: branchId,
      class_id: primaryClassId,
    }, { onConflict: 'id' });

    if (profErr) { console.error(`  ✗ ${adm.name} 프로필 오류:`, profErr.message); continue; }

    // admin_class_assignments 에 여러 반 등록
    if (adm.classes && adm.role === 'admin_class') {
      const assignments = adm.classes.map(cn => ({
        admin_id: auth.user.id,
        class_id: classMap[`${cn}__${branchId}`],
      })).filter(a => a.class_id);

      if (assignments.length > 0) {
        await admin.from('admin_class_assignments')
          .upsert(assignments, { onConflict: 'admin_id,class_id' });
      }
    }

    console.log(`  ✓ ${adm.name} (사번: ${adm.employee_no} / ${adm.password})${adm.classes ? ` [${adm.classes.join(', ')}]` : ''}`);
  }

  // 4. 학생 120명 생성
  console.log('\n🎓 학생 계정 생성...');
  let created = 0;
  let skipped = 0;

  for (const group of STUDENT_GROUPS) {
    const branchId = branchMap[group.branch];
    const classId = classMap[`${group.class}__${branchId}`];

    for (let i = 0; i < 20; i++) {
      const examNo = String(group.startNo + i);
      const name = makeName(group.startNo + i);
      const email = `${examNo}@voca-master.internal`;

      const { data: auth, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: '1234',
        email_confirm: true,
      });

      if (authErr) {
        if (authErr.message.includes('already registered')) { skipped++; continue; }
        console.error(`  ✗ ${name} (${examNo}) 오류:`, authErr.message);
        continue;
      }

      const { error: profErr } = await admin.from('profiles').upsert({
        id: auth.user.id,
        role: 'student',
        name,
        exam_no: examNo,
        class_id: classId,
      }, { onConflict: 'id' });

      if (profErr) { console.error(`  ✗ ${name} 프로필 오류:`, profErr.message); continue; }

      // student_class_memberships 등록
      await admin.from('student_class_memberships')
        .upsert({ student_id: auth.user.id, class_id: classId }, { onConflict: 'student_id,class_id' });

      created++;
    }

    console.log(`  ✓ ${group.branch} ${group.class}: ${group.startNo}~${group.startNo + 19}`);
  }

  console.log(`\n✅ 시드 완료! (생성 ${created}명 / 건너뜀 ${skipped}명)\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 계정 정보');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('관리자 (사번으로 로그인):');
  console.log('  사번 SUPER01 / 1234  (전체관리자)  ← Supabase에서 직접 생성');
  console.log('  사번 A001    / 1234  (지점관리자 · 부산캠퍼스)');
  console.log('  사번 A002    / 1234  (반담임 · 부산 A+B반)');
  console.log('\n학생 (비밀번호 모두 1234):');
  console.log('  부산캠퍼스 A반: 수험번호 1001~1020');
  console.log('  부산캠퍼스 B반: 수험번호 1021~1040');
  console.log('  부산캠퍼스 C반: 수험번호 1041~1060');
  console.log('  서울캠퍼스 A반: 수험번호 2001~2020');
  console.log('  서울캠퍼스 B반: 수험번호 2021~2040');
  console.log('  서울캠퍼스 C반: 수험번호 2041~2060');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seed().catch(console.error);
