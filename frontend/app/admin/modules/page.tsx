"use client";

import { Card } from "@/components/ui";

export default function ModulesPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Modules</h1>
          <p className="mt-1 text-sm text-gray-600">
            View and manage academic modules.
          </p>
        </div>
      </header>

      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">Module Management</h2>
          <p className="mt-2 text-sm text-gray-600">
            This page will display a list of all academic modules, allowing administrators
            to view module details, assigned lecturers, and moderators.
          </p>

          <div className="mt-6 rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <div className="text-gray-400 text-4xl mb-2">📚</div>
            <h3 className="text-lg font-medium text-gray-700">Coming Soon</h3>
            <p className="mt-1 text-sm text-gray-500">
              Module management features are planned for a future release.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Features will include: module creation, lecturer/moderator assignment,
              cohort management, and module run tracking.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="p-5">
          <h2 className="text-lg font-semibold">Planned Features</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>View all modules with their codes, names, and credit sizes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Assign lecturers as module leaders</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Assign default moderators for each module</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Track module runs by academic year</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>View assessment history per module</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
