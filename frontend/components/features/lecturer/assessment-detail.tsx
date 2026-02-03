import Link from "next/link";
import { Card } from "@/components/ui";
import type { SampleMethod } from "@/types/assessment";

type Status =
  | "Draft"
  | "Marks Uploaded"
  | "Sample Generated"
  | "Pending Moderation"
  | "In Moderation"
  | "Approved"
  | "Changes Requested";

function StatusPill({ status }: { status: Status }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border";
  const map: Record<Status, string> = {
    Draft: "bg-gray-50 text-gray-700 border-gray-200",
    "Marks Uploaded": "bg-blue-50 text-blue-700 border-blue-200",
    "Sample Generated": "bg-indigo-50 text-indigo-700 border-indigo-200",
    "Pending Moderation": "bg-yellow-50 text-yellow-800 border-yellow-200",
    "In Moderation": "bg-purple-50 text-purple-700 border-purple-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    "Changes Requested": "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`${base} ${map[status]}`}>{status}</span>;
}

interface AssessmentDetailProps {
  assessmentId: string;
}

export function AssessmentDetail({ assessmentId }: AssessmentDetailProps) {
  // TODO: Fetch from API
  const detail = {
    assessmentId,
    moduleCode: "6COSC023W",
    moduleName: "Final Year Project",
    title: "Coursework 1",
    cohort: "2025/26",
    dueDate: "2026-03-01",
    status: "Marks Uploaded" as Status,
    marksUploadedCount: 120,
    sample: null as null | { size: number; method: SampleMethod; percent: number },
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Assessment</h1>
          <p className="mt-1 text-sm text-gray-600">
            {detail.moduleCode} • {detail.moduleName}
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

      {/* Summary */}
      <Card>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{detail.title}</h2>
              <div className="mt-1 text-sm text-gray-600">
                Cohort {detail.cohort} • Due {detail.dueDate}
              </div>
            </div>
            <StatusPill status={detail.status} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Marks uploaded</div>
              <div className="mt-2 text-xl font-semibold">{detail.marksUploadedCount}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Sample size</div>
              <div className="mt-2 text-xl font-semibold">{detail.sample?.size ?? "—"}</div>
              <div className="mt-1 text-xs text-gray-500">
                {detail.sample ? `${detail.sample.percent}% • ${detail.sample.method}` : "Not generated yet"}
              </div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-sm text-gray-600">Next step</div>
              <div className="mt-2 font-medium">
                {detail.status === "Draft"
                  ? "Upload marks"
                  : detail.status === "Marks Uploaded"
                  ? "Generate sample"
                  : "Submit for moderation"}
              </div>
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
              <select id="sample-method" className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
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
                defaultValue={10}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button className="w-full rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50">
                Generate sample
              </button>
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            TODO: POST /api/lecturer/assessments/{assessmentId}/generate-sample
          </div>
        </div>
      </Card>

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
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              rows={3}
              placeholder="E.g., marking rubric notes, special cases, late submissions..."
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90">
              Submit
            </button>
            <span className="text-sm text-gray-600">
              TODO: POST /api/lecturer/assessments/{assessmentId}/submit-for-moderation
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
