"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

type SampleRow = {
  studentId: string;
  mark: number;
  markerId?: string;
  flagged?: boolean;
};

interface AssessmentReviewProps {
  assessmentId: string;
}

export function AssessmentReview({ assessmentId }: AssessmentReviewProps) {
  // TODO: Fetch from API - GET /api/moderator/assessments/{assessmentId}
  const mockDetail = {
    assessmentId,
    moduleCode: "6COSC999X",
    moduleName: "Database Systems",
    assessmentTitle: "Exam Marking",
    cohort: "2025/26",
    dueDate: "2026-02-20",
    lecturerName: "Dr Patel",
    lecturerComment:
      "Marking followed rubric v2. Two late submissions were capped per policy.",
    sample: {
      size: 18,
      method: "Random",
      percent: 10,
      students: [
        { studentId: "w1234567", mark: 72, markerId: "m001" },
        { studentId: "w2222222", mark: 41, markerId: "m001", flagged: true },
        { studentId: "w3333333", mark: 66, markerId: "m002" },
        { studentId: "w4444444", mark: 58, markerId: "m002" },
      ] as SampleRow[],
    },
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Moderation Review</h1>
          <p className="mt-1 text-sm text-gray-600">
            {mockDetail.moduleCode} • {mockDetail.moduleName}
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

      {/* Summary */}
      <Card>
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{mockDetail.assessmentTitle}</h2>
              <div className="mt-1 text-sm text-gray-600">
                Cohort {mockDetail.cohort} • Due {mockDetail.dueDate}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                Lecturer: <span className="font-medium">{mockDetail.lecturerName}</span>
              </div>
            </div>

            <div className="rounded-xl border bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-600">Sample</div>
              <div className="mt-1 font-medium">
                {mockDetail.sample.size} ({mockDetail.sample.percent}%) • {mockDetail.sample.method}
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
            {mockDetail.lecturerComment || "No comment provided."}
          </p>
        </div>
      </Card>

      {/* Sample table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Sample set</h2>
          <div className="text-sm text-gray-600">{mockDetail.sample.students.length} shown</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">Mark</th>
                <th className="px-5 py-3 font-medium">Marker</th>
                <th className="px-5 py-3 font-medium">Flag</th>
              </tr>
            </thead>

            <tbody>
              {mockDetail.sample.students.map((s) => (
                <tr key={s.studentId} className="border-b last:border-b-0">
                  <td className="px-5 py-4 font-medium">{s.studentId}</td>
                  <td className="px-5 py-4">{s.mark}</td>
                  <td className="px-5 py-4">{s.markerId ?? "—"}</td>
                  <td className="px-5 py-4">
                    {s.flagged ? (
                      <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs bg-yellow-50 text-yellow-800 border-yellow-200">
                        Review
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 text-xs text-gray-500 border-t">
          TODO: In full build, allow moderator to flag rows + attach reasons.
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
              className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90"
              aria-label="Approve moderation outcome"
            >
              Approve (TODO)
            </button>
            <button
              className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white hover:opacity-90"
              aria-label="Request changes to marking"
            >
              Request changes (TODO)
            </button>
            <button
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              aria-label="Escalate to third marker for independent review"
            >
              Escalate to third marker (TODO)
            </button>
          </div>

          <div>
            <label htmlFor="moderator-comment" className="text-xs text-gray-600">Moderator comment</label>
            <textarea
              id="moderator-comment"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              rows={4}
              placeholder="Explain reasons, evidence, required actions, or escalation context..."
            />
          </div>

          <div className="text-xs text-gray-500">
            TODO (backend): POST /api/moderator/assessments/{assessmentId}/decision
          </div>
        </div>
      </Card>
    </div>
  );
}
