import { apiRequest } from "./api-client";

export type AssessmentStatus =
  | "DRAFT"
  | "MARKS_UPLOADED"
  | "SAMPLE_GENERATED"
  | "SUBMITTED_FOR_MODERATION"
  | "IN_MODERATION"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "ESCALATED";

export interface Assessment {
  id: string;
  module_code: string;
  module_name: string;
  title: string;
  cohort: string;
  due_date: string;
  weighting: number;
  status: AssessmentStatus;
  marks_uploaded_count: number;
  sample_size: number | null;
  sample_method: string | null;
  sample_percent: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Optional fields from queue endpoints
  lecturer_name?: string;
  moderator_name?: string;
  submitted_at?: string;
  escalated_at?: string;
}

export interface AssessmentCreate {
  module_code: string;
  module_name: string;
  title: string;
  cohort: string;
  due_date: string;
  weighting: number;
  credit_size: number;
}

export interface MarkUpload {
  student_id: string;
  mark: number;
  marker_id: string | undefined;
}

export interface SampleGenerateRequest {
  method: "RANDOM" | "STRATIFIED" | "RISK_BASED";
  percent: number;
}

export interface ModerationSubmitRequest {
  comment: string | undefined;
}

export interface ModerationDecisionRequest {
  decision: "APPROVED" | "CHANGES_REQUESTED" | "ESCALATED";
  comment: string | undefined;
}

export interface ModerationFormData {
  has_marking_rubric: boolean;
  has_marking_rubric_comment?: string;
  criteria_consistently_applied: boolean;
  criteria_consistently_applied_comment?: string;
  full_range_of_marks_used: boolean;
  full_range_of_marks_used_comment?: string;
  marks_awarded_fairly: boolean;
  marks_awarded_fairly_comment?: string;
  feedback_comments_appropriate: boolean;
  feedback_comments_appropriate_comment?: string;
  all_marks_appropriate: boolean;
  all_marks_appropriate_comment?: string;
  recommendations?: string;
  feedback_suggestions?: string;
}

// Pre-Moderation Checklist (completed by Module Leader/Lecturer BEFORE moderation)
export interface PreModerationChecklist {
  id: string;
  assessment_id: string;
  completed_by: string | null;
  marking_in_accordance: boolean;
  late_work_policy_adhered: boolean;
  plagiarism_policy_adhered: boolean;
  marks_available_with_percentages: boolean;
  totalling_checked: boolean;
  consistency_comments: string | null;
  created_at: string;
  updated_at: string;
  completed_by_name?: string;
}

export interface PreModerationChecklistSubmit {
  marking_in_accordance: boolean;
  late_work_policy_adhered: boolean;
  plagiarism_policy_adhered: boolean;
  marks_available_with_percentages: boolean;
  totalling_checked: boolean;
  consistency_comments?: string;
}

// Module Leader Response (completed by Module Leader/Lecturer AFTER moderator feedback)
export interface ModuleLeaderResponse {
  id: string;
  moderation_case_id: string;
  completed_by: string | null;
  moderator_comments_considered: boolean;
  response_to_issues: string | null;
  outliers_explanation: string | null;
  needs_third_marker: boolean;
  created_at: string;
  updated_at: string;
  completed_by_name?: string;
}

export interface ModuleLeaderResponseSubmit {
  moderator_comments_considered: boolean;
  response_to_issues?: string;
  outliers_explanation?: string;
  needs_third_marker: boolean;
}

export interface ThirdMarkerDecisionRequest {
  decision: "CONFIRM_MODERATOR" | "OVERRIDE_MODERATOR" | "REFER_BACK";
  comment: string | undefined;
}

export interface ModerationCase {
  id: string;
  assessment_id: string;
  moderator_id: string | null;
  third_marker_id: string | null;
  status: AssessmentStatus;
  lecturer_comment: string | null;
  moderator_comment: string | null;
  third_marker_comment: string | null;
  submitted_at: string | null;
  escalated_at: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  lecturer_name: string | null;
  moderator_name: string | null;
  third_marker_name: string | null;
  sample_size: number | null;
  sample_method: string | null;
  sample_percent: number | null;
}

export interface SampleItem {
  id: string;
  sample_set_id: string;
  student_id: string;
  mark: number;
  marker_id: string | null;
  moderator_note: string | null;
}

export interface LecturerDashboardStats {
  total: number;
  draft: number;
  marks_uploaded: number;
  sample_generated: number;
  pending_moderation: number;
  in_moderation: number;
  approved: number;
  changes_requested: number;
}

export interface ModeratorDashboardStats {
  total: number;
  pending: number;
  in_moderation: number;
  escalated: number;
}

export interface ThirdMarkerDashboardStats {
  total: number;
  escalated: number;
  in_review: number;
}

export interface AdminStats {
  total_assessments: number;
  by_status: Record<string, number>;
  users: Record<string, number>;
  activity_last_24h: Record<string, number>;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action: string;
  assessment_id: string | null;
}

export interface MarksUploadResponse {
  processed: number;
  skipped: number;
  errors: string[];
}

export async function getLecturerAssessments(): Promise<Assessment[]> {
  return apiRequest<Assessment[]>("/lecturer/assessments", { requireAuth: true });
}

export async function createAssessment(data: AssessmentCreate): Promise<Assessment> {
  return apiRequest<Assessment>("/lecturer/assessments", {
    method: "POST",
    body: data,
    requireAuth: true,
  });
}

