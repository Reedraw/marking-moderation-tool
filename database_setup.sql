/* ============================================================
   Marking Moderation Tool - Database Schema Setup
   ============================================================ */

BEGIN;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS & AUTH
-- =========================

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS moderation_item_notes CASCADE;
DROP TABLE IF EXISTS moderation_form_responses CASCADE;
DROP TABLE IF EXISTS moderation_cases CASCADE;
DROP TABLE IF EXISTS sample_items CASCADE;
DROP TABLE IF EXISTS sample_sets CASCADE;
DROP TABLE IF EXISTS marks CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS module_run_staff CASCADE;
DROP TABLE IF EXISTS enrolments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS module_runs CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                 -- lecturer/moderator/admin/third_marker/student
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================
-- MODULES, RUNS, STUDENTS, ENROLMENTS
-- =========================

CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,          -- Added UNIQUE constraint for ON CONFLICT
  title TEXT NOT NULL,
  credits INT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS module_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,                 -- e.g. "2025/26"
  semester TEXT,                               -- e.g. "1", "2"
  cohort_size INT DEFAULT 0 CHECK (cohort_size >= 0),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce uniqueness of module runs across module, academic year, and semester,
-- treating NULL semester values as a concrete sentinel so that only one NULL
-- semester run is allowed per (module_id, academic_year).
CREATE UNIQUE INDEX IF NOT EXISTS ux_module_runs_module_year_semester
  ON module_runs (module_id, academic_year, COALESCE(semester, '__NO_SEMESTER__'));

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
  module_code TEXT NOT NULL,                   -- Added: denormalized for queries
  module_name TEXT NOT NULL,                   -- Added: denormalized for queries
  title TEXT NOT NULL,
  cohort TEXT NOT NULL,                        -- Added: e.g. "2025/26"
  weighting INT NOT NULL CHECK (weighting BETWEEN 0 AND 100),
  credit_size INT NOT NULL DEFAULT 15,         -- Added: 15, 20, 30+
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'DRAFT',        -- Added: assessment workflow status
  requires_moderation BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Marks table - stores individual student marks
CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,                    -- Changed: TEXT for anonymous IDs like "S001"
  marker_id TEXT,                              -- Changed: TEXT for marker reference
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  mark NUMERIC(5,2) NOT NULL CHECK (mark BETWEEN 0 AND 100),
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
  method TEXT NOT NULL,                        -- RANDOM, STRATIFIED, RISK_BASED
  percent NUMERIC(5,2) NOT NULL,               -- Percentage used for sampling
  size INT NOT NULL CHECK (size >= 0),         -- Actual sample size
  cohort_size INT NOT NULL DEFAULT 0 CHECK (cohort_size >= 0),
  pass_mark INT NOT NULL DEFAULT 40 CHECK (pass_mark BETWEEN 0 AND 100),
  rule_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sample_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_set_id UUID NOT NULL REFERENCES sample_sets(id) ON DELETE CASCADE,
  mark_id UUID NOT NULL REFERENCES marks(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,                    -- Added: denormalized for queries
  original_mark NUMERIC(5,2) NOT NULL,         -- Added: mark at time of sampling
  marker_id TEXT,                              -- Added: denormalized marker ID
  reason TEXT,                                 -- Why included in sample
  moderator_note TEXT,                         -- Moderator's notes on this item
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

  status TEXT NOT NULL DEFAULT 'DRAFT',        -- DRAFT, IN_MODERATION, APPROVED, etc.

  -- Lecturer submission
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  lecturer_comment TEXT,
  submitted_at TIMESTAMPTZ,

  -- Moderator review
  moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  moderator_comment TEXT,
  moderator_started_at TIMESTAMPTZ,
  
  -- Third marker (escalation)
  third_marker_id UUID REFERENCES users(id) ON DELETE SET NULL,
  third_marker_comment TEXT,
  escalated_at TIMESTAMPTZ,
  third_marker_started_at TIMESTAMPTZ,

  decided_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Moderation form responses (6 questions from university moderation form)
CREATE TABLE IF NOT EXISTS moderation_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
  responder_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Q1: Was there a marking rubric for the module?
  has_marking_rubric BOOLEAN NOT NULL,
  has_marking_rubric_comment TEXT,
  
  -- Q2: Were the marking criteria consistently applied across all scripts?
  criteria_consistently_applied BOOLEAN NOT NULL,
  criteria_consistently_applied_comment TEXT,
  
  -- Q3: Was the full range of marks used?
  full_range_of_marks_used BOOLEAN NOT NULL,
  full_range_of_marks_used_comment TEXT,
  
  -- Q4: Were marks awarded fairly?
  marks_awarded_fairly BOOLEAN NOT NULL,
  marks_awarded_fairly_comment TEXT,
  
  -- Q5: Were feedback comments appropriate and do they justify the marks awarded?
  feedback_comments_appropriate BOOLEAN NOT NULL,
  feedback_comments_appropriate_comment TEXT,
  
  -- Q6: Are you able to confirm that all marks in the sample are appropriate?
  all_marks_appropriate BOOLEAN NOT NULL,
  all_marks_appropriate_comment TEXT,
  
  -- Recommendations (required if all_marks_appropriate is false)
  recommendations TEXT,
  
  -- Feedback suggestions (optional, for positive feedback)
  feedback_suggestions TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-moderation checklist (completed by Module Leader/Lecturer BEFORE submitting for moderation)
CREATE TABLE IF NOT EXISTS pre_moderation_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE UNIQUE,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Checkbox 1: Marking was carried out in accordance with Assessment Regulations and the devised marking scheme
  marking_in_accordance BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Checkbox 2: The policy regarding hand in of late work has been adhered to (for coursework)
  late_work_policy_adhered BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Checkbox 3: The policy regarding misconduct/plagiarism has been adhered to
  plagiarism_policy_adhered BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Checkbox 4: All marks have been made available with percentages of pass/fail/non-submissions
  marks_available_with_percentages BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Checkbox 5: The totalling of marks has been checked for correctness
  totalling_checked BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Comments (in the case of several markers please state how consistency across markers has been ensured)
  consistency_comments TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Module Leader Response (completed by Module Leader/Lecturer AFTER receiving moderator feedback)
CREATE TABLE IF NOT EXISTS module_leader_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE UNIQUE,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Checkbox: The Moderator's comments and recommendations have been given proper consideration
  moderator_comments_considered BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Text: Please respond to any issues raised/recommendations made by the internal moderator
  response_to_issues TEXT,
  
  -- Text: Please comment on any outliers from the full range of assessment marks and provide an explanation
  outliers_explanation TEXT,
  
  -- Yes/No: Does the sample need to be assigned to a third marker to confirm the marks are appropriate?
  needs_third_marker BOOLEAN NOT NULL DEFAULT FALSE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- =========================
-- INDEXES
-- =========================

CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON assessments(created_by);

CREATE INDEX IF NOT EXISTS idx_marks_assessment ON marks(assessment_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);

CREATE INDEX IF NOT EXISTS idx_sample_sets_assessment ON sample_sets(assessment_id);
CREATE INDEX IF NOT EXISTS idx_sample_items_set ON sample_items(sample_set_id);

CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON moderation_cases(status);
CREATE INDEX IF NOT EXISTS idx_moderation_cases_assessment ON moderation_cases(assessment_id);

CREATE INDEX IF NOT EXISTS idx_pre_moderation_checklists_assessment ON pre_moderation_checklists(assessment_id);
CREATE INDEX IF NOT EXISTS idx_module_leader_responses_case ON module_leader_responses(moderation_case_id);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_assessment ON audit_log(assessment_id);

COMMIT;
