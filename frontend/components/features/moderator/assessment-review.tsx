// "use client" directive tells Next.js this component runs in the browser (client-side rendering)
// Required because we use React hooks (useState, useEffect), form inputs, and browser navigation
"use client";

// Import React hooks: useState for managing component state, useEffect for running side effects on mount
import { useState, useEffect } from "react";
// Import Next.js Link component for client-side navigation (Back button) without full page reloads
import Link from "next/link";
// Import useRouter hook from Next.js App Router for programmatic navigation (redirect on auth failure)
import { useRouter } from "next/navigation";
// Import the reusable Card UI component for consistent styled containers throughout the app
import { Card } from "@/components/ui";
// Import ApiError class to detect and handle structured API errors with status codes and detail messages
import { ApiError } from "@/lib/api-client";
// Import API functions for the moderator review workflow, plus TypeScript types for type safety
import {
  getModeratorAssessment,      // Fetches assessment details for the moderator
  getModeratorSample,          // Fetches the sample set of student marks for review
  getModerationCase,           // Fetches the moderation case record (lecturer/moderator comments)
  submitModerationDecision,    // Submits the moderator's final decision (approve/changes/escalate)
  submitModerationForm,        // Submits the 6-question moderation form with decision in one request
  type Assessment,             // TypeScript type for assessment data structure
  type SampleItem,             // TypeScript type for individual student mark in the sample
  type ModerationCase,         // TypeScript type for the moderation case record
  type ModerationFormData,     // TypeScript type for the 6 moderation form questions and comments
} from "@/lib/assessments-api";

// TypeScript interface defining the props this component accepts
// assessmentId is passed from the dynamic route parameter [assessmentId]
interface AssessmentReviewProps {
  assessmentId: string;  // UUID of the assessment being reviewed, from the URL
}

