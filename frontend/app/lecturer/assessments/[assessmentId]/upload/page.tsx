// Lecturer upload marks page - allows lecturers to upload student marks for a specific assessment
// This is a nested route under [assessmentId], so it has access to the assessment's dynamic parameter
// URL pattern: /lecturer/assessments/{assessmentId}/upload

// Import the UploadMarks feature component which provides the file upload UI and mark entry form
import { UploadMarks } from "@/components/features/lecturer";

// Default export as an async Server Component - awaits the dynamic route params from Next.js
// The 'params' prop is automatically injected by Next.js containing all dynamic route segments
// In Next.js 15+, params is a Promise that must be awaited before accessing its values
export default async function LecturerUploadMarksPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>; // TypeScript type: Promise resolving to object with assessmentId
}) {
  // Await and destructure the assessmentId from the route parameters
  // e.g., /lecturer/assessments/uuid-here/upload -> assessmentId = "uuid-here"
  const { assessmentId } = await params;

  // Render the UploadMarks feature component, passing the assessmentId so it knows
  // which assessment the uploaded marks should be associated with
  return <UploadMarks assessmentId={assessmentId} />;
}
