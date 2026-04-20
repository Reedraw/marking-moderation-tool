// Import the generic API request function from our HTTP client module
import { apiRequest } from "./api-client";

// Union type defining all possible assessment workflow states
// Matches the backend AssessmentStatus enum - used across the entire frontend
export type AssessmentStatus =
  | "DRAFT"                          // Initial state when assessment is created
  | "MARKS_UPLOADED"                 // Lecturer has uploaded student marks
  | "SAMPLE_GENERATED"              // System has generated a moderation sample
  | "SUBMITTED_FOR_MODERATION"      // Lecturer submitted for moderator review
  | "IN_MODERATION"                 // Moderator is currently reviewing
  | "APPROVED"                      // Moderator approved the marks
  | "CHANGES_REQUESTED"            // Moderator requested changes from lecturer
  | "ESCALATED";                   // Sent to third marker for independent review

// Full assessment data structure returned from the backend
// Represents a single assessment (e.g., "CS101 Final Exam 2024")
export interface Assessment {
  id: string;                        // UUID primary key
  module_code: string;               // Module code (e.g., "CS101")
  module_name: string;               // Module name (e.g., "Introduction to Computing")
  title: string;                     // Assessment title (e.g., "Final Exam")
  cohort: string;                    // Academic year cohort (e.g., "2024/25")
  due_date: string;                  // ISO date string for assessment due date
  weighting: number;                 // Percentage weighting of this assessment
  status: AssessmentStatus;          // Current workflow status
  marks_uploaded_count: number;      // Number of student marks uploaded so far
  sample_size: number | null;        // Number of items in the moderation sample (null if not generated)
  sample_method: string | null;      // Method used to generate sample (RANDOM/STRATIFIED/RISK_BASED)
  sample_percent: number | null;     // Percentage of cohort in sample
  created_by: string;                // UUID of the lecturer who created this assessment
  created_at: string;                // ISO timestamp of creation
  updated_at: string;                // ISO timestamp of last update
  // Optional fields only present in queue/list endpoints (joined from related tables)
  lecturer_name?: string;            // Display name of the creating lecturer
  moderator_name?: string;           // Display name of assigned moderator
  submitted_at?: string;             // When submitted for moderation
  escalated_at?: string;             // When escalated to third marker
}

// Data required to create a new assessment
// Matches the backend AssessmentCreate Pydantic model
export interface AssessmentCreate {
  module_code: string;               // Module code
  module_name: string;               // Module name
  title: string;                     // Assessment title
  cohort: string;                    // Cohort identifier
  due_date: string;                  // Due date
  weighting: number;                 // Assessment weighting percentage
  credit_size: number;               // Module credit size (used for sample size calculation)
}

// Single mark entry for bulk upload
export interface MarkUpload {
  student_id: string;                // Anonymous student identifier
  mark: number;                      // Numerical mark (0-100)
  marker_id: string | undefined;     // UUID of the marker (optional, defaults to current user)
}

// Request body for generating a moderation sample
export interface SampleGenerateRequest {
  method: "RANDOM" | "STRATIFIED" | "RISK_BASED";  // Sampling strategy
  percent: number;                                    // Percentage of cohort to sample
}

// Request body when lecturer submits assessment for moderation
export interface ModerationSubmitRequest {
  comment: string | undefined;       // Optional comment from lecturer to moderator
}

// Request body for moderator's decision on an assessment
export interface ModerationDecisionRequest {
  decision: "APPROVED" | "CHANGES_REQUESTED" | "ESCALATED";  // Moderator's verdict
  comment: string | undefined;                                  // Optional explanation
}

// Moderation form data matching the university's moderation form requirements
// Each boolean question has an optional comment field for justification
// Based on Section 12 of academic regulations
export interface ModerationFormData {
  has_marking_rubric: boolean;                         // Was there a marking rubric?
  has_marking_rubric_comment?: string;
  criteria_consistently_applied: boolean;              // Were marking criteria consistently applied?
  criteria_consistently_applied_comment?: string;
  full_range_of_marks_used: boolean;                   // Was the full range of marks used?
  full_range_of_marks_used_comment?: string;
  marks_awarded_fairly: boolean;                       // Were marks awarded fairly?
  marks_awarded_fairly_comment?: string;
  feedback_comments_appropriate: boolean;              // Were feedback comments appropriate?
  feedback_comments_appropriate_comment?: string;
  all_marks_appropriate: boolean;                      // Are all marks in sample appropriate?
  all_marks_appropriate_comment?: string;
  recommendations?: string;                            // Overall recommendations from moderator
  feedback_suggestions?: string;                       // Suggestions for improving feedback
}

