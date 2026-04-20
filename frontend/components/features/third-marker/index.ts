// Barrel export file - re-exports all third-marker feature components from a single entry point
// This allows other parts of the app to import like: import { ThirdMarkerDashboard, AssessmentReview } from "@/components/features/third-marker"

// Export the ThirdMarkerDashboard component which shows escalated assessments assigned to this third marker
export { ThirdMarkerDashboard } from "./dashboard";
// Export the AssessmentReview component which handles the third marker's independent review and final decision
export { AssessmentReview } from "./assessment-review";
