/* ============================================================
   Marking Moderation Tool - Database Schema Setup
   ============================================================
   This SQL script creates the complete PostgreSQL database schema
   for the Marking Moderation Tool. It manages academic assessment
   marking, moderation workflows, and quality assurance processes
   based on university academic regulations (Section 12).
   ============================================================ */

-- BEGIN a transaction so that ALL tables are created atomically; if any statement fails, the entire schema creation is rolled back
BEGIN;

-- Enable the pgcrypto extension which provides the gen_random_uuid() function used to auto-generate UUID primary keys
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS & AUTH
-- =========================

-- Drop all tables in reverse dependency order (child tables first) to avoid foreign key constraint violations
-- CASCADE ensures any dependent objects (views, foreign keys referencing these tables) are also dropped
DROP TABLE IF EXISTS audit_log CASCADE;                
DROP TABLE IF EXISTS moderation_item_notes CASCADE;    
DROP TABLE IF EXISTS module_leader_responses CASCADE;  
DROP TABLE IF EXISTS pre_moderation_checklists CASCADE; 
DROP TABLE IF EXISTS moderation_form_responses CASCADE; 
DROP TABLE IF EXISTS moderation_cases CASCADE;         
DROP TABLE IF EXISTS sample_items CASCADE;             
DROP TABLE IF EXISTS sample_sets CASCADE;              
DROP TABLE IF EXISTS marks_revision_history CASCADE;   
DROP TABLE IF EXISTS marks CASCADE;                    
DROP TABLE IF EXISTS assessments CASCADE;              
DROP TABLE IF EXISTS module_run_staff CASCADE;         
DROP TABLE IF EXISTS enrolments CASCADE;               
DROP TABLE IF EXISTS students CASCADE;                 
DROP TABLE IF EXISTS module_runs CASCADE;              
DROP TABLE IF EXISTS modules CASCADE;                  
DROP TABLE IF EXISTS users CASCADE;                    

-- Create the users table to store all system accounts (lecturers, moderators, admins, third markers)
-- This is the central identity table referenced by most other tables via foreign keys
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- UUID primary key generated automatically for each user, ensures globally unique identifiers across distributed systems
  username TEXT UNIQUE NOT NULL,                   -- Unique login name for authentication; UNIQUE constraint prevents duplicate accounts; NOT NULL ensures every user has a username
  email TEXT UNIQUE,                               -- Optional email address with UNIQUE constraint to prevent duplicate registrations; nullable since not all accounts require email
  full_name TEXT,                                  -- Display name of the user (e.g. "Dr. Jane Smith"); nullable as it can be set later
  password_hash TEXT NOT NULL,                     -- Argon2-hashed password stored securely; plain-text passwords are NEVER stored for security
  role TEXT NOT NULL,                              -- User's system role controlling access permissions: 'lecturer', 'moderator', 'admin', 'third_marker', or 'student'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,         -- Soft-delete flag: FALSE disables the account without removing data, preserving audit trail integrity
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- Timestamp with timezone recording when the account was created; auto-set on INSERT for audit purposes
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()    -- Timestamp with timezone recording last modification; updated by application code when user details change
);

-- =========================
-- MODULES, RUNS, STUDENTS, ENROLMENTS
-- =========================

-- Create the modules table to store academic module definitions (e.g. "CS101 - Intro to Programming")
-- A module is a subject/course offered by the university, independent of when it is taught
CREATE TABLE IF NOT EXISTS modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each module definition
  code TEXT UNIQUE NOT NULL,                                                  -- Module code (e.g. "CS101"); UNIQUE constraint enables upsert operations via ON CONFLICT and prevents duplicates
  title TEXT NOT NULL,                                                        -- Human-readable module name (e.g. "Introduction to Programming"); NOT NULL as every module must have a title
  credits INT,                                                                -- Number of academic credits for this module (e.g. 15, 20, 30); nullable as it may be set later
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,                    -- Foreign key to the admin/user who created this module; SET NULL on delete preserves the module if the creator is removed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this module was first defined in the system
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording the last modification to this module's details
);