// Pre-Moderation Checklist - completed by Module Leader/Lecturer BEFORE submitting for moderation
// Ensures basic quality checks are done before moderator reviews
export interface PreModerationChecklist {
  id: string;                                          // UUID primary key
  assessment_id: string;                               // FK to the assessment
  completed_by: string | null;                         // UUID of person who completed it
  marking_in_accordance: boolean;                      // Marking done per regulations
  late_work_policy_adhered: boolean;                   // Late submission policy followed
  plagiarism_policy_adhered: boolean;                  // Plagiarism policy followed
  marks_available_with_percentages: boolean;           // Marks shown as percentages
  totalling_checked: boolean;                          // Mark totals verified
  consistency_comments: string | null;                 // Comments on marking consistency
  created_at: string;
  updated_at: string;
  completed_by_name?: string;                          // Display name (from joined query)
}

// Data to submit when filling in the pre-moderation checklist
export interface PreModerationChecklistSubmit {
  marking_in_accordance: boolean;
  late_work_policy_adhered: boolean;
  plagiarism_policy_adhered: boolean;
  marks_available_with_percentages: boolean;
  totalling_checked: boolean;
  consistency_comments?: string;                       // Optional consistency notes
}

// Module Leader Response - completed by lecturer AFTER receiving moderator feedback
// Part of the moderation workflow: moderator gives feedback, lecturer responds
export interface ModuleLeaderResponse {
  id: string;                                          // UUID primary key
  moderation_case_id: string;                          // FK to the moderation case
  completed_by: string | null;                         // UUID of the lecturer
  moderator_comments_considered: boolean;              // Whether moderator comments were considered
  response_to_issues: string | null;                   // Lecturer's response to raised issues
  outliers_explanation: string | null;                  // Explanation for any outlier marks
  needs_third_marker: boolean;                         // Whether lecturer agrees third marker needed
  created_at: string;
  updated_at: string;
  completed_by_name?: string;                          // Display name (from joined query)
}

// Data to submit when filling in the module leader response form
export interface ModuleLeaderResponseSubmit {
  moderator_comments_considered: boolean;
  response_to_issues?: string;
  outliers_explanation?: string;
  needs_third_marker: boolean;
}

// Third marker's decision options when reviewing an escalated assessment
export interface ThirdMarkerDecisionRequest {
  decision: "CONFIRM_MODERATOR" | "OVERRIDE_MODERATOR" | "REFER_BACK";  // Agree, override, or send back
  comment: string | undefined;                                             // Explanation for the decision
}

// Full moderation case data - tracks the entire moderation workflow for an assessment
// A moderation case is created when an assessment is submitted for moderation
export interface ModerationCase {
  id: string;                        // UUID primary key
  assessment_id: string;             // FK to the assessment being moderated
  moderator_id: string | null;       // UUID of assigned moderator
  third_marker_id: string | null;    // UUID of third marker (if escalated)
  status: AssessmentStatus;          // Current status of this case
  lecturer_comment: string | null;   // Comment from lecturer on submission
  moderator_comment: string | null;  // Moderator's feedback/decision comment
  third_marker_comment: string | null; // Third marker's feedback
  submitted_at: string | null;       // When submitted for moderation
  escalated_at: string | null;       // When escalated to third marker
  decided_at: string | null;         // When final decision was made
  created_at: string;
  updated_at: string;
  lecturer_name: string | null;      // Display names from joined queries
  moderator_name: string | null;
  third_marker_name: string | null;
  sample_size: number | null;        // Sample info for display
  sample_method: string | null;
  sample_percent: number | null;
}

// Single item in a moderation sample - one student's mark selected for review
export interface SampleItem {
  id: string;                        // UUID primary key
  sample_set_id: string;             // FK to the sample set this belongs to
  student_id: string;                // Anonymous student ID
  mark: number;                      // The student's mark (0-100)
  marker_id: string | null;          // UUID of who marked this student
  moderator_note: string | null;     // Moderator's note on this specific item
}

