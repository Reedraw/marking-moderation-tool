import { AssessmentDetail } from "@/components/features/lecturer";

export default async function LecturerAssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  
  return <AssessmentDetail assessmentId={assessmentId} />;
}
