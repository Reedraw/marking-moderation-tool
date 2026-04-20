// "use client" directive tells Next.js this component runs in the browser (client-side),
// not on the server. Required because we use React hooks (useState, useEffect) and browser APIs.
"use client";

// Import React hooks: useState for managing component state, useEffect for side effects (data fetching on mount)
import { useState, useEffect } from "react";
// Link component from Next.js for client-side navigation without full page reloads
import Link from "next/link";
// useRouter hook from Next.js App Router for programmatic navigation (e.g., redirect to login)
import { useRouter } from "next/navigation";
// Card is a reusable UI component that provides a styled container with border and rounded corners
import { Card } from "@/components/ui";
// ApiError is a custom error class that carries HTTP status code and detail message from the backend
import { ApiError } from "@/lib/auth";
// getLecturerAssessments fetches the list of assessments for the logged-in lecturer from the backend API;
// Assessment is the TypeScript type defining the shape of an assessment object
import { getLecturerAssessments, type Assessment } from "@/lib/assessments-api";

// Main dashboard component exported as a named export for use in the lecturer dashboard page
export function LecturerDashboard() {
  // useRouter returns a router object that lets us navigate programmatically (e.g., redirect to /login)
  const router = useRouter();
  // State to hold the array of assessments fetched from the API; starts as empty array
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  // Loading state tracks whether the initial data fetch is in progress; starts true until fetch completes
  const [loading, setLoading] = useState(true);
  // Error state holds any error message to display to the user; null means no error
  const [error, setError] = useState<string | null>(null);

  // useEffect runs once on component mount (empty dependency array except router) to fetch assessments
  useEffect(() => {
    // Define an async function inside useEffect because useEffect callbacks can't be async directly
    async function loadData() {
      try {
        // Call the API to get all assessments belonging to the currently logged-in lecturer
        const assessmentsData = await getLecturerAssessments();
        // Store the fetched assessments in state, which triggers a re-render with the data
        setAssessments(assessmentsData);
      } catch (err) {
        // Check if the error is an API-specific error with status code and detail message
        if (err instanceof ApiError) {
          // 401 means unauthorized — JWT token expired or missing, so redirect to login page
          if (err.status === 401) {
            router.push("/login");
          } else {
            // For other API errors (400, 403, 500, etc.), display the server's error detail message
            setError(err.detail);
          }
        } else {
          // For non-API errors (network failures, etc.), use the error message or a fallback string
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        // Whether the fetch succeeded or failed, stop the loading spinner
        setLoading(false);
      }
    }

    // Invoke the async function immediately
    loadData();
  }, [router]); // router is included in the dependency array because it's used inside the effect

  // --- Derived statistics computed from the assessments array ---
  // Total number of assessments the lecturer has
  const total = assessments.length;
  // Count of assessments currently waiting for a moderator to review them
  const pending = assessments.filter((a) => a.status === "SUBMITTED_FOR_MODERATION").length;
  // Count of assessments that have been approved by the moderator
  const approved = assessments.filter((a) => a.status === "APPROVED").length;
  // Count of assessments that require lecturer action: either still in draft or moderator requested changes
  const needAction = assessments.filter((a) => a.status === "DRAFT" || a.status === "CHANGES_REQUESTED").length;

  // Converts a backend status code (e.g., "SUBMITTED_FOR_MODERATION") to a human-readable label (e.g., "Pending Moderation")
  function getStatusDisplay(status: string): string {
    // Record<string, string> maps each backend status key to its display text
    const statusMap: Record<string, string> = {
      DRAFT: "Draft",                                    // Assessment created but no marks uploaded yet
      MARKS_UPLOADED: "Marks Uploaded",                  // CSV marks have been uploaded
      SAMPLE_GENERATED: "Sample Generated",              // Moderation sample has been created
      SUBMITTED_FOR_MODERATION: "Pending Moderation",    // Sent to moderator, waiting for review
      IN_MODERATION: "In Moderation",                    // Moderator is actively reviewing
      APPROVED: "Approved",                              // Moderator approved the marks
      CHANGES_REQUESTED: "Changes Requested",            // Moderator asked for revisions
      ESCALATED: "Escalated",                            // Escalated to third marker for dispute resolution
    };
    // Return the mapped display text, or the raw status string if not found in the map
    return statusMap[status] || status;
  }

  // Returns Tailwind CSS classes for styling the status badge/pill based on the assessment status
  function getStatusClasses(status: string): string {
    // Each status maps to specific background, text, and border colour classes for visual distinction
    const classMap: Record<string, string> = {
      DRAFT: "bg-gray-50 text-gray-700 border-gray-200",                          // Neutral grey for draft
      MARKS_UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",                  // Blue indicates progress
      SAMPLE_GENERATED: "bg-indigo-50 text-indigo-700 border-indigo-200",          // Indigo for sample ready
      SUBMITTED_FOR_MODERATION: "bg-yellow-50 text-yellow-800 border-yellow-200",  // Yellow for pending/waiting
      IN_MODERATION: "bg-purple-50 text-purple-700 border-purple-200",             // Purple for active review
      APPROVED: "bg-green-50 text-green-700 border-green-200",                     // Green for approved/success
      CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",                  // Red for action needed
      ESCALATED: "bg-indigo-50 text-indigo-700 border-indigo-200",                 // Indigo for escalation
    };
    // Combine base pill styles (inline-flex, rounded, padding, font size, border) with the status-specific colours
    return `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${classMap[status] || ""}`;
  }

  // --- JSX Return: The component's rendered output ---
  return (
    // Outer container with vertical spacing between child elements
    <div className="space-y-6">
      {/* Page header with title, description, and "Create assessment" button */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Main page heading */}
          <h1 className="text-2xl font-semibold">Lecturer Dashboard</h1>
          {/* Subtitle explaining the page purpose */}
          <p className="mt-1 text-sm text-gray-600">
            Upload marks, generate samples, and submit assessments for moderation.
          </p>
        </div>
        {/* Link navigates to the "create new assessment" page; styled as a black button */}
        <Link
          href="/lecturer/assessments/new"
          className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Create assessment
        </Link>
      </header>

      {/* Conditional error banner — only rendered if there's an error message in state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Conditional rendering: show loading spinner while fetching, or the dashboard content when done */}
      {loading ? (
        // Loading state: centered "Loading..." text while waiting for API response
        <div className="flex items-center justify-center p-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      ) : (
        // Fragment (<>) wraps multiple elements without adding an extra DOM node
        <>
          {/* Summary statistics cards — displayed in a 4-column responsive grid */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {/* Card 1: Total number of assessments */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Assessments</div>
                {/* Display the total count from the computed variable */}
                <div className="mt-2 text-2xl font-semibold">{total}</div>
              </div>
            </Card>

            {/* Card 2: Assessments needing lecturer action (Draft or Changes Requested) */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Need action</div>
                <div className="mt-2 text-2xl font-semibold">{needAction}</div>
                {/* Clarifying subtitle explaining which statuses count */}
                <div className="mt-1 text-xs text-gray-500">Draft / Changes requested</div>
              </div>
            </Card>

            {/* Card 3: Assessments submitted and awaiting moderator review */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Pending moderation</div>
                <div className="mt-2 text-2xl font-semibold">{pending}</div>
              </div>
            </Card>

            {/* Card 4: Assessments that have been approved by the moderator */}
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Approved</div>
                <div className="mt-2 text-2xl font-semibold">{approved}</div>
              </div>
            </Card>
          </section>

          {/* Assessments table card — lists all assessments with details and action buttons */}
          <Card>
            {/* Table header row with title and total count */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Your assessments</h2>
              <div className="text-sm text-gray-600">{total} total</div>
            </div>

            {/* Scrollable container so the table doesn't break layout on small screens */}
            <div className="overflow-x-auto">
              {/* Data table displaying all assessments */}
              <table className="w-full text-sm">
                {/* Table column headers */}
                <thead className="text-left text-gray-600">
                  <tr className="border-b">
                    <th className="px-5 py-3 font-medium">Module</th>
                    <th className="px-5 py-3 font-medium">Assessment</th>
                    <th className="px-5 py-3 font-medium">Due</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Marks</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Map over each assessment to create a table row; key={a.id} for React's reconciliation */}
                  {assessments.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0">
                      {/* Module column: shows module code, name, and cohort year */}
                      <td className="px-5 py-4">
                        <div className="font-medium">{a.module_code}</div>
                        <div className="text-gray-600">{a.module_name}</div>
                        <div className="text-xs text-gray-500">{a.cohort}</div>
                      </td>

                      {/* Assessment column: title and unique ID for reference */}
                      <td className="px-5 py-4">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-gray-600 text-xs">ID: {a.id}</div>
                      </td>

                      {/* Due date column */}
                      <td className="px-5 py-4">{a.due_date}</td>

                      {/* Status column: displays a coloured pill/badge using the helper functions */}
                      <td className="px-5 py-4">
                        <span className={getStatusClasses(a.status)}>
                          {getStatusDisplay(a.status)}
                        </span>
                      </td>

                      {/* Marks count column: how many student marks have been uploaded */}
                      <td className="px-5 py-4">{a.marks_uploaded_count}</td>

                      {/* Actions column: contextual buttons based on the assessment's current status */}
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {/* "Open" button — always visible, navigates to the assessment detail page */}
                          <Link
                            href={`/lecturer/assessments/${a.id}`}
                            className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            Open
                          </Link>

                          {/* "Upload marks" or "Revise Marks" button — only shown when the assessment
                              is in a state where marks can be uploaded or revised (Draft, Marks Uploaded,
                              Sample Generated, or Changes Requested by moderator) */}
                          {(a.status === "DRAFT" || a.status === "MARKS_UPLOADED" || a.status === "SAMPLE_GENERATED" || a.status === "CHANGES_REQUESTED") && (
                            <Link
                              href={`/lecturer/assessments/${a.id}/upload`}
                              className={`rounded-xl px-3 py-2 text-sm text-white hover:opacity-90 ${
                                // Amber colour when revising marks after moderator feedback; black otherwise
                                a.status === "CHANGES_REQUESTED" ? "bg-amber-600" : "bg-black"
                              }`}
                            >
                              {/* Button text changes depending on whether this is a revision or first upload */}
                              {a.status === "CHANGES_REQUESTED" ? "Revise Marks" : "Upload marks"}
                            </Link>
                          )}

                          {/* "Respond" button — only shown when the assessment has been approved,
                              allowing the lecturer to submit the Module Leader Response form */}
                          {a.status === "APPROVED" && (
                            <Link
                              href={`/lecturer/assessments/${a.id}/response`}
                              className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:opacity-90"
                            >
                              Respond
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Empty state: shown when the lecturer has no assessments at all */}
                  {assessments.length === 0 && (
                    <tr>
                      {/* colSpan={6} makes this single cell span all 6 columns */}
                      <td className="px-5 py-10 text-center text-gray-600" colSpan={6}>
                        No assessments found.
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
