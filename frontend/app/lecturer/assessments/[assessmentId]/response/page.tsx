import { ModeratorResponse } from "@/components/features/lecturer";

interface PageProps {
  params: Promise<{ assessmentId: string }>;
}

export default async function ModeratorResponsePage({ params }: PageProps) {
  const { assessmentId } = await params;
  return <ModeratorResponse assessmentId={assessmentId} />;
}
