/* ============================================================
   Marking Moderation Tool - Database Setup
   ============================================================ */

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS & AUTH
-- =========================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                 -- validate in FastAPI (e.g. lecturer/moderator/admin/third_marker)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- MODULES, RUNS, STUDENTS, ENROLMENTS
-- =========================

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  credits INT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,                 -- e.g. "2025/26"
  semester TEXT,                               -- e.g. "1", "2"
  cohort_size INT DEFAULT 0 CHECK (cohort_size >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_id, academic_year, semester)
);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number TEXT UNIQUE NOT NULL,         -- e.g. "w1234567"
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrolments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_run_id UUID NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_run_id, student_id)
);

CREATE TABLE IF NOT EXISTS module_run_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_run_id UUID NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_role TEXT NOT NULL,                    -- validate in FastAPI
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_run_id, user_id, staff_role)
);

-- =========================
-- ASSESSMENTS & MARKING
-- =========================

CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_run_id UUID NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  weighting INT NOT NULL CHECK (weighting BETWEEN 0 AND 100),
  due_date DATE,
  requires_moderation BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marker_id UUID REFERENCES users(id) ON DELETE SET NULL,
  mark INT NOT NULL CHECK (mark BETWEEN 0 AND 100),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assessment_id, student_id)
);

-- =========================
-- SAMPLE SETS + ITEMS
-- =========================

CREATE TABLE IF NOT EXISTS sample_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  cohort_size INT NOT NULL CHECK (cohort_size >= 0),
  required_sample_size INT NOT NULL CHECK (required_sample_size >= 0),
  pass_mark INT NOT NULL DEFAULT 40 CHECK (pass_mark BETWEEN 0 AND 100),
  within_two_below_pass_count INT NOT NULL DEFAULT 0 CHECK (within_two_below_pass_count >= 0),
  rule_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sample_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_set_id UUID NOT NULL REFERENCES sample_sets(id) ON DELETE CASCADE,
  mark_id UUID NOT NULL REFERENCES marks(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,                        -- validate in FastAPI
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sample_set_id, mark_id)
);

-- =========================
-- MODERATION WORKFLOW
-- =========================

CREATE TABLE IF NOT EXISTS moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE,
  sample_set_id UUID REFERENCES sample_sets(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'draft',        -- validate in FastAPI

  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,

  assigned_moderator UUID REFERENCES users(id) ON DELETE SET NULL,
  moderator_started_at TIMESTAMPTZ,
  moderator_submitted_at TIMESTAMPTZ,
  moderator_decision TEXT,                     -- validate in FastAPI
  moderator_summary TEXT,

  escalated_at TIMESTAMPTZ,
  assigned_third_marker UUID REFERENCES users(id) ON DELETE SET NULL,
  third_marker_started_at TIMESTAMPTZ,
  third_marker_submitted_at TIMESTAMPTZ,
  third_marker_summary TEXT,

  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES users(id) ON DELETE SET NULL,
  responses_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_item_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  sample_item_id UUID NOT NULL REFERENCES sample_items(id) ON DELETE CASCADE,
  noted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (moderation_case_id, sample_item_id, noted_by)
);

-- =========================
-- AUDIT LOG
-- =========================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,                        -- validate in FastAPI
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- INDEXES
-- =========================

CREATE INDEX IF NOT EXISTS idx_marks_assessment ON marks(assessment_id);
CREATE INDEX IF NOT EXISTS idx_marks_marker ON marks(marker_id);

CREATE INDEX IF NOT EXISTS idx_sample_sets_assessment ON sample_sets(assessment_id);
CREATE INDEX IF NOT EXISTS idx_sample_items_set ON sample_items(sample_set_id);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON moderation_cases(status);

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);

COMMIT;
