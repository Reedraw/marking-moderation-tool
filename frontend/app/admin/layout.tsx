// Admin layout component - wraps all pages under the /admin route with a sidebar navigation
// This is a Server Component (no "use client") because it only renders static navigation links
// In Next.js App Router, layout files persist across page navigations within their route segment

// Import the Link component from Next.js for client-side navigation without full page reloads
import Link from "next/link";

// Default export makes this the layout for all /admin/* routes
// The 'children' prop contains the currently active page component within the admin section
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    // Outer container - ensures minimum full-screen height with a light gray background
    <div className="min-h-screen bg-gray-50">
      {/* Flexbox row layout - sidebar on the left, main content on the right */}
      <div className="flex">
        {/* Sidebar navigation panel - fixed width of 16rem (256px) */}
        {/* border-r adds a right border to visually separate sidebar from main content */}
        {/* min-h-screen ensures the sidebar stretches the full viewport height */}
        <aside className="w-64 border-r bg-white min-h-screen p-4">
          {/* Application abbreviation/logo text */}
          <div className="text-lg font-semibold">MMT</div>
          {/* Role indicator - shows which role section the user is in */}
          <div className="mt-1 text-sm text-gray-600">Admin</div>

          {/* Navigation links - space-y-2 adds 0.5rem vertical gap between each link */}
          <nav className="mt-6 space-y-2">
            {/* Dashboard link - navigates to the admin overview page */}
            {/* 'block' makes the link fill the full width for a larger click target */}
            {/* rounded-xl and hover:bg-gray-100 provide visual feedback on hover */}
            <Link
              href="/admin/dashboard"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            {/* Users management link - for viewing and managing user accounts */}
            <Link
              href="/admin/users"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Users
            </Link>

            {/* Modules management link - for managing academic modules/courses */}
            <Link
              href="/admin/modules"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Modules
            </Link>

            {/* Audit log link - for viewing system activity logs for compliance */}
            <Link
              href="/admin/audit-log"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Audit Log
            </Link>

            {/* Sign out link - navigates back to the login page */}
            {/* text-red-600 makes this link red to indicate it's a destructive/logout action */}
            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100 text-red-600"
            >
              Sign out
            </Link>
          </nav>
        </aside>

        {/* Main content area - flex-1 makes it expand to fill remaining horizontal space */}
        {/* p-6 adds 1.5rem padding around the page content */}
        {/* {children} renders the currently active admin page (dashboard, users, modules, etc.) */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
