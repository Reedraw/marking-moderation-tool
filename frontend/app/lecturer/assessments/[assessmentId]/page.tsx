import { AssessmentDetail } from "@/components/features/lecturer";

export default async function LecturerAssessmentDetailPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  const { assessmentId } = params;
  
  return <AssessmentDetail assessmentId={assessmentId} />;
}
