// Import the BadgeVariant type from UI components for colour-coded status badges
import { BadgeVariant } from "@/components/ui";
// Import the AssessmentStatus union type for type-safe status handling
import { AssessmentStatus } from "@/types/assessment";

// Utility function to convert a raw assessment status string into a display-friendly label and badge colour
// Used across dashboard and detail views to consistently render assessment statuses
export function formatAssessmentStatus(status: AssessmentStatus): { label: string; badge: BadgeVariant } {
  // Map every possible assessment status to its display label and badge colour variant
  // Record<AssessmentStatus, ...> ensures we handle ALL possible statuses (TypeScript compile-time check)
  const statusMap: Record<AssessmentStatus, { label: string; badge: BadgeVariant }> = {
    DRAFT: { label: "Draft", badge: "default" },                                  // Grey - initial state
    MARKS_UPLOADED: { label: "Marks uploaded", badge: "info" },                    // Blue - marks added
    SAMPLE_GENERATED: { label: "Sample generated", badge: "warning" },             // Yellow - sample ready
    SUBMITTED_FOR_MODERATION: { label: "Submitted", badge: "warning" },            // Yellow - awaiting moderator
    IN_MODERATION: { label: "In moderation", badge: "info" },                      // Blue - moderator reviewing
    APPROVED: { label: "Approved", badge: "success" },                             // Green - moderation complete
    CHANGES_REQUESTED: { label: "Changes requested", badge: "danger" },            // Red - needs attention
    ESCALATED: { label: "Escalated", badge: "warning" },                           // Yellow - sent to third marker
  };
  // Look up the status in the map, fallback to default if somehow not found
  return statusMap[status] || { label: status, badge: "default" };
}
