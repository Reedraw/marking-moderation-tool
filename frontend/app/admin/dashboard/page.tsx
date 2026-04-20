// Admin dashboard page - renders the admin overview/dashboard view
// This is a thin "page" component that delegates rendering to a feature component
// This pattern separates routing concerns (pages) from business logic (feature components)

// Import the AdminDashboard feature component which contains the actual dashboard UI and logic
// The @/ alias maps to the project root (configured in tsconfig.json), avoiding relative path imports
import { AdminDashboard } from "@/components/features/admin";

// Default export defines this as the page component for the /admin/dashboard route
// Next.js App Router automatically maps this file's location to the URL path
export default function AdminDashboardPage() {
  // Render the AdminDashboard feature component which handles all dashboard display logic
  // The page component acts as a thin wrapper - keeping pages simple and logic in components
  return <AdminDashboard />;
}