export async function getAssessment(assessmentId: string): Promise<Assessment> {
  return apiRequest<Assessment>(`/lecturer/assessments/${assessmentId}`, {
    requireAuth: true,
  });
}

export async function uploadMarks(
  assessmentId: string,
  marks: MarkUpload[]
): Promise<MarksUploadResponse> {
  return apiRequest<MarksUploadResponse>(
    `/lecturer/assessments/${assessmentId}/marks/upload`,
    {
      method: "POST",
      body: { marks },
      requireAuth: true,
    }
  );
}

export async function generateSample(
  assessmentId: string,
  method: "RANDOM" | "STRATIFIED" | "RISK_BASED" = "RISK_BASED",
  percent: number = 10
): Promise<{ sample_size: number; method: string; percent: number; sample_items: SampleItem[] }> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/generate-sample`, {
    method: "POST",
    body: { method, percent },
    requireAuth: true,
  });
}

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

export async function getAssessmentSample(assessmentId: string): Promise<SampleItem[]> {
  return apiRequest<SampleItem[]>(`/lecturer/assessments/${assessmentId}/sample`, {
    requireAuth: true,
  });
}

export async function getLecturerDashboardStats(): Promise<LecturerDashboardStats> {
  return apiRequest<LecturerDashboardStats>("/lecturer/dashboard", {
    requireAuth: true,
  });
}

export async function getModeratorQueue(): Promise<Assessment[]> {
  return apiRequest<Assessment[]>("/moderator/queue", { requireAuth: true });
}

export async function getModeratorDashboardStats(): Promise<ModeratorDashboardStats> {
  return apiRequest<ModeratorDashboardStats>("/moderator/dashboard", {
    requireAuth: true,
  });
}

export async function getModeratorAssessment(assessmentId: string): Promise<Assessment> {
  return apiRequest<Assessment>(`/moderator/assessments/${assessmentId}`, {
    requireAuth: true,
  });
}

export async function getModeratorSample(assessmentId: string): Promise<SampleItem[]> {
  return apiRequest<SampleItem[]>(`/moderator/assessments/${assessmentId}/sample`, {
    requireAuth: true,
  });
}

export async function getModerationCase(assessmentId: string): Promise<ModerationCase> {
  return apiRequest<ModerationCase>(`/moderator/assessments/${assessmentId}/moderation-case`, {
    requireAuth: true,
  });
}

export async function getLecturerModerationCase(assessmentId: string): Promise<ModerationCase> {
  return apiRequest<ModerationCase>(`/lecturer/assessments/${assessmentId}/moderation-case`, {
    requireAuth: true,
  });
}

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

export async function submitModerationForm(
  assessmentId: string,
  formData: ModerationFormData,
  decision: "APPROVED" | "CHANGES_REQUESTED" | "ESCALATED",
  summaryComment?: string
): Promise<{ message: string }> {
  return apiRequest(`/moderator/assessments/${assessmentId}/form`, {
    method: "POST",
    body: {
      form_responses: formData,
      decision: decision,
      summary_comment: summaryComment,
    },
    requireAuth: true,
  });
}

export async function getThirdMarkerQueue(): Promise<Assessment[]> {
  return apiRequest<Assessment[]>("/third-marker/queue", {
    requireAuth: true,
  });
}

export async function getThirdMarkerDashboardStats(): Promise<ThirdMarkerDashboardStats> {
  return apiRequest<ThirdMarkerDashboardStats>("/third-marker/dashboard", {
    requireAuth: true,
  });
}

export async function getThirdMarkerAssessment(assessmentId: string): Promise<Assessment> {
  return apiRequest<Assessment>(`/third-marker/assessments/${assessmentId}`, {
    requireAuth: true,
  });
}

export async function getThirdMarkerSample(assessmentId: string): Promise<SampleItem[]> {
  return apiRequest<SampleItem[]>(`/third-marker/assessments/${assessmentId}/sample`, {
    requireAuth: true,
  });
}

export async function getThirdMarkerModerationCase(assessmentId: string): Promise<ModerationCase> {
  return apiRequest<ModerationCase>(`/third-marker/assessments/${assessmentId}/moderation-case`, {
    requireAuth: true,
  });
}

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

export async function getAdminStats(): Promise<AdminStats> {
  return apiRequest<AdminStats>("/admin/stats", { requireAuth: true });
}

export async function getAuditEvents(limit: number = 20): Promise<AuditEvent[]> {
  return apiRequest<AuditEvent[]>(`/admin/audit?limit=${limit}`, {
    requireAuth: true,
  });
}

export async function getAllUsers(
  role?: string,
  is_active?: boolean,
  limit: number = 50
): Promise<any[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (role) params.append("role", role);
  if (is_active !== undefined) params.append("is_active", is_active.toString());

  return apiRequest(`/admin/users?${params.toString()}`, {
    requireAuth: true,
  });
}

export async function deactivateUser(userId: string): Promise<{ message: string }> {
  return apiRequest(`/admin/users/${userId}/deactivate`, {
    method: "POST",
    requireAuth: true,
  });
}

// ===============================
// Pre-Moderation Checklist APIs
// ===============================

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

export async function getModuleLeaderResponse(
  assessmentId: string
): Promise<ModuleLeaderResponse> {
  return apiRequest(`/lecturer/assessments/${assessmentId}/response`, {
    requireAuth: true,
  });
}

// Re-export ApiError from api-client for convenience
export { ApiError } from "./api-client";
