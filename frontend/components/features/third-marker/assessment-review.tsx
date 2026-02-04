"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import {
  getThirdMarkerAssessment,
  getThirdMarkerSample,
  getThirdMarkerModerationCase,
  submitThirdMarkerDecision,
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
        const [assessmentData, sampleData, caseData] = await Promise.all([
          getThirdMarkerAssessment(assessmentId),
          getThirdMarkerSample(assessmentId),
          getThirdMarkerModerationCase(assessmentId),
        ]);
        setAssessment(assessmentData);
        setSample(sampleData);
        setModerationCase(caseData);
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

  async function handleDecision(decision: "CONFIRM_MODERATOR" | "OVERRIDE_MODERATOR" | "REFER_BACK") {
    setSubmitting(true);
    setError(null);

    try {
      await submitThirdMarkerDecision(assessmentId, {
        decision,
        comment: comment || undefined,
      });
      router.push("/third-marker/dashboard");
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
          <h1 className="text-2xl font-semibold">Third Marker Review</h1>
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.module_name}
          </p>
          <p className="mt-1 text-xs text-gray-500">Assessment ID: {assessmentId}</p>
        </div>

        <Link
          href="/third-marker/dashboard"
          className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">{assessment.title}</h2>
          <div className="mt-1 text-sm text-gray-600">Cohort {assessment.cohort}</div>
          <div className="mt-2 text-sm text-gray-600">
            Lecturer: <span className="font-medium">{moderationCase?.lecturer_name || "Unknown"}</span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Moderator: <span className="font-medium">{moderationCase?.moderator_name || "Unknown"}</span>
          </div>
        </div>
      </Card>

      {/* Comments */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <div className="p-5">
            <h3 className="text-md font-semibold">Lecturer notes</h3>
            <p className="mt-2 text-sm text-gray-700">
              {moderationCase?.lecturer_comment || "No notes provided."}
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <h3 className="text-md font-semibold">Moderator notes</h3>
            <p className="mt-2 text-sm text-gray-700">
              {moderationCase?.moderator_comment || "No notes provided."}
            </p>
          </div>
        </Card>
      </section>

      {/* Sample */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Moderation sample</h2>
          <div className="text-sm text-gray-600">{sample.length} students</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Mark</th>
                <th className="px-5 py-3 font-medium">Marker</th>
              </tr>
            </thead>

            <tbody>
              {sample.map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="px-5 py-4 font-medium">{s.student_id}</td>
                  <td className="px-5 py-4">{s.mark}</td>
                  <td className="px-5 py-4">{s.marker_id ?? "—"}</td>
                </tr>
              ))}

              {sample.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-600" colSpan={3}>
                    No sample items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Decision */}
      <Card>
        <div className="p-5 space-y-3">
          <h2 className="text-lg font-semibold">Final decision</h2>
          <p className="text-sm text-gray-600">
            Record the final outcome of this escalation.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <button
              onClick={() => handleDecision("CONFIRM_MODERATOR")}
              disabled={submitting}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Confirm moderator decision for this assessment"
            >
              {submitting ? "Submitting..." : "Confirm moderator decision"}
            </button>
            <button
              onClick={() => handleDecision("OVERRIDE_MODERATOR")}
              disabled={submitting}
              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              aria-label="Override moderator decision for this assessment"
            >
              {submitting ? "Submitting..." : "Override decision"}
            </button>
            <button
              onClick={() => handleDecision("REFER_BACK")}
              disabled={submitting}
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              aria-label="Refer this assessment back for further review"
            >
              {submitting ? "Submitting..." : "Refer back"}
            </button>
          </div>

          <div>
            <label htmlFor="third-marker-comment" className="text-xs text-gray-600">Third marker comment</label>
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
