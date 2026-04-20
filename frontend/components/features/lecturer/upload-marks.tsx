// "use client" directive tells Next.js this component runs in the browser (client-side),
// required because we use React hooks, file input refs, and browser APIs (Blob, URL.createObjectURL)
"use client";

// useState manages reactive state variables; useRef creates a mutable reference to a DOM element (file input)
import { useState, useRef } from "react";
// Link component from Next.js for client-side navigation (e.g., "Back" button)
import Link from "next/link";
// useRouter from Next.js App Router for programmatic navigation (redirect after upload or on auth failure)
import { useRouter } from "next/navigation";
// Card is a reusable styled container component from the UI library
import { Card } from "@/components/ui";
// ApiError is a custom error class carrying HTTP status and detail message from the backend
import { ApiError } from "@/lib/api-client";
// uploadMarks sends the parsed marks array to the backend API; MarkUpload is the TypeScript type for a single mark entry
import { uploadMarks, type MarkUpload } from "@/lib/assessments-api";

// TypeScript interface defining the props this component expects — the assessment UUID from the URL
interface UploadMarksProps {
  assessmentId: string;
}

// Main component for uploading student marks via CSV file
export function UploadMarks({ assessmentId }: UploadMarksProps) {
  // Router instance for programmatic navigation (redirect to login or back to assessment detail)
  const router = useRouter();
  // useRef creates a reference to the hidden file input element so we can programmatically access it
  const fileInputRef = useRef<HTMLInputElement>(null);
  // State to hold the selected CSV File object; null until user picks a file
  const [file, setFile] = useState<File | null>(null);
  // Boolean state tracking whether an upload is in progress (disables the button, shows "Uploading...")
  const [uploading, setUploading] = useState(false);
  // Error message state; null means no error to display
  const [error, setError] = useState<string | null>(null);
  // Result state holds the server's response after upload: how many marks processed, skipped, and any errors
  const [result, setResult] = useState<{ processed: number; skipped: number; errors: string[] } | null>(null);

  // Event handler called when the user selects a file from the file input dialog
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    // e.target.files is a FileList; optional chaining gets the first file (index 0)
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Store the selected file in state
      setFile(selectedFile);
      // Clear any previous error since user is trying again
      setError(null);
      // Clear any previous upload result
      setResult(null);
    }
  }

  // Parses the CSV file contents into an array of MarkUpload objects for the API
  async function parseCSV(file: File): Promise<MarkUpload[]> {
    // file.text() reads the entire file as a string (returns a Promise)
    const text = await file.text();
    // Split the text into lines by newline character, trimming whitespace
    const lines = text.trim().split("\n");
    // Array to accumulate the parsed mark objects
    const marks: MarkUpload[] = [];

    // Start from index 1 to skip the header row (index 0 is "student_id,mark,marker_id")
    for (let i = 1; i < lines.length; i++) {
      // Trim whitespace from each line
      const line = lines[i].trim();
      // Skip empty lines
      if (!line) continue;

      // Split the CSV line by commas and trim each value
      const parts = line.split(",").map(p => p.trim());
      // A valid line needs at least 2 columns (student_id and mark); marker_id is optional
      if (parts.length >= 2) {
        marks.push({
          student_id: parts[0],               // First column: student identifier (e.g., "w1234567")
          mark: parseFloat(parts[1]),          // Second column: numeric mark (0-100), parsed from string
          marker_id: parts[2] || undefined,    // Third column (optional): marker identifier, or undefined if empty
        });
      }
    }

    // Return the array of parsed marks to be sent to the backend
    return marks;
  }

  // Main upload handler: parses the CSV and sends marks to the backend API
  async function handleUpload() {
    // Guard: ensure a file has been selected before proceeding
    if (!file) {
      setError("Please select a file first");
      return;
    }

    // Set uploading state to true (disables button, shows spinner text)
    setUploading(true);
    // Clear any previous errors and results
    setError(null);
    setResult(null);

    try {
      // Parse the CSV file into structured mark objects
      const marks = await parseCSV(file);
      // If no valid marks were found in the file, show an error and stop
      if (marks.length === 0) {
        setError("No valid marks found in the CSV file");
        setUploading(false);
        return;
      }

      // Send the parsed marks to the backend API endpoint for this assessment
      const response = await uploadMarks(assessmentId, marks);
      // Store the upload result (processed count, skipped count, errors) in state for display
      setResult(response);

      // If no errors occurred during upload, redirect back to assessment detail after 2 seconds
      if (response.errors.length === 0) {
        setTimeout(() => {
          router.push(`/lecturer/assessments/${assessmentId}`);
        }, 2000); // 2-second delay so the user can see the success message
      }
    } catch (err) {
      // Handle API-specific errors with status codes
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // Unauthorized — redirect to login page (token expired or missing)
          router.push("/login");
        } else {
          // Display the backend error message (e.g., validation failure details)
          setError(err.detail);
        }
      } else {
        // Handle generic errors (network issues, etc.)
        setError(err instanceof Error ? err.message : "Failed to upload marks");
      }
    } finally {
      // Always reset the uploading state, whether the upload succeeded or failed
      setUploading(false);
    }
  }

  // Creates and downloads a CSV template file so lecturers know the expected format
  function downloadTemplate() {
    // Define the template CSV content with headers and two example rows
    const template = "student_id,mark,marker_id\nw1234567,72,m001\nw7654321,65,m002\n";
    // Create a Blob (binary large object) from the string with CSV MIME type
    const blob = new Blob([template], { type: "text/csv" });
    // Generate a temporary URL pointing to the Blob in browser memory
    const url = URL.createObjectURL(blob);
    // Programmatically create an <a> element to trigger the download
    const a = document.createElement("a");
    a.href = url;                           // Set the download URL
    a.download = "marks_template.csv";      // Set the suggested filename
    a.click();                              // Trigger the download
    // Release the Blob URL to free browser memory
    URL.revokeObjectURL(url);
  }

  // --- JSX Return: The component's rendered output ---
  return (
    // Outer container with vertical spacing between sections
    <div className="space-y-6">
      {/* Page header with title and "Back" navigation link */}
      <header className="flex items-start justify-between gap-4">
        <div>
          {/* Main heading for the upload page */}
          <h1 className="text-2xl font-semibold">Upload marks</h1>
          {/* Display the assessment ID for reference */}
          <p className="mt-1 text-sm text-gray-600">Assessment ID: {assessmentId}</p>
        </div>

        <div className="flex gap-2">
          {/* Back button navigates to the assessment detail page */}
          <Link
            href={`/lecturer/assessments/${assessmentId}`}
            className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </header>

      {/* Error banner — only rendered when there's an error message in state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Upload result banner — shown after upload completes; colour depends on whether there were errors */}
      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          // Yellow styling if there were partial errors, green if fully successful
          result.errors.length > 0 ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-green-200 bg-green-50 text-green-700"
        }`}>
          <div className="font-medium">Upload complete</div>
          {/* Show how many marks were successfully processed */}
          <div>Processed: {result.processed} marks</div>
          {/* Show skipped count only if any were skipped */}
          {result.skipped > 0 && <div>Skipped: {result.skipped}</div>}
          {/* Show individual error messages if any occurred */}
          {result.errors.length > 0 && (
            <div className="mt-2">
              <div className="font-medium">Errors:</div>
              {/* Render each error as a bullet point in an unordered list */}
              <ul className="list-disc pl-5 text-xs">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main upload card containing the file picker, upload button, and instructions */}
      <Card className="">
        <div className="p-5">
          {/* Section heading */}
          <h2 className="text-lg font-semibold">CSV upload</h2>
          {/* Brief description of what this section does */}
          <p className="mt-1 text-sm text-gray-600">
            Upload a CSV containing student identifiers and marks. Validation will be applied on upload.
          </p>

          {/* Dashed-border upload area — visual affordance for drag-and-drop style file selection */}
          <div className="mt-4 rounded-2xl border border-dashed p-6">
            <div className="text-sm font-medium">Choose a CSV file</div>
            {/* Accepted file type hint */}
            <p className="mt-1 text-xs text-gray-600">
              Accepted: <span className="font-mono">.csv</span>
            </p>

            {/* Row containing the file input, upload button, and template download button */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Native HTML file input with ref for programmatic access; only accepts .csv files */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-700
                           file:mr-4 file:rounded-xl file:border file:bg-white
                           file:px-4 file:py-2 file:text-sm file:hover:bg-gray-50"
              />

              {/* Upload button — disabled when no file selected or upload is in progress */}
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {/* Show "Uploading..." text while the upload is processing */}
                {uploading ? "Uploading..." : "Upload"}
              </button>

              {/* Template download button — creates and downloads a sample CSV file */}
              <button
                onClick={downloadTemplate}
                className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
              >
                Download template
              </button>
            </div>

            {/* Show the selected filename so the user knows which file they picked */}
            {file && (
              <div className="mt-3 text-sm text-gray-600">
                Selected: {file.name}
              </div>
            )}
          </div>

          {/* Documentation section: lists the expected CSV column names and validation rules */}
          <div className="mt-6 rounded-xl border p-4">
            <div className="text-sm font-medium">Expected CSV columns</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-700 space-y-1">
              <li>
                {/* student_id is the primary identifier for each student */}
                <span className="font-mono">student_id</span> (or{" "}
                <span className="font-mono">student_number</span>)
              </li>
              <li>
                {/* mark must be a number between 0 and 100 */}
                <span className="font-mono">mark</span> (0–100)
              </li>
              <li>
                {/* marker_id is optional — identifies which marker graded this student */}
                <span className="font-mono">marker_id</span> (optional)
              </li>
            </ul>

            {/* Note about server-side validation that will catch data quality issues */}
            <div className="mt-3 text-xs text-gray-500">
              Backend validation: missing IDs, duplicate rows, non-numeric marks, out-of-range marks.
            </div>
          </div>

          {/* Example CSV section — shows a formatted preview of what a valid CSV looks like */}
          <div className="mt-6 rounded-xl border p-4 bg-gray-50">
            <div className="text-sm font-medium">Example CSV</div>
            {/* <pre> preserves whitespace and uses monospace font for code-like display */}
            <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs text-gray-800 border">
{/* Template literal showing example CSV data with headers and three sample rows */}
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
