"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

type AdminStats = {
  totalAssessments: number;
  draft: number;
  pendingModeration: number;
  inModeration: number;
  changesRequested: number;
  approved: number;
  escalated: number;

  activeUsers: number;
  lecturers: number;
  moderators: number;
  thirdMarkers: number;

  last24hUploads: number;
  last24hSubmissions: number;
  last24hDecisions: number;
};

type AuditEvent = {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: "Lecturer" | "Moderator" | "Third Marker" | "Admin";
  action: string;
  assessmentId?: string;
};

const mockStats: AdminStats = {
  totalAssessments: 14,
  draft: 3,
  pendingModeration: 4,
  inModeration: 2,
  changesRequested: 1,
  approved: 3,
  escalated: 1,

  activeUsers: 42,
  lecturers: 28,
  moderators: 10,
  thirdMarkers: 3,

  last24hUploads: 6,
  last24hSubmissions: 3,
  last24hDecisions: 4,
};

const mockAudit: AuditEvent[] = [
  {
    id: "evt_001",
    timestamp: "2026-02-02 18:10",
    actorName: "Dr Patel",
    actorRole: "Lecturer",
    action: "Uploaded marks (CSV)",
    assessmentId: "d4e5f6",
  },
  {
    id: "evt_002",
    timestamp: "2026-02-02 18:25",
    actorName: "Dr Patel",
    actorRole: "Lecturer",
    action: "Generated moderation sample (10% random)",
    assessmentId: "d4e5f6",
  },
  {
    id: "evt_003",
    timestamp: "2026-02-02 18:30",
    actorName: "Dr Patel",
    actorRole: "Lecturer",
    action: "Submitted for moderation",
    assessmentId: "d4e5f6",
  },
  {
    id: "evt_004",
    timestamp: "2026-02-02 19:05",
    actorName: "Dr Smith",
    actorRole: "Moderator",
    action: "Escalated to third marker",
    assessmentId: "d4e5f6",
  },
];

function RolePill({ role }: { role: AuditEvent["actorRole"] }) {
  const base = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border";
  const map: Record<AuditEvent["actorRole"], string> = {
    Lecturer: "bg-blue-50 text-blue-700 border-blue-200",
    Moderator: "bg-purple-50 text-purple-700 border-purple-200",
    "Third Marker": "bg-indigo-50 text-indigo-700 border-indigo-200",
    Admin: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return <span className={`${base} ${map[role]}`}>{role}</span>;
}

export function AdminDashboard() {
  // TODO: Fetch from API - GET /api/admin/stats and GET /api/admin/audit
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            System overview and audit visibility (prototype).
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/dashboard"
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Refresh
          </Link>
        </div>
      </header>

      {/* Top stats */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Total assessments</div>
            <div className="mt-2 text-2xl font-semibold">{mockStats.totalAssessments}</div>
          </div>
        </Card>

        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Pending moderation</div>
            <div className="mt-2 text-2xl font-semibold">{mockStats.pendingModeration}</div>
          </div>
        </Card>

        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Escalations</div>
            <div className="mt-2 text-2xl font-semibold">{mockStats.escalated}</div>
            <div className="mt-1 text-xs text-gray-500">Third marker required</div>
          </div>
        </Card>

        <Card className="">
          <div className="p-4">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="mt-2 text-2xl font-semibold">{mockStats.approved}</div>
          </div>
        </Card>
      </section>

      {/* Status breakdown */}
      <Card className="">
        <div className="p-5">
          <h2 className="text-lg font-semibold">Workflow status breakdown</h2>
          <p className="mt-1 text-sm text-gray-600">
            Snapshot of assessments by moderation workflow stage.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-600">Draft</div>
              <div className="mt-2 text-xl font-semibold">{mockStats.draft}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-600">Pending</div>
              <div className="mt-2 text-xl font-semibold">{mockStats.pendingModeration}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-600">In moderation</div>
              <div className="mt-2 text-xl font-semibold">{mockStats.inModeration}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-600">Changes req.</div>
              <div className="mt-2 text-xl font-semibold">{mockStats.changesRequested}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-600">Approved</div>
              <div className="mt-2 text-xl font-semibold">{mockStats.approved}</div>
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-xs text-gray-600">Escalated</div>
              <div className="mt-2 text-xl font-semibold">{mockStats.escalated}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Users / Activity */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="">
          <div className="p-5">
            <h2 className="text-lg font-semibold">Users</h2>
            <p className="mt-1 text-sm text-gray-600">Active accounts by role.</p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Active users</div>
                <div className="mt-2 text-xl font-semibold">{mockStats.activeUsers}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Lecturers</div>
                <div className="mt-2 text-xl font-semibold">{mockStats.lecturers}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Moderators</div>
                <div className="mt-2 text-xl font-semibold">{mockStats.moderators}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Third markers</div>
                <div className="mt-2 text-xl font-semibold">{mockStats.thirdMarkers}</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href="/admin/users"
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                Manage users (prototype)
              </Link>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              TODO: FastAPI user management endpoints (create/disable/assign roles).
            </div>
          </div>
        </Card>

        <Card className="">
          <div className="p-5">
            <h2 className="text-lg font-semibold">Activity (last 24 hours)</h2>
            <p className="mt-1 text-sm text-gray-600">Operational signals for admin oversight.</p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Uploads</div>
                <div className="mt-2 text-xl font-semibold">{mockStats.last24hUploads}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Submissions</div>
                <div className="mt-2 text-xl font-semibold">{mockStats.last24hSubmissions}</div>
              </div>
              <div className="rounded-xl border p-4">
                <div className="text-xs text-gray-600">Decisions</div>
                <div className="mt-2 text-xl font-semibold">{mockStats.last24hDecisions}</div>
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-500">
              TODO: GET /api/admin/stats should compute these from audit log events.
            </div>
          </div>
        </Card>
      </section>

      {/* Audit feed */}
      <Card className="">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Recent audit events</h2>
          <Link
            href="/admin/audit-log"
            className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            View audit log (prototype)
          </Link>
        </div>

        <div className="divide-y">
          {mockAudit.map((e) => (
            <div key={e.id} className="px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{e.action}</div>
                <div className="mt-1 text-xs text-gray-600">
                  {e.timestamp} • {e.actorName} •{" "}
                  {e.assessmentId ? `Assessment ${e.assessmentId}` : "System"}
                </div>
              </div>
              <RolePill role={e.actorRole} />
            </div>
          ))}

          {mockAudit.length === 0 && (
            <div className="px-5 py-10 text-center text-gray-600">
              No recent events.
            </div>
          )}
        </div>

        <div className="px-5 py-3 text-xs text-gray-500 border-t">
          TODO: GET /api/admin/audit?limit=20 (supports pagination + filters in full build)
        </div>
      </Card>

      <div className="text-xs text-gray-500">
        TODO (backend): GET /api/admin/stats • GET /api/admin/audit • GET/POST /api/admin/users • GET/POST /api/admin/modules
      </div>
    </div>
  );
}
