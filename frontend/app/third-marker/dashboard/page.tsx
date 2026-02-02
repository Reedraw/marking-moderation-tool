import { ThirdMarkerDashboard } from "@/components/features/third-marker";

export default function ThirdMarkerDashboardPage() {
  return <ThirdMarkerDashboard />;
}


      {/* TODO API CONTRACT (FastAPI)
        GET /api/third-marker/queue
        Auth: Third Marker JWT
        Response: [
          {
            assessment_id: uuid,
            module_code: string,
            module_name: string,
            assessment_title: string,
            cohort: string,
            escalated_at: string (ISO),
            lecturer_name: string,
            moderator_name: string,
            sample_size: number
          }
        ]
      */}

      