import Link from "next/link";

export default function LecturerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white min-h-screen p-4">
          <div className="text-lg font-semibold">MMT</div>
          <div className="mt-1 text-sm text-gray-600">Lecturer</div>

          <nav className="mt-6 space-y-2">
            <Link
              href="/lecturer/dashboard"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            {/* Later: profile/settings */}
            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100 text-red-600"
            >
              Sign out
            </Link>
          </nav>

          <div className="mt-8 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
            Frontend-first build.
            <div className="mt-1">Backend endpoints are marked as TODO on pages.</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
