import { AssessmentReview } from "@/components/features/moderator";

export default async function ModeratorAssessmentReviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return <AssessmentReview assessmentId={assessmentId} />;
}

  