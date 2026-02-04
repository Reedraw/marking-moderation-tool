import { AssessmentReview } from "@/components/features/third-marker";

export default async function ThirdMarkerAssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return <AssessmentReview assessmentId={assessmentId} />;
}

 