// Dashboard statistics for the lecturer view
export interface LecturerDashboardStats {
  total: number;                     // Total assessments created by this lecturer
  draft: number;                     // Assessments in draft state
  marks_uploaded: number;            // Assessments with marks uploaded
  sample_generated: number;          // Assessments with samples generated
  pending_moderation: number;        // Submitted but not yet picked up
  in_moderation: number;             // Currently being reviewed
  approved: number;                  // Approved by moderator
  changes_requested: number;         // Moderator requested changes
}

// Dashboard statistics for the moderator view
export interface ModeratorDashboardStats {
  total: number;                     // Total cases assigned to this moderator
  pending: number;                   // Awaiting review
  in_moderation: number;             // Currently reviewing
  escalated: number;                 // Escalated to third marker
}

// Dashboard statistics for the third marker view
export interface ThirdMarkerDashboardStats {
  total: number;                     // Total escalated cases
  escalated: number;                 // Cases waiting for review
  in_review: number;                 // Cases currently being reviewed
}

// Admin dashboard statistics - system-wide overview
export interface AdminStats {
  total_assessments: number;                     // Total assessments in the system
  by_status: Record<string, number>;             // Count per status (e.g., {"DRAFT": 5, "APPROVED": 3})
  users: Record<string, number>;                 // Count per role (e.g., {"lecturer": 10})
  activity_last_24h: Record<string, number>;     // Recent activity counts
}

// Single audit log entry - tracks all actions for compliance
export interface AuditEvent {
  id: string;                        // UUID primary key
  timestamp: string;                 // When the action occurred
  actor_id: string;                  // UUID of who performed the action
  actor_name: string;                // Display name of the actor
  actor_role: string;                // Role of the actor
  action: string;                    // Description of the action (e.g., "uploaded marks")
  assessment_id: string | null;      // FK to related assessment (if applicable)
}

// Response from the marks upload endpoint
export interface MarksUploadResponse {
  processed: number;                 // Number of marks successfully processed
  skipped: number;                   // Number of duplicate/skipped entries
  errors: string[];                  // Any error messages for failed entries
}

// ===============================
// Lecturer API Functions
// ===============================

// Fetch all assessments created by the currently logged-in lecturer
export async function getLecturerAssessments(): Promise<Assessment[]> {
  return apiRequest<Assessment[]>("/lecturer/assessments", { requireAuth: true });
}

// Create a new assessment - sends assessment details to the backend
export async function createAssessment(data: AssessmentCreate): Promise<Assessment> {
  return apiRequest<Assessment>("/lecturer/assessments", {
    method: "POST",
    body: data,
    requireAuth: true,
  });
}

// Fetch a single assessment by its UUID
export async function getAssessment(assessmentId: string): Promise<Assessment> {
  return apiRequest<Assessment>(`/lecturer/assessments/${assessmentId}`, {
    requireAuth: true,
  });
}

// Upload student marks in bulk for a specific assessment
// Sends an array of {student_id, mark, marker_id} objects
export async function uploadMarks(
  assessmentId: string,
  marks: MarkUpload[]
): Promise<MarksUploadResponse> {
  return apiRequest<MarksUploadResponse>(
    `/lecturer/assessments/${assessmentId}/marks/upload`,
    {
      method: "POST",
      body: { marks },        // Wrap marks array in an object to match backend schema
      requireAuth: true,
    }
  );
}

// Generate a moderation sample for an assessment using the specified strategy
// Backend selects students based on method (RANDOM, STRATIFIED, or RISK_BASED)
// RISK_BASED includes boundary marks (38-42%, 58-62%, 68-72%) per academic regulations
export async function generateSample(
  assessmentId: string,
  method: "RANDOM" | "STRATIFIED" | "RISK_BASED" = "RISK_BASED",  // Default to risk-based
  percent: number = 10                                                // Default 10% sample
): Promise<{ sample_size: number; method: string; percent: number; sample_items: SampleItem[] }> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/generate-sample`, {
    method: "POST",
    body: { method, percent },
    requireAuth: true,
  });
}

// Submit an assessment for moderation - transitions status to SUBMITTED_FOR_MODERATION
// Optionally includes a comment from the lecturer to the moderator
export async function submitForModeration(
  assessmentId: string,
  comment: string | undefined = undefined
): Promise<{ message: string }> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/submit-for-moderation`, {
    method: "POST",
    body: { comment },
    requireAuth: true,
  });
}

