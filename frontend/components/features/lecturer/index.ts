// Barrel export file — re-exports all lecturer feature components from a single entry point.
// This allows other parts of the app to import like: import { LecturerDashboard } from "@/components/features/lecturer"
// instead of importing from each individual file, keeping imports clean and centralised.

// Export the main lecturer dashboard component that shows assessment list and summary stats
export { LecturerDashboard } from "./dashboard";
// Export the assessment detail view with sample generation, checklist, and submit-for-moderation
export { AssessmentDetail } from "./assessment-detail";
// Export the CSV upload component for uploading student marks
export { UploadMarks } from "./upload-marks";
// Export the Module Leader Response form for responding to moderator feedback
export { ModeratorResponse } from "./moderator-response";
