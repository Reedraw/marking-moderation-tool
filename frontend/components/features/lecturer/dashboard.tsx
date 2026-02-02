"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui";

type AssessmentStatus =
  | "Draft"
  | "Marks Uploaded"
  | "Sample Generated"
  | "Pending Moderation"
  | "In Moderation"
  | "Approved"
  | "Changes Requested";

type AssessmentRow = {
  assessmentId: string;
  moduleCode: string;
  moduleName: string;
  assessmentTitle: string;
  dueDate: string;
  status: AssessmentStatus;
  marksUploadedCount: number;
  cohort: string;
};

const mockAssessments: AssessmentRow[] = [
  {
    assessmentId: "a1b2c3",
    moduleCode: "6COSC023W",
    moduleName: "Final Year Project",
    assessmentTitle: "Coursework 1",
    dueDate: "2026-03-01",
    status: "Marks Uploaded",
    marksUploadedCount: 120,
    cohort: "2025/26",
  },
  {
    assessmentId: "d4e5f6",
    moduleCode: "6COSC999X",
    moduleName: "Database Systems",
    assessmentTitle: "Exam Marking",
    dueDate: "2026-02-20",
    status: "Pending Moderation",
    marksUploadedCount: 180,
    cohort: "2025/26",
  },
  {
    assessmentId: "p9q8r7",
    moduleCode: "6COSC111A",
    moduleName: "Software Engineering",
    assessmentTitle: "Group Project Release 1",
    dueDate: "2026-02-15",
    status: "Sample Generated",
    marksUploadedCount: 220,
    cohort: "2025/26",
  },
  {
    assessmentId: "x7y6z5",
    moduleCode: "6COSC222B",
    moduleName: "Formal Methods",
    assessmentTitle: "B-Method Specification",
    dueDate: "2026-02-08",
    status: "Changes Requested",
    marksUploadedCount: 140,
    cohort: "2025/26",
  },
];

function StatusPill({ status }: { status: AssessmentStatus }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border";
  const map: Record<AssessmentStatus, string> = {
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

export function LecturerDashboard() {
  const total = mockAssessments.length;
  const pending = mockAssessments.filter((a) => a.status === "Pending Moderation").length;
  const approved = mockAssessments.filter((a) => a.status === "Approved").length;
  const needAction = mockAssessments.filter(
    (a) => a.status === "Draft" || a.status === "Changes Requested"
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Lecturer Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload marks, generate samples, and submit assessments for moderation.
          </p>
        </div>
      </header>

      {/* Overview cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Assessments</div>
            <div className="mt-2 text-2xl font-semibold">{total}</div>
          </div>
        </Card>

        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Need action</div>
            <div className="mt-2 text-2xl font-semibold">{needAction}</div>
            <div className="mt-1 text-xs text-gray-500">Draft / Changes requested</div>
          </div>
        </Card>

        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Pending moderation</div>
            <div className="mt-2 text-2xl font-semibold">{pending}</div>
          </div>
        </Card>

        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="mt-2 text-2xl font-semibold">{approved}</div>
          </div>
        </Card>
      </section>

      {/* Table */}
      <Card className="">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Your assessments</h2>
          <div className="text-sm text-gray-600">{mockAssessments.length} total</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Module</th>
                <th className="px-5 py-3 font-medium">Assessment</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Marks</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {mockAssessments.map((a) => (
                <tr key={a.assessmentId} className="border-b last:border-b-0">
                  <td className="px-5 py-4">
                    <div className="font-medium">{a.moduleCode}</div>
                    <div className="text-gray-600">{a.moduleName}</div>
                    <div className="text-xs text-gray-500">{a.cohort}</div>
                  </td>

                  <td className="px-5 py-4">
                    <div className="font-medium">{a.assessmentTitle}</div>
                    <div className="text-gray-600 text-xs">ID: {a.assessmentId}</div>
                  </td>

                  <td className="px-5 py-4">{a.dueDate}</td>

                  <td className="px-5 py-4">
                    <StatusPill status={a.status} />
                  </td>

                  <td className="px-5 py-4">{a.marksUploadedCount}</td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/lecturer/assessments/${a.assessmentId}`}
                        className="rounded-xl border bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        Open
                      </Link>

                      <Link
                        href={`/lecturer/assessments/${a.assessmentId}/upload`}
                        className="rounded-xl bg-black px-3 py-2 text-white hover:opacity-90"
                      >
                        Upload marks
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {mockAssessments.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-600" colSpan={6}>
                    No assessments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
