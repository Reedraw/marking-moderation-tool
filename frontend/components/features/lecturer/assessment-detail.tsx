"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import {
  getAssessment,
  getAssessmentSample,
  generateSample,
  submitForModeration,
  type Assessment,
  type SampleItem,
} from "@/lib/assessments-api";

type Status =
  | "Draft"
  | "Marks Uploaded"
  | "Sample Generated"
  | "Pending Moderation"
  | "In Moderation"
  | "Approved"
  | "Changes Requested";

function StatusPill({ status }: { status: string }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border";
  const map: Record<string, string> = {
    DRAFT: "bg-gray-50 text-gray-700 border-gray-200",
    MARKS_UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",
    SAMPLE_GENERATED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    SUBMITTED_FOR_MODERATION: "bg-yellow-50 text-yellow-800 border-yellow-200",
    IN_MODERATION: "bg-purple-50 text-purple-700 border-purple-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",
    ESCALATED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
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
  return <span className={`${base} ${map[status] || ""}`}>{displayMap[status] || status}</span>;
}

interface AssessmentDetailProps {
  assessmentId: string;
}

export function AssessmentDetail({ assessmentId }: AssessmentDetailProps) {
  const router = useRouter();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [sample, setSample] = useState<SampleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sampleMethod, setSampleMethod] = useState<"RANDOM" | "STRATIFIED" | "RISK_BASED">("RISK_BASED");
  const [samplePercent, setSamplePercent] = useState(10);
  const [moderatorComment, setModeratorComment] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const assessmentData = await getAssessment(assessmentId);
        setAssessment(assessmentData);

        // Load sample if it exists
        if (assessmentData.sample_size && assessmentData.sample_size > 0) {
          try {
            const sampleData = await getAssessmentSample(assessmentId);
            setSample(sampleData);
          } catch {
            // Sample might not exist yet
          }
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

  async function handleGenerateSample() {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await generateSample(assessmentId, sampleMethod, samplePercent);
      setSuccess(`Sample generated: ${result.sample_size} items (${result.percent}% using ${result.method})`);
      setSample(result.sample_items || []);
      // Reload assessment to get updated sample info
      const assessmentData = await getAssessment(assessmentId);
      setAssessment(assessmentData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate sample");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitForModeration() {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await submitForModeration(assessmentId, moderatorComment || undefined);
      setSuccess("Assessment submitted for moderation successfully");
      // Reload assessment to get updated status
      const assessmentData = await getAssessment(assessmentId);
      setAssessment(assessmentData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit for moderation");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function getNextStep(status: string): string {
    switch (status) {
      case "DRAFT":
        return "Upload marks";
      case "MARKS_UPLOADED":
        return "Generate sample";
      case "SAMPLE_GENERATED":
        return "Submit for moderation";
      case "SUBMITTED_FOR_MODERATION":
      case "IN_MODERATION":
        return "Awaiting moderator review";
      case "APPROVED":
        return "Complete";
      case "CHANGES_REQUESTED":
        return "Address feedback";
      default:
        return "Unknown";
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

  const canGenerateSample = assessment.status === "MARKS_UPLOADED" || assessment.status === "SAMPLE_GENERATED";
  const canSubmit = assessment.status === "SAMPLE_GENERATED";

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Assessment</h1>
          <p className="mt-1 text-sm text-gray-600">
            {assessment.module_code} • {assessment.module_name}
          </p>
          <p className="mt-1 text-xs text-gray-500">Assessment ID: {assessmentId}</p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/lecturer/assessments/${assessmentId}/upload`}
            className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Upload marks
          </Link>
          <Link
            href="/lecturer/dashboard"
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

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
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
            </div>
            <StatusPill status={assessment.status} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Marks uploaded</div>
              <div className="mt-2 text-xl font-semibold">{assessment.marks_uploaded_count || 0}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Sample size</div>
              <div className="mt-2 text-xl font-semibold">{assessment.sample_size ?? "—"}</div>
              <div className="mt-1 text-xs text-gray-500">
                {assessment.sample_size ? `${assessment.sample_percent}% • ${assessment.sample_method}` : "Not generated yet"}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Next step</div>
              <div className="mt-2 font-medium">{getNextStep(assessment.status)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Generate sample */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">Generate moderation sample</h2>
          <p className="mt-1 text-sm text-gray-600">
            Create a sample set for moderation before submitting.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="sample-method" className="text-xs text-gray-600">Method</label>
              <select
                id="sample-method"
                value={sampleMethod}
                onChange={(e) => setSampleMethod(e.target.value as "RANDOM" | "STRATIFIED" | "RISK_BASED")}
                disabled={!canGenerateSample || generating}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="RANDOM">Random</option>
                <option value="STRATIFIED">Stratified</option>
                <option value="RISK_BASED">Risk-based</option>
              </select>
            </div>

            <div>
              <label htmlFor="sample-percent" className="text-xs text-gray-600">Percent</label>
              <input
                id="sample-percent"
                type="number"
                min={1}
                max={30}
                value={samplePercent}
                onChange={(e) => setSamplePercent(Number(e.target.value))}
                disabled={!canGenerateSample || generating}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleGenerateSample}
                disabled={!canGenerateSample || generating}
                className="w-full rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate sample"}
              </button>
            </div>
          </div>

          {!canGenerateSample && (
            <div className="mt-3 text-xs text-gray-500">
              {assessment.status === "DRAFT" 
                ? "Upload marks first before generating a sample." 
                : "Sample generation is only available for assessments with uploaded marks."}
            </div>
          )}
        </div>
      </Card>

      {/* Sample preview */}
      {sample.length > 0 && (
        <Card>
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-lg font-semibold">Sample preview</h2>
            <div className="text-sm text-gray-600">{sample.length} items</div>
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
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Submit for moderation */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">Submit for moderation</h2>
          <p className="mt-1 text-sm text-gray-600">
            When submitted, the system notifies the assigned moderator and locks workflow changes.
          </p>

          <div className="mt-4">
            <label htmlFor="moderator-comment" className="text-xs text-gray-600">Optional comment to moderator</label>
            <textarea
              id="moderator-comment"
              value={moderatorComment}
              onChange={(e) => setModeratorComment(e.target.value)}
              disabled={!canSubmit || submitting}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
              rows={3}
              placeholder="E.g., marking rubric notes, special cases, late submissions..."
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={handleSubmitForModeration}
              disabled={!canSubmit || submitting}
              className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for moderation"}
            </button>
            {!canSubmit && (
              <span className="text-sm text-gray-600">
                {assessment.status === "DRAFT" || assessment.status === "MARKS_UPLOADED"
                  ? "Generate a sample first before submitting."
                  : "Already submitted or in progress."}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
