import { AdminDashboard } from "@/components/features/admin";

{/* TODO API CONTRACT (FastAPI)
  GET /api/admin/stats
  Auth: Admin JWT
  Response: {
    total_assessments: number,
    by_status: {
      draft: number,
      pending_moderation: number,
      in_moderation: number,
      changes_requested: number,
      approved: number,
      escalated: number
    },
    users: {
      active_users: number,
      lecturers: number,
      moderators: number,
      third_markers: number
    },
    activity_last_24h: {
      uploads: number,
      submissions: number,
      decisions: number
    }
  }

  GET /api/admin/audit?limit=20
  Response: [
    { id, timestamp, actor_name, actor_role, action, assessment_id? }
  ]
*/}


export default function AdminDashboardPage() {
  // TODO API CONTRACT (FastAPI)
  // GET /api/admin/stats - Auth: Admin JWT
  // Response: { total_assessments, by_status: {draft, pending_moderation, in_moderation, changes_requested, approved, escalated}, users: {active_users, lecturers, moderators, third_markers}, activity_last_24h: {uploads, submissions, decisions} }
  // 
  // GET /api/admin/audit?limit=20
  // Response: [{ id, timestamp, actor_name, actor_role, action, assessment_id? }]
  //
  // TODO: FastAPI user management endpoints (create/disable/assign roles)
  // TODO: GET /api/admin/stats should compute these from audit log events
  // TODO: GET /api/admin/audit?limit=20 (supports pagination + filters in full build)
  // Suggested FastAPI endpoints: GET /api/admin/stats • GET /api/admin/audit • (later) GET/POST /api/admin/users • GET/POST /api/admin/modules
  
  return <AdminDashboard />;
}
