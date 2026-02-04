"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { uploadMarks, type MarkUpload } from "@/lib/assessments-api";

interface UploadMarksProps {
  assessmentId: string;
}

export function UploadMarks({ assessmentId }: UploadMarksProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ processed: number; skipped: number; errors: string[] } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  }

  async function parseCSV(file: File): Promise<MarkUpload[]> {
    const text = await file.text();
    const lines = text.trim().split("\n");
    const marks: MarkUpload[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(",").map(p => p.trim());
      if (parts.length >= 2) {
        marks.push({
          student_id: parts[0],
          mark: parseFloat(parts[1]),
          marker_id: parts[2] || undefined,
        });
      }
    }

    return marks;
  }

  async function handleUpload() {
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const marks = await parseCSV(file);
      if (marks.length === 0) {
        setError("No valid marks found in the CSV file");
        setUploading(false);
        return;
      }

      const response = await uploadMarks(assessmentId, marks);
      setResult(response);

      if (response.errors.length === 0) {
        // Redirect back to assessment detail after successful upload
        setTimeout(() => {
          router.push(`/lecturer/assessments/${assessmentId}`);
        }, 2000);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push("/login");
        } else {
          setError(err.detail);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to upload marks");
      }
    } finally {
      setUploading(false);
    }
  }

  function downloadTemplate() {
    const template = "student_id,mark,marker_id\nw1234567,72,m001\nw7654321,65,m002\n";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marks_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Upload marks</h1>
          <p className="mt-1 text-sm text-gray-600">Assessment ID: {assessmentId}</p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/lecturer/assessments/${assessmentId}`}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.errors.length > 0 ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-green-200 bg-green-50 text-green-700"}`}>
          <div className="font-medium">Upload complete</div>
          <div>Processed: {result.processed} marks</div>
          {result.skipped > 0 && <div>Skipped: {result.skipped}</div>}
          {result.errors.length > 0 && (
            <div className="mt-2">
              <div className="font-medium">Errors:</div>
              <ul className="list-disc pl-5 text-xs">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Card className="">
        <div className="p-5">
          <h2 className="text-lg font-semibold">CSV upload</h2>
          <p className="mt-1 text-sm text-gray-600">
            Upload a CSV containing student identifiers and marks. Validation will be applied on upload.
          </p>

          {/* Upload box */}
          <div className="mt-4 rounded-2xl border border-dashed p-6">
            <div className="text-sm font-medium">Choose a CSV file</div>
            <p className="mt-1 text-xs text-gray-600">
              Accepted: <span className="font-mono">.csv</span>
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-700
                           file:mr-4 file:rounded-xl file:border file:bg-white
                           file:px-4 file:py-2 file:text-sm file:hover:bg-gray-50"
              />

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>

              <button
                onClick={downloadTemplate}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                Download template
              </button>
            </div>

            {file && (
              <div className="mt-3 text-sm text-gray-600">
                Selected: {file.name}
              </div>
            )}
          </div>

          {/* Expected columns */}
          <div className="mt-6 rounded-xl border p-4">
            <div className="text-sm font-medium">Expected CSV columns</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>
                <span className="font-mono">student_id</span> (or{" "}
                <span className="font-mono">student_number</span>)
              </li>
              <li>
                <span className="font-mono">mark</span> (0–100)
              </li>
              <li>
                <span className="font-mono">marker_id</span> (optional)
              </li>
            </ul>

            <div className="mt-3 text-xs text-gray-500">
              Backend validation: missing IDs, duplicate rows, non-numeric marks, out-of-range marks.
            </div>
          </div>

          {/* Example */}
          <div className="mt-6 rounded-xl border p-4 bg-gray-50">
            <div className="text-sm font-medium">Example CSV</div>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs text-gray-800 border">
{`student_id,mark,marker_id
w1234567,72,m001
w7654321,65,m001
w1111111,84,m002`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
