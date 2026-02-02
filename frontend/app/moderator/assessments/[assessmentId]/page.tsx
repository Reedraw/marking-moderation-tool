import { AssessmentReview } from "@/components/features/moderator";

export default function ModeratorAssessmentReviewPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  const { assessmentId } = params;

  return <AssessmentReview assessmentId={assessmentId} />;
}

  // GET /api/moderator/assessments/{assessmentId}
  // Response: {
  //   assessment_id,
  //   module_code, module_name, assessment_title, cohort, due_date,
  //   lecturer_name,
  //   status,
  //   lecturer_comment?: string,
  //   sample: { size, method, percent, students: [{ student_id, mark, marker_id, flagged? }] }
  // }

 

  // TODO API CONTRACT (FastAPI)
  // POST /api/moderator/assessments/{assessmentId}/decision
  // Body: {
  //   decision: "approve"|"request_changes"|"escalate",
  //   comment: string,
  //   flags?: [{ student_id, reason }]
  // }
  // Response: { status: "approved"|"changes_requested"|"escalated" }

  