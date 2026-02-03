"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

type SampleRow = {
  studentId: string;
  mark: number;
  markerId?: string;
};

interface AssessmentReviewProps {
  assessmentId: string;
}

export function AssessmentReview({ assessmentId }: AssessmentReviewProps) {
  // TODO: Fetch from API - GET /api/third-marker/assessments/{assessmentId}
  const mockDetail = {
    assessmentId,
    moduleCode: "6COSC999X",
    moduleName: "Database Systems",
    assessmentTitle: "Exam Marking",
    cohort: "2025/26",
    lecturerName: "Dr Patel",
    moderatorName: "Dr Smith",
    lecturerComment:
      "Marks follow rubric v2. Borderline cases double-checked.",
    moderatorComment:
      "Large variance in one marker's distribution; requesting third review.",
    sample: {
      size: 18,
      students: [
        { studentId: "w1234567", mark: 72, markerId: "m001" },
        { studentId: "w2222222", mark: 41, markerId: "m001" },
        { studentId: "w3333333", mark: 66, markerId: "m002" },
      ],
    },
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Third Marker Review</h1>
          <p className="mt-1 text-sm text-gray-600">
            {mockDetail.moduleCode} • {mockDetail.moduleName}
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

      {/* Summary */}
      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">{mockDetail.assessmentTitle}</h2>
          <div className="mt-1 text-sm text-gray-600">Cohort {mockDetail.cohort}</div>
          <div className="mt-2 text-sm text-gray-600">
            Lecturer: <span className="font-medium">{mockDetail.lecturerName}</span>
          </div>
          <div className="mt-1 text-sm text-gray-600">
            Moderator: <span className="font-medium">{mockDetail.moderatorName}</span>
          </div>
        </div>
      </Card>

      {/* Comments */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <div className="p-5">
            <h3 className="text-md font-semibold">Lecturer notes</h3>
            <p className="mt-2 text-sm text-gray-700">
              {mockDetail.lecturerComment || "No notes provided."}
            </p>
          </div>
        </Card>

        <Card>
          <div className="p-5">
            <h3 className="text-md font-semibold">Moderator notes</h3>
            <p className="mt-2 text-sm text-gray-700">
              {mockDetail.moderatorComment || "No notes provided."}
            </p>
          </div>
        </Card>
      </section>

      {/* Sample */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Moderation sample</h2>
          <div className="text-sm text-gray-600">{mockDetail.sample.size} students</div>
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
              {mockDetail.sample.students.map((s) => (
                <tr key={s.studentId} className="border-b last:border-b-0">
                  <td className="px-5 py-4 font-medium">{s.studentId}</td>
                  <td className="px-5 py-4">{s.mark}</td>
                  <td className="px-5 py-4">{s.markerId ?? "—"}</td>
                </tr>
              ))}
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
              className="rounded-xl bg-green-600 px-4 py-2 text-sm text-white hover:opacity-90"
              aria-label="Confirm moderator decision for this assessment"
            >
              Confirm moderator decision
            </button>
            <button
              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm text-white hover:opacity-90"
              aria-label="Override moderator decision for this assessment"
            >
              Override decision
            </button>
            <button
              className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              aria-label="Refer this assessment back for further review"
            >
              Refer back
            </button>
          </div>

          <div>
            <label htmlFor="third-marker-comment" className="text-xs text-gray-600">Third marker comment</label>
            <textarea
              id="third-marker-comment"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              rows={4}
              placeholder="Independent rationale and final justification..."
            />
          </div>

          <div className="text-xs text-gray-500">
            TODO (backend): POST /api/third-marker/assessments/{assessmentId}/decision
          </div>
        </div>
      </Card>
    </div>
  );
}
