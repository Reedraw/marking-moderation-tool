"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { getModules, type ModuleInfo } from "@/lib/assessments-api";

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadModules();
  }, []);

  async function loadModules() {
    setLoading(true);
    setError(null);

    try {
      const data = await getModules();
      setModules(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push("/login");
        } else {
          setError(err.detail);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to load modules");
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = modules.filter(
    (m) =>
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      m.title.toLowerCase().includes(search.toLowerCase())
  );

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Modules</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage academic modules.
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{modules.length}</div>
            <div className="text-sm text-gray-600">Total Modules</div>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {modules.reduce((sum, m) => sum + m.assessment_count, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Assessments</div>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {modules.filter((m) => m.assessment_count > 0).length}
            </div>
            <div className="text-sm text-gray-600">Active Modules</div>
          </div>
        </Card>
      </div>

      {/* Search and refresh */}
      <Card>
        <div className="p-4 flex flex-wrap gap-4 items-center justify-between">
          <div>
            <label htmlFor="search" className="block text-xs text-gray-600 mb-1">
              Search modules
            </label>
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by code or title..."
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm w-64"
            />
          </div>
          <button
            onClick={loadModules}
            disabled={loading}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </Card>

      {/* Modules table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">All Modules</h2>
          <div className="text-sm text-gray-600">
            {filtered.length} module{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-gray-600">Loading modules...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="text-gray-400 text-4xl mb-2">📚</div>
            <h3 className="text-lg font-medium text-gray-700">
              {search ? "No matching modules" : "No modules yet"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? "Try adjusting your search query."
                : "Modules are created automatically when lecturers create assessments."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-600">
                <tr className="border-b">
                  <th className="px-5 py-3 font-medium">Code</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Credits</th>
                  <th className="px-5 py-3 font-medium">Assessments</th>
                  <th className="px-5 py-3 font-medium">Latest Cohort</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((mod) => (
                  <tr key={mod.id} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-medium text-blue-700">
                        {mod.code}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{mod.title}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {mod.credits ? `${mod.credits} credits` : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                          mod.assessment_count > 0
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {mod.assessment_count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {mod.latest_cohort || "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {formatDate(mod.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