-- Create the module_runs table to represent a specific delivery/instance of a module in a given academic year and semester
-- For example, "CS101" taught in "2025/26" Semester 1 is one module run; the same module in Semester 2 is another
CREATE TABLE IF NOT EXISTS module_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each module run instance
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,           -- Foreign key linking this run to its parent module; CASCADE delete removes all runs if the module is deleted
  academic_year TEXT NOT NULL,                                                -- Academic year string (e.g. "2025/26") identifying when this module delivery takes place
  semester TEXT,                                                              -- Semester identifier (e.g. "1", "2"); nullable for year-long modules that span both semesters
  cohort_size INT DEFAULT 0 CHECK (cohort_size >= 0),                         -- Number of students enrolled; defaults to 0; CHECK constraint prevents negative values which would be invalid
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,                    -- Foreign key to the user who created this run; SET NULL preserves the run if the creator is deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this module run was created in the system
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording the last update to this module run's details
);

-- Create a unique index to enforce that only one module run exists per combination of module, academic year, and semester
-- COALESCE handles NULL semesters by replacing them with a sentinel value '__NO_SEMESTER__',
-- ensuring that only ONE null-semester run is allowed per (module_id, academic_year) pair
-- Without this, PostgreSQL would treat NULL != NULL and allow unlimited null-semester duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_module_runs_module_year_semester
  ON module_runs (module_id, academic_year, COALESCE(semester, '__NO_SEMESTER__'));

-- Create the students table to store student identity records
-- Kept minimal; student details are referenced by their student_number for anonymity during marking
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each student record
  student_number TEXT UNIQUE NOT NULL,                                        -- University student number (e.g. "w1234567"); UNIQUE ensures no duplicates; used for identification across the system
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording when this student record was first created
);

-- Create the enrolments table to link students to specific module runs (many-to-many relationship)
-- A student can be enrolled in multiple module runs, and a module run has multiple students
CREATE TABLE IF NOT EXISTS enrolments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each enrolment record
  module_run_id UUID NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,   -- Foreign key to the module run; CASCADE delete removes enrolment if the module run is deleted
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,         -- Foreign key to the student; CASCADE delete removes enrolment if the student record is deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this enrolment was created
  UNIQUE (module_run_id, student_id)                                          -- Composite unique constraint prevents a student from being enrolled twice in the same module run
);

-- Create the module_run_staff table to assign staff members (lecturers, moderators, etc.) to module runs
-- This is a many-to-many junction table: one staff member can work on multiple modules, one module can have multiple staff
CREATE TABLE IF NOT EXISTS module_run_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each staff assignment
  module_run_id UUID NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,   -- Foreign key to the module run this staff member is assigned to; CASCADE on delete
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,               -- Foreign key to the staff member (user); CASCADE removes assignment if the user is deleted
  staff_role TEXT NOT NULL,                                                   -- Role of this staff member for this specific module run (e.g. 'module_leader', 'moderator', 'marker'); validated in FastAPI application layer
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this staff assignment was created
  UNIQUE (module_run_id, user_id, staff_role)                                 -- Composite unique constraint prevents assigning the same user the same role twice on the same module run
);

-- =========================
-- ASSESSMENTS & MARKING
-- =========================

