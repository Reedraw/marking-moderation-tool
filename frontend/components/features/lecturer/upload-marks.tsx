"use client";

import Link from "next/link";
import { Card } from "@/components/ui";

interface UploadMarksProps {
  assessmentId: string;
}

export function UploadMarks({ assessmentId }: UploadMarksProps) {
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
                type="file"
                accept=".csv"
                className="block w-full text-sm text-gray-700
                           file:mr-4 file:rounded-xl file:border file:bg-white
                           file:px-4 file:py-2 file:text-sm file:hover:bg-gray-50"
              />

              <button className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90">
                Upload
              </button>

              <button className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50">
                Download template
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              TODO: POST /api/lecturer/assessments/{assessmentId}/marks/upload
            </div>
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
