export default function ModeratorDashboard() {
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Moderator Dashboard</h1>

      <div className="rounded-xl border p-4">
        <h2 className="font-medium">Assigned Moderation Cases</h2>
        <p className="text-sm text-gray-600 mt-1">
          TODO (backend): GET /moderator/cases?status=in_review|submitted
        </p>
      </div>
    </div>
  );
}
