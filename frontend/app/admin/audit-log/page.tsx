"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { getAuditEvents, type AuditEvent } from "@/lib/assessments-api";

export default function AuditLogPage() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    loadEvents();
  }, [limit]);

  async function loadEvents() {
    setLoading(true);
    setError(null);

    try {
      const data = await getAuditEvents(limit);
      setEvents(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push("/login");
        } else {
          setError(err.detail);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to load audit events");
      }
    } finally {
      setLoading(false);
    }
  }

  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getRoleClasses(role: string): string {
    const classMap: Record<string, string> = {
      lecturer: "bg-blue-50 text-blue-700 border-blue-200",
      moderator: "bg-purple-50 text-purple-700 border-purple-200",
      third_marker: "bg-indigo-50 text-indigo-700 border-indigo-200",
      admin: "bg-gray-50 text-gray-700 border-gray-200",
    };
    return `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${classMap[role] || "bg-gray-50 text-gray-700 border-gray-200"}`;
  }

  function getActionClasses(action: string): string {
    if (action.includes("APPROVED") || action.includes("CREATED") || action.includes("UPLOADED")) {
      return "text-green-700";
    }
    if (action.includes("REJECTED") || action.includes("DELETED") || action.includes("CHANGES_REQUESTED")) {
      return "text-red-700";
    }
    if (action.includes("ESCALATED") || action.includes("SUBMITTED")) {
      return "text-yellow-700";
    }
    return "text-gray-700";
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-600">
            Complete history of all system actions for compliance and oversight.
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Controls */}
      <Card>
        <div className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <div>
              <label htmlFor="limit" className="block text-xs text-gray-600 mb-1">
                Show events
              </label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value={20}>Last 20</option>
                <option value={50}>Last 50</option>
                <option value={100}>Last 100</option>
                <option value={200}>Last 200</option>
              </select>
            </div>
          </div>

          <button
            onClick={loadEvents}
            disabled={loading}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </Card>

      {/* Audit events table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Events</h2>
          <div className="text-sm text-gray-600">{events.length} events</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Timestamp</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Actor</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Assessment</th>
                </tr>
              </thead>

              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b last:border-b-0">
                    <td className="px-5 py-4 text-gray-600 whitespace-nowrap">
                      {formatTimestamp(event.timestamp)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-medium ${getActionClasses(event.action)}`}>
                        {event.action}
                      </span>
                    </td>
                    <td className="px-5 py-4">{event.actor_name}</td>
                    <td className="px-5 py-4">
                      <span className={getRoleClasses(event.actor_role)}>
                        {event.actor_role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {event.assessment_id ? (
                        <span className="font-mono text-xs text-gray-600">
                          {event.assessment_id.substring(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}

                {events.length === 0 && (
                  <tr>
                    <td className="px-5 py-10 text-center text-gray-600" colSpan={5}>
                      No audit events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">About Audit Logging</h2>
          <p className="mt-2 text-sm text-gray-600">
            The audit log records all significant actions in the system for compliance and oversight purposes.
            Events are automatically captured when users perform actions such as:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-gray-600">
            <li>• Creating or updating assessments</li>
            <li>• Uploading marks</li>
            <li>• Generating moderation samples</li>
            <li>• Submitting assessments for moderation</li>
            <li>• Making moderation decisions (approve, request changes, escalate)</li>
            <li>• Third marker decisions</li>
            <li>• User account changes</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
