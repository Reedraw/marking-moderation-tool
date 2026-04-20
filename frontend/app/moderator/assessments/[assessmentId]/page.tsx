// Moderator assessment review page - displays the moderation review interface for a specific assessment
// The [assessmentId] folder creates a dynamic route, so this page handles any assessment ID in the URL
// URL pattern: /moderator/assessments/{assessmentId}

// Import the AssessmentReview feature component from the moderator features module
// This component contains the moderation form, sample review, and mark confirmation UI
import { AssessmentReview } from "@/components/features/moderator";

// Default export as an async Server Component - required to await the dynamic route params
// Next.js 15+ passes params as a Promise, so the function must be async to use 'await'
// The params prop is automatically injected by Next.js and contains the dynamic URL segments
export default async function ModeratorAssessmentReviewPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>; // TypeScript type: Promise with assessmentId string
}) {
  // Await the params Promise and destructure the assessmentId
  // e.g., visiting /moderator/assessments/abc-123 gives assessmentId = "abc-123"
  const { assessmentId } = await params;

  // Pass the assessmentId to the AssessmentReview component so it can fetch
  // and display the specific assessment's sample, marks, and moderation form
  return <AssessmentReview assessmentId={assessmentId} />;
}