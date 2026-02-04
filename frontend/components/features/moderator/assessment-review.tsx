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
  type Assessment,
  type SampleItem,
  type ModerationCase,
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

  async function handleDecision(decision: "APPROVED" | "CHANGES_REQUESTED" | "ESCALATED") {
    setSubmitting(true);
    setError(null);

    try {
      await submitModerationDecision(assessmentId, {
        decision,
        comment: comment || undefined,
      });
      router.push("/moderator/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
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
