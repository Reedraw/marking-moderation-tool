import { AssessmentReview } from "@/components/features/third-marker";

export default function ThirdMarkerAssessmentPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  const { assessmentId } = params;

  return <AssessmentReview assessmentId={assessmentId} />;
}

  // GET /api/third-marker/assessments/{assessmentId}
  // Response: {
  //   assessment_id,
  //   module_code, module_name, assessment_title, cohort,
  //   lecturer_name, moderator_name,
  //   lecturer_comment?, moderator_comment?,
  //   sample: { size, students: [{ student_id, mark, marker_id }] }
  // }

  

  // TODO API CONTRACT (FastAPI)
  // POST /api/third-marker/assessments/{assessmentId}/decision
  // Body: {
  //   decision: "confirm"|"override"|"refer_back",
  //   comment: string
  // }
  // Response: { final_status }

 
