"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { ApiError } from "@/lib/api-client";
import { createAssessment } from "@/lib/assessments-api";

export default function NewAssessmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    module_code: "",
    module_name: "",
    title: "",
    cohort: "",
    due_date: "",
    weighting: 100,
    credit_size: 15,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const assessment = await createAssessment(formData);
      router.push(`/lecturer/assessments/${assessment.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          router.push("/login");
        } else {
          setError(err.detail);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to create assessment");
      }
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Create Assessment</h1>
          <p className="mt-1 text-sm text-gray-600">
            Add a new assessment for marking and moderation.
          </p>
        </div>
        <Link
          href="/lecturer/dashboard"
          className="rounded-xl border bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          Cancel
        </Link>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="module_code" className="block text-sm font-medium text-gray-700">
                Module Code
              </label>
              <input
                type="text"
                id="module_code"
                name="module_code"
                value={formData.module_code}
                onChange={handleChange}
                required
                placeholder="e.g., 6COSC023W"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label htmlFor="module_name" className="block text-sm font-medium text-gray-700">
                Module Name
              </label>
              <input
                type="text"
                id="module_name"
                name="module_name"
                value={formData.module_name}
                onChange={handleChange}
                required
                placeholder="e.g., Final Year Project"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Assessment Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Coursework 1"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="cohort" className="block text-sm font-medium text-gray-700">
                Cohort
              </label>
              <input
                type="text"
                id="cohort"
                name="cohort"
                value={formData.cohort}
                onChange={handleChange}
                required
                placeholder="e.g., 2024/25"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label htmlFor="due_date" className="block text-sm font-medium text-gray-700">
                Due Date
              </label>
              <input
                type="date"
                id="due_date"
                name="due_date"
                value={formData.due_date}
                onChange={handleChange}
                required
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="weighting" className="block text-sm font-medium text-gray-700">
                Weighting (%)
              </label>
              <input
                type="number"
                id="weighting"
                name="weighting"
                value={formData.weighting}
                onChange={handleChange}
                min={1}
                max={100}
                required
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label htmlFor="credit_size" className="block text-sm font-medium text-gray-700">
                Credit Size
              </label>
              <select
                id="credit_size"
                name="credit_size"
                value={formData.credit_size}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
              >
                <option value={15}>15 credits</option>
                <option value={30}>30 credits</option>
                <option value={45}>45 credits</option>
                <option value={60}>60 credits</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-black px-6 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create assessment"}
            </button>
            <Link
              href="/lecturer/dashboard"
              className="rounded-xl border bg-white px-6 py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