-- Create the assessments table to define individual assessment components within a module run
-- Each assessment represents a piece of coursework, exam, or other evaluated work (e.g. "Final Exam", "Coursework 1")
CREATE TABLE IF NOT EXISTS assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each assessment definition
  module_run_id UUID NOT NULL REFERENCES module_runs(id) ON DELETE CASCADE,   -- Foreign key linking this assessment to its parent module run; CASCADE delete removes assessments if the module run is deleted
  module_code TEXT NOT NULL,                                                  -- Denormalized module code (e.g. "CS101") copied from modules table for faster query performance without joins
  module_name TEXT NOT NULL,                                                  -- Denormalized module title copied from modules table to avoid repeated joins in read-heavy queries
  title TEXT NOT NULL,                                                        -- Assessment title (e.g. "Final Exam", "Coursework 1"); NOT NULL as every assessment needs a name
  cohort TEXT NOT NULL,                                                       -- Academic cohort identifier (e.g. "2025/26") denormalized for efficient filtering and display
  weighting INT NOT NULL CHECK (weighting BETWEEN 0 AND 100),                 -- Percentage weighting of this assessment within the module (0-100%); CHECK constraint enforces valid range
  credit_size INT NOT NULL DEFAULT 15,                                        -- Credit size of the parent module (15, 20, 30+); affects sample size calculation per academic regulations
  due_date DATE,                                                              -- Submission deadline for this assessment; nullable for assessments without fixed deadlines (e.g. exams)
  status TEXT NOT NULL DEFAULT 'DRAFT',                                       -- Workflow status tracking the assessment lifecycle: DRAFT -> MARKS_UPLOADED -> SAMPLE_GENERATED -> SUBMITTED_FOR_MODERATION -> etc.
  requires_moderation BOOLEAN NOT NULL DEFAULT TRUE,                          -- Flag indicating whether this assessment requires moderation review; defaults to TRUE per academic regulations
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,                    -- Foreign key to the lecturer who created this assessment; SET NULL preserves assessment if creator is deleted
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this assessment was first created in the system
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording the last modification to this assessment's details
);

-- Create the marks table to store individual student marks for each assessment
-- Each row represents one student's mark for one assessment, including the grade, feedback, and revision tracking
CREATE TABLE IF NOT EXISTS marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each mark record
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,   -- Foreign key linking each mark to its parent assessment; CASCADE delete removes all marks if the assessment is deleted
  student_id TEXT NOT NULL,                                                   -- Anonymous student identifier (e.g. "S001") as TEXT to support anonymized IDs during blind marking, maintaining student anonymity
  marker_id TEXT,                                                             -- Identifier of the person who marked this work, stored as TEXT for flexibility; nullable for unassigned marks
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,                   -- Foreign key to the user who uploaded/entered this mark; SET NULL preserves the mark if the uploader is deleted
  mark NUMERIC(5,2) NOT NULL CHECK (mark BETWEEN 0 AND 100),                 -- The actual mark value with 2 decimal places (e.g. 72.50); CHECK constraint ensures mark stays within valid academic range (0-100)
  feedback TEXT,                                                              -- Written feedback comments from the marker explaining the grade; nullable as feedback may be added later
  is_revised BOOLEAN DEFAULT FALSE,                                           -- Flag indicating whether this mark has been revised after moderation; defaults to FALSE for original marks
  revision_reason TEXT,                                                       -- Explanation for why this mark was changed during moderation (e.g. "Moderator recommended re-evaluation"); nullable for unrevised marks
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this mark was first entered into the system
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording the last modification to this mark record
  UNIQUE (assessment_id, student_id)                                          -- Composite unique constraint ensures each student can only have one mark per assessment, preventing duplicate entries
);

-- Create the marks_revision_history table to maintain a complete audit trail of all mark changes
-- Every time a mark is revised during moderation, the original and new values are recorded here for accountability
CREATE TABLE IF NOT EXISTS marks_revision_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each revision history entry
  mark_id UUID NOT NULL REFERENCES marks(id) ON DELETE CASCADE,               -- Foreign key to the specific mark record that was revised; CASCADE delete removes history if the mark is deleted
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,   -- Foreign key to the assessment for efficient querying of all revisions for an assessment; CASCADE on delete
  student_id TEXT NOT NULL,                                                   -- Anonymous student identifier copied from the marks table for denormalized querying without joins
  original_mark NUMERIC(5,2) NOT NULL,                                        -- The mark value BEFORE the revision, preserved as evidence of the original grading
  revised_mark NUMERIC(5,2) NOT NULL,                                         -- The mark value AFTER the revision, recording the new grade assigned during moderation
  revision_reason TEXT,                                                       -- Explanation for why the mark was changed (e.g. "Inconsistent marking criteria identified by moderator")
  revised_by UUID REFERENCES users(id) ON DELETE SET NULL,                    -- Foreign key to the user who made the revision; SET NULL preserves the history if the user is deleted
  revised_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording exactly when this revision took place, for chronological audit trail
);

