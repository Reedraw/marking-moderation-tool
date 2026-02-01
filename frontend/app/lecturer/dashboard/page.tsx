export default function LecturerDashboard() {
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Lecturer Dashboard</h1>

      <div className="rounded-xl border p-4">
        <h2 className="font-medium">My Modules & Assessments</h2>
        <p className="text-sm text-gray-600 mt-1">
          TODO (backend): GET /lecturer/assessments (based on logged-in user)
        </p>
      </div>

      <div className="rounded-xl border p-4">
        <h2 className="font-medium">Actions</h2>
        <ul className="list-disc pl-5 text-sm text-gray-700 mt-1">
          <li>Upload marks (CSV)</li>
          <li>Generate moderation sample</li>
          <li>Submit for moderation</li>
        </ul>
      </div>
    </div>
  );
}
