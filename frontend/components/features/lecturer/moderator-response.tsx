"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import {
  getAssessment,
  getLecturerModerationCase,
  submitModuleLeaderResponse,
  getModuleLeaderResponse,
  type Assessment,
  type ModerationCase,
  type ModuleLeaderResponseSubmit,
} from "@/lib/assessments-api";

interface ModeratorResponseProps {
  assessmentId: string;
}

export function ModeratorResponse({ assessmentId }: ModeratorResponseProps) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [moderationCase, setModerationCase] = useState<ModerationCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingResponse, setExistingResponse] = useState(false);

  // Module Leader Response form state
  const [response, setResponse] = useState<ModuleLeaderResponseSubmit>({
    moderator_comments_considered: false,
    response_to_issues: "",
    outliers_explanation: "",
    needs_third_marker: false,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const assessmentData = await getAssessment(assessmentId);
        setAssessment(assessmentData);

        const caseData = await getLecturerModerationCase(assessmentId);
        setModerationCase(caseData);

        // Check if response already exists
        try {
          const existingResp = await getModuleLeaderResponse(assessmentId);
          setResponse({
            moderator_comments_considered: existingResp.moderator_comments_considered,
            response_to_issues: existingResp.response_to_issues || "",
            outliers_explanation: existingResp.outliers_explanation || "",
            needs_third_marker: existingResp.needs_third_marker,
          });
          setExistingResponse(true);
        } catch {
          // Response might not exist yet
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            router.push("/login");
          } else {
            setError(err.detail);
          }
        } else {
          setError(err instanceof Error ? err.message : "Failed to load data");
        }
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [assessmentId, router]);

  async function handleSubmit() {
    if (!response.moderator_comments_considered) {
      setError("You must confirm that you have considered the moderator's comments");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await submitModuleLeaderResponse(assessmentId, response);
      setSuccess(
        response.needs_third_marker
          ? "Response submitted. Assessment has been escalated to third marker."
          : "Response submitted. Final marks have been agreed."
      );
      setExistingResponse(true);
      
      // Reload assessment
      const assessmentData = await getAssessment(assessmentId);
      setAssessment(assessmentData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit response");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Assessment not found
      </div>
    );
  }

  // Only show this page for assessments that have been moderated
  const canRespond = ["IN_MODERATION", "CHANGES_REQUESTED", "APPROVED"].includes(assessment.status);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Module Leader Response</h1>
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.title}
          </p>
        </div>

        <Link
          href={`/lecturer/assessments/${assessmentId}`}
          className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back to Assessment
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Moderator Feedback Summary */}
      {moderationCase && (
        <Card>
          <div className="p-5">
            <h2 className="text-lg font-semibold">Internal Moderator Feedback</h2>
            <p className="mt-1 text-sm text-gray-600">
              Review the moderator&apos;s comments and recommendations below.
            </p>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600">Moderator</div>
                <div className="mt-1 font-medium">{moderationCase.moderator_name || "—"}</div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600">Status</div>
                <div className="mt-1 font-medium">{moderationCase.status}</div>
              </div>

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

      {/* Module Leader Response Form */}
      <Card>
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Your Response</h2>
            <p className="mt-1 text-sm text-gray-600">
              Respond to the moderator&apos;s feedback and confirm final marks.
            </p>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={response.moderator_comments_considered}
              onChange={(e) => setResponse({ ...response, moderator_comments_considered: e.target.checked })}
              disabled={!canRespond || existingResponse}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-sm">
              The Moderator&apos;s comments and recommendations have been given proper consideration and 
              wherever appropriate they have been taken on board and a final set of marks agreed
            </span>
          </label>

          <div>
            <label className="text-xs text-gray-600">
              Please respond to any issues raised/recommendations made by the internal moderator
            </label>
            <textarea
              value={response.response_to_issues}
              onChange={(e) => setResponse({ ...response, response_to_issues: e.target.value })}
              disabled={!canRespond || existingResponse}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              rows={4}
              placeholder="Respond to specific issues or recommendations..."
            />
          </div>

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

          <div className="rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-medium mb-2">
              Does the sample need to be assigned to a third marker to confirm the marks are appropriate?
            </div>
            <div className="flex gap-4">
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
            {response.needs_third_marker && (
              <div className="mt-2 text-xs text-amber-600">
                Warning: Selecting &quot;Yes&quot; will escalate the assessment to a third marker for review.
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={!canRespond || existingResponse || submitting || !response.moderator_comments_considered}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Response"}
            </button>
            {existingResponse && (
              <span className="text-sm text-green-600">✓ Response already submitted</span>
            )}
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
