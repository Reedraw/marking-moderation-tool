// Lecturer assessment detail page - displays detailed view of a specific assessment
// This is an async Server Component that extracts the dynamic route parameter before rendering
// The [assessmentId] folder name creates a dynamic route segment in Next.js App Router

// Import the AssessmentDetail feature component which renders the full assessment view
import { AssessmentDetail } from "@/components/features/lecturer";

// Default export as an async function - this is a Server Component that awaits the route params
// The 'async' keyword is needed because Next.js 15+ passes params as a Promise that must be awaited
// The 'params' prop is automatically provided by Next.js and contains the dynamic route segments
// TypeScript type annotation defines params as a Promise resolving to an object with assessmentId string
export default async function LecturerAssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  // Await the params Promise to extract the assessmentId from the URL
  // For example, visiting /lecturer/assessments/abc-123 gives assessmentId = "abc-123"
  // Destructuring extracts just the assessmentId property from the resolved params object
  const { assessmentId } = await params;
  
  // Pass the extracted assessmentId string to the AssessmentDetail feature component
  // The component uses this ID to fetch and display the specific assessment's data
  return <AssessmentDetail assessmentId={assessmentId} />;
}
