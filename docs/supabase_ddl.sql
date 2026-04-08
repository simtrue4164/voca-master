-- ============================================================
-- Voca-Master DDL Migration
-- Supabase SQL Editor에서 전체 실행
-- ============================================================

-- ── 2-1. 조직 구조 ─────────────────────────────────────────

CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE classes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2-2. 사용자 (Supabase Auth 연동) ──────────────────────

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN (
               'student', 'admin_super', 'admin_branch', 'admin_class'
             )),
  name       TEXT NOT NULL,
  exam_no    TEXT UNIQUE,
  branch_id  UUID REFERENCES branches(id),
  class_id   UUID REFERENCES classes(id),
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_view_self" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "admin_view_students" ON profiles
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_super'
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_branch'
      AND branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    )
    OR (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_class'
      AND class_id = (SELECT class_id FROM profiles WHERE id = auth.uid())
    )
  );

-- 본인 프로필 수정
CREATE POLICY "user_update_self" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- super만 다른 프로필 수정 가능
CREATE POLICY "super_manage_profiles" ON profiles
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin_super'
  );

-- ── 2-3. 어휘 데이터 ───────────────────────────────────────

CREATE TABLE vocabulary (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day        SMALLINT NOT NULL CHECK (day BETWEEN 1 AND 60),
  word       TEXT NOT NULL,
  exam_count SMALLINT NOT NULL DEFAULT 0,
  UNIQUE (day, word)
);

CREATE INDEX idx_vocabulary_day ON vocabulary(day);

ALTER TABLE vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_vocabulary" ON vocabulary
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_vocabulary" ON vocabulary
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

CREATE TABLE word_meanings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  pos           TEXT NOT NULL CHECK (pos IN ('n.','v.','adj.','adv.','prep.','conj.')),
  meaning_ko    TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_word_meanings_vocab ON word_meanings(vocab_id);

ALTER TABLE word_meanings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_meanings" ON word_meanings
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_meanings" ON word_meanings
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

CREATE TABLE word_synonyms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vocab_id      UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  synonym       TEXT NOT NULL,
  display_order SMALLINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_word_synonyms_vocab ON word_synonyms(vocab_id);

ALTER TABLE word_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_synonyms" ON word_synonyms
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_synonyms" ON word_synonyms
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

-- ── 2-4. 학습 로그 ─────────────────────────────────────────

CREATE TABLE learning_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vocab_id    UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('studied', 'memorized', 'failed')),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, vocab_id)
);

CREATE INDEX idx_learning_logs_student ON learning_logs(student_id);

ALTER TABLE learning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_manage_own_logs" ON learning_logs
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "admin_read_logs" ON learning_logs
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

-- ── 2-5. 시험 시스템 ───────────────────────────────────────

CREATE TABLE exams (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  day_1        SMALLINT NOT NULL CHECK (day_1 BETWEEN 1 AND 60),
  day_2        SMALLINT NOT NULL CHECK (day_2 BETWEEN 1 AND 60),
  duration_min SMALLINT NOT NULL DEFAULT 8,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,  -- 트리거로 자동 계산: starts_at + duration_min분
  status       TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'active', 'closed')),
  created_by   UUID NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ends_at 자동 계산 트리거
CREATE OR REPLACE FUNCTION set_exam_ends_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.ends_at := NEW.starts_at + (NEW.duration_min * INTERVAL '1 minute');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_exam_ends_at
  BEFORE INSERT OR UPDATE OF starts_at, duration_min ON exams
  FOR EACH ROW EXECUTE FUNCTION set_exam_ends_at();

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_read_own_class_exams" ON exams
  FOR SELECT USING (
    class_id = (SELECT class_id FROM profiles WHERE id = auth.uid())
    AND status IN ('active', 'closed')
  );

CREATE POLICY "admin_manage_exams" ON exams
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

CREATE TABLE exam_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id          UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  vocab_id         UUID NOT NULL REFERENCES vocabulary(id),
  question_no      SMALLINT NOT NULL,
  accepted_answers JSONB NOT NULL
);

CREATE INDEX idx_exam_questions_exam ON exam_questions(exam_id);

ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

