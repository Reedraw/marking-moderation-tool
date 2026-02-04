"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import {
  getModeratorAssessment,
  getModeratorSample,
  getModerationCase,
  submitModerationDecision,
  submitModerationForm,
  type Assessment,
  type SampleItem,
  type ModerationCase,
  type ModerationFormData,
} from "@/lib/assessments-api";

interface AssessmentReviewProps {
  assessmentId: string;
}

export function AssessmentReview({ assessmentId }: AssessmentReviewProps) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sample, setSample] = useState<SampleItem[]>([]);
  const [moderationCase, setModerationCase] = useState<ModerationCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [formData, setFormData] = useState<ModerationFormData>({
    has_marking_rubric: true,
    criteria_consistently_applied: true,
    full_range_of_marks_used: true,
    marks_awarded_fairly: true,
    feedback_comments_appropriate: true,
    all_marks_appropriate: true,
  });

  useEffect(() => {
    async function loadData() {
      try {
        const assessmentData = await getModeratorAssessment(assessmentId);
        setAssessment(assessmentData);

        const sampleData = await getModeratorSample(assessmentId);
        setSample(sampleData);

        try {
          const caseData = await getModerationCase(assessmentId);
          setModerationCase(caseData);
        } catch (caseError) {
          // Moderation case might not exist yet - this is okay
          console.log("No moderation case found yet:", caseError);
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401) {
            router.push("/login");
          } else {
            setError(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
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

  async function handleDecision(decision: "APPROVED" | "CHANGES_REQUESTED" | "ESCALATED") {
    setSubmitting(true);
    setError(null);

    try {
      // Submit the moderation form with decision in one request
      await submitModerationForm(assessmentId, formData, decision, comment || undefined);
      router.push("/moderator/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit decision");
      }
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

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Moderation Review</h1>
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.module_name}
          </p>
          <p className="mt-1 text-xs text-gray-500">Assessment ID: {assessmentId}</p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/moderator/dashboard"
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      <Card>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{assessment.title}</h2>
              <div className="mt-1 text-sm text-gray-600">
                Cohort {assessment.cohort} • Due {assessment.due_date}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Lecturer: <span className="font-medium">{moderationCase?.lecturer_name || "Unknown"}</span>
              </div>
            </div>

            <div className="rounded-xl border bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-600">Sample</div>
              <div className="mt-1 font-medium">
                {assessment.sample_size || 0} ({assessment.sample_percent || 0}%) • {assessment.sample_method || "N/A"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lecturer comment */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">Lecturer notes</h2>
          <p className="mt-2 text-sm text-gray-700">
            {moderationCase?.lecturer_comment || "No comment provided."}
          </p>
        </div>
      </Card>

      {/* Sample table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Sample set</h2>
          <div className="text-sm text-gray-600">{sample.length} shown</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Mark</th>
                <th className="px-5 py-3 font-medium">Marker</th>
                <th className="px-5 py-3 font-medium">Notes</th>
              </tr>
            </thead>

            <tbody>
              {sample.map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="px-5 py-4 font-medium">{s.student_id}</td>
                  <td className="px-5 py-4">{s.mark}</td>
                  <td className="px-5 py-4">{s.marker_id ?? "—"}</td>
                  <td className="px-5 py-4">
                    {s.moderator_note ? (
                      <span className="text-sm text-gray-600">{s.moderator_note}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}

              {sample.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-600" colSpan={4}>
                    No sample items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Moderation Form - 6 Required Questions */}
      <Card>
        <div className="p-5 space-y-6">
          <div>
            <h2 className="text-lg font-semibold">Moderation Form</h2>
            <p className="mt-1 text-sm text-gray-600">
              Complete all 6 questions based on your review of the sample
            </p>
          </div>

          {/* Q1: Marking Rubric */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              1. Was there a marking rubric for the module?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.has_marking_rubric === true}
                  onChange={() => setFormData({ ...formData, has_marking_rubric: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
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
            <textarea
              value={formData.has_marking_rubric_comment || ""}
              onChange={(e) => setFormData({ ...formData, has_marking_rubric_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q2: Criteria Consistently Applied */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              2. Were the marking criteria consistently applied across all scripts?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.criteria_consistently_applied === true}
                  onChange={() => setFormData({ ...formData, criteria_consistently_applied: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
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
            <textarea
              value={formData.criteria_consistently_applied_comment || ""}
              onChange={(e) => setFormData({ ...formData, criteria_consistently_applied_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q3: Full Range of Marks Used */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              3. Was the full range of marks used?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.full_range_of_marks_used === true}
                  onChange={() => setFormData({ ...formData, full_range_of_marks_used: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
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
            <textarea
              value={formData.full_range_of_marks_used_comment || ""}
              onChange={(e) => setFormData({ ...formData, full_range_of_marks_used_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q4: Marks Awarded Fairly */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              4. Were marks awarded fairly?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.marks_awarded_fairly === true}
                  onChange={() => setFormData({ ...formData, marks_awarded_fairly: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
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
            <textarea
              value={formData.marks_awarded_fairly_comment || ""}
              onChange={(e) => setFormData({ ...formData, marks_awarded_fairly_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q5: Feedback Comments Appropriate */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              5. Were feedback comments appropriate and do they justify the marks awarded?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.feedback_comments_appropriate === true}
                  onChange={() => setFormData({ ...formData, feedback_comments_appropriate: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
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
            <textarea
              value={formData.feedback_comments_appropriate_comment || ""}
              onChange={(e) => setFormData({ ...formData, feedback_comments_appropriate_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Q6: All Marks Appropriate */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              6. Are you able to confirm that all marks in the sample are appropriate?
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.all_marks_appropriate === true}
                  onChange={() => setFormData({ ...formData, all_marks_appropriate: true })}
                  className="text-blue-600"
                />
                <span className="text-sm">Yes</span>
              </label>
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
            <textarea
              value={formData.all_marks_appropriate_comment || ""}
              onChange={(e) => setFormData({ ...formData, all_marks_appropriate_comment: e.target.value })}
              placeholder="Optional comment..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={2}
            />
          </div>

          {/* Recommendations (shown if Q6 is No) */}
          {!formData.all_marks_appropriate && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-red-600">
                Recommendations (Required when marks are not appropriate)
              </label>
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

          {/* Feedback Suggestions (shown if Q6 is Yes) */}
          {formData.all_marks_appropriate && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Feedback Suggestions (Optional)
              </label>
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

      {/* Decision panel */}
      <Card>
        <div className="p-5 space-y-3">
          <h2 className="text-lg font-semibold">Moderator decision</h2>
          <p className="text-sm text-gray-600">
            Record outcome to update workflow and notify the lecturer.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              onClick={() => handleDecision("APPROVED")}
              disabled={submitting}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Approve moderation outcome"
            >
              {submitting ? "Submitting..." : "Approve"}
            </button>
            <button
              onClick={() => handleDecision("CHANGES_REQUESTED")}
              disabled={submitting}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Request changes to marking"
            >
              {submitting ? "Submitting..." : "Request changes"}
            </button>
            <button
              onClick={() => handleDecision("ESCALATED")}
              disabled={submitting}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              aria-label="Escalate to third marker for independent review"
            >
              {submitting ? "Submitting..." : "Escalate to third marker"}
            </button>
          </div>

          <div>
            <label htmlFor="moderator-comment" className="text-xs text-gray-600">Moderator comment</label>
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
