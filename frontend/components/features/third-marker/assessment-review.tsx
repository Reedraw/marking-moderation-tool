// "use client" directive tells Next.js this component runs in the browser (client-side rendering)
// Required because we use React hooks (useState, useEffect), form inputs, and browser navigation
"use client";

// Import React hooks: useState for managing component state, useEffect for side effects on mount
import { useState, useEffect } from "react";
// Import Next.js Link component for client-side navigation (Back button) without full page reloads
import Link from "next/link";
// Import useRouter hook from Next.js App Router for programmatic navigation (redirect on auth failure)
import { useRouter } from "next/navigation";
// Import the reusable Card UI component for consistent styled containers
import { Card } from "@/components/ui";
// Import ApiError class to detect and handle structured API errors with status codes
import { ApiError } from "@/lib/api-client";
// Import API functions for the third marker review workflow, plus TypeScript types
import {
  getThirdMarkerAssessment,       // Fetches assessment details for the third marker
  getThirdMarkerSample,           // Fetches the sample set of student marks for independent review
  getThirdMarkerModerationCase,   // Fetches the moderation case with lecturer + moderator comments
  submitThirdMarkerDecision,      // Submits the third marker's final decision to the backend
  type Assessment,                // TypeScript type for assessment data structure
  type SampleItem,                // TypeScript type for individual student mark in the sample
  type ModerationCase,            // TypeScript type for the moderation case record
} from "@/lib/assessments-api";

// TypeScript interface defining the props this component accepts
// assessmentId is passed from the dynamic route parameter [assessmentId]
interface AssessmentReviewProps {
  assessmentId: string;  // UUID of the escalated assessment being reviewed, from the URL
}

