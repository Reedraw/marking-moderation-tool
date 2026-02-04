"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { getThirdMarkerQueue, type Assessment } from "@/lib/assessments-api";

export function ThirdMarkerDashboard() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getThirdMarkerQueue();
        setAssessments(data);
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

  function formatDate(dateString: string | undefined | null): string {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Third Marker Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Independent review of escalated assessments.
        </p>
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
        <Card className="">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-lg font-semibold">Escalated assessments</h2>
            <div className="text-sm text-gray-600">{assessments.length} total</div>
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
                {assessments.map((a) => (
                  <tr key={a.id} className="border-b last:border-b-0">
                    <td className="px-5 py-4">
                      <div className="font-medium">{a.module_code}</div>
                      <div className="text-gray-600">{a.module_name}</div>
                      <div className="text-xs text-gray-500">{a.cohort}</div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-gray-500">ID: {a.id.substring(0, 8)}...</div>
                    </td>

                    <td className="px-5 py-4">{formatDate(a.escalated_at)}</td>

                    <td className="px-5 py-4">{a.lecturer_name || "—"}</td>

                    <td className="px-5 py-4">{a.moderator_name || "—"}</td>

                    <td className="px-5 py-4">{a.sample_size || 0}</td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end">
                        <Link
                          href={`/third-marker/assessments/${a.id}`}
                          className="rounded-xl bg-black px-3 py-2 text-white hover:opacity-90"
                        >
                          Review
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

                {assessments.length === 0 && (
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
      )}
    </div>
  );
}