// Fetch the moderation sample items for a specific assessment
export async function getAssessmentSample(assessmentId: string): Promise<SampleItem[]> {
  return apiRequest<SampleItem[]>(`/lecturer/assessments/${assessmentId}/sample`, {
    requireAuth: true,
  });
}

// Fetch dashboard statistics for the lecturer (counts by status)
export async function getLecturerDashboardStats(): Promise<LecturerDashboardStats> {
  return apiRequest<LecturerDashboardStats>("/lecturer/dashboard", {
    requireAuth: true,
  });
}

// ===============================
// Moderator API Functions
// ===============================

// Fetch the queue of assessments awaiting moderation (assigned to this moderator)
export async function getModeratorQueue(): Promise<Assessment[]> {
  return apiRequest<Assessment[]>("/moderator/queue", { requireAuth: true });
}

// Fetch moderator dashboard statistics
export async function getModeratorDashboardStats(): Promise<ModeratorDashboardStats> {
  return apiRequest<ModeratorDashboardStats>("/moderator/dashboard", {
    requireAuth: true,
  });
}

// Fetch a specific assessment from the moderator's perspective
export async function getModeratorAssessment(assessmentId: string): Promise<Assessment> {
  return apiRequest<Assessment>(`/moderator/assessments/${assessmentId}`, {
    requireAuth: true,
  });
}

// Fetch the moderation sample for a moderator to review
export async function getModeratorSample(assessmentId: string): Promise<SampleItem[]> {
  return apiRequest<SampleItem[]>(`/moderator/assessments/${assessmentId}/sample`, {
    requireAuth: true,
  });
}

// Fetch the moderation case details for a specific assessment (moderator view)
export async function getModerationCase(assessmentId: string): Promise<ModerationCase> {
  return apiRequest<ModerationCase>(`/moderator/assessments/${assessmentId}/moderation-case`, {
    requireAuth: true,
  });
}

// Fetch moderation case from the lecturer's perspective (to see moderator feedback)
export async function getLecturerModerationCase(assessmentId: string): Promise<ModerationCase> {
  return apiRequest<ModerationCase>(`/lecturer/assessments/${assessmentId}/moderation-case`, {
    requireAuth: true,
  });
}

// Submit a moderation decision (APPROVED, CHANGES_REQUESTED, or ESCALATED)
export async function submitModerationDecision(
  assessmentId: string,
  decision: ModerationDecisionRequest
): Promise<{ message: string; case: ModerationCase }> {
  return apiRequest(`/moderator/assessments/${assessmentId}/decision`, {
    method: "POST",
    body: decision,
    requireAuth: true,
  });
}

// Submit the full moderation form with all quality assurance questions and a decision
// This is the main moderation workflow action - moderator fills the form and makes a decision
export async function submitModerationForm(
  assessmentId: string,
  formData: ModerationFormData,                                      // All form question responses
  decision: "APPROVED" | "CHANGES_REQUESTED" | "ESCALATED",         // Final decision
  summaryComment?: string                                             // Optional summary comment
): Promise<{ message: string }> {
  return apiRequest(`/moderator/assessments/${assessmentId}/form`, {
    method: "POST",
    body: {
      form_responses: formData,       // Nested form data
      decision: decision,
      summary_comment: summaryComment,
    },
    requireAuth: true,
  });
}

// ===============================
// Third Marker API Functions
// ===============================

// Fetch the queue of escalated assessments for third marker review
export async function getThirdMarkerQueue(): Promise<Assessment[]> {
  return apiRequest<Assessment[]>("/third-marker/queue", {
    requireAuth: true,
  });
}

// Fetch third marker dashboard statistics
export async function getThirdMarkerDashboardStats(): Promise<ThirdMarkerDashboardStats> {
  return apiRequest<ThirdMarkerDashboardStats>("/third-marker/dashboard", {
    requireAuth: true,
  });
}

// Fetch assessment details from the third marker's perspective
export async function getThirdMarkerAssessment(assessmentId: string): Promise<Assessment> {
  return apiRequest<Assessment>(`/third-marker/assessments/${assessmentId}`, {
    requireAuth: true,
  });
}

// Fetch the moderation sample for third marker review
export async function getThirdMarkerSample(assessmentId: string): Promise<SampleItem[]> {
  return apiRequest<SampleItem[]>(`/third-marker/assessments/${assessmentId}/sample`, {
    requireAuth: true,
  });
}

