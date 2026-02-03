import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white min-h-screen p-4">
          <div className="text-lg font-semibold">MMT</div>
          <div className="mt-1 text-sm text-gray-600">Admin</div>

          <nav className="mt-6 space-y-2">
            <Link
              href="/admin/dashboard"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Dashboard
            </Link>

            {/* Optional future pages (prototype links) */}
            <Link
              href="/admin/users"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Users (prototype)
            </Link>

            <Link
              href="/admin/modules"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Modules (prototype)
            </Link>

            <Link
              href="/admin/audit-log"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100"
            >
              Audit log (prototype)
            </Link>

            <Link
              href="/login"
              className="block rounded-xl px-3 py-2 hover:bg-gray-100 text-red-600"
            >
              Sign out
            </Link>
          </nav>

          <div className="mt-8 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
            Prototype scope: Admin is read-only.
            <div className="mt-1">Configuration pages can be implemented later.</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
