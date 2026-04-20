// Third Marker assessment review page - displays the third marking review interface for an escalated assessment
// The [assessmentId] folder creates a dynamic route segment in Next.js App Router
// URL pattern: /third-marker/assessments/{assessmentId}
// Third markers independently review the entire sample when moderation escalation occurs

// Import the AssessmentReview feature component from the third-marker features module
// This component provides the independent review form and mark assessment interface
import { AssessmentReview } from "@/components/features/third-marker";

// Default export as an async Server Component - async is required to await the route params
// Next.js 15+ passes params as a Promise, requiring await before the values can be accessed
// The params prop is automatically provided by Next.js containing all dynamic route segments
export default async function ThirdMarkerAssessmentPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>; // TypeScript type: Promise resolving to object with assessmentId
}) {
  // Await the params Promise and destructure the assessmentId from the URL
  // e.g., /third-marker/assessments/abc-123 gives assessmentId = "abc-123"
  const { assessmentId } = await params;

  // Pass the assessmentId to the AssessmentReview component so it can fetch
  // the escalated assessment data and render the third marking review interface
  return <AssessmentReview assessmentId={assessmentId} />;
}
