"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/auth";
import { getLecturerAssessments, type Assessment } from "@/lib/assessments-api";

export function LecturerDashboard() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const assessmentsData = await getLecturerAssessments();
        setAssessments(assessmentsData);
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
  }, [router]);

  const total = assessments.length;
  const pending = assessments.filter((a) => a.status === "SUBMITTED_FOR_MODERATION").length;
  const approved = assessments.filter((a) => a.status === "APPROVED").length;
  const needAction = assessments.filter((a) => a.status === "DRAFT" || a.status === "CHANGES_REQUESTED").length;

  function getStatusDisplay(status: string): string {
    const statusMap: Record<string, string> = {
      DRAFT: "Draft",
      MARKS_UPLOADED: "Marks Uploaded",
      SAMPLE_GENERATED: "Sample Generated",
      SUBMITTED_FOR_MODERATION: "Pending Moderation",
      IN_MODERATION: "In Moderation",
      APPROVED: "Approved",
      CHANGES_REQUESTED: "Changes Requested",
      ESCALATED: "Escalated",
    };
    return statusMap[status] || status;
  }

  function getStatusClasses(status: string): string {
    const classMap: Record<string, string> = {
      DRAFT: "bg-gray-50 text-gray-700 border-gray-200",
      MARKS_UPLOADED: "bg-blue-50 text-blue-700 border-blue-200",
      SAMPLE_GENERATED: "bg-indigo-50 text-indigo-700 border-indigo-200",
      SUBMITTED_FOR_MODERATION: "bg-yellow-50 text-yellow-800 border-yellow-200",
      IN_MODERATION: "bg-purple-50 text-purple-700 border-purple-200",
      APPROVED: "bg-green-50 text-green-700 border-green-200",
      CHANGES_REQUESTED: "bg-red-50 text-red-700 border-red-200",
      ESCALATED: "bg-indigo-50 text-indigo-700 border-indigo-200",
    };
    return `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${classMap[status] || ""}`;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Lecturer Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload marks, generate samples, and submit assessments for moderation.
          </p>
        </div>
        <Link
          href="/lecturer/assessments/new"
          className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Create assessment
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-gray-600">Loading...</div>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Assessments</div>
                <div className="mt-2 text-2xl font-semibold">{total}</div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Need action</div>
                <div className="mt-2 text-2xl font-semibold">{needAction}</div>
                <div className="mt-1 text-xs text-gray-500">Draft / Changes requested</div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Pending moderation</div>
                <div className="mt-2 text-2xl font-semibold">{pending}</div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Approved</div>
                <div className="mt-2 text-2xl font-semibold">{approved}</div>
              </div>
            </Card>
          </section>

          <Card>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Your assessments</h2>
              <div className="text-sm text-gray-600">{total} total</div>
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
                  {assessments.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0">
                      <td className="px-5 py-4">
                        <div className="font-medium">{a.module_code}</div>
                        <div className="text-gray-600">{a.module_name}</div>
                        <div className="text-xs text-gray-500">{a.cohort}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-gray-600 text-xs">ID: {a.id}</div>
                      </td>

                      <td className="px-5 py-4">{a.due_date}</td>

                      <td className="px-5 py-4">
                        <span className={getStatusClasses(a.status)}>
                          {getStatusDisplay(a.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4">{a.marks_uploaded_count}</td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/lecturer/assessments/${a.id}`}
                            className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                          >
                            Open
                          </Link>

                          {(a.status === "DRAFT" || a.status === "MARKS_UPLOADED" || a.status === "SAMPLE_GENERATED") && (
                            <Link
                              href={`/lecturer/assessments/${a.id}/upload`}
                              className="rounded-xl bg-black px-3 py-2 text-sm text-white hover:opacity-90"
                            >
                              Upload marks
                            </Link>
                          )}

                          {(a.status === "APPROVED" || a.status === "CHANGES_REQUESTED" || a.status === "ESCALATED") && (
                            <Link
                              href={`/lecturer/assessments/${a.id}/response`}
                              className="rounded-xl bg-blue-600 px-3 py-2 text-sm text-white hover:opacity-90"
                            >
                              Respond
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {assessments.length === 0 && (
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
        </>
      )}
    </div>
  );
}
