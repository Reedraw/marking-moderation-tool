"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // TODO (backend): POST /auth/login { username, password }
    // Expect: { access_token, user: { id, role } }
    // Then: store token (httpOnly cookie or memory) + redirect by role
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm bg-white">
        <h1 className="text-2xl font-semibold">Marking Moderation Tool</h1>
        <p className="mt-1 text-sm text-gray-600">Sign in to continue.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-sm font-medium">Username</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Password</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-black px-4 py-2 text-white hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