// Fetch moderation case details from the third marker's perspective
export async function getThirdMarkerModerationCase(assessmentId: string): Promise<ModerationCase> {
  return apiRequest<ModerationCase>(`/third-marker/assessments/${assessmentId}/moderation-case`, {
    requireAuth: true,
  });
}

// Submit third marker's decision on an escalated assessment
// CONFIRM_MODERATOR = agree with moderator, OVERRIDE_MODERATOR = disagree, REFER_BACK = needs more work
export async function submitThirdMarkerDecision(
  assessmentId: string,
  decision: ThirdMarkerDecisionRequest
): Promise<{ message: string; case: ModerationCase }> {
  return apiRequest(`/third-marker/assessments/${assessmentId}/decision`, {
    method: "POST",
    body: decision,
    requireAuth: true,
  });
}

// ===============================
// Admin API Functions
// ===============================

// Fetch system-wide statistics for the admin dashboard
export async function getAdminStats(): Promise<AdminStats> {
  return apiRequest<AdminStats>("/admin/stats", { requireAuth: true });
}

// Fetch audit trail events - tracks all user actions for compliance
// limit parameter controls how many recent events to retrieve
export async function getAuditEvents(limit: number = 20): Promise<AuditEvent[]> {
  return apiRequest<AuditEvent[]>(`/admin/audit?limit=${limit}`, {
    requireAuth: true,
  });
}

// Fetch all users with optional filtering by role and active status
// Used by admin to manage user accounts
export async function getAllUsers(
  role?: string,                   // Optional role filter (e.g., "lecturer")
  is_active?: boolean,             // Optional active status filter
  limit: number = 50               // Max users to return
): Promise<any[]> {
  // Build URL search params dynamically based on provided filters
  const params = new URLSearchParams({ limit: limit.toString() });
  if (role) params.append("role", role);
  if (is_active !== undefined) params.append("is_active", is_active.toString());

  return apiRequest(`/admin/users?${params.toString()}`, {
    requireAuth: true,
  });
}

// Deactivate a user account (admin action) - prevents user from logging in
export async function deactivateUser(userId: string): Promise<{ message: string }> {
  return apiRequest(`/admin/users/${userId}/deactivate`, {
    method: "POST",
    requireAuth: true,
  });
}

// ===============================
// Module APIs
// ===============================

// Module information returned from the admin modules endpoint
export interface ModuleInfo {
  id: string;                      // UUID primary key
  code: string;                    // Module code (e.g., "CS101")
  title: string;                   // Module title
  credits: number | null;          // Credit value (null if not set)
  created_at: string;
  updated_at: string;
  assessment_count: number;        // Number of assessments for this module
  latest_cohort: string | null;    // Most recent cohort using this module
}

// Fetch all modules in the system (admin view)
export async function getModules(limit: number = 100): Promise<ModuleInfo[]> {
  return apiRequest<ModuleInfo[]>(`/admin/modules?limit=${limit}`, {
    requireAuth: true,
  });
}

// ===============================
// Pre-Moderation Checklist APIs
// ===============================

// Submit the pre-moderation checklist for an assessment (lecturer action)
// Must be completed before submitting for moderation
export async function submitPreModerationChecklist(
  assessmentId: string,
  data: PreModerationChecklistSubmit
): Promise<PreModerationChecklist> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/checklist`, {
    method: "POST",
    body: data,
    requireAuth: true,
  });
}

// Fetch the existing pre-moderation checklist for an assessment
export async function getPreModerationChecklist(
  assessmentId: string
): Promise<PreModerationChecklist> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/checklist`, {
    requireAuth: true,
  });
}

// ===============================
// Module Leader Response APIs
// ===============================

// Submit the module leader's response to moderator feedback (lecturer action)
// Part of the feedback loop: moderator reviews → lecturer responds
export async function submitModuleLeaderResponse(
  assessmentId: string,
  data: ModuleLeaderResponseSubmit
): Promise<ModuleLeaderResponse> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/response`, {
    method: "POST",
    body: data,
    requireAuth: true,
  });
}

// Fetch the existing module leader response for an assessment
export async function getModuleLeaderResponse(
  assessmentId: string
): Promise<ModuleLeaderResponse> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/response`, {
    requireAuth: true,
  });
}

// Re-export ApiError from api-client for convenience
// Allows importing ApiError from either api-client or assessments-api
export { ApiError } from "./api-client";
