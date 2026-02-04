import { BadgeVariant } from "@/components/ui";
import { AssessmentStatus } from "@/types/assessment";

export function formatAssessmentStatus(status: AssessmentStatus): { label: string; badge: BadgeVariant } {
  const statusMap: Record<AssessmentStatus, { label: string; badge: BadgeVariant }> = {
    DRAFT: { label: "Draft", badge: "default" },
    MARKS_UPLOADED: { label: "Marks uploaded", badge: "info" },
    SAMPLE_GENERATED: { label: "Sample generated", badge: "warning" },
    SUBMITTED_FOR_MODERATION: { label: "Submitted", badge: "warning" },
    IN_MODERATION: { label: "In moderation", badge: "info" },
    APPROVED: { label: "Approved", badge: "success" },
    CHANGES_REQUESTED: { label: "Changes requested", badge: "danger" },
    ESCALATED: { label: "Escalated", badge: "warning" },
  };
  return statusMap[status] || { label: status, badge: "default" };
}
