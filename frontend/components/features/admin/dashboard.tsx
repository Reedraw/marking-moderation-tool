"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/auth";
import { getAdminStats, getAuditEvents, type AdminStats, type AuditEvent } from "@/lib/assessments-api";

export function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, auditData] = await Promise.all([
          getAdminStats(),
          getAuditEvents(20),
        ]);
        setStats(statsData);
        setAuditEvents(auditData);
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

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    return `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${classMap[status] || "bg-gray-50 text-gray-700 border-gray-200"}`;
  }

  function getRoleClasses(role: string): string {
    const classMap: Record<string, string> = {
      lecturer: "bg-blue-50 text-blue-700 border-blue-200",
      moderator: "bg-purple-50 text-purple-700 border-purple-200",
      third_marker: "bg-indigo-50 text-indigo-700 border-indigo-200",
      admin: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return classMap[role] || "bg-gray-50 text-gray-700 border-gray-200";
  }

  const byStatus = stats?.by_status || {};

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            System overview and audit visibility.
          </p>
        </div>
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
                <div className="text-sm text-gray-600">Total assessments</div>
                <div className="mt-2 text-2xl font-semibold">{stats?.total_assessments || 0}</div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Pending moderation</div>
                <div className="mt-2 text-2xl font-semibold">{(byStatus.SUBMITTED_FOR_MODERATION || 0) + (byStatus.IN_MODERATION || 0)}</div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Escalations</div>
                <div className="mt-2 text-2xl font-semibold">{byStatus.ESCALATED || 0}</div>
                <div className="mt-1 text-xs text-gray-500">Third marker required</div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="text-sm text-gray-600">Approved</div>
                <div className="mt-2 text-2xl font-semibold">{byStatus.APPROVED || 0}</div>
              </div>
            </Card>
          </section>

          <Card>
            <div className="p-5">
              <h2 className="text-lg font-semibold">Workflow status breakdown</h2>
              <p className="mt-1 text-sm text-gray-600">
                Snapshot of assessments by moderation workflow stage.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Draft</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.DRAFT || 0}</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Pending</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.SUBMITTED_FOR_MODERATION || 0}</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">In moderation</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.IN_MODERATION || 0}</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Changes req.</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.CHANGES_REQUESTED || 0}</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Approved</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.APPROVED || 0}</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-xs text-gray-600">Escalated</div>
                  <div className="mt-2 text-xl font-semibold">{byStatus.ESCALATED || 0}</div>
                </div>
              </div>
            </div>
          </Card>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold">Users</h2>
                <p className="mt-1 text-sm text-gray-600">Active accounts by role.</p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Active users</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.users.active_users || 0}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Lecturers</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.users.lecturers || 0}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Moderators</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.users.moderators || 0}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Third markers</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.users.third_markers || 0}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-5">
                <h2 className="text-lg font-semibold">Activity (last 24 hours)</h2>
                <p className="mt-1 text-sm text-gray-600">Operational signals for admin oversight.</p>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Uploads</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.activity_last_24h.uploads || 0}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Submissions</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.activity_last_24h.submissions || 0}</div>
                  </div>
                  <div className="rounded-xl border p-4">
                    <div className="text-xs text-gray-600">Decisions</div>
                    <div className="mt-2 text-xl font-semibold">{stats?.activity_last_24h.decisions || 0}</div>
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <Card>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Recent audit events</h2>
            </div>

            <div className="divide-y">
              {auditEvents.map((e) => (
                <div key={e.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium">{e.action}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      {formatTimestamp(e.timestamp)} • {e.actor_name} •{" "}
                      {e.assessment_id ? `Assessment ${e.assessment_id}` : "System"}
                    </div>
                  </div>
                  <span className={getRoleClasses(e.actor_role)}>
                    {e.actor_role.replace("_", " ")}
                  </span>
                </div>
              ))}

              {auditEvents.length === 0 && (
                <div className="px-5 py-10 text-center text-gray-600">
                  No recent events.
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

