"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

type EscalatedAssessment = {
  assessmentId: string;
  moduleCode: string;
  moduleName: string;
  assessmentTitle: string;
  cohort: string;
  escalatedAt: string;
  lecturerName: string;
  moderatorName: string;
  sampleSize: number;
};

const mockEscalations: EscalatedAssessment[] = [
  {
    assessmentId: "e1s2c3",
    moduleCode: "6COSC999X",
    moduleName: "Database Systems",
    assessmentTitle: "Exam Marking",
    cohort: "2025/26",
    escalatedAt: "2026-02-03",
    lecturerName: "Dr Patel",
    moderatorName: "Dr Smith",
    sampleSize: 18,
  },
];

export function ThirdMarkerDashboard() {
  // TODO: Fetch from API - GET /api/third-marker/queue
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Third Marker Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Independent review of escalated assessments.
        </p>
      </header>

      <Card className="">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Escalated assessments</h2>
          <div className="text-sm text-gray-600">{mockEscalations.length} total</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-600">
              <tr className="border-b">
                <th className="px-5 py-3 font-medium">Module</th>
                <th className="px-5 py-3 font-medium">Assessment</th>
                <th className="px-5 py-3 font-medium">Escalated</th>
                <th className="px-5 py-3 font-medium">Lecturer</th>
                <th className="px-5 py-3 font-medium">Moderator</th>
                <th className="px-5 py-3 font-medium">Sample</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {mockEscalations.map((a) => (
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

                  <td className="px-5 py-4">{a.escalatedAt}</td>

                  <td className="px-5 py-4">{a.lecturerName}</td>

                  <td className="px-5 py-4">{a.moderatorName}</td>

                  <td className="px-5 py-4">{a.sampleSize}</td>

                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <Link
                        href={`/third-marker/assessments/${a.assessmentId}`}
                        className="rounded-xl bg-black px-3 py-2 text-white hover:opacity-90"
                      >
                        Review
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {mockEscalations.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-gray-600" colSpan={7}>
                    No escalations assigned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-xs text-gray-500">
        TODO (backend): GET /api/third-marker/queue
      </div>
    </div>
  );
}