-- Index on mark_id for fast lookup of all revisions for a specific mark record
CREATE INDEX idx_marks_revision_history_mark ON marks_revision_history(mark_id);
-- Index on assessment_id for efficient retrieval of all mark revisions across an entire assessment
CREATE INDEX idx_marks_revision_history_assessment ON marks_revision_history(assessment_id);

-- =========================
-- SAMPLE SETS + ITEMS
-- =========================

-- Create the sample_sets table to store metadata about each moderation sample generated for an assessment
-- Per academic regulations (Section 12.18-12.20), a representative sample of student marks must be selected for moderator review
-- Sample size depends on cohort size: <100 students = 20% or 10 (whichever greater), 100-300 = 15%, >300 = 10%
CREATE TABLE IF NOT EXISTS sample_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each sample set
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,   -- Foreign key linking this sample to its assessment; CASCADE delete removes samples if the assessment is deleted
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,                  -- Foreign key to the user (typically lecturer) who generated this sample; SET NULL preserves sample if user is deleted
  method TEXT NOT NULL,                                                       -- Sampling method used: 'RANDOM' (random selection), 'STRATIFIED' (across mark ranges), 'RISK_BASED' (targeting boundary cases)
  percent NUMERIC(5,2) NOT NULL,                                              -- Percentage of the cohort included in this sample (e.g. 20.00 for 20%); calculated based on cohort size rules
  size INT NOT NULL CHECK (size >= 0),                                        -- Actual number of marks included in the sample; CHECK constraint prevents negative values
  cohort_size INT NOT NULL DEFAULT 0 CHECK (cohort_size >= 0),                -- Total cohort size at time of sampling; stored for audit purposes so the sample percentage can be verified later
  pass_mark INT NOT NULL DEFAULT 40 CHECK (pass_mark BETWEEN 0 AND 100),     -- Pass mark threshold (default 40%); used to identify boundary cases (38-39%) that MUST be included per regulations
  rule_notes TEXT,                                                            -- Free-text notes explaining which sampling rules were applied and any special inclusion reasons
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording when this sample was generated
);

-- Create the sample_items table to store individual marks that were selected as part of a moderation sample
-- Each row links a specific mark to a sample set, with denormalized fields for efficient display and the moderator's notes
CREATE TABLE IF NOT EXISTS sample_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each sample item
  sample_set_id UUID NOT NULL REFERENCES sample_sets(id) ON DELETE CASCADE,   -- Foreign key to the parent sample set; CASCADE delete removes items if the sample set is deleted
  mark_id UUID NOT NULL REFERENCES marks(id) ON DELETE CASCADE,               -- Foreign key to the actual mark record being sampled; CASCADE delete removes the sample item if the mark is deleted
  student_id TEXT NOT NULL,                                                   -- Denormalized anonymous student ID copied from marks table for efficient display without joins
  original_mark NUMERIC(5,2) NOT NULL,                                        -- Mark value at the time of sampling, preserved as a snapshot even if the mark is later revised during moderation
  marker_id TEXT,                                                             -- Denormalized marker ID copied from marks table to show which marker graded this work
  reason TEXT,                                                                -- Reason why this mark was included in the sample (e.g. "Boundary case 38-42%", "Highest mark", "Random selection")
  moderator_note TEXT,                                                        -- Moderator's comments on this specific sample item during their review of the work
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this item was added to the sample
  UNIQUE (sample_set_id, mark_id)                                             -- Composite unique constraint prevents the same mark from being included twice in the same sample set
);

