// "use client" directive tells Next.js this component runs in the browser (client-side rendering)
// Required because we use React hooks (useState, useEffect) and browser-only APIs like navigation
"use client";

// Import React hooks: useState for managing component state, useEffect for running side effects on mount
import { useState, useEffect } from "react";
// Import Next.js Link component for client-side navigation between pages without full page reload
import Link from "next/link";
// Import useRouter hook from Next.js App Router for programmatic navigation (e.g., redirecting to login)
import { useRouter } from "next/navigation";
// Import the reusable Card UI component for consistent styled containers throughout the app
import { Card } from "@/components/ui";
// Import ApiError class to detect and handle structured API errors (status codes, detail messages)
import { ApiError } from "@/lib/auth";
// Import API functions to fetch moderator-specific data, and the Assessment type for TypeScript type safety
import { getModeratorQueue, getModeratorDashboardStats, type Assessment } from "@/lib/assessments-api";

// Main dashboard component for the moderator role - displays queue of assessments awaiting moderation
export function ModeratorDashboard() {
  // Next.js router instance for programmatic navigation (e.g., redirecting to /login on 401)
  const router = useRouter();
  // State: array of assessments assigned to this moderator for review, initially empty
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  // State: dashboard statistics (total, pending, in_moderation, escalated counts), initially null
  const [stats, setStats] = useState<any | null>(null);
  // State: loading flag, starts true and set to false once API data is fetched or errors
  const [loading, setLoading] = useState(true);
  // State: error message string to display to the user, null means no error
  const [error, setError] = useState<string | null>(null);

  // useEffect runs once on component mount (empty-ish dependency array) to fetch dashboard data
  useEffect(() => {
    // Async function to load both assessments list and statistics in parallel
    async function loadData() {
      try {
        // Promise.all fires both API requests simultaneously for faster loading
        // getModeratorQueue() fetches assessments assigned to this moderator
        // getModeratorDashboardStats() fetches summary counts (total, pending, in_moderation, escalated)
        const [assessmentsData, statsData] = await Promise.all([
          getModeratorQueue(),
          getModeratorDashboardStats(),
        ]);
        // Store the fetched assessments array in state to render the table
        setAssessments(assessmentsData);
        // Store the stats object in state to render the summary cards
        setStats(statsData);
      } catch (err) {
        // Check if the error is a structured API error with status code and detail
        if (err instanceof ApiError) {
          // 401 Unauthorized means the user's JWT token is expired or missing - redirect to login
          if (err.status === 401) {
            router.push("/login");
          } else {
            // For other API errors (403, 404, 500), display the error detail message
            setError(err.detail);
          }
        } else {
          // For unexpected non-API errors, extract message or show a generic fallback
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        // Always set loading to false whether the request succeeded or failed
        // This removes the loading spinner and shows either data or error
        setLoading(false);
      }
    }

    // Invoke the async data loading function
    loadData();
  }, [router]); // Dependency array includes router to satisfy React's exhaustive-deps rule

  // Helper function: converts a database status code (e.g., "SUBMITTED_FOR_MODERATION") to a human-readable label
  function getStatusDisplay(status: string): string {
    // Map of all possible assessment workflow statuses to user-friendly display text
    const statusMap: Record<string, string> = {
      DRAFT: "Draft",                                    // Assessment created but not yet submitted
      MARKS_UPLOADED: "Marks Uploaded",                  // Lecturer has uploaded student marks
      SAMPLE_GENERATED: "Sample Generated",              // System has auto-selected a moderation sample
      SUBMITTED_FOR_MODERATION: "Pending Moderation",    // Lecturer submitted assessment for moderator review
      IN_MODERATION: "In Moderation",                    // Moderator has started reviewing the assessment
      APPROVED: "Approved",                              // Moderator confirmed marks are appropriate
      CHANGES_REQUESTED: "Changes Requested",            // Moderator asked lecturer to revise marks
      ESCALATED: "Escalated",                            // Moderator escalated to third marker (Section 12.24)
    };
    // Return the mapped display name, or the raw status code if not found in the map
    return statusMap[status] || status;
  }

  // Helper function: returns Tailwind CSS classes for styling status badges with appropriate colours
  function getStatusClasses(status: string): string {
    // Each status gets a distinct background, text, and border colour for visual differentiation
    const classMap: Record<string, string> = {
      DRAFT: "bg-gray-50 text-gray-700 border-gray-200",              // Grey for inactive/draft
      MARKS_UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",      // Blue for uploaded
      SAMPLE_GENERATED: "bg-indigo-50 text-indigo-700 border-indigo-200", // Indigo for generated
      SUBMITTED_FOR_MODERATION: "bg-yellow-50 text-yellow-800 border-yellow-200", // Yellow for pending action
      IN_MODERATION: "bg-purple-50 text-purple-700 border-purple-200", // Purple for in-progress
      APPROVED: "bg-green-50 text-green-700 border-green-200",        // Green for approved/success
      CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",     // Red for issues found
      ESCALATED: "bg-indigo-50 text-indigo-700 border-indigo-200",    // Indigo for escalated to third marker
    };
    // Combine base badge styles (pill shape, padding, font) with the status-specific colour classes
    return `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${classMap[status] || ""}`;
  }

  // Main JSX return - renders the entire moderator dashboard UI
  return (
    // Outer container with vertical spacing between all child sections
    <div className="space-y-6">
      {/* Page header section with title and description */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Main page heading identifying this as the moderator's dashboard */}
          <h1 className="text-2xl font-semibold">Moderator Dashboard</h1>
          {/* Subtitle explaining the purpose of this page */}
          <p className="mt-1 text-sm text-gray-600">
            Review submitted assessments and record moderation outcomes.
          </p>
        </div>
      </header>

      {/* Conditional error banner - only renders if there's an error message in state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Conditional rendering: show loading spinner while data is being fetched */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      ) : (
        // Fragment wraps the stats cards and assessments table (shown after loading completes)
        <>
          {/* Statistics summary section - 4 cards in a responsive grid (1 col mobile, 4 cols desktop) */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Card 1: Total number of assessments in the moderator's queue */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">In queue</div>
                {/* Display total count from stats, fallback to 0 if stats haven't loaded */}
                <div className="mt-2 text-2xl font-semibold">{stats?.total || 0}</div>
              </div>
            </Card>

            {/* Card 2: Assessments submitted but not yet started by the moderator */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Pending</div>
                <div className="mt-2 text-2xl font-semibold">{stats?.pending || 0}</div>
              </div>
            </Card>

            {/* Card 3: Assessments the moderator is currently reviewing */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">In moderation</div>
                <div className="mt-2 text-2xl font-semibold">{stats?.in_moderation || 0}</div>
              </div>
            </Card>

            {/* Card 4: Assessments escalated to a third marker per Section 12.24 */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Escalated</div>
                <div className="mt-2 text-2xl font-semibold">{stats?.escalated || 0}</div>
              </div>
            </Card>
          </section>

          {/* Main assessments table wrapped in a Card for consistent styling */}
          <Card>
            {/* Table header row with title and total count */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Submitted assessments</h2>
              {/* Show the total number of assessments in the queue */}
              <div className="text-sm text-gray-600">{assessments.length} total</div>
            </div>

            {/* Horizontal scroll wrapper so the table doesn't break layout on small screens */}
            <div className="overflow-x-auto">
              {/* Data table listing all assessments assigned to this moderator */}
              <table className="w-full text-sm">
                {/* Table column headers */}
                <thead className="text-left text-gray-600">
                  <tr className="border-b">
                    <th className="px-5 py-3 font-medium">Module</th>
                    <th className="px-5 py-3 font-medium">Assessment</th>
                    <th className="px-5 py-3 font-medium">Submitted</th>
                    <th className="px-5 py-3 font-medium">Lecturer</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Sample</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Iterate over each assessment and render a table row */}
                  {assessments.map((a) => (
                    // Each row needs a unique key prop (assessment UUID) for React's reconciliation
                    <tr key={a.id} className="border-b last:border-b-0">
                      {/* Module info cell: code, name, and cohort on separate lines */}
                      <td className="px-5 py-4">
                        <div className="font-medium">{a.module_code}</div>
                        <div className="text-gray-600">{a.module_name}</div>
                        <div className="text-xs text-gray-500">{a.cohort}</div>
                      </td>

                      {/* Assessment title and truncated UUID for identification */}
                      <td className="px-5 py-4">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-gray-500">ID: {a.id}</div>
                      </td>

                      {/* Date the assessment was last updated (submitted/modified) */}
                      <td className="px-5 py-4">{a.updated_at}</td>

                      {/* Name of the lecturer who submitted this assessment, em dash if not available */}
                      <td className="px-5 py-4">{a.lecturer_name || "—"}</td>

                      {/* Status badge: uses helper functions for display text and colour styling */}
                      <td className="px-5 py-4">
                        <span className={getStatusClasses(a.status)}>
                          {getStatusDisplay(a.status)}
                        </span>
                      </td>

                      {/* Number of student submissions selected for the moderation sample */}
                      <td className="px-5 py-4">{a.sample_size || "—"}</td>

                      {/* Action button: navigates to the detailed moderation review page for this assessment */}
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          {/* Link to the individual assessment review page using the assessment's UUID */}
                          <Link
                            href={`/moderator/assessments/${a.id}`}
                            className="rounded-xl bg-black px-3 py-2 text-white hover:opacity-90"
                          >
                            Review
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Empty state: shown when no assessments are in the moderator's queue */}
                  {assessments.length === 0 && (
                    <tr>
                      {/* colSpan={7} spans all 7 columns to center the empty message */}
                      <td className="px-5 py-10 text-center text-gray-600" colSpan={7}>
                        No assessments are currently awaiting moderation.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

