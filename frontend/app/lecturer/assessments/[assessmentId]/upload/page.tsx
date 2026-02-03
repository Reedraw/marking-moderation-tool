import { UploadMarks } from "@/components/features/lecturer";

export default async function LecturerUploadMarksPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  return <UploadMarks assessmentId={assessmentId} />;
}