-- =========================
-- MODERATION WORKFLOW
-- =========================

-- Create the moderation_cases table to track the full lifecycle of a moderation workflow for each assessment
-- Per academic regulations (Section 12.15-12.31), each assessment goes through: submission -> moderation -> optional escalation -> resolution
-- This table is the central hub connecting the lecturer, moderator, and optional third marker for each assessment's moderation
CREATE TABLE IF NOT EXISTS moderation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each moderation case
  assessment_id UUID NOT NULL UNIQUE REFERENCES assessments(id) ON DELETE CASCADE, -- Foreign key to the assessment being moderated; UNIQUE ensures one-to-one relationship (one case per assessment); CASCADE on delete
  sample_set_id UUID REFERENCES sample_sets(id) ON DELETE SET NULL,           -- Foreign key to the sample set used for this moderation; SET NULL preserves the case if sample is regenerated

  status TEXT NOT NULL DEFAULT 'DRAFT',                                       -- Workflow status: DRAFT -> IN_MODERATION -> APPROVED / ESCALATED_TO_THIRD_MARKER -> CLOSED; tracks progression through moderation stages

  -- Lecturer submission fields: populated when the lecturer submits the assessment for moderation
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,                    -- Foreign key to the lecturer who initiated this moderation case; SET NULL preserves case if lecturer is deleted
  lecturer_comment TEXT,                                                      -- Optional comments from the lecturer explaining any marking decisions or flagging concerns for the moderator
  submitted_at TIMESTAMPTZ,                                                   -- Timestamp recording when the lecturer formally submitted this case for moderation review

  -- Moderator review fields: populated when a moderator is assigned and reviews the sample
  moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,                  -- Foreign key to the moderator assigned to review this case; SET NULL preserves case if moderator is deleted
  moderator_comment TEXT,                                                     -- Moderator's overall feedback on the marking quality and any issues identified during review
  moderator_started_at TIMESTAMPTZ,                                           -- Timestamp recording when the moderator began their review of this case
  
  -- Third marker escalation fields: populated only if the moderator cannot confirm marks and escalation is needed (Section 12.28-12.31)
  third_marker_id UUID REFERENCES users(id) ON DELETE SET NULL,               -- Foreign key to the third marker assigned if escalation is required; SET NULL preserves case if third marker is deleted
  third_marker_comment TEXT,                                                  -- Third marker's assessment and comments after reviewing the entire sample independently
  escalated_at TIMESTAMPTZ,                                                   -- Timestamp recording when this case was escalated to a third marker
  third_marker_started_at TIMESTAMPTZ,                                        -- Timestamp recording when the third marker began their independent review

  decided_at TIMESTAMPTZ,                                                     -- Timestamp recording when a final decision was reached on this moderation case (approved or marks adjusted)
  closed_at TIMESTAMPTZ,                                                      -- Timestamp recording when this moderation case was formally closed after all actions were completed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this moderation case record was first created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording the last modification to this moderation case
);

