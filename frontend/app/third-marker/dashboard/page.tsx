// Third Marker dashboard page - displays assessments that have been escalated for third marking
// Third marking occurs when the moderator cannot confirm the original marks (academic regulation Section 12.15-12.31)
// This is a thin page component that delegates rendering to the ThirdMarkerDashboard feature component

// Import the ThirdMarkerDashboard feature component from the third-marker features barrel export
// The @/ alias resolves to the project root directory, configured in tsconfig.json
import { ThirdMarkerDashboard } from "@/components/features/third-marker";

// Default export defines this as the page component for the /third-marker/dashboard route
// Next.js App Router automatically maps this file location to the URL path
export default function ThirdMarkerDashboardPage() {
  // Render the ThirdMarkerDashboard component which lists escalated assessments requiring review
  return <ThirdMarkerDashboard />;
}