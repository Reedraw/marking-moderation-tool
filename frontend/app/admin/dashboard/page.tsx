export default function AdminDashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Administrator Dashboard</h1>
      <p className="text-gray-600">
        System administration and user management.
      </p>

      {/* User Management */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium">User Management</h2>
        <p className="text-sm text-gray-600 mt-1">
          Create and manage system users (lecturers, moderators, third markers).
        </p>
        <p className="mt-2 text-xs text-gray-500">
          TODO (backend): GET /admin/users  
          TODO (backend): POST /admin/users  
          TODO (backend): PATCH /admin/users/:id  
          TODO (backend): deactivate/reactivate accounts
        </p>
      </div>

      {/* Module Management */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium">Modules & Module Runs</h2>
        <p className="text-sm text-gray-600 mt-1">
          Create modules and academic year runs.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          TODO (backend): POST /admin/modules  
          TODO (backend): POST /admin/module-runs  
          TODO (backend): assign staff to module runs
        </p>
      </div>

      {/* System Overview */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium">System Overview</h2>
        <p className="text-sm text-gray-600 mt-1">
          High-level system statistics and audit overview.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          TODO (backend): GET /admin/stats  
          TODO (backend): GET /audit-log (admin view)
        </p>
      </div>
    </div>
  );
}