-- Create the moderation_form_responses table to store answers to the 6 standard university moderation questions
-- These questions come from the official university Moderation Form (Marking Assessment) and must be answered by the moderator/third marker
-- Each question has a boolean answer (yes/no) and an optional comment field for justification
CREATE TABLE IF NOT EXISTS moderation_form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each form response
  moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE, -- Foreign key to the moderation case this form belongs to; CASCADE delete for data integrity
  responder_id UUID REFERENCES users(id) ON DELETE SET NULL,                  -- Foreign key to the moderator or third marker who completed this form; SET NULL preserves response if user is deleted
  
  -- Q1: Was there a marking rubric for the module?
  has_marking_rubric BOOLEAN NOT NULL,                                        -- Whether a marking rubric/scheme was provided; essential for consistent marking (answer: YES or NO)
  has_marking_rubric_comment TEXT,                                            -- Optional comment explaining the rubric situation (e.g. "Clear rubric provided with grade descriptors")
  
  -- Q2: Were the marking criteria consistently applied across all scripts?
  criteria_consistently_applied BOOLEAN NOT NULL,                             -- Whether the same marking standards were applied uniformly to all student submissions
  criteria_consistently_applied_comment TEXT,                                 -- Optional comment on consistency (e.g. "Minor variation noted between Marker A and Marker B")
  
  -- Q3: Was the full range of marks used?
  full_range_of_marks_used BOOLEAN NOT NULL,                                  -- Whether marks span the full 0-100 range appropriately, not clustering around one value
  full_range_of_marks_used_comment TEXT,                                      -- Optional comment on mark distribution (e.g. "Marks clustered between 55-65, limited use of upper range")
  
  -- Q4: Were marks awarded fairly?
  marks_awarded_fairly BOOLEAN NOT NULL,                                      -- Overall fairness assessment: whether marks appropriately reflect the quality of student work
  marks_awarded_fairly_comment TEXT,                                          -- Optional comment on fairness (e.g. "All marks appear justified by the quality of submissions")
  
  -- Q5: Were feedback comments appropriate and do they justify the marks awarded?
  feedback_comments_appropriate BOOLEAN NOT NULL,                             -- Whether written feedback aligns with and justifies the grade given to each student
  feedback_comments_appropriate_comment TEXT,                                 -- Optional comment on feedback quality (e.g. "Feedback is constructive but could be more specific")
  
  -- Q6: Are you able to confirm that all marks in the sample are appropriate?
  all_marks_appropriate BOOLEAN NOT NULL,                                     -- Critical question: if FALSE, marks cannot be confirmed and further action (third marking) may be required
  all_marks_appropriate_comment TEXT,                                         -- Optional comment explaining the decision (e.g. "Two marks in the 38-42% range need reconsideration")
  
  -- Recommendations field: required when all_marks_appropriate is FALSE, to specify what corrective action is needed
  recommendations TEXT,                                                       -- Specific recommendations for mark adjustments or re-marking (e.g. "Recommend third marking for boundary cases")
  
  -- Feedback suggestions: optional positive feedback or general improvement suggestions for the marking team
  feedback_suggestions TEXT,                                                  -- Optional constructive suggestions for improving marking or feedback quality in future assessments
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording when this moderation form response was submitted
);

-- Create the pre_moderation_checklists table to store the checklist that the Module Leader/Lecturer must complete BEFORE submitting marks for moderation
-- This ensures all prerequisite quality checks have been performed on the marking before moderator review begins
-- Based on the university's official Moderation Form pre-submission requirements
CREATE TABLE IF NOT EXISTS pre_moderation_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each checklist submission
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE UNIQUE, -- Foreign key to the assessment; UNIQUE ensures only one checklist per assessment; CASCADE on delete
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,                  -- Foreign key to the lecturer/module leader who completed this checklist; SET NULL preserves checklist if user is deleted
  
  -- Checkbox 1: Confirms marking followed Assessment Regulations and the approved marking scheme
  marking_in_accordance BOOLEAN NOT NULL DEFAULT FALSE,                       -- Must be TRUE before submission: attests that marking was done per university regulations and the marking scheme
  
  -- Checkbox 2: Confirms late work penalties were correctly applied (for coursework submissions)
  late_work_policy_adhered BOOLEAN NOT NULL DEFAULT FALSE,                    -- Must be TRUE before submission: attests that late submission penalties were applied according to policy
  
  -- Checkbox 3: Confirms academic misconduct/plagiarism procedures were followed where applicable
  plagiarism_policy_adhered BOOLEAN NOT NULL DEFAULT FALSE,                   -- Must be TRUE before submission: attests that any plagiarism cases were handled per university policy
  
  -- Checkbox 4: Confirms all marks are available with pass/fail/non-submission percentages calculated
  marks_available_with_percentages BOOLEAN NOT NULL DEFAULT FALSE,            -- Must be TRUE before submission: attests that mark statistics are complete and available for review
  
  -- Checkbox 5: Confirms the arithmetic totalling of marks has been independently verified for correctness
  totalling_checked BOOLEAN NOT NULL DEFAULT FALSE,                           -- Must be TRUE before submission: attests that mark calculations have been double-checked
  
  -- Comments field for explaining how consistency was ensured when multiple markers were involved
  consistency_comments TEXT,                                                  -- Required when multiple markers are used; explains how inter-marker consistency was achieved (e.g. "Calibration meeting held")
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this checklist was first created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording the last modification to this checklist
);

