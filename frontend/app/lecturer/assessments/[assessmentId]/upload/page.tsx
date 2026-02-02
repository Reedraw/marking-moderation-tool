import { UploadMarks } from "@/components/features/lecturer";

export default function LecturerUploadMarksPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  const { assessmentId } = params;

  return <UploadMarks assessmentId={assessmentId} />;
}
