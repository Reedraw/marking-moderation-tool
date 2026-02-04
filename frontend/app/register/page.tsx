"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register, ApiError } from "@/lib/auth";

type Role = "lecturer" | "moderator" | "third_marker" | "admin";

const PASSWORD_COMPLEXITY_REGEX = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/;

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("lecturer");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const fn = fullName.trim();
    const u = username.trim();
    const em = email.trim();

    if (!u) {
      return setError("Please enter a username.");
    }
    if (!em) {
      return setError("Please enter an email.");
    }
    if (!password) {
      return setError("Please enter a password.");
    }
    if (password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
      return setError(
        "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
    }
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    setSubmitting(true);
    try {
      await register({
        full_name: fn || null,
        username: u,
        email: em,
        password,
        role,
      });

      setSuccessMsg("Account created. Redirecting to login...");
      setTimeout(() => router.push("/login"), 800);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors) {
          const fieldErrors = Object.values(err.errors).flat().join(", ");
          setError(fieldErrors);
        } else {
          setError(err.detail);
        }
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5">
            <h1 className="text-2xl font-semibold">Create an account</h1>
            <p className="mt-1 text-sm text-gray-600">
              Prototype registration. In a real system, accounts may be created by admins or SSO.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
              <input
                id="fullName"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr A. Patel"
                autoComplete="name"
              />
              <div className="mt-1 text-xs text-gray-500">
                Optional — used for display in dashboards.
              </div>
            </div>

            <div>
              <label htmlFor="username" className="text-sm font-medium">Username</label>
              <input
                id="username"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. dr.patel"
                autoComplete="username"
              />
              <div className="mt-1 text-xs text-gray-500">
                Used for internal identification (unique).
              </div>
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <input
                id="email"
                type="email"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@uni.ac.uk"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="role" className="text-sm font-medium">Role</label>
              <select
                id="role"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="lecturer">Lecturer</option>
                <option value="moderator">Moderator</option>
                <option value="third_marker">Third Marker</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <input
                id="password"
                type="password"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Creating account..." : "Register"}
            </button>

            <div className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-black hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

