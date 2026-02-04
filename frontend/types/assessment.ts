export type AssessmentStatus =
  | "DRAFT"
  | "MARKS_UPLOADED"
  | "SAMPLE_GENERATED"
  | "SUBMITTED_FOR_MODERATION"
  | "IN_MODERATION"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "ESCALATED";

/**
 * @deprecated Use Assessment from lib/assessments-api.ts instead.
 * This type uses camelCase which doesn't match backend API responses.
 * The backend returns snake_case field names.
 */
export type Assessment = {
  id: string;
  moduleCode: string;
  moduleName: string;
  assessmentTitle: string;
  cohort: string;
  dueDate: string;
  students: number;
  status: AssessmentStatus;
  sampleSize: number;
  lastUpdated: string;
};

export type SampleMethod = "RANDOM" | "STRATIFIED" | "RISK_BASED";