-- Create the module_leader_responses table to store the Module Leader's/Lecturer's response AFTER receiving moderator feedback
-- This is the second part of the moderation form workflow: the lecturer reviews the moderator's comments and responds
-- The lecturer must also decide whether escalation to a third marker is needed
CREATE TABLE IF NOT EXISTS module_leader_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each response
  moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE UNIQUE, -- Foreign key to the moderation case; UNIQUE ensures one response per case; CASCADE on delete
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,                  -- Foreign key to the lecturer who completed this response form; SET NULL preserves response if user is deleted
  
  -- Checkbox: Confirms the Module Leader has given proper consideration to the moderator's feedback and recommendations
  moderator_comments_considered BOOLEAN NOT NULL DEFAULT FALSE,               -- Must be TRUE: attests that the moderator's comments and recommendations have been reviewed and considered
  
  -- Text response addressing any issues or recommendations raised by the internal moderator
  response_to_issues TEXT,                                                    -- Lecturer's detailed response to moderator feedback (e.g. "Agreed, marks for boundary cases have been revised")
  
  -- Text explanation for any statistical outliers in the assessment mark distribution
  outliers_explanation TEXT,                                                  -- Explanation for unusual marks (e.g. "Student X scored 98% due to exceptional research quality")
  
  -- Decision on whether the sample needs third marker review per academic regulations (Section 12.28)
  needs_third_marker BOOLEAN NOT NULL DEFAULT FALSE,                          -- If TRUE, the moderation case will be escalated to an independent third marker for final review
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this response was first created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                               -- Timestamp recording the last modification to this response
);

-- Create the moderation_item_notes table to store per-item notes that moderators/third markers write about individual sample items
-- This allows reviewers to leave detailed comments on specific student submissions within the sample
CREATE TABLE IF NOT EXISTS moderation_item_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each note
  moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE, -- Foreign key to the parent moderation case; CASCADE delete removes notes if the case is deleted
  sample_item_id UUID NOT NULL REFERENCES sample_items(id) ON DELETE CASCADE, -- Foreign key to the specific sample item being commented on; CASCADE delete removes notes if the sample item is deleted
  noted_by UUID REFERENCES users(id) ON DELETE SET NULL,                      -- Foreign key to the user who wrote this note (moderator or third marker); SET NULL preserves note if user is deleted
  comment TEXT,                                                               -- The actual note/comment about this specific sample item (e.g. "Mark seems high for the quality of analysis")
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                              -- Timestamp recording when this note was created
  UNIQUE (moderation_case_id, sample_item_id, noted_by)                       -- Composite unique constraint ensures each reviewer can only leave one note per sample item per case, preventing duplicate notes
);

-- =========================
-- AUDIT LOG
-- =========================

