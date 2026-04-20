// Third Marker layout component - wraps all pages under the /third-marker route with sidebar navigation
// The Third Marker is an escalation-only role per academic regulations (Section 12.15-12.31)
// They provide independent review when the moderator cannot confirm the original marks
// This is a Server Component - no "use client" needed since it only renders static links

// Import the Link component from Next.js for client-side navigation
import Link from "next/link";

// Default export makes this the layout for all /third-marker/* routes
// The 'children' prop contains whatever page is currently active within this route segment
export default function ThirdMarkerLayout({ children }: { children: React.ReactNode }) {
  return (
    // Outer container - full viewport height with light gray background
    <div className="min-h-screen bg-gray-50">
      {/* Flexbox row layout - sidebar on the left, main content on the right */}
      <div className="flex">
        {/* Sidebar navigation panel - fixed 256px width, white background */}
        {/* border-r adds a right border separator between sidebar and main content */}
        <aside className="w-64 border-r bg-white min-h-screen p-4">
          {/* Application abbreviation/logo */}
          <div className="text-lg font-semibold">MMT</div>
          {/* Role indicator - shows the user they are in the Third Marker section */}
          <div className="mt-1 text-sm text-gray-600">Third Marker</div>

          {/* Navigation links - space-y-2 adds vertical spacing between links */}
          <nav className="mt-6 space-y-2">
            {/* Dashboard link - navigates to the third marker's main page with escalated assessments */}
            <Link
              href="/third-marker/dashboard"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            {/* Sign out link - red text indicates this is a logout/destructive action */}
            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100 text-red-600"
            >
              Sign out
            </Link>
          </nav>

          {/* Informational box explaining the third marker's role in the moderation process */}
          {/* This helps users understand that third marking is only triggered by escalation */}
          {/* rounded-xl border bg-gray-50 creates a subtle card-like container */}
          <div className="mt-8 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
            Escalation-only role.
            {/* Additional context about the quality assurance purpose of third marking */}
            <div className="mt-1">Independent review for quality assurance.</div>
          </div>
        </aside>

        {/* Main content area - flex-1 fills all remaining horizontal space */}
        {/* p-6 adds padding around the page content */}
        {/* {children} renders the active third-marker page (dashboard or assessment review) */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
