// Lecturer layout component - wraps all pages under the /lecturer route with sidebar navigation
// This is a Server Component (no "use client") since it only renders static navigation links
// Layout files in Next.js persist across navigations - the sidebar stays mounted while pages change

// Import the Link component from Next.js for client-side navigation without full page reloads
import Link from "next/link";

// Default export makes this the layout for all /lecturer/* routes
// The 'children' prop contains the currently active page within the lecturer section
export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  return (
    // Outer container - full viewport height with light gray background
    <div className="min-h-screen bg-gray-50">
      {/* Flexbox row layout - sidebar and main content sit side by side */}
      <div className="flex">
        {/* Sidebar navigation - fixed 256px width with a right border separator */}
        {/* min-h-screen ensures the sidebar extends the full viewport height */}
        <aside className="w-64 border-r bg-white min-h-screen p-4">
          {/* Application abbreviation displayed as the sidebar header/logo */}
          <div className="text-lg font-semibold">MMT</div>
          {/* Role indicator - shows the user they are in the Lecturer section */}
          <div className="mt-1 text-sm text-gray-600">Lecturer</div>

          {/* Navigation links - space-y-2 adds 0.5rem vertical gap between links */}
          <nav className="mt-6 space-y-2">
            {/* Dashboard link - navigates to the lecturer's main overview page */}
            {/* Lecturers see their assessments and can create new ones from the dashboard */}
            <Link
              href="/lecturer/dashboard"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            {/* Sign out link - redirects to login page to end the session */}
            {/* text-red-600 visually distinguishes this as a logout/destructive action */}
            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100 text-red-600"
            >
              Sign out
            </Link>
          </nav>
        </aside>

        {/* Main content area - flex-1 makes it fill all remaining horizontal space */}
        {/* p-6 adds padding around the page content for visual breathing room */}
        {/* {children} renders the active lecturer page (dashboard, assessment detail, upload, etc.) */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