-- Create the audit_log table to record every significant action taken in the system for compliance and accountability
-- This is essential for academic governance: all marking and moderation actions must be traceable to support appeals and quality reviews
-- Uses JSONB for flexible storage of action-specific details without requiring schema changes for new event types
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),                              -- UUID primary key auto-generated for each audit event
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),                               -- Exact time the audited action occurred; NOT NULL ensures every event is timestamped; indexed for chronological queries
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,                      -- Foreign key to the user who performed the action; SET NULL preserves the audit entry if the user is later deleted
  actor_name TEXT,                                                            -- Denormalized user display name at time of action; preserved even if the user record changes later
  actor_role TEXT,                                                            -- Denormalized user role at time of action (e.g. 'lecturer', 'moderator'); preserved for historical accuracy
  action TEXT NOT NULL,                                                       -- Description of the action performed (e.g. 'MARKS_UPLOADED', 'SAMPLE_GENERATED', 'MODERATION_SUBMITTED', 'MARK_REVISED')
  assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,           -- Optional foreign key to the related assessment; SET NULL preserves log if assessment is deleted; nullable for non-assessment actions
  entity_type TEXT,                                                           -- Type of the entity affected (e.g. 'assessment', 'mark', 'moderation_case', 'sample_set'); for filtering audit queries
  entity_id UUID,                                                             -- UUID of the specific entity affected; not a foreign key as entities may be deleted while audit records must persist
  details JSONB NOT NULL DEFAULT '{}'::jsonb                                  -- Flexible JSON storage for action-specific metadata (e.g. old/new mark values, sample sizes, status changes); defaults to empty object
);

-- =========================
-- INDEXES
-- =========================
-- Indexes speed up SELECT queries by creating sorted lookup structures on frequently queried columns
-- Without indexes, PostgreSQL must scan every row in a table (sequential scan) which is slow for large datasets
-- The trade-off is slightly slower INSERT/UPDATE operations and additional disk space usage

-- Index on assessment status for fast filtering by workflow stage (e.g. find all assessments in 'SUBMITTED_FOR_MODERATION' status)
CREATE INDEX IF NOT EXISTS idx_assessments_status ON assessments(status);
-- Index on assessment creator for fast lookup of all assessments created by a specific lecturer
CREATE INDEX IF NOT EXISTS idx_assessments_created_by ON assessments(created_by);

-- Index on marks by assessment for fast retrieval of all student marks belonging to a specific assessment
CREATE INDEX IF NOT EXISTS idx_marks_assessment ON marks(assessment_id);
-- Index on marks by student for fast lookup of all marks across assessments for a specific student
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);

-- Index on sample sets by assessment for fast lookup of all sample sets generated for a specific assessment
CREATE INDEX IF NOT EXISTS idx_sample_sets_assessment ON sample_sets(assessment_id);
-- Index on sample items by sample set for fast retrieval of all items within a specific sample
CREATE INDEX IF NOT EXISTS idx_sample_items_set ON sample_items(sample_set_id);

-- Index on moderation case status for fast filtering of cases by workflow stage (e.g. find all cases 'IN_MODERATION')
CREATE INDEX IF NOT EXISTS idx_moderation_cases_status ON moderation_cases(status);
-- Index on moderation case by assessment for fast lookup of the moderation case for a specific assessment
CREATE INDEX IF NOT EXISTS idx_moderation_cases_assessment ON moderation_cases(assessment_id);

-- Index on pre-moderation checklists by assessment for fast lookup of whether a checklist exists for an assessment
CREATE INDEX IF NOT EXISTS idx_pre_moderation_checklists_assessment ON pre_moderation_checklists(assessment_id);
-- Index on module leader responses by moderation case for fast lookup of the lecturer's response to moderator feedback
CREATE INDEX IF NOT EXISTS idx_module_leader_responses_case ON module_leader_responses(moderation_case_id);

-- Index on audit log timestamp for efficient chronological queries and date-range filtering of audit events
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
-- Index on audit log actor for fast retrieval of all actions performed by a specific user
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
-- Index on audit log assessment for fast retrieval of the complete audit trail for a specific assessment
CREATE INDEX IF NOT EXISTS idx_audit_assessment ON audit_log(assessment_id);

-- COMMIT the transaction: all table creations and index builds are now applied atomically
-- If any statement above failed, the entire schema would have been rolled back, leaving the database unchanged
COMMIT;
