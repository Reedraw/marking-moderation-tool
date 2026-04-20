// "use client" directive tells Next.js this component runs in the browser (client-side),
// required because we use React hooks (useState, useEffect) and handle interactive form elements
"use client";

// useState manages reactive component state; useEffect runs side effects (data fetching) on mount
import { useState, useEffect } from "react";
// Link component from Next.js for client-side navigation without full page reloads
import Link from "next/link";
// useRouter from Next.js App Router for programmatic navigation (e.g., redirect to login)
import { useRouter } from "next/navigation";
// Card is a reusable styled container component from the shared UI library
import { Card } from "@/components/ui";
// ApiError is a custom error class carrying HTTP status code and detail message from the backend
import { ApiError } from "@/lib/api-client";
// Import multiple API functions and TypeScript types needed for this component:
// - getAssessment: fetches a single assessment by ID
// - getAssessmentSample: fetches the generated moderation sample items
// - generateSample: triggers sample generation on the backend
// - submitForModeration: submits the assessment for moderator review
// - submitPreModerationChecklist / getPreModerationChecklist: save/load the pre-moderation checklist
// - Assessment, SampleItem, PreModerationChecklistSubmit: TypeScript types for type safety
import {
  getAssessment,
  getAssessmentSample,
  generateSample,
  submitForModeration,
  submitPreModerationChecklist,
  getPreModerationChecklist,
  type Assessment,
  type SampleItem,
  type PreModerationChecklistSubmit,
} from "@/lib/assessments-api";

// TypeScript union type defining all possible human-readable status labels
// Used for type safety in components that display assessment status text
type Status =
  | "Draft"
  | "Marks Uploaded"
  | "Sample Generated"
  | "Pending Moderation"
  | "In Moderation"
  | "Approved"
  | "Changes Requested";

// StatusPill is a small helper component that renders a coloured badge/pill for an assessment status.
// It takes a raw backend status string (e.g., "SUBMITTED_FOR_MODERATION") and maps it to styled display text.
function StatusPill({ status }: { status: string }) {
  // Base Tailwind CSS classes shared by all status pills: inline layout, rounded corners, padding, font size, border
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border";
  // Map from backend status codes to Tailwind colour classes — each status gets a distinct colour
  const map: Record<string, string> = {
    DRAFT: "bg-gray-50 text-gray-700 border-gray-200",                          // Neutral grey for draft
    MARKS_UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",                  // Blue for marks uploaded
    SAMPLE_GENERATED: "bg-indigo-50 text-indigo-700 border-indigo-200",          // Indigo for sample ready
    SUBMITTED_FOR_MODERATION: "bg-yellow-50 text-yellow-800 border-yellow-200",  // Yellow for waiting
    IN_MODERATION: "bg-purple-50 text-purple-700 border-purple-200",             // Purple for active review
    APPROVED: "bg-green-50 text-green-700 border-green-200",                     // Green for approved
    CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",                  // Red for action needed
    ESCALATED: "bg-indigo-50 text-indigo-700 border-indigo-200",                 // Indigo for escalation
  };
  // Map from backend status codes to user-friendly display strings
  const displayMap: Record<string, string> = {
    DRAFT: "Draft",
    MARKS_UPLOADED: "Marks Uploaded",
    SAMPLE_GENERATED: "Sample Generated",
    SUBMITTED_FOR_MODERATION: "Pending Moderation",
    IN_MODERATION: "In Moderation",
    APPROVED: "Approved",
    CHANGES_REQUESTED: "Changes Requested",
    ESCALATED: "Escalated",
  };
  // Render a <span> with combined base + status-specific classes, displaying the human-readable text
  return <span className={`${base} ${map[status] || ""}`}>{displayMap[status] || status}</span>;
}

// TypeScript interface defining the props this component expects — the assessment UUID from the URL route params
interface AssessmentDetailProps {
  assessmentId: string;
}

