"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { getAllUsers, deactivateUser } from "@/lib/assessments-api";

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("all");

  useEffect(() => {
    loadUsers();
  }, [filterRole, filterActive]);

  async function loadUsers() {
    setLoading(true);
    setError(null);

    try {
      const role = filterRole || undefined;
      const isActive = filterActive === "all" ? undefined : filterActive === "active";
      const data = await getAllUsers(role, isActive, 100);
      setUsers(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push("/login");
        } else {
          setError(err.detail);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      await deactivateUser(userId);
      loadUsers();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail);
      } else {
        setError(err instanceof Error ? err.message : "Failed to deactivate user");
      }
    }
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
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage system users and their roles.
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <Card>
        <div className="p-4 flex flex-wrap gap-4">
          <div>
            <label htmlFor="filter-role" className="block text-xs text-gray-600 mb-1">
              Filter by role
            </label>
            <select
              id="filter-role"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All roles</option>
              <option value="lecturer">Lecturer</option>
              <option value="moderator">Moderator</option>
              <option value="third_marker">Third Marker</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="filter-active" className="block text-xs text-gray-600 mb-1">
              Status
            </label>
            <select
              id="filter-active"
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users table */}
      <Card>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">All users</h2>
          <div className="text-sm text-gray-600">{users.length} users</div>
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
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Username</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Role</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="px-5 py-4 font-medium">{user.full_name}</td>
                    <td className="px-5 py-4">{user.username}</td>
                    <td className="px-5 py-4">{user.email}</td>
                    <td className="px-5 py-4">
                      <span className={getRoleClasses(user.role)}>
                        {user.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {user.is_active ? (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border bg-gray-50 text-gray-700 border-gray-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">{formatDate(user.created_at)}</td>
                    <td className="px-5 py-4 text-right">
                      {user.is_active && (
                        <button
                          onClick={() => handleDeactivate(user.id)}
                          className="rounded-xl border bg-white px-3 py-1 text-xs hover:bg-gray-50 text-red-600"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {users.length === 0 && (
                  <tr>
                    <td className="px-5 py-10 text-center text-gray-600" colSpan={7}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
