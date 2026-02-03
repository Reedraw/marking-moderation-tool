// frontend/app/moderator/layout.tsx
import Link from "next/link";

export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white min-h-screen p-4">
          <div className="text-lg font-semibold">MMT</div>
          <div className="mt-1 text-sm text-gray-600">Moderator</div>

          <nav className="mt-6 space-y-2">
            <Link
              href="/moderator/dashboard"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            {/* Optional later pages */}
            {/* <Link
              href="/moderator/history"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              History
            </Link> */}

            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100 text-red-600"
            >
              Sign out
            </Link>
          </nav>

          <div className="mt-8 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
            Prototype build.
            <div className="mt-1">FastAPI endpoints are marked as TODO on pages.</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