// Main component for the third marker's independent assessment review page
// Per Section 12.24: a third marker independently reviews the entire sample when
// the moderator cannot confirm marks are appropriate after discussion with the lecturer
export function AssessmentReview({ assessmentId }: AssessmentReviewProps) {
  // Next.js router instance for programmatic navigation (redirect to login or back to dashboard)
  const router = useRouter();
  // State: the full assessment record (module info, title, sample size, etc.), null until fetched
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  // State: array of student marks in the moderation sample for independent review, initially empty
  const [sample, setSample] = useState<SampleItem[]>([]);
  // State: the moderation case record containing both lecturer and moderator comments, null until fetched
  const [moderationCase, setModerationCase] = useState<ModerationCase | null>(null);
  // State: loading flag, starts true and set to false once all API data is fetched
  const [loading, setLoading] = useState(true);
  // State: tracks whether a decision is currently being submitted to prevent double-clicks
  const [submitting, setSubmitting] = useState(false);
  // State: error message string displayed to the user, null means no error
  const [error, setError] = useState<string | null>(null);
  // State: the third marker's free-text comment explaining their independent rationale and decision
  const [comment, setComment] = useState("");

  // useEffect runs on component mount to fetch all data needed for the third marker review
  useEffect(() => {
    // Async function to load assessment, sample, and moderation case data in parallel
    async function loadData() {
      try {
        // Promise.all fires all three API requests simultaneously for faster loading
        // Fetches: assessment details, sample marks, and the moderation case record
        const [assessmentData, sampleData, caseData] = await Promise.all([
          getThirdMarkerAssessment(assessmentId),      // Assessment metadata (module, title, etc.)
          getThirdMarkerSample(assessmentId),           // Student marks in the sample set
          getThirdMarkerModerationCase(assessmentId),   // Lecturer + moderator comments and history
        ]);
        // Store assessment details in state for rendering the summary section
        setAssessment(assessmentData);
        // Store sample items in state for rendering the sample marks table
        setSample(sampleData);
        // Store moderation case in state for displaying lecturer and moderator notes
        setModerationCase(caseData);
      } catch (err) {
        // Check if the error is a structured API error with a status code
        if (err instanceof ApiError) {
          // 401 Unauthorized means the JWT token is expired/missing - redirect to login
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
        // Always set loading to false whether the requests succeeded or failed
        setLoading(false);
      }
    }

    // Invoke the async data loading function
    loadData();
  }, [assessmentId, router]); // Re-run if assessmentId changes (navigating between assessments)

  // Handler function for submitting the third marker's final decision
  // Takes a union type parameter restricting the decision to one of three valid outcomes:
  // CONFIRM_MODERATOR = agrees with the moderator's assessment (marks need changing)
  // OVERRIDE_MODERATOR = disagrees with moderator, overrides their decision (marks are fine)
  // REFER_BACK = refers the case back for further discussion between lecturer and moderator
  // Per Section 12.26: if third marker cannot confirm, all instances by original marker must be re-marked
  async function handleDecision(decision: "CONFIRM_MODERATOR" | "OVERRIDE_MODERATOR" | "REFER_BACK") {
    // Set submitting flag to true to disable buttons and prevent duplicate submissions
    setSubmitting(true);
    // Clear any previous error messages before attempting submission
    setError(null);

    try {
      // Submit the third marker's decision and optional comment to the backend API
      await submitThirdMarkerDecision(assessmentId, {
        decision,                          // The chosen outcome (confirm/override/refer)
        comment: comment || undefined,     // Optional comment, undefined if empty string
      });
      // On success, navigate back to the third marker dashboard
      router.push("/third-marker/dashboard");
    } catch (err) {
      // Handle API errors by displaying the error detail to the user
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        // Handle unexpected errors with a generic message
        setError(err instanceof Error ? err.message : "Failed to submit decision");
      }
      // Re-enable the submit buttons so the third marker can try again
      setSubmitting(false);
    }
  }

  // Early return: show a centered loading indicator while API data is being fetched
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Early return: show an error message if the assessment was not found (e.g., invalid UUID)
  if (!assessment) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Assessment not found
      </div>
    );
  }

  // Main JSX return - renders the full third marker review page
  return (
    // Outer container with vertical spacing between all sections
    <div className="space-y-6">
      {/* Page header with title, module info, and back navigation */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Main page heading identifying this as a third marker review */}
          <h1 className="text-2xl font-semibold">Third Marker Review</h1>
          {/* Module code and name from the assessment data for context */}
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.module_name}
          </p>
          {/* Assessment UUID displayed for reference and audit trail purposes */}
          <p className="mt-1 text-xs text-gray-500">Assessment ID: {assessmentId}</p>
        </div>

        {/* Back button: returns to the third marker dashboard without submitting changes */}
        <Link
          href="/third-marker/dashboard"
          className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back
        </Link>
      </header>

      {/* Conditional error banner - only renders when there's an error message in state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Assessment summary card - shows key info about the escalated assessment */}
      <Card>
        <div className="p-5">
          {/* Assessment title (e.g., "Coursework 1") */}
          <h2 className="text-lg font-semibold">{assessment.title}</h2>
          {/* Cohort year for context */}
          <div className="mt-1 text-sm text-gray-600">Cohort {assessment.cohort}</div>
          {/* Name of the original lecturer who marked the assessment */}
          <div className="mt-2 text-sm text-gray-600">
            Lecturer: <span className="font-medium">{moderationCase?.lecturer_name || "Unknown"}</span>
          </div>
          {/* Name of the moderator who escalated this assessment to third marking */}
          <div className="mt-1 text-sm text-gray-600">
            Moderator: <span className="font-medium">{moderationCase?.moderator_name || "Unknown"}</span>
          </div>
        </div>
      </Card>

      {/* Comments section - side-by-side cards showing both lecturer and moderator notes */}
      {/* The third marker needs to see both perspectives to make an informed independent decision */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Lecturer's notes card - their original comments when submitting for moderation */}
        <Card>
          <div className="p-5">
            <h3 className="text-md font-semibold">Lecturer notes</h3>
            {/* Display the lecturer's comment or a placeholder if none was provided */}
            <p className="mt-2 text-sm text-gray-700">
              {moderationCase?.lecturer_comment || "No notes provided."}
            </p>
          </div>
        </Card>

        {/* Moderator's notes card - their comments explaining why they escalated */}
        <Card>
          <div className="p-5">
            <h3 className="text-md font-semibold">Moderator notes</h3>
            {/* Display the moderator's comment explaining the escalation rationale */}
            <p className="mt-2 text-sm text-gray-700">
              {moderationCase?.moderator_comment || "No notes provided."}
            </p>
          </div>
        </Card>
      </section>

      {/* Sample table - displays all student marks for the third marker's independent review */}
      {/* The third marker reviews the same sample the moderator reviewed, forming their own opinion */}
      <Card>
        {/* Table header with title and count of students in the sample */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Moderation sample</h2>
          <div className="text-sm text-gray-600">{sample.length} students</div>
        </div>

        {/* Horizontal scroll wrapper for the table on narrow screens */}
        <div className="overflow-x-auto">
          {/* Table showing each student's mark for independent assessment by the third marker */}
          <table className="w-full text-sm">
            {/* Column headers for the sample table */}
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Mark</th>
                <th className="px-5 py-3 font-medium">Marker</th>
              </tr>
            </thead>

            <tbody>
              {/* Iterate over each student in the sample and render a row */}
              {sample.map((s) => (
                // Each row uses the sample item's unique ID as the React key
                <tr key={s.id} className="border-b last:border-b-0">
                  {/* Student identifier (anonymised to maintain student anonymity) */}
                  <td className="px-5 py-4 font-medium">{s.student_id}</td>
                  {/* The mark awarded to this student by the original marker */}
                  <td className="px-5 py-4">{s.mark}</td>
                  {/* ID of the marker who assessed this student, em dash if not recorded */}
                  <td className="px-5 py-4">{s.marker_id ?? "—"}</td>
                </tr>
              ))}

              {/* Empty state: shown when the sample set has no items */}
              {sample.length === 0 && (
                <tr>
                  {/* colSpan={3} spans all 3 columns to center the empty message */}
                  <td className="px-5 py-10 text-center text-gray-600" colSpan={3}>
                    No sample items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Decision panel - where the third marker submits their final independent decision */}
      {/* Per Section 12.24-12.26: third marker can confirm, override, or refer back */}
      <Card>
        <div className="p-5 space-y-3">
          <h2 className="text-lg font-semibold">Final decision</h2>
          {/* Explanation that this is the final outcome of the escalation process */}
          <p className="text-sm text-gray-600">
            Record the final outcome of this escalation.
          </p>

          {/* Three decision buttons in a responsive grid (1 col mobile, 3 cols desktop) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* CONFIRM MODERATOR button: agrees with moderator that marks need changing */}
            {/* Per Section 12.26: if confirmed, all instances by original marker must be re-marked */}
            {/* Green colour indicates agreement/confirmation */}
            <button
              onClick={() => handleDecision("CONFIRM_MODERATOR")}
              disabled={submitting}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Confirm moderator decision for this assessment"
            >
              {/* Show "Submitting..." text while the API request is in progress */}
              {submitting ? "Submitting..." : "Confirm moderator decision"}
            </button>
            {/* OVERRIDE button: disagrees with moderator, overrides their decision */}
            {/* Yellow colour indicates caution - this is a significant action that reverses the moderation */}
            <button
              onClick={() => handleDecision("OVERRIDE_MODERATOR")}
              disabled={submitting}
              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Override moderator decision for this assessment"
            >
              {submitting ? "Submitting..." : "Override decision"}
            </button>
            {/* REFER BACK button: sends the case back for further discussion */}
            {/* Neutral styling (white/border) as this is a procedural step, not a final judgment */}
            <button
              onClick={() => handleDecision("REFER_BACK")}
              disabled={submitting}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              aria-label="Refer this assessment back for further review"
            >
              {submitting ? "Submitting..." : "Refer back"}
            </button>
          </div>

          {/* Third marker's free-text comment field for their independent rationale */}
          <div>
            {/* Label linked to textarea by htmlFor/id for accessibility compliance */}
            <label htmlFor="third-marker-comment" className="text-xs text-gray-600">Third marker comment</label>
            {/* Textarea for the third marker to document their independent assessment and justification */}
            {/* This comment forms part of the audit trail for compliance reporting */}
            <textarea
              id="third-marker-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              rows={4}
              placeholder="Independent rationale and final justification..."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
