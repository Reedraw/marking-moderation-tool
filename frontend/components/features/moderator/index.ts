// Barrel export file - re-exports all moderator feature components from a single entry point
// This allows other parts of the app to import like: import { ModeratorDashboard, AssessmentReview } from "@/components/features/moderator"

// Export the ModeratorDashboard component which shows the list of assessments awaiting moderation
export { ModeratorDashboard } from "./dashboard";
// Export the AssessmentReview component which handles the full moderation review workflow (form + decision)
export { AssessmentReview } from "./assessment-review";