-- 학생에게는 accepted_answers 없이 vocab_id/question_no만 (API 레이어에서 필터링)
CREATE POLICY "student_read_active_questions" ON exam_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exams e
      WHERE e.id = exam_id
        AND e.class_id = (SELECT class_id FROM profiles WHERE id = auth.uid())
        AND e.status = 'active'
    )
  );

CREATE POLICY "admin_manage_questions" ON exam_questions
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

CREATE TABLE exam_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id      UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL,
  scores       JSONB NOT NULL,
  score        SMALLINT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  is_forced    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (exam_id, student_id)
);

CREATE INDEX idx_exam_results_student ON exam_results(student_id);
CREATE INDEX idx_exam_results_exam    ON exam_results(exam_id);

ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_manage_own_results" ON exam_results
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "admin_read_results" ON exam_results
  FOR SELECT USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

-- ── 2-6. 상담 시스템 ───────────────────────────────────────

CREATE TABLE counseling_recommendations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id   UUID NOT NULL REFERENCES profiles(id),
  risk_score NUMERIC(4,2) NOT NULL CHECK (risk_score BETWEEN 0 AND 1),
  reason     TEXT NOT NULL,
  factors    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE counseling_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_recommendations" ON counseling_recommendations
  FOR ALL USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch', 'admin_class'
    )
  );

CREATE TABLE counseling_slots (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_hour SMALLINT NOT NULL CHECK (slot_hour BETWEEN 9 AND 16),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (admin_id, slot_date, slot_hour)
);

ALTER TABLE counseling_slots ENABLE ROW LEVEL SECURITY;

-- 학생은 활성 슬롯만 조회 (신청 화면)
CREATE POLICY "student_read_active_slots" ON counseling_slots
  FOR SELECT USING (is_active = true);

CREATE POLICY "admin_manage_own_slots" ON counseling_slots
  FOR ALL USING (auth.uid() = admin_id);

CREATE TABLE counseling_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  admin_id          UUID NOT NULL REFERENCES profiles(id),
  source            TEXT NOT NULL CHECK (source IN ('student', 'ai')),
  recommendation_id UUID REFERENCES counseling_recommendations(id),
  request_note      TEXT,
  slot_id           UUID REFERENCES counseling_slots(id),
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','scheduled','completed','dismissed')),
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_counseling_requests_student ON counseling_requests(student_id);
CREATE INDEX idx_counseling_requests_admin   ON counseling_requests(admin_id);

ALTER TABLE counseling_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_manage_own_requests" ON counseling_requests
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "admin_manage_requests" ON counseling_requests
  FOR ALL USING (
    auth.uid() = admin_id
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch'
    )
  );

CREATE TABLE counseling_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES counseling_requests(id),
  admin_id   UUID NOT NULL REFERENCES profiles(id),
  content    TEXT NOT NULL,
  outcome    TEXT CHECK (outcome IN ('정상복귀','집중관리','기타')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE counseling_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_records" ON counseling_records
  FOR ALL USING (
    auth.uid() = admin_id
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN (
      'admin_super', 'admin_branch'
    )
  );

-- ── 2-7. 대시보드 AI 캐시 ─────────────────────────────────

CREATE TABLE dashboard_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cache_type   TEXT NOT NULL CHECK (cache_type IN (
                 'admin_insight','admin_anomalies','admin_goal_prediction',
                 'student_coaching','student_prediction'
               )),
  content      JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, cache_type)
);

ALTER TABLE dashboard_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_manage_own_cache" ON dashboard_cache
  FOR ALL USING (auth.uid() = user_id);

-- ── Auth 트리거: 신규 Auth 유저 → profiles 자동 생성 ──────────
-- (관리자 초대 시 이메일로 가입되면 role은 초대 API에서 별도 설정)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 학생 계정은 @voca-master.internal 이메일로 식별
  IF NEW.email LIKE '%@voca-master.internal' THEN
    INSERT INTO profiles (id, role, name, exam_no)
    VALUES (
      NEW.id,
      'student',
      COALESCE(NEW.raw_user_meta_data->>'name', ''),
      REPLACE(NEW.email, '@voca-master.internal', '')
    );
  END IF;
  -- 관리자는 초대 완료 후 별도 API로 profiles 생성
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Realtime 활성화 (시험 강제 종료 broadcast용) ─────────────
ALTER PUBLICATION supabase_realtime ADD TABLE exams;
ALTER PUBLICATION supabase_realtime ADD TABLE exam_results;
