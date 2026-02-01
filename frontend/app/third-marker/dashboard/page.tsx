export default function ThirdMarkerDashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Third Marker Dashboard</h1>
      <p className="text-gray-600">
        Escalated moderation cases requiring independent review.
      </p>

      {/* Assigned Escalations */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium">Escalated Moderation Cases</h2>
        <p className="text-sm text-gray-600 mt-1">
          Assessments escalated by moderators for third marking.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          TODO (backend): GET /third-marker/cases  
          Filter by: assigned_third_marker = current user
        </p>
      </div>

      {/* Case Review */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium">Review & Decision</h2>
        <p className="text-sm text-gray-600 mt-1">
          Review sample marks and submit an independent decision.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          TODO (backend): GET /third-marker/cases/:id  
          TODO (backend): POST /third-marker/cases/:id/decision  
          Decision may confirm or recommend mark adjustment
        </p>
      </div>

      {/* Audit Visibility */}
      <div className="rounded-xl border p-4">
        <h2 className="font-medium">Audit Context</h2>
        <p className="text-sm text-gray-600 mt-1">
          View relevant audit events for escalated cases.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          TODO (backend): GET /audit-log?entity=moderation_case
        </p>
      </div>
    </div>
  );
}
