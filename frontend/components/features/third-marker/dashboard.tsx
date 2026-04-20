// "use client" directive tells Next.js this component runs in the browser (client-side rendering)
// Required because we use React hooks (useState, useEffect) and browser navigation
"use client";

// Import React hooks: useState for managing component state, useEffect for side effects on mount
import { useState, useEffect } from "react";
// Import Next.js Link component for client-side navigation without full page reloads
import Link from "next/link";
// Import useRouter hook from Next.js App Router for programmatic navigation (e.g., redirect on 401)
import { useRouter } from "next/navigation";
// Import the reusable Card UI component for consistent styled containers
import { Card } from "@/components/ui";
// Import ApiError class to detect and handle structured API errors with status codes
import { ApiError } from "@/lib/api-client";
// Import the API function to fetch escalated assessments assigned to this third marker, plus the Assessment type
import { getThirdMarkerQueue, type Assessment } from "@/lib/assessments-api";

// Main dashboard component for the third marker role - shows assessments escalated from moderation
// Per Section 12.24: third marking happens when moderator cannot confirm marks are appropriate
export function ThirdMarkerDashboard() {
  // Next.js router instance for programmatic navigation (redirect to /login on authentication failure)
  const router = useRouter();
  // State: array of escalated assessments assigned to this third marker, initially empty
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  // State: loading flag, starts true and set to false once API data is fetched or errors occur
  const [loading, setLoading] = useState(true);
  // State: error message string to display to the user, null means no error
  const [error, setError] = useState<string | null>(null);

  // useEffect runs once on component mount to fetch the third marker's queue of escalated assessments
  useEffect(() => {
    // Async function to load escalated assessments from the backend API
    async function loadData() {
      try {
        // Fetch all assessments escalated to this third marker from the backend
        const data = await getThirdMarkerQueue();
        // Store the fetched assessments in state to render the table
        setAssessments(data);
      } catch (err) {
        // Check if the error is a structured API error with a status code
        if (err instanceof ApiError) {
          // 401 Unauthorized means the JWT token is expired or missing - redirect to login page
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
        setLoading(false);
      }
    }

    // Invoke the async data loading function
    loadData();
  }, [router]); // Dependency array includes router to satisfy React's exhaustive-deps lint rule

  // Helper function: formats an ISO date string into a readable UK format like "20 Apr 2026"
  function formatDate(dateString: string | undefined | null): string {
    // Return em dash if the date is missing, undefined, or null
    if (!dateString) return "—";
    // Parse the ISO string into a Date object and format it with UK locale (day month year)
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",   // Two-digit day (e.g., "20")
      month: "short",   // Abbreviated month name (e.g., "Apr")
      year: "numeric",  // Full year (e.g., "2026")
    });
  }

  // Main JSX return - renders the third marker dashboard UI
  return (
    // Outer container with vertical spacing between all child sections
    <div className="space-y-6">
      {/* Page header with title and description */}
      <header>
        {/* Main page heading identifying this as the third marker's dashboard */}
        <h1 className="text-2xl font-semibold">Third Marker Dashboard</h1>
        {/* Subtitle explaining the purpose - third markers independently review escalated cases */}
        <p className="mt-1 text-sm text-gray-600">
          Independent review of escalated assessments.
        </p>
      </header>

      {/* Conditional error banner - only renders when there's an error message in state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Conditional rendering: show loading spinner while data is being fetched from the API */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      ) : (
        // Main content card shown after loading completes
        <Card className="">
          {/* Table header row showing title and total count of escalated assessments */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-lg font-semibold">Escalated assessments</h2>
            <div className="text-sm text-gray-600">{assessments.length} total</div>
          </div>

          {/* Horizontal scroll wrapper to prevent table from breaking layout on narrow screens */}
          <div className="overflow-x-auto">
            {/* Data table listing all escalated assessments assigned to this third marker */}
            <table className="w-full text-sm">
              {/* Table column headers */}
              <thead className="text-left text-gray-600">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Module</th>
                  <th className="px-5 py-3 font-medium">Assessment</th>
                  <th className="px-5 py-3 font-medium">Escalated</th>
                  <th className="px-5 py-3 font-medium">Lecturer</th>
                  <th className="px-5 py-3 font-medium">Moderator</th>
                  <th className="px-5 py-3 font-medium">Sample</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {/* Iterate over each escalated assessment and render a table row */}
                {assessments.map((a) => (
                  // Each row needs a unique key prop (assessment UUID) for React's reconciliation algorithm
                  <tr key={a.id} className="border-b last:border-b-0">
                    {/* Module info cell: code, name, and cohort displayed on separate lines */}
                    <td className="px-5 py-4">
                      <div className="font-medium">{a.module_code}</div>
                      <div className="text-gray-600">{a.module_name}</div>
                      <div className="text-xs text-gray-500">{a.cohort}</div>
                    </td>

                    {/* Assessment title and truncated UUID (first 8 chars) for quick identification */}
                    <td className="px-5 py-4">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-gray-500">ID: {a.id.substring(0, 8)}...</div>
                    </td>

                    {/* Date the assessment was escalated, formatted using the formatDate helper */}
                    <td className="px-5 py-4">{formatDate(a.escalated_at)}</td>

                    {/* Name of the original lecturer, em dash if not available */}
                    <td className="px-5 py-4">{a.lecturer_name || "—"}</td>

                    {/* Name of the moderator who escalated this assessment, em dash if not available */}
                    <td className="px-5 py-4">{a.moderator_name || "—"}</td>

                    {/* Number of student submissions in the moderation sample */}
                    <td className="px-5 py-4">{a.sample_size || 0}</td>

                    {/* Action button: navigates to the detailed third marker review page */}
                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        {/* Link to the individual third marker review page using the assessment's UUID */}
                        <Link
                          href={`/third-marker/assessments/${a.id}`}
                          className="rounded-xl bg-black px-3 py-2 text-white hover:opacity-90"
                        >
                          Review
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Empty state: shown when no escalated assessments are assigned to this third marker */}
                {assessments.length === 0 && (
                  <tr>
                    {/* colSpan={7} spans all 7 columns to center the empty state message */}
                    <td className="px-5 py-10 text-center text-gray-600" colSpan={7}>
                      No escalations assigned.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