// Main component: Assessment detail page where the lecturer can view assessment info,
// generate a moderation sample, complete the pre-moderation checklist, and submit for moderation.
// This implements the core workflow from Section 12.15-12.31 of academic regulations.
export function AssessmentDetail({ assessmentId }: AssessmentDetailProps) {
  // Router for programmatic navigation (redirect to login on auth failure)
  const router = useRouter();
  // State to hold the full assessment object; null until loaded from the API
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  // State to hold the array of sample items (student marks selected for moderation review)
  const [sample, setSample] = useState<SampleItem[]>([]);
  // Loading state — true while the initial data fetch is in progress
  const [loading, setLoading] = useState(true);
  // Generating state — true while sample generation API call is in progress
  const [generating, setGenerating] = useState(false);
  // Submitting state — true while the "submit for moderation" API call is in progress
  const [submitting, setSubmitting] = useState(false);
  // Error message state — null means no error to display
  const [error, setError] = useState<string | null>(null);
  // Success message state — shown after a successful action (sample generated, submitted, etc.)
  const [success, setSuccess] = useState<string | null>(null);
  // Sample generation method: RANDOM, STRATIFIED, or RISK_BASED — default is RISK_BASED
  // RISK_BASED prioritises boundary cases (38-42%, 58-62%, 68-72%) per Section 12.19-12.20
  const [sampleMethod, setSampleMethod] = useState<"RANDOM" | "STRATIFIED" | "RISK_BASED">("RISK_BASED");
  // Sample percentage — what % of the cohort to include in the sample (default 10%)
  // Academic regulations specify minimum percentages based on cohort size (Section 12.18)
  const [samplePercent, setSamplePercent] = useState(10);
  // Optional comment the lecturer can send to the moderator when submitting
  const [moderatorComment, setModeratorComment] = useState("");

  // Pre-moderation checklist state — tracks which items the lecturer has confirmed
  // These checkboxes correspond to the "Marking Process Checklist" from the moderation form
  const [checklist, setChecklist] = useState<PreModerationChecklistSubmit>({
    marking_in_accordance: false,              // Marking followed assessment regulations and marking scheme
    late_work_policy_adhered: false,           // Late submission policy was applied correctly
    plagiarism_policy_adhered: false,          // Academic misconduct/plagiarism policy was followed
    marks_available_with_percentages: false,   // All marks include pass/fail/non-submission percentages
    totalling_checked: false,                  // Mark totals have been verified for accuracy
    consistency_comments: "",                  // Free-text: how consistency across markers was ensured
  });
  // Tracks whether the checklist has been saved to the backend (shows "✓ Checklist saved" indicator)
  const [checklistSaved, setChecklistSaved] = useState(false);

  // useEffect runs once on mount to load assessment data, sample, and checklist from the backend
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch the full assessment object by its ID (includes module info, status, marks count, etc.)
        const assessmentData = await getAssessment(assessmentId);
        setAssessment(assessmentData);

        // If the assessment already has a sample generated (sample_size > 0), load the sample items
        if (assessmentData.sample_size && assessmentData.sample_size > 0) {
          try {
            // Fetch the list of student marks that were selected for the moderation sample
            const sampleData = await getAssessmentSample(assessmentId);
            setSample(sampleData);
          } catch {
            // Sample data might not be available yet — silently ignore 404 errors
          }
        }

        // Try to load an existing pre-moderation checklist (if lecturer previously saved one)
        try {
          const existingChecklist = await getPreModerationChecklist(assessmentId);
          // Pre-fill the checklist form with the previously saved values
          setChecklist({
            marking_in_accordance: existingChecklist.marking_in_accordance,
            late_work_policy_adhered: existingChecklist.late_work_policy_adhered,
            plagiarism_policy_adhered: existingChecklist.plagiarism_policy_adhered,
            marks_available_with_percentages: existingChecklist.marks_available_with_percentages,
            totalling_checked: existingChecklist.totalling_checked,
            consistency_comments: existingChecklist.consistency_comments || "",
          });
          // Show the "✓ Checklist saved" indicator since it was loaded from the backend
          setChecklistSaved(true);
        } catch {
          // Checklist might not exist yet (first visit) — silently ignore 404 errors
        }
      } catch (err) {
        // Handle API-specific errors
        if (err instanceof ApiError) {
          if (err.status === 401) {
            // Unauthorized — JWT expired or missing, redirect to login
            router.push("/login");
          } else {
            // Display the server error detail (e.g., 403 Forbidden, 404 Not Found)
            setError(err.detail);
          }
        } else {
          // Handle generic errors (network failures, JSON parse errors, etc.)
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        // Stop the loading spinner regardless of outcome
        setLoading(false);
      }
    }

    loadData();
  }, [assessmentId, router]); // Re-run if assessmentId or router reference changes

  // Derived boolean: checks if ALL required checklist items are checked (all must be true to submit)
  // The consistency_comments field is optional so it's not included in this check
  const isChecklistComplete = 
    checklist.marking_in_accordance &&
    checklist.late_work_policy_adhered &&
    checklist.plagiarism_policy_adhered &&
    checklist.marks_available_with_percentages &&
    checklist.totalling_checked;

  // Handler to save the pre-moderation checklist to the backend without submitting for moderation
  async function handleSaveChecklist() {
    setError(null);
    try {
      // Send the checklist data to the backend API for this assessment
      await submitPreModerationChecklist(assessmentId, checklist);
      // Mark the checklist as saved (shows green checkmark indicator)
      setChecklistSaved(true);
      setSuccess("Checklist saved successfully");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to save checklist");
      }
    }
  }

  // Handler to generate a moderation sample from the uploaded marks
  // The sample is a subset of student marks selected for the moderator to review
  async function handleGenerateSample() {
    // Set generating state to show loading indicator and disable the button
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      // Call the backend API to generate a sample using the selected method and percentage
      // The backend applies rules from Section 12.18-12.20 (sample size, boundary cases, etc.)
      const result = await generateSample(assessmentId, sampleMethod, samplePercent);
      // Show success message with the sample size, percentage, and method used
      setSuccess(`Sample generated: ${result.sample_size} items (${result.percent}% using ${result.method})`);
      // Store the sample items for display in the preview table
      setSample(result.sample_items || []);
      // Reload the full assessment object to get updated sample_size and sample_method fields
      const assessmentData = await getAssessment(assessmentId);
      setAssessment(assessmentData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate sample");
      }
    } finally {
      // Always reset the generating state
      setGenerating(false);
    }
  }

  // Handler to submit the assessment for moderation — this is the key workflow transition
  // After submission, the moderator is notified and the assessment is locked from further changes
  async function handleSubmitForModeration() {
    // Set submitting state to disable the button and prevent double-submission
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // First, save/update the pre-moderation checklist to ensure it's persisted
      await submitPreModerationChecklist(assessmentId, checklist);
      setChecklistSaved(true);

      // Then submit the assessment for moderation, optionally including a comment for the moderator
      // The backend changes the status to SUBMITTED_FOR_MODERATION and notifies the assigned moderator
      await submitForModeration(assessmentId, moderatorComment || undefined);
      setSuccess("Assessment submitted for moderation successfully");
      // Reload the assessment to reflect the new status in the UI
      const assessmentData = await getAssessment(assessmentId);
      setAssessment(assessmentData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit for moderation");
      }
    } finally {
      // Always reset the submitting state
      setSubmitting(false);
    }
  }

  // Helper function that returns the next action the lecturer should take based on the current status
  // Used in the "Next step" card to guide the lecturer through the moderation workflow
  function getNextStep(status: string): string {
    switch (status) {
      case "DRAFT":
        return "Upload marks";                          // Step 1: Upload CSV with student marks
      case "MARKS_UPLOADED":
        return "Generate sample";                       // Step 2: Generate a moderation sample
      case "SAMPLE_GENERATED":
        return "Submit for moderation";                 // Step 3: Complete checklist and submit
      case "SUBMITTED_FOR_MODERATION":
      case "IN_MODERATION":
        return "Awaiting moderator review";             // Waiting: moderator is reviewing the sample
      case "APPROVED":
        return "Respond to confirm final marks";        // Step 4: Submit Module Leader Response
      case "CHANGES_REQUESTED":
        return "Revise marks and resubmit";             // Revision: moderator requested changes
      default:
        return "Unknown";
    }
  }

  // --- Loading state: show a spinner/message while data is being fetched ---
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // --- Error state: assessment not found (null after fetch completed) ---
  if (!assessment) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Assessment not found
      </div>
    );
  }

  // --- Permission flags: determine which actions are available based on current assessment status ---

  // Sample can be generated (or regenerated) when marks are uploaded, sample already generated, or changes were requested
  // CHANGES_REQUESTED allows regenerating because the moderator may have asked for mark revisions
  const canGenerateSample = assessment.status === "MARKS_UPLOADED" || assessment.status === "SAMPLE_GENERATED" || assessment.status === "CHANGES_REQUESTED";
  // Assessment can be submitted for moderation when a sample exists, or when resubmitting after changes
  const canSubmit = assessment.status === "SAMPLE_GENERATED" || assessment.status === "CHANGES_REQUESTED";
  // Module Leader Response form is only available after the assessment has been approved by the moderator
  // This is the final step where the lecturer confirms or escalates (not during the revision cycle)
  const canRespondToModerator = assessment.status === "APPROVED";

  // --- JSX Return: The component's rendered output ---
  return (
    // Outer container with vertical spacing between all sections
    <div className="space-y-6">
      {/* Page header: assessment title, module info, and contextual action buttons */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Main heading */}
          <h1 className="text-2xl font-semibold">Assessment</h1>
          {/* Module code and name for context */}
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.module_name}
          </p>
          {/* Assessment UUID for reference/debugging */}
          <p className="mt-1 text-xs text-gray-500">Assessment ID: {assessmentId}</p>
        </div>

        {/* Action buttons — which ones show depends on the current assessment status */}
        <div className="flex gap-2">
          {/* "Respond to Moderator" button — only shown when assessment is APPROVED */}
          {canRespondToModerator && (
            <Link
              href={`/lecturer/assessments/${assessmentId}/response`}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Respond to Moderator
            </Link>
          )}
          {/* "Upload marks" button — shown during early workflow stages (Draft, Marks Uploaded, Sample Generated) */}
          {(assessment.status === "DRAFT" || assessment.status === "MARKS_UPLOADED" || assessment.status === "SAMPLE_GENERATED") && (
            <Link
              href={`/lecturer/assessments/${assessmentId}/upload`}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Upload marks
            </Link>
          )}
          {/* "Revise Marks" button — shown when moderator has requested changes (amber colour for urgency) */}
          {assessment.status === "CHANGES_REQUESTED" && (
            <Link
              href={`/lecturer/assessments/${assessmentId}/upload`}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Revise Marks
            </Link>
          )}
          {/* "Back" button — always visible, returns to the lecturer dashboard */}
          <Link
            href="/lecturer/dashboard"
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </header>

      {/* Error banner — conditionally rendered when there's an error message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success banner — shown after successful actions (sample generated, checklist saved, etc.) */}
      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Assessment Summary card — shows key information about the assessment at a glance */}
      <Card>
        <div className="p-5">
          {/* Title row with assessment name and status pill badge */}
          <div className="flex items-start justify-between gap-4">
            <div>
              {/* Assessment title (e.g., "Coursework 1") */}
              <h2 className="text-lg font-semibold">{assessment.title}</h2>
              {/* Cohort year and due date */}
              <div className="mt-1 text-sm text-gray-600">
                Cohort {assessment.cohort} • Due {assessment.due_date}
              </div>
            </div>
            {/* Render the coloured status pill using the StatusPill helper component */}
            <StatusPill status={assessment.status} />
          </div>

          {/* Three-column summary grid showing key metrics */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Card 1: Number of student marks that have been uploaded */}
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Marks uploaded</div>
              <div className="mt-2 text-xl font-semibold">{assessment.marks_uploaded_count || 0}</div>
            </div>
            {/* Card 2: Sample size — how many marks are in the moderation sample */}
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Sample size</div>
              {/* Use nullish coalescing (??) to show "—" dash if sample_size is null/undefined */}
              <div className="mt-2 text-xl font-semibold">{assessment.sample_size ?? "—"}</div>
              {/* Show percentage and method if sample exists, otherwise "Not generated yet" */}
              <div className="mt-1 text-xs text-gray-500">
                {assessment.sample_size ? `${assessment.sample_percent}% • ${assessment.sample_method}` : "Not generated yet"}
              </div>
            </div>
            {/* Card 3: Next step guidance — tells the lecturer what to do next in the workflow */}
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Next step</div>
              <div className="mt-2 font-medium">{getNextStep(assessment.status)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Generate Sample card — controls for creating a moderation sample from uploaded marks */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">Generate moderation sample</h2>
          <p className="mt-1 text-sm text-gray-600">
            Create a sample set for moderation before submitting.
          </p>

          {/* Three-column grid: method selector, percentage input, and generate button */}
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Dropdown to select the sampling method */}
            <div>
              <label htmlFor="sample-method" className="text-xs text-gray-600">Method</label>
              <select
                id="sample-method"
                value={sampleMethod}
                // Cast the selected value to the union type; update state on change
                onChange={(e) => setSampleMethod(e.target.value as "RANDOM" | "STRATIFIED" | "RISK_BASED")}
                // Disabled when sample generation isn't allowed or when a generation is in progress
                disabled={!canGenerateSample || generating}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                {/* Random: purely random selection from all marks */}
                <option value="RANDOM">Random</option>
                {/* Stratified: ensures proportional representation across mark ranges */}
                <option value="STRATIFIED">Stratified</option>
                {/* Risk-based: prioritises boundary cases (38-42%, 58-62%, 68-72%) per Section 12.19 */}
                <option value="RISK_BASED">Risk-based</option>
              </select>
            </div>

            {/* Numeric input for the sample percentage (1-30% of the cohort) */}
            <div>
              <label htmlFor="sample-percent" className="text-xs text-gray-600">Percent</label>
              <input
                id="sample-percent"
                type="number"
                min={1}
                max={30}
                value={samplePercent}
                // Convert the string input value to a number before storing in state
                onChange={(e) => setSamplePercent(Number(e.target.value))}
                disabled={!canGenerateSample || generating}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>

            {/* Generate button — triggers the handleGenerateSample async function */}
            <div className="flex items-end">
              <button
                onClick={handleGenerateSample}
                disabled={!canGenerateSample || generating}
                className="w-full rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {/* Show "Generating..." while the API call is in progress */}
                {generating ? "Generating..." : "Generate sample"}
              </button>
            </div>
          </div>

          {/* Informational message shown when sample generation is not yet available */}
          {!canGenerateSample && (
            <div className="mt-3 text-xs text-gray-500">
              {assessment.status === "DRAFT" 
                ? "Upload marks first before generating a sample." 
                : "Sample generation is only available for assessments with uploaded marks."}
            </div>
          )}
        </div>
      </Card>

      {/* Sample Preview table — only rendered when sample items exist (sample has been generated) */}
      {sample.length > 0 && (
        <Card>
          {/* Table header row with title and item count */}
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-lg font-semibold">Sample preview</h2>
            <div className="text-sm text-gray-600">{sample.length} items</div>
          </div>

          {/* Scrollable table container for the sample data */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Column headers: Student ID, Mark, and Marker */}
              <thead className="text-left text-gray-600">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Mark</th>
                  <th className="px-5 py-3 font-medium">Marker</th>
                </tr>
              </thead>
              <tbody>
                {/* Map over each sample item to create a table row; key={s.id} for React reconciliation */}
                {sample.map((s) => (
                  <tr key={s.id} className="border-b last:border-b-0">
                    {/* Student ID — anonymised identifier (e.g., "w1234567") */}
                    <td className="px-5 py-4 font-medium">{s.student_id}</td>
                    {/* The student's mark (0-100) */}
                    <td className="px-5 py-4">{s.mark}</td>
                    {/* Marker ID — who graded this student; show "—" dash if not specified */}
                    <td className="px-5 py-4">{s.marker_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pre-Moderation Checklist card — the "Marking Process Checklist" from the moderation form.
          The lecturer must confirm all items before submitting the assessment for internal moderation.
          These items ensure marking quality and compliance with academic regulations. */}
      <Card>
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Marking Process Checklist</h2>
            <p className="mt-1 text-sm text-gray-600">
              Complete this checklist before submitting for internal moderation. All items must be checked.
            </p>
          </div>

          {/* Checklist items — each is a checkbox with a descriptive label */}
          <div className="space-y-3">
            {/* Item 1: Marking followed assessment regulations and the marking scheme */}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={checklist.marking_in_accordance}
                // Spread operator creates a new checklist object with the updated field (immutable update)
                onChange={(e) => setChecklist({ ...checklist, marking_in_accordance: e.target.checked })}
                // Only editable when the sample has been generated (SAMPLE_GENERATED status)
                disabled={assessment.status !== "SAMPLE_GENERATED"}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                Marking was carried out in accordance with Assessment Regulations and the devised marking scheme
              </span>
            </label>

            {/* Item 2: Late work submission policy was correctly applied */}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={checklist.late_work_policy_adhered}
                onChange={(e) => setChecklist({ ...checklist, late_work_policy_adhered: e.target.checked })}
                disabled={assessment.status !== "SAMPLE_GENERATED"}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                The policy regarding hand in of late work has been adhered to (for coursework)
              </span>
            </label>

            {/* Item 3: Academic misconduct/plagiarism policy was followed */}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={checklist.plagiarism_policy_adhered}
                onChange={(e) => setChecklist({ ...checklist, plagiarism_policy_adhered: e.target.checked })}
                disabled={assessment.status !== "SAMPLE_GENERATED"}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                The policy regarding misconduct/plagiarism has been adhered to
              </span>
            </label>

            {/* Item 4: All marks include percentages and pass/fail/non-submission breakdown */}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={checklist.marks_available_with_percentages}
                onChange={(e) => setChecklist({ ...checklist, marks_available_with_percentages: e.target.checked })}
                disabled={assessment.status !== "SAMPLE_GENERATED"}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                All marks have been made available with percentages of pass/fail/non-submissions
              </span>
            </label>

            {/* Item 5: Mark totals have been verified for mathematical correctness */}
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={checklist.totalling_checked}
                onChange={(e) => setChecklist({ ...checklist, totalling_checked: e.target.checked })}
                disabled={assessment.status !== "SAMPLE_GENERATED"}
                className="mt-0.5 h-4 w-4"
              />
              <span className="text-sm">
                The totalling of marks has been checked for correctness
              </span>
            </label>
          </div>

          {/* Optional free-text field for explaining how consistency across multiple markers was ensured */}
          <div>
            <label className="text-xs text-gray-600">
              Comments (in case of multiple markers, please state how consistency across markers has been ensured)
            </label>
            <textarea
              value={checklist.consistency_comments}
              onChange={(e) => setChecklist({ ...checklist, consistency_comments: e.target.value })}
              disabled={assessment.status !== "SAMPLE_GENERATED"}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              rows={3}
              placeholder="E.g., All markers attended standardisation meeting, double-marked borderline cases..."
            />
          </div>

          {/* Save Checklist button and status indicators */}
          <div className="flex items-center gap-3">
            {/* Save button — only enabled when status is SAMPLE_GENERATED */}
            <button
              onClick={handleSaveChecklist}
              disabled={assessment.status !== "SAMPLE_GENERATED"}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Save Checklist
            </button>
            {/* Green checkmark shown after the checklist has been successfully saved */}
            {checklistSaved && (
              <span className="text-sm text-green-600">✓ Checklist saved</span>
            )}
            {/* Warning shown when some checklist items are still unchecked */}
            {!isChecklistComplete && assessment.status === "SAMPLE_GENERATED" && (
              <span className="text-sm text-amber-600">Please check all items before submitting</span>
            )}
          </div>
        </div>
      </Card>

      {/* Submit for Moderation card — final step where the lecturer submits the assessment to the moderator.
          The button text and behaviour change depending on whether it's a first submission
          or a resubmission after the moderator requested changes. */}
      <Card>
        <div className="p-5">
          {/* Dynamic title: "Resubmit" when changes were requested, otherwise "Submit" */}
          <h2 className="text-lg font-semibold">
            {assessment.status === "CHANGES_REQUESTED" ? "Resubmit for moderation" : "Submit for moderation"}
          </h2>
          {/* Contextual description explaining what happens upon submission */}
          <p className="mt-1 text-sm text-gray-600">
            {assessment.status === "CHANGES_REQUESTED"
              ? "After revising marks as requested, resubmit for moderator review."
              : "When submitted, the system notifies the assigned moderator and locks workflow changes."}
          </p>

          {/* Textarea for the lecturer to include a note to the moderator */}
          <div className="mt-4">
            <label htmlFor="moderator-comment" className="text-xs text-gray-600">
              {/* Label changes based on context — "Explain what was revised" vs "Optional comment" */}
              {assessment.status === "CHANGES_REQUESTED" ? "Explain what was revised" : "Optional comment to moderator"}
            </label>
            <textarea
              id="moderator-comment"
              value={moderatorComment}
              // Update the moderatorComment state as the user types
              onChange={(e) => setModeratorComment(e.target.value)}
              // Disabled when submission isn't allowed or while submitting
              disabled={!canSubmit || submitting}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              rows={3}
              // Placeholder varies by context
              placeholder={assessment.status === "CHANGES_REQUESTED" 
                ? "Describe what marks were revised and why..."
                : "E.g., marking rubric notes, special cases, late submissions..."}
            />
          </div>

          {/* Button row with submit button and contextual warning messages */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              // Triggers the handleSubmitForModeration async function
              onClick={handleSubmitForModeration}
              // Disabled when: can't submit, checklist incomplete (except for resubmissions), or already submitting
              disabled={!canSubmit || (!isChecklistComplete && assessment.status !== "CHANGES_REQUESTED") || submitting}
              // Dynamic classes: amber button for resubmission, black button for first submission
              className={`rounded-xl px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 ${
                assessment.status === "CHANGES_REQUESTED" ? "bg-amber-600" : "bg-black"
              }`}
            >
              {/* Button text changes: "Submitting..." while in progress, "Resubmit" or "Submit" otherwise */}
              {submitting ? "Submitting..." : (assessment.status === "CHANGES_REQUESTED" ? "Resubmit for review" : "Submit for moderation")}
            </button>
            {/* Warning message when submission is not yet possible (e.g., no sample generated) */}
            {!canSubmit && (
              <span className="text-sm text-gray-600">
                {assessment.status === "DRAFT" || assessment.status === "MARKS_UPLOADED"
                  ? "Generate a sample first before submitting."
                  : "Already submitted or in progress."}
              </span>
            )}
            {/* Warning when submission is allowed but the checklist hasn't been fully completed */}
            {canSubmit && !isChecklistComplete && assessment.status !== "CHANGES_REQUESTED" && (
              <span className="text-sm text-amber-600">
                Complete the marking process checklist first.
              </span>
            )}
          </div>
        </div>
      </Card>
    {/* Close the outer flex-column container div */}
    </div>
  );
// Close the AssessmentDetail component function
}
