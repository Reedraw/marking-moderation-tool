// Moderator dashboard page - displays the moderator's overview of assessments awaiting review
// This is a thin page component that delegates rendering to the ModeratorDashboard feature component
// Keeps routing (page files) separate from business logic (feature components)

// Import the ModeratorDashboard feature component from the moderator features barrel export
// The @/ alias resolves to the project root (configured in tsconfig.json)
import { ModeratorDashboard } from "@/components/features/moderator";

// Default export defines this as the page component for the /moderator/dashboard route
// Next.js App Router maps the file path app/moderator/dashboard/page.tsx to this URL
export default function ModeratorDashboardPage() {
  // Render the ModeratorDashboard component which lists assessments submitted for moderation
  return <ModeratorDashboard />;
}
