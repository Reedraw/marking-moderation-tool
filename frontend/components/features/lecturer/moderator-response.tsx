// "use client" directive tells Next.js this component runs in the browser (client-side),
// required because we use React hooks (useState, useEffect) and handle form interactions
"use client";

// useState manages reactive component state; useEffect runs side effects (data fetching) on mount
import { useState, useEffect } from "react";
// Link component from Next.js for client-side navigation without full page reloads
import Link from "next/link";
// useRouter from Next.js App Router for programmatic navigation (e.g., redirect to login)
import { useRouter } from "next/navigation";
// Card is a reusable UI container component providing consistent styling
import { Card } from "@/components/ui";
// ApiError is a custom error class that carries HTTP status code and detail message from the backend
import { ApiError } from "@/lib/api-client";
// Import multiple API functions and TypeScript types needed for this component:
// - getAssessment: fetches assessment details
// - getLecturerModerationCase: fetches the moderation case with moderator feedback
// - submitModuleLeaderResponse: submits the lecturer's response to moderator feedback
// - getModuleLeaderResponse: checks if a response was already submitted
// - Assessment, ModerationCase, ModuleLeaderResponseSubmit: TypeScript types for type safety
import {
  getAssessment,
  getLecturerModerationCase,
  submitModuleLeaderResponse,
  getModuleLeaderResponse,
  type Assessment,
  type ModerationCase,
  type ModuleLeaderResponseSubmit,
} from "@/lib/assessments-api";

// TypeScript interface defining the props this component expects — the assessment UUID from the URL
interface ModeratorResponseProps {
  assessmentId: string;
}

