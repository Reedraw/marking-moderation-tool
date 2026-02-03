"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import type { AssessmentStatus } from "@/types/assessment";

type ModerationStatus = AssessmentStatus | "Pending Moderation" | "Escalated";

type ModerationQueueRow = {
  assessmentId: string;
  moduleCode: string;
  moduleName: string;
  assessmentTitle: string;
  cohort: string;
  submittedAt: string;
  lecturerName: string;
  status: ModerationStatus;
  sampleSize: number;
};

const mockQueue: ModerationQueueRow[] = [
  {
    assessmentId: "d4e5f6",
    moduleCode: "6COSC999X",
    moduleName: "Database Systems",
    assessmentTitle: "Exam Marking",
    cohort: "2025/26",
    submittedAt: "2026-02-01",
    lecturerName: "Dr Patel",
    status: "Pending Moderation",
    sampleSize: 18,
  },
  {
    assessmentId: "p9q8r7",
    moduleCode: "6COSC111A",
    moduleName: "Software Engineering",
    assessmentTitle: "Group Project Release 1",
    cohort: "2025/26",
    submittedAt: "2026-02-02",
    lecturerName: "Prof Green",
    status: "In Moderation",
    sampleSize: 22,
  },
];

function StatusPill({ status }: { status: ModerationStatus }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border";
  const map: Record<ModerationStatus, string> = {
    DRAFT: "bg-gray-50 text-gray-700 border-gray-200",
    MARKS_UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",
    SAMPLE_GENERATED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    SUBMITTED_FOR_MODERATION: "bg-yellow-50 text-yellow-800 border-yellow-200",
    IN_MODERATION: "bg-purple-50 text-purple-700 border-purple-200",
    APPROVED: "bg-green-50 text-green-700 border-green-200",
    CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",
    "Pending Moderation": "bg-yellow-50 text-yellow-800 border-yellow-200",
    Escalated: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };
  return <span className={`${base} ${map[status]}`}>{status}</span>;
}

export function ModeratorDashboard() {
  // TODO: Fetch from API - GET /api/moderator/queue
  const total = mockQueue.length;
  const pending = mockQueue.filter((a) => a.status === "Pending Moderation").length;
  const inProgress = mockQueue.filter((a) => a.status === "In Moderation").length;
  const escalated = mockQueue.filter((a) => a.status === "Escalated").length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Moderator Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review submitted assessments and record moderation outcomes.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/moderator/dashboard"
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </Link>
        </div>
      </header>

      {/* KPI */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">In queue</div>
            <div className="mt-2 text-2xl font-semibold">{total}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Pending</div>
            <div className="mt-2 text-2xl font-semibold">{pending}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">In moderation</div>
            <div className="mt-2 text-2xl font-semibold">{inProgress}</div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="text-sm text-gray-600">Escalated</div>
            <div className="mt-2 text-2xl font-semibold">{escalated}</div>
          </div>
        </Card>
      </section>

      {/* Table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Submitted assessments</h2>
          <div className="text-sm text-gray-600">{mockQueue.length} total</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Module</th>
                <th className="px-5 py-3 font-medium">Assessment</th>
                <th className="px-5 py-3 font-medium">Submitted</th>
                <th className="px-5 py-3 font-medium">Lecturer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Sample</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {mockQueue.map((a) => (
                <tr key={a.assessmentId} className="border-b last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="font-medium">{a.moduleCode}</div>
                    <div className="text-gray-600">{a.moduleName}</div>
                    <div className="text-xs text-gray-500">{a.cohort}</div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="font-medium">{a.assessmentTitle}</div>
                    <div className="text-xs text-gray-500">ID: {a.assessmentId}</div>
                  </td>

                  <td className="px-5 py-4">{a.submittedAt}</td>

                  <td className="px-5 py-4">{a.lecturerName}</td>

                  <td className="px-5 py-4">
                    <StatusPill status={a.status} />
                  </td>

                  <td className="px-5 py-4">{a.sampleSize}</td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <Link
                        href={`/moderator/assessments/${a.assessmentId}`}
                        className="rounded-xl bg-black px-3 py-2 text-white hover:opacity-90"
                      >
                        Review
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {mockQueue.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-600" colSpan={7}>
                    No assessments are currently awaiting moderation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-gray-500">
        TODO (backend): GET /api/moderator/queue • GET /api/moderator/assessments/:id • POST /api/moderator/assessments/:id/decision
      </div>
    </div>
  );
}