// Main component for the moderator's assessment review page
// This is where the moderator reviews the sample, completes the 6 moderation form questions,
// and makes a decision: approve marks, request changes, or escalate to a third marker
export function AssessmentReview({ assessmentId }: AssessmentReviewProps) {
  // Next.js router instance for programmatic navigation (redirect to login or back to dashboard)
  const router = useRouter();
  // State: the full assessment record (module info, title, sample size, etc.), null until fetched
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  // State: array of student marks in the moderation sample, initially empty
  const [sample, setSample] = useState<SampleItem[]>([]);
  // State: the moderation case record with lecturer/moderator comments and status, null until fetched
  const [moderationCase, setModerationCase] = useState<ModerationCase | null>(null);
  // State: loading flag, starts true and set to false once all API data is fetched
  const [loading, setLoading] = useState(true);
  // State: tracks whether a decision is currently being submitted to prevent double-clicks
  const [submitting, setSubmitting] = useState(false);
  // State: error message string displayed to the user, null means no error
  const [error, setError] = useState<string | null>(null);
  // State: the moderator's free-text comment explaining their decision rationale
  const [comment, setComment] = useState("");
  // State: the 6 moderation form questions (based on the university's Moderation Form requirements)
  // All 6 boolean questions default to true (Yes), following the standard moderation form structure
  // These correspond to the questions from the Moderation Form (Marking Assessment 2024/25)
  const [formData, setFormData] = useState<ModerationFormData>({
    has_marking_rubric: true,              // Q1: Was there a marking rubric for the module?
    criteria_consistently_applied: true,    // Q2: Were marking criteria consistently applied?
    full_range_of_marks_used: true,        // Q3: Was the full range of marks used?
    marks_awarded_fairly: true,            // Q4: Were marks awarded fairly?
    feedback_comments_appropriate: true,    // Q5: Were feedback comments appropriate?
    all_marks_appropriate: true,           // Q6: Are all marks in the sample appropriate?
  });

  // useEffect runs on component mount to fetch all data needed for the moderation review
  useEffect(() => {
    // Async function to load assessment details, sample marks, and moderation case data
    async function loadData() {
      try {
        // First fetch the assessment details (module info, title, sample configuration)
        const assessmentData = await getModeratorAssessment(assessmentId);
        // Store assessment data in state for rendering the summary section
        setAssessment(assessmentData);

        // Then fetch the sample set - the student marks selected for moderation review
        // Sample size follows Section 12.18 rules (e.g., 20% for <100 students)
        const sampleData = await getModeratorSample(assessmentId);
        // Store sample items in state for rendering the sample table
        setSample(sampleData);

        try {
          // Try to fetch the moderation case record (contains lecturer/moderator comments)
          const caseData = await getModerationCase(assessmentId);
          // Store the moderation case in state for displaying lecturer notes
          setModerationCase(caseData);
        } catch (caseError) {
          // Moderation case might not exist yet if this is a first review - this is normal
          // We log it but don't show an error to the user since the review can still proceed
          console.log("No moderation case found yet:", caseError);
        }
      } catch (err) {
        // Check if the error is a structured API error with a status code
        if (err instanceof ApiError) {
          // 401 Unauthorized means the JWT token is expired/missing - redirect to login
          if (err.status === 401) {
            router.push("/login");
          } else {
            // For other API errors, display the detail message (handle both string and object formats)
            setError(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
          }
        } else {
          // For unexpected non-API errors, extract message or show a generic fallback
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        // Always set loading to false whether requests succeeded or failed
        setLoading(false);
      }
    }

    // Invoke the async data loading function
    loadData();
  }, [assessmentId, router]); // Re-run if assessmentId changes (navigating between assessments)

  // Handler function for submitting the moderator's decision (approve, request changes, or escalate)
  // Takes a union type parameter restricting the decision to one of three valid workflow transitions
  // APPROVED = marks confirmed as appropriate (Section 12.21)
  // CHANGES_REQUESTED = moderator asks lecturer to revise marks (Section 12.22)
  // ESCALATED = disagreement requires independent third marker review (Section 12.24)
  async function handleDecision(decision: "APPROVED" | "CHANGES_REQUESTED" | "ESCALATED") {
    // Set submitting flag to true to disable buttons and prevent duplicate submissions
    setSubmitting(true);
    // Clear any previous error messages before attempting submission
    setError(null);

    try {
      // Submit the moderation form answers (6 questions) along with the decision and comment
      // This sends everything in a single API request for atomicity
      await submitModerationForm(assessmentId, formData, decision, comment || undefined);
      // On success, navigate back to the moderator dashboard to see the updated queue
      router.push("/moderator/dashboard");
    } catch (err) {
      // Handle API errors by displaying the error detail to the user
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
      } else {
        // Handle unexpected errors with a generic message
        setError(err instanceof Error ? err.message : "Failed to submit decision");
      }
      // Re-enable the submit buttons so the moderator can try again
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

  // Main JSX return - renders the full moderation review page
  return (
    // Outer container with vertical spacing between all sections
    <div className="space-y-6">
      {/* Page header with title, module info, and back navigation */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Main page heading identifying this as a moderation review */}
          <h1 className="text-2xl font-semibold">Moderation Review</h1>
          {/* Module code and name from the assessment data for context */}
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.module_name}
          </p>
          {/* Assessment UUID displayed for reference and audit trail purposes */}
          <p className="mt-1 text-xs text-gray-500">Assessment ID: {assessmentId}</p>
        </div>

        {/* Navigation buttons aligned to the right */}
        <div className="flex gap-2">
          {/* Back button: returns to the moderator dashboard without submitting any changes */}
          <Link
            href="/moderator/dashboard"
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </header>

      {/* Conditional error banner - only renders when there's an error message in state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Assessment summary card showing key information about the assessment being moderated */}
      <Card>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Assessment title (e.g., "Coursework 1") */}
              <h2 className="text-lg font-semibold">{assessment.title}</h2>
              {/* Cohort year and due date for context */}
              <div className="mt-1 text-sm text-gray-600">
                Cohort {assessment.cohort} • Due {assessment.due_date}
              </div>
              {/* Name of the lecturer who submitted the assessment for moderation */}
              <div className="mt-1 text-sm text-gray-600">
                Lecturer: <span className="font-medium">{moderationCase?.lecturer_name || "Unknown"}</span>
              </div>
            </div>

            {/* Sample statistics box showing size, percentage, and selection method */}
            {/* Sample follows Section 12.18-12.20 rules for size and selection criteria */}
            <div className="rounded-xl border bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-600">Sample</div>
              {/* Display: count (percentage%) • method (e.g., "10 (20%) • Stratified") */}
              <div className="mt-1 font-medium">
                {assessment.sample_size || 0} ({assessment.sample_percent || 0}%) • {assessment.sample_method || "N/A"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lecturer's notes card - shows any comments the lecturer provided when submitting */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">Lecturer notes</h2>
          {/* Display the lecturer's comment or a placeholder if none was provided */}
          <p className="mt-2 text-sm text-gray-700">
            {moderationCase?.lecturer_comment || "No comment provided."}
          </p>
        </div>
      </Card>

      {/* Sample table - displays all student marks selected for moderation review */}
      {/* Per Section 12.19-12.20: sample must include boundary cases (38-42%, 58-62%, 68-72%) */}
      <Card>
        {/* Table header with title and count of sample items displayed */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Sample set</h2>
          <div className="text-sm text-gray-600">{sample.length} shown</div>
        </div>

        {/* Horizontal scroll wrapper for the table on narrow screens */}
        <div className="overflow-x-auto">
          {/* Table showing each student's mark in the sample for the moderator to review */}
          <table className="w-full text-sm">
            {/* Column headers for the sample table */}
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Mark</th>
                <th className="px-5 py-3 font-medium">Marker</th>
                <th className="px-5 py-3 font-medium">Notes</th>
              </tr>
            </thead>

            <tbody>
              {/* Iterate over each student in the sample and render a row */}
              {sample.map((s) => (
                // Each row uses the sample item's unique ID as the React key
                <tr key={s.id} className="border-b last:border-b-0">
                  {/* Student identifier (anonymised ID to maintain student anonymity per regulations) */}
                  <td className="px-5 py-4 font-medium">{s.student_id}</td>
                  {/* The mark awarded to this student by the original marker */}
                  <td className="px-5 py-4">{s.mark}</td>
                  {/* ID of the marker who assessed this student, em dash if not recorded */}
                  <td className="px-5 py-4">{s.marker_id ?? "—"}</td>
                  {/* Optional moderator note for this specific sample item */}
                  <td className="px-5 py-4">
                    {s.moderator_note ? (
                      <span className="text-sm text-gray-600">{s.moderator_note}</span>
                    ) : (
                      // Show em dash when no note has been added yet
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Empty state: shown when the sample set has no items */}
              {sample.length === 0 && (
                <tr>
                  {/* colSpan={4} spans all 4 columns to center the empty message */}
                  <td className="px-5 py-10 text-center text-gray-600" colSpan={4}>
                    No sample items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Moderation Form Card - Contains the 6 required questions from the university's Moderation Form */}
      {/* These questions are mandated by the Moderation Form (Marking Assessment 2024/25) */}
      {/* Each question has a Yes/No radio button and an optional comment textarea */}
      <Card>
        <div className="p-5 space-y-6">
          {/* Form header explaining what the moderator needs to do */}
          <div>
            <h2 className="text-lg font-semibold">Moderation Form</h2>
            <p className="mt-1 text-sm text-gray-600">
              Complete all 6 questions based on your review of the sample
            </p>
          </div>

          {/* Q1: Was there a marking rubric? */}
          {/* Rubrics ensure consistent marking standards across all markers */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              1. Was there a marking rubric for the module?
            </label>
            {/* Radio button group for Yes/No selection */}
            <div className="flex gap-4">
              {/* "Yes" option - sets has_marking_rubric to true in form state */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.has_marking_rubric === true}
                  onChange={() => setFormData({ ...formData, has_marking_rubric: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
              {/* "No" option - sets has_marking_rubric to false in form state */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.has_marking_rubric === false}
                  onChange={() => setFormData({ ...formData, has_marking_rubric: false })}
                  className="text-blue-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {/* Optional comment field for additional context about the rubric */}
            <textarea
              value={formData.has_marking_rubric_comment || ""}
              onChange={(e) => setFormData({ ...formData, has_marking_rubric_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q2: Were marking criteria consistently applied? */}
          {/* Consistency ensures all students are assessed against the same standards */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              2. Were the marking criteria consistently applied across all scripts?
            </label>
            <div className="flex gap-4">
              {/* "Yes" option - criteria were applied consistently */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.criteria_consistently_applied === true}
                  onChange={() => setFormData({ ...formData, criteria_consistently_applied: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
              {/* "No" option - inconsistencies were found in how criteria were applied */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.criteria_consistently_applied === false}
                  onChange={() => setFormData({ ...formData, criteria_consistently_applied: false })}
                  className="text-blue-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {/* Optional comment field for explaining any inconsistencies found */}
            <textarea
              value={formData.criteria_consistently_applied_comment || ""}
              onChange={(e) => setFormData({ ...formData, criteria_consistently_applied_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q3: Was the full range of marks used? */}
          {/* Checks whether markers used the entire 0-100 scale rather than clustering marks */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              3. Was the full range of marks used?
            </label>
            <div className="flex gap-4">
              {/* "Yes" option - full mark range was utilised appropriately */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.full_range_of_marks_used === true}
                  onChange={() => setFormData({ ...formData, full_range_of_marks_used: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
              {/* "No" option - marks were clustered or the full range wasn't used */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.full_range_of_marks_used === false}
                  onChange={() => setFormData({ ...formData, full_range_of_marks_used: false })}
                  className="text-blue-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {/* Optional comment field for noting mark distribution concerns */}
            <textarea
              value={formData.full_range_of_marks_used_comment || ""}
              onChange={(e) => setFormData({ ...formData, full_range_of_marks_used_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q4: Were marks awarded fairly? */}
          {/* Fairness assessment ensuring no bias in the marking process */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              4. Were marks awarded fairly?
            </label>
            <div className="flex gap-4">
              {/* "Yes" option - marks were fair and unbiased */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.marks_awarded_fairly === true}
                  onChange={() => setFormData({ ...formData, marks_awarded_fairly: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
              {/* "No" option - fairness concerns were identified */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.marks_awarded_fairly === false}
                  onChange={() => setFormData({ ...formData, marks_awarded_fairly: false })}
                  className="text-blue-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {/* Optional comment field for explaining fairness concerns */}
            <textarea
              value={formData.marks_awarded_fairly_comment || ""}
              onChange={(e) => setFormData({ ...formData, marks_awarded_fairly_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q5: Were feedback comments appropriate? */}
          {/* Checks whether written feedback justifies the marks and helps students improve */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              5. Were feedback comments appropriate and do they justify the marks awarded?
            </label>
            <div className="flex gap-4">
              {/* "Yes" option - feedback was appropriate and justified the marks */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.feedback_comments_appropriate === true}
                  onChange={() => setFormData({ ...formData, feedback_comments_appropriate: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
              {/* "No" option - feedback quality or mark justification was inadequate */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.feedback_comments_appropriate === false}
                  onChange={() => setFormData({ ...formData, feedback_comments_appropriate: false })}
                  className="text-blue-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {/* Optional comment field for noting feedback quality issues */}
            <textarea
              value={formData.feedback_comments_appropriate_comment || ""}
              onChange={(e) => setFormData({ ...formData, feedback_comments_appropriate_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q6: Are all marks in the sample appropriate? (Most critical question) */}
          {/* This is the key question - if "No", the moderator should escalate or request changes */}
          {/* Per Section 12.21: moderator confirms marks OR recommends third marking */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              6. Are you able to confirm that all marks in the sample are appropriate?
            </label>
            <div className="flex gap-4">
              {/* "Yes" option - all marks are confirmed as appropriate */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.all_marks_appropriate === true}
                  onChange={() => setFormData({ ...formData, all_marks_appropriate: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
              {/* "No" option - marks are NOT appropriate, will show recommendations textarea */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.all_marks_appropriate === false}
                  onChange={() => setFormData({ ...formData, all_marks_appropriate: false })}
                  className="text-blue-600"
                />
                <span className="text-sm">No</span>
              </label>
            </div>
            {/* Optional comment field for this question */}
            <textarea
              value={formData.all_marks_appropriate_comment || ""}
              onChange={(e) => setFormData({ ...formData, all_marks_appropriate_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Conditional: Recommendations field appears only when Q6 answer is "No" (marks not appropriate) */}
          {/* Required per Section 12.22: moderator must explain what changes are needed */}
          {!formData.all_marks_appropriate && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-red-600">
                Recommendations (Required when marks are not appropriate)
              </label>
              {/* Required textarea for detailed recommendations when marks are not appropriate */}
              <textarea
                value={formData.recommendations || ""}
                onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                placeholder="Provide detailed recommendations for addressing the issues identified..."
                className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm"
                rows={4}
                required
              />
            </div>
          )}

          {/* Conditional: Feedback suggestions field appears only when Q6 answer is "Yes" (marks appropriate) */}
          {/* Optional field for the moderator to suggest improvements to feedback quality */}
          {formData.all_marks_appropriate && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Feedback Suggestions (Optional)
              </label>
              {/* Optional textarea for suggestions to improve feedback even when marks are approved */}
              <textarea
                value={formData.feedback_suggestions || ""}
                onChange={(e) => setFormData({ ...formData, feedback_suggestions: e.target.value })}
                placeholder="Any suggestions for improving feedback quality..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                rows={3}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Decision panel - where the moderator submits their final moderation outcome */}
      {/* Per Section 12.15-12.31: moderator can approve, request changes, or escalate to third marker */}
      <Card>
        <div className="p-5 space-y-3">
          <h2 className="text-lg font-semibold">Moderator decision</h2>
          {/* Explanation that submitting updates the workflow status and triggers notifications */}
          <p className="text-sm text-gray-600">
            Record outcome to update workflow and notify the lecturer.
          </p>

          {/* Three decision buttons in a responsive grid (1 col mobile, 3 cols desktop) */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* APPROVE button: confirms marks are appropriate per Section 12.21 */}
            {/* Green colour indicates positive/success action */}
            <button
              onClick={() => handleDecision("APPROVED")}
              disabled={submitting}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Approve moderation outcome"
            >
              {/* Show "Submitting..." text while the API request is in progress */}
              {submitting ? "Submitting..." : "Approve"}
            </button>
            {/* REQUEST CHANGES button: asks lecturer to revise marks per Section 12.22 */}
            {/* Red colour indicates an issue that needs attention */}
            <button
              onClick={() => handleDecision("CHANGES_REQUESTED")}
              disabled={submitting}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Request changes to marking"
            >
              {submitting ? "Submitting..." : "Request changes"}
            </button>
            {/* ESCALATE button: refers to an independent third marker per Section 12.24 */}
            {/* Used when moderator and lecturer cannot agree on marks */}
            {/* Neutral styling (white/border) since this is a procedural rather than positive/negative action */}
            <button
              onClick={() => handleDecision("ESCALATED")}
              disabled={submitting}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              aria-label="Escalate to third marker for independent review"
            >
              {submitting ? "Submitting..." : "Escalate to third marker"}
            </button>
          </div>

          {/* Moderator's free-text comment field for explaining their decision rationale */}
          <div>
            {/* Label for the comment textarea, linked by htmlFor/id for accessibility */}
            <label htmlFor="moderator-comment" className="text-xs text-gray-600">Moderator comment</label>
            {/* Textarea for the moderator to explain their decision, evidence, and required actions */}
            <textarea
              id="moderator-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              rows={4}
              placeholder="Explain reasons, evidence, required actions, or escalation context..."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