// Main component: Module Leader Response form — allows the lecturer to respond to moderator feedback
// This is part of the moderation workflow (Section 12 of academic regulations) where the module leader
// reviews the moderator's comments and either agrees final marks or escalates to a third marker
export function ModeratorResponse({ assessmentId }: ModeratorResponseProps) {
  // Router for programmatic navigation (redirect to login on auth failure)
  const router = useRouter();
  // State to hold the full assessment object fetched from the API
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  // State to hold the moderation case data (moderator name, status, comments)
  const [moderationCase, setModerationCase] = useState<ModerationCase | null>(null);
  // Loading state — true while initial data is being fetched from the API
  const [loading, setLoading] = useState(true);
  // Submitting state — true while the response form is being submitted to prevent double-submission
  const [submitting, setSubmitting] = useState(false);
  // Error message state — null means no error to display
  const [error, setError] = useState<string | null>(null);
  // Success message state — shown after successful form submission
  const [success, setSuccess] = useState<string | null>(null);
  // Tracks whether a response has already been submitted (disables form fields if true)
  const [existingResponse, setExistingResponse] = useState(false);

  // Form state for the Module Leader Response — matches the ModuleLeaderResponseSubmit type
  // This form captures the lecturer's response to the moderator's feedback per the moderation form requirements
  const [response, setResponse] = useState<ModuleLeaderResponseSubmit>({
    moderator_comments_considered: false,  // Checkbox: lecturer confirms they've read moderator comments
    response_to_issues: "",                // Textarea: response to specific issues raised by moderator
    outliers_explanation: "",               // Textarea: explanation for any unusual mark distributions
    needs_third_marker: false,             // Radio: whether a third marker is needed for dispute resolution
  });

  // useEffect runs once on component mount to fetch assessment data, moderation case, and any existing response
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch the assessment details (module code, title, status, etc.)
        const assessmentData = await getAssessment(assessmentId);
        setAssessment(assessmentData);

        // Fetch the moderation case which contains the moderator's feedback and review status
        const caseData = await getLecturerModerationCase(assessmentId);
        setModerationCase(caseData);

        // Try to load an existing response — if the lecturer already submitted one, pre-fill the form
        try {
          const existingResp = await getModuleLeaderResponse(assessmentId);
          // Populate the form state with the previously submitted response values
          setResponse({
            moderator_comments_considered: existingResp.moderator_comments_considered,
            response_to_issues: existingResp.response_to_issues || "",
            outliers_explanation: existingResp.outliers_explanation || "",
            needs_third_marker: existingResp.needs_third_marker,
          });
          // Mark that a response already exists — this will disable form editing
          setExistingResponse(true);
        } catch {
          // 404 expected if no response exists yet — silently ignore
        }
      } catch (err) {
        // Handle API-specific errors
        if (err instanceof ApiError) {
          if (err.status === 401) {
            // Unauthorized — redirect to login page
            router.push("/login");
          } else {
            // Display the server error message
            setError(err.detail);
          }
        } else {
          // Handle generic errors (network failures, etc.)
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        // Stop the loading spinner regardless of outcome
        setLoading(false);
      }
    }

    loadData();
  }, [assessmentId, router]); // Re-run if assessmentId or router changes

  // Form submission handler for the Module Leader Response
  async function handleSubmit() {
    // Validation: the lecturer must confirm they've considered the moderator's comments before submitting
    if (!response.moderator_comments_considered) {
      setError("You must confirm that you have considered the moderator's comments");
      return;
    }

    // Set submitting state to disable the button and prevent double-submission
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Send the Module Leader Response to the backend API
      await submitModuleLeaderResponse(assessmentId, response);
      // Show a success message — the text varies depending on whether a third marker was requested
      setSuccess(
        response.needs_third_marker
          ? "Response submitted. Assessment has been escalated to third marker."  // Escalation path per Section 12.22
          : "Response submitted. Final marks have been agreed."                   // Normal completion path
      );
      // Mark that a response now exists, disabling further edits
      setExistingResponse(true);
      
      // Reload the assessment to reflect the updated status in the UI
      const assessmentData = await getAssessment(assessmentId);
      setAssessment(assessmentData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit response");
      }
    } finally {
      // Always reset submitting state
      setSubmitting(false);
    }
  }

  // --- Loading state: show spinner while data is being fetched ---
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // --- Error state: assessment not found (404 or data issue) ---
  if (!assessment) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Assessment not found
      </div>
    );
  }

  // Determine if the lecturer is allowed to submit a response based on the assessment status
  // Only assessments that have been through moderation review can receive a response
  const canRespond = ["IN_MODERATION", "CHANGES_REQUESTED", "APPROVED"].includes(assessment.status);

  // --- JSX Return: The component's rendered output ---
  return (
    // Outer container with vertical spacing between sections
    <div className="space-y-6">
      {/* Page header with title, assessment info, and back navigation */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Page title — this is the Module Leader Response form from the moderation form requirements */}
          <h1 className="text-2xl font-semibold">Module Leader Response</h1>
          {/* Show module code and assessment title for context */}
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.title}
          </p>
        </div>

        {/* Back button navigates to the assessment detail page */}
        <Link
          href={`/lecturer/assessments/${assessmentId}`}
          className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back to Assessment
        </Link>
      </header>

      {/* Error banner — conditionally rendered when there's an error message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success banner — shown after successful form submission */}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Moderator Feedback Summary card — displays the internal moderator's feedback for the lecturer to review */}
      {moderationCase && (
        <Card>
          <div className="p-5">
            <h2 className="text-lg font-semibold">Internal Moderator Feedback</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review the moderator&apos;s comments and recommendations below.
            </p>

            <div className="mt-4 space-y-3">
              {/* Display the moderator's name */}
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600">Moderator</div>
                <div className="mt-1 font-medium">{moderationCase.moderator_name || "—"}</div>
              </div>

              {/* Display the moderation case status */}
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600">Status</div>
                <div className="mt-1 font-medium">{moderationCase.status}</div>
              </div>

              {/* Display the moderator's comments if any were provided */}
              {moderationCase.moderator_comment && (
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-600">Moderator Comments</div>
                  <div className="mt-1">{moderationCase.moderator_comment}</div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Module Leader Response Form card — the main form for the lecturer to fill in */}
      <Card>
        <div className="p-5 space-y-4">
          <div>
            {/* Form section heading */}
            <h2 className="text-lg font-semibold">Your Response</h2>
            <p className="mt-1 text-sm text-gray-600">
              Respond to the moderator&apos;s feedback and confirm final marks.
            </p>
          </div>

          {/* Checkbox: Lecturer must confirm they've considered the moderator's comments
              This is a required field — form cannot be submitted without it checked.
              Based on the moderation form requirement: "The Moderator's comments and recommendations
              have been given proper consideration" */}
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={response.moderator_comments_considered}
              onChange={(e) => setResponse({ ...response, moderator_comments_considered: e.target.checked })}
              // Disabled if assessment can't receive a response or if a response was already submitted
              disabled={!canRespond || existingResponse}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm">
              The Moderator&apos;s comments and recommendations have been given proper consideration and 
              wherever appropriate they have been taken on board and a final set of marks agreed
            </span>
          </label>

          {/* Textarea: Response to specific issues raised by the moderator */}
          <div>
            <label className="text-xs text-gray-600">
              Please respond to any issues raised/recommendations made by the internal moderator
            </label>
            <textarea
              value={response.response_to_issues}
              // Spread operator creates a new object with the updated field (immutable state update pattern)
              onChange={(e) => setResponse({ ...response, response_to_issues: e.target.value })}
              disabled={!canRespond || existingResponse}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              rows={4}
              placeholder="Respond to specific issues or recommendations..."
            />
          </div>

          {/* Textarea: Explanation for mark distribution outliers
              This is from the moderation form — asking the module leader to explain any unusual patterns
              in the marks (e.g., unusually high/low cohort results) */}
          <div>
            <label className="text-xs text-gray-600">
              Please comment on any outliers from the full range of assessment marks and provide an explanation 
              (e.g., where the cohort has a particularly significant numbers or either high or low marks)
            </label>
            <textarea
              value={response.outliers_explanation}
              onChange={(e) => setResponse({ ...response, outliers_explanation: e.target.value })}
              disabled={!canRespond || existingResponse}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              rows={4}
              placeholder="Explain any unusual mark distributions..."
            />
          </div>

          {/* Radio buttons: Third marker decision — whether the sample needs a third marker
              Per Section 12.22 of academic regulations, if the module leader and moderator cannot agree,
              the sample is sent to a third marker for independent review */}
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-medium mb-2">
              Does the sample need to be assigned to a third marker to confirm the marks are appropriate?
            </div>
            <div className="flex gap-4">
              {/* "No" option — marks are agreed, no escalation needed */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="needs_third_marker"
                  checked={!response.needs_third_marker}
                  onChange={() => setResponse({ ...response, needs_third_marker: false })}
                  disabled={!canRespond || existingResponse}
                />
                <span className="text-sm">No</span>
              </label>
              {/* "Yes" option — escalates to third marker for dispute resolution */}
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="needs_third_marker"
                  checked={response.needs_third_marker}
                  onChange={() => setResponse({ ...response, needs_third_marker: true })}
                  disabled={!canRespond || existingResponse}
                />
                <span className="text-sm">Yes</span>
              </label>
            </div>
            {/* Warning message shown when third marker is selected — alerts the user about the escalation */}
            {response.needs_third_marker && (
              <div className="mt-2 text-xs text-amber-600">
                Warning: Selecting &quot;Yes&quot; will escalate the assessment to a third marker for review.
              </div>
            )}
          </div>

          {/* Form action buttons and status messages */}
          <div className="flex items-center gap-3">
            {/* Submit button — disabled when: can't respond, already submitted, currently submitting,
                or the required checkbox isn't checked */}
            <button
              onClick={handleSubmit}
              disabled={!canRespond || existingResponse || submitting || !response.moderator_comments_considered}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {/* Show "Submitting..." while the API call is in progress */}
              {submitting ? "Submitting..." : "Submit Response"}
            </button>
            {/* Confirmation text shown if a response was already submitted (prevents duplicate submissions) */}
            {existingResponse && (
              <span className="text-sm text-green-600">✓ Response already submitted</span>
            )}
            {/* Informational text shown when the assessment status doesn't allow responses yet */}
            {!canRespond && (
              <span className="text-sm text-gray-600">
                Response can only be submitted after moderation review.
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
