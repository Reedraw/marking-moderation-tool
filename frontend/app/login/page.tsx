"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim()) return setError("Please enter a username.");
    if (!password) return setError("Please enter a password.");

    setSubmitting(true);
    try {
      // TODO (backend): POST /auth/login { username, password }
      // Expect: { access_token, user: { id, role } }
      // Then: store token (httpOnly cookie or memory) + redirect by role
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        let msg = "Login failed.";
        try {
          const data = await res.json();
          msg = data?.detail ?? data?.message ?? msg;
        } catch {
          // ignore JSON parse errors
        }
        setError(msg);
        return;
      }

      // Handle successful login - redirect based on role
      const data = await res.json();
      // TODO: Implement role-based redirect
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm bg-white">
        <h1 className="text-2xl font-semibold text-center">Marking Moderation Tool</h1>
        <p className="mt-1 text-sm text-gray-600 text-center">Sign in to continue.</p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <input
              id="username"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
