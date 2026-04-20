// Moderator layout component - wraps all pages under the /moderator route with sidebar navigation
// This is a Server Component (no "use client") since it only renders static navigation links
// The moderator role is responsible for reviewing marking samples and confirming or escalating marks

// Import the Link component from Next.js for client-side navigation (no full page reloads)
import Link from "next/link";

// Default export makes this the layout for all /moderator/* routes
// The 'children' prop contains the currently active page within the moderator section
export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  return (
    // Outer container - full viewport height with light gray background
    <div className="min-h-screen bg-gray-50">
      {/* Flexbox row layout - sidebar on the left, main content area on the right */}
      <div className="flex">
        {/* Sidebar navigation panel - fixed 256px width, white background, right border separator */}
        {/* min-h-screen makes the sidebar stretch the full height of the viewport */}
        <aside className="w-64 border-r bg-white min-h-screen p-4">
          {/* Application abbreviation/logo in the sidebar header */}
          <div className="text-lg font-semibold">MMT</div>
          {/* Role indicator label - tells the user they are in the Moderator section */}
          <div className="mt-1 text-sm text-gray-600">Moderator</div>

          {/* Navigation links - space-y-2 adds 0.5rem gap between each link */}
          <nav className="mt-6 space-y-2">
            {/* Dashboard link - navigates to the moderator's main page showing assessments to review */}
            <Link
              href="/moderator/dashboard"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            {/* Sign out link - redirects to the login page to end the user session */}
            {/* text-red-600 colours the text red to visually indicate this is a logout action */}
            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100 text-red-600"
            >
              Sign out
            </Link>
          </nav>
        </aside>

        {/* Main content area - flex-1 takes up all remaining horizontal space */}
        {/* p-6 adds 1.5rem padding around the content */}
        {/* {children} renders the active moderator page (dashboard or assessment review) */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
