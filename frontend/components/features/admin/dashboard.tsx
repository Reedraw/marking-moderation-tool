// "use client" directive tells Next.js this component runs in the browser (client-side)
// This is required because we use React hooks (useState, useEffect) and browser-only APIs
// Without this, Next.js would try to render this as a server component and hooks would fail
"use client";

// Import useState (for reactive state variables) and useEffect (for side effects on mount/update) from React
// These are the two core hooks that power this component's data fetching and UI state management
import { useState, useEffect } from "react";
// Import Link component from Next.js for client-side navigation without full page reloads
// Used if we need to create navigable links within the dashboard (Next.js prefetches linked pages)
import Link from "next/link";
// Import useRouter hook from Next.js App Router for programmatic navigation
// We use this to redirect unauthenticated users (401 errors) to the login page
import { useRouter } from "next/navigation";
// Import the reusable Card UI component from our shared UI library
// Card provides a consistent bordered container used throughout the dashboard for stats sections
import { Card } from "@/components/ui";
// Import the ApiError class which is a custom error type thrown by our API client
// It contains HTTP status codes and error details so we can handle 401s differently from other errors
import { ApiError } from "@/lib/auth";
// Import API functions and TypeScript types for the admin dashboard data
// getAdminStats: fetches system-wide statistics (assessment counts, user counts, recent activity)
// getAuditEvents: fetches the audit trail log entries for compliance/oversight
// AdminStats: TypeScript type defining the shape of the stats response object
// AuditEvent: TypeScript type defining the shape of a single audit log entry
import { getAdminStats, getAuditEvents, type AdminStats, type AuditEvent } from "@/lib/assessments-api";

