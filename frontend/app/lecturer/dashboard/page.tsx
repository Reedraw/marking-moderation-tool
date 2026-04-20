// Lecturer dashboard page - renders the lecturer's main overview/dashboard view
// This is a thin "page" component that delegates all rendering to a feature component
// Keeps routing logic separate from business/UI logic following component separation pattern

// Import the LecturerDashboard feature component from the lecturer features barrel export
// The @/ alias resolves to the project root directory (configured in tsconfig.json)
import { LecturerDashboard } from "@/components/features/lecturer";

// Default export defines this as the page component for the /lecturer/dashboard route
// Next.js automatically maps the file path app/lecturer/dashboard/page.tsx to this URL
export default function LecturerDashboardPage() {
  // Render the LecturerDashboard component which contains assessment listings and actions
  return <LecturerDashboard />;
}