// Named export of the AdminDashboard React functional component
// Named exports (vs default) allow consistent imports and better refactoring support across the codebase
export function AdminDashboard() {
  // Get the Next.js router instance for programmatic navigation (e.g., redirecting to /login on auth failure)
  const router = useRouter();
  // React state to hold the admin statistics data fetched from the API
  // Initially null because data hasn't been loaded yet; AdminStats | null type reflects this
  const [stats, setStats] = useState<AdminStats | null>(null);
  // React state to hold the array of audit event log entries
  // Initialized as empty array since we know it will always be a list (even if empty)
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  // React state to track whether data is currently being fetched from the API
  // Starts as true because we begin loading immediately when the component mounts
  const [loading, setLoading] = useState(true);
  // React state to hold any error message string to display to the user
  // null means no error; a string value triggers the error banner in the UI
  const [error, setError] = useState<string | null>(null);

  // useEffect hook runs the data-fetching side effect when the component first mounts
  // The [router] dependency array means this effect re-runs if the router instance changes
  // (in practice it runs once on mount since router is stable)
  useEffect(() => {
    // Define an async function inside useEffect because useEffect callbacks cannot be async directly
    // This is the standard React pattern for async data fetching in effects
    async function loadData() {
      try {
        // Fetch both admin stats and audit events in parallel using Promise.all for efficiency
        // This fires both API requests simultaneously rather than waiting for one to finish before starting the other
        // Destructuring assigns the results to statsData and auditData respectively
        const [statsData, auditData] = await Promise.all([
          // Call the API function to get system-wide admin statistics (assessment counts, user counts, activity)
          getAdminStats(),
          // Call the API function to get the 20 most recent audit events for the audit trail table
          getAuditEvents(20),
        ]);
        // Update the stats state with the fetched data, triggering a re-render with the real numbers
        setStats(statsData);
        // Update the auditEvents state with the fetched audit log entries
        setAuditEvents(auditData);
      } catch (err) {
        // Check if the error is an instance of our custom ApiError class (thrown by our API client)
        // ApiError has structured fields like status code and detail message
        if (err instanceof ApiError) {
          // If HTTP 401 Unauthorized, the user's session has expired or they aren't logged in
          // Redirect them to the login page so they can re-authenticate
          if (err.status === 401) {
            router.push("/login");
          } else {
            // For other API errors (403, 500, etc.), display the server's error detail message to the user
            setError(err.detail);
          }
        } else {
          // For non-API errors (network failures, unexpected exceptions), show a generic error message
          // Uses instanceof Error check to safely access .message, with a fallback string
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        // Always set loading to false when done, whether the request succeeded or failed
        // This ensures the loading spinner is removed and the UI shows either data or an error
        setLoading(false);
      }
    }

    // Invoke the async loadData function we just defined
    // This kicks off the API calls as soon as the component mounts
    loadData();
  }, [router]); // Dependency array: re-run effect if router changes (stable in practice, included for ESLint rules)

  // Helper function to format an ISO timestamp string into a human-readable UK date format
  // Takes a raw timestamp like "2026-04-20T14:30:00Z" and returns "20 Apr 2026, 14:30"
  // Used in the audit events table to display when each event occurred
  function formatTimestamp(timestamp: string): string {
    // Create a JavaScript Date object from the ISO timestamp string
    const date = new Date(timestamp);
    // Use the built-in Intl date formatter with British English locale ("en-GB")
    // This ensures day-first format (20 Apr 2026) which is standard in UK higher education
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",    // Two-digit day: "20"
      month: "short",    // Abbreviated month name: "Apr"
      year: "numeric",   // Full year: "2026"
      hour: "2-digit",   // Two-digit hour: "14"
      minute: "2-digit", // Two-digit minute: "30"
    });
  }

  // Helper function that returns Tailwind CSS classes for styling role badges in the audit trail
  // Each role gets a distinct color scheme so admins can quickly visually scan who did what
  // Returns border + background + text color classes for the role badge
  function getRoleClasses(role: string): string {
    // Lookup object mapping each user role to its corresponding Tailwind color classes
    // Record<string, string> type means keys and values are both strings
    const classMap: Record<string, string> = {
      lecturer: "bg-blue-50 text-blue-700 border-blue-200",         // Blue theme for lecturers (primary markers)
      moderator: "bg-purple-50 text-purple-700 border-purple-200",   // Purple theme for moderators (reviewers)
      third_marker: "bg-indigo-50 text-indigo-700 border-indigo-200", // Indigo theme for third markers (escalation reviewers)
      admin: "bg-gray-50 text-gray-700 border-gray-200",             // Gray theme for admin users
    };
    // Return the matching classes for the role, or default gray classes if role is unknown
    // The fallback prevents crashes if a new role is added to the backend but not yet to this map
    return classMap[role] || "bg-gray-50 text-gray-700 border-gray-200";
  }

  // Extract the by_status object from stats for convenient access throughout the JSX
  // Uses optional chaining (?.) because stats may be null before data loads
  // Falls back to empty object {} so we can safely access status properties without null checks
  const byStatus = stats?.by_status || {};

  // Begin the JSX return — this is the component's rendered output (the actual UI)
  return (
    // Outer container div with Tailwind "space-y-6" adding 1.5rem vertical gap between all direct children
    // This creates consistent spacing between the header, stats cards, and audit trail sections
    <div className="space-y-6">
      {/* Page header section: flexbox layout with title on left, space for future actions on right */}
      {/* "items-start" aligns children to top, "justify-between" pushes them apart, "gap-4" adds spacing */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Main page heading — text-2xl for large size, font-semibold for medium-bold weight */}
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          {/* Subtitle description — smaller text (text-sm) in gray to provide context without visual dominance */}
          <p className="mt-1 text-sm text-gray-600">
            System overview and audit visibility.
          </p>
        </div>
      </header>

      {/* Conditional error banner: only renders if the error state is truthy (non-null string) */}
      {/* Uses red color scheme (border, background, text) to clearly signal something went wrong */}
      {/* rounded-xl gives large border radius for modern card-like appearance */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {/* Display the error message string stored in state */}
          {error}
        </div>
      )}

      {/* Conditional rendering: show loading spinner while data is being fetched, or the actual dashboard content */}
      {/* This ternary operator (condition ? trueCase : falseCase) is the standard React pattern for loading states */}
      {loading ? (
        // Loading state: centered text indicator shown while API requests are in progress
        // flex + items-center + justify-center centers the text both horizontally and vertically
        // p-12 adds generous padding so the loading area has visual presence
        <div className="flex items-center justify-center p-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      ) : (
        // Fragment (<>...</>) wraps multiple sibling elements without adding an extra DOM node
        // Used here because JSX requires a single parent element, but we don't want an extra wrapper div
        <>
          {/* ===== TOP-LEVEL SUMMARY CARDS SECTION ===== */}
          {/* Grid layout: 1 column on mobile (grid-cols-1), 4 columns on medium+ screens (md:grid-cols-4) */}
          {/* gap-4 adds consistent spacing between grid items. This is the key metrics row at the top */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Card 1: Total assessments count — gives admin an at-a-glance view of system volume */}
            <Card>
              <div className="p-4">
                {/* Label text in small gray — describes what the number below represents */}
                <div className="text-sm text-gray-600">Total assessments</div>
                {/* The actual count value — large and bold for quick scanning */}
                {/* Optional chaining (?.) safely accesses total_assessments even if stats is null */}
                {/* "|| 0" provides a fallback of 0 if the value is undefined/null/0 */}
                <div className="mt-2 text-2xl font-semibold">{stats?.total_assessments || 0}</div>
              </div>
            </Card>

            {/* Card 2: Pending moderation count — sum of SUBMITTED_FOR_MODERATION and IN_MODERATION statuses */}
            {/* These two statuses represent assessments waiting for or currently undergoing moderator review */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Pending moderation</div>
                {/* Add both pending statuses together to show total workload awaiting moderator action */}
                <div className="mt-2 text-2xl font-semibold">{(byStatus.SUBMITTED_FOR_MODERATION || 0) + (byStatus.IN_MODERATION || 0)}</div>
              </div>
            </Card>

            {/* Card 3: Escalations count — assessments that need third marker intervention */}
            {/* Per academic regulations Section 12.15-12.31, escalation happens when moderator can't confirm marks */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Escalations</div>
                {/* Count of assessments in ESCALATED status */}
                <div className="mt-2 text-2xl font-semibold">{byStatus.ESCALATED || 0}</div>
                {/* Small explanatory note beneath the number for clarity */}
                <div className="mt-1 text-xs text-gray-500">Third marker required</div>
              </div>
            </Card>

            {/* Card 4: Approved count — assessments that have completed the moderation process successfully */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Approved</div>
                <div className="mt-2 text-2xl font-semibold">{byStatus.APPROVED || 0}</div>
              </div>
            </Card>
          </section>

          {/* ===== WORKFLOW STATUS BREAKDOWN SECTION ===== */}
          {/* Detailed breakdown card showing assessment counts at every stage of the moderation workflow */}
          {/* This maps to the assessment lifecycle: Draft → Submitted → In Moderation → Changes/Approved/Escalated */}
          <Card>
            <div className="p-5">
              {/* Section title */}
              <h2 className="text-lg font-semibold">Workflow status breakdown</h2>
              {/* Section description explaining what this data represents */}
              <p className="mt-1 text-sm text-gray-600">
                Snapshot of assessments by moderation workflow stage.
              </p>

              {/* 6-column grid for the workflow stages: 1 col on mobile, 6 cols on md+ screens */}
              {/* Each cell represents one stage in the assessment moderation pipeline */}
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
                {/* Draft: assessments created but marks not yet uploaded by the lecturer */}
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Draft</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.DRAFT || 0}</div>
                </div>
                {/* Pending: marks uploaded and submitted, waiting for moderator to begin review */}
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Pending</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.SUBMITTED_FOR_MODERATION || 0}</div>
                </div>
                {/* In moderation: moderator has started reviewing the sample but hasn't made a decision yet */}
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">In moderation</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.IN_MODERATION || 0}</div>
                </div>
                {/* Changes requested: moderator reviewed but asked lecturer to revise marks or feedback */}
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Changes req.</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.CHANGES_REQUESTED || 0}</div>
                </div>
                {/* Approved: moderation complete, marks confirmed as appropriate */}
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Approved</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.APPROVED || 0}</div>
                </div>
                {/* Escalated: moderator couldn't confirm marks, escalated to third marker per Section 12.15-12.31 */}
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Escalated</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.ESCALATED || 0}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* ===== USERS AND ACTIVITY SIDE-BY-SIDE SECTION ===== */}
          {/* Two-column grid: Users card on left, Activity card on right */}
          {/* On mobile (grid-cols-1) they stack vertically; on md+ screens (md:grid-cols-2) they sit side by side */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* ---- Users Card: shows active user counts broken down by role ---- */}
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold">Users</h2>
                {/* Subtitle explaining this shows user accounts grouped by their system role */}
                <p className="mt-1 text-sm text-gray-600">Active accounts by role.</p>

                {/* 2x2 grid of user role counts */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {/* Total active users across all roles */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Active users</div>
                    {/* Optional chaining through stats?.users safely handles null stats */}
                    <div className="mt-2 text-xl font-semibold">{stats?.users.active_users || 0}</div>
                  </div>
                  {/* Count of users with the lecturer role (primary markers who create assessments) */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Lecturers</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.users.lecturers || 0}</div>
                  </div>
                  {/* Count of users with the moderator role (internal reviewers who check marking quality) */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Moderators</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.users.moderators || 0}</div>
                  </div>
                  {/* Count of users with the third_marker role (called in when moderator escalates) */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Third markers</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.users.third_markers || 0}</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ---- Activity Card: shows operational metrics from the last 24 hours ---- */}
            {/* Helps admin spot unusual patterns (e.g., zero uploads might indicate a system issue) */}
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold">Activity (last 24 hours)</h2>
                {/* Subtitle clarifying these are recent operational signals */}
                <p className="mt-1 text-sm text-gray-600">Operational signals for admin oversight.</p>

                {/* 3-column grid for the three activity metrics */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {/* Uploads: number of mark uploads by lecturers in the last 24 hours */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Uploads</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.activity_last_24h.uploads || 0}</div>
                  </div>
                  {/* Submissions: number of assessments submitted for moderation in the last 24 hours */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Submissions</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.activity_last_24h.submissions || 0}</div>
                  </div>
                  {/* Decisions: number of moderation decisions (approve/reject/escalate) in the last 24 hours */}
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Decisions</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.activity_last_24h.decisions || 0}</div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          {/* ===== AUDIT EVENTS TABLE SECTION ===== */}
          {/* This is the audit trail — a key compliance feature for academic quality assurance */}
          {/* Every significant action in the system is logged here for accountability and transparency */}
          <Card>
            {/* Table header row with title, styled with a bottom border to separate from the event list */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Recent audit events</h2>
            </div>

            {/* Container for event rows — "divide-y" adds a horizontal line between each child element */}
            {/* This creates a clean visual separation between audit entries without explicit border styling */}
            <div className="divide-y">
              {/* Map over the auditEvents array to render one row per audit event */}
              {/* .map() transforms each AuditEvent object into a JSX element for the list */}
              {auditEvents.map((e) => (
                // Each event row: key={e.id} is required by React for efficient list re-rendering
                // React uses keys to track which items changed, were added, or removed
                // Flexbox layout with items at the start, content justified between action text and role badge
                <div key={e.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    {/* The action name/description — e.g., "MARKS_UPLOADED", "MODERATION_APPROVED" */}
                    <div className="text-sm font-medium">{e.action}</div>
                    {/* Metadata line: timestamp, who did it (actor_name), and which assessment it relates to */}
                    {/* Uses bullet character (•) as visual separator between metadata items */}
                    <div className="mt-1 text-xs text-gray-600">
                      {/* Format the raw ISO timestamp into readable UK date format using our helper function */}
                      {formatTimestamp(e.timestamp)} • {e.actor_name} •{" "}
                      {/* Ternary: show assessment ID if the event relates to one, otherwise show "System" */}
                      {/* Some events (like user creation) are system-level and don't have an assessment_id */}
                      {e.assessment_id ? `Assessment ${e.assessment_id}` : "System"}
                    </div>
                  </div>
                  {/* Role badge: colored label showing the actor's role (lecturer, moderator, etc.) */}
                  {/* getRoleClasses() returns the appropriate Tailwind color classes for the role */}
                  <span className={getRoleClasses(e.actor_role)}>
                    {/* Replace underscores with spaces for display: "third_marker" becomes "third marker" */}
                    {e.actor_role.replace("_", " ")}
                  </span>
                </div>
              ))}

              {/* Empty state: shown when there are no audit events to display */}
              {/* This prevents the section from being completely blank, which could confuse users */}
              {auditEvents.length === 0 && (
                <div className="px-5 py-10 text-center text-gray-600">
                  No recent events.
                </div>
              )}
            </div>
          </Card>
        {/* Close the Fragment that wraps all the dashboard content sections */}
        </>
      )}
    {/* Close the outer container div */}
    </div>
  );
// Close the AdminDashboard component function
}

