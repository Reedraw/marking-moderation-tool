// Login page component - handles user authentication
// "use client" directive is required because this component uses React hooks (useState, useRouter)
// Client Components run in the browser and can handle user interactions, form state, and side effects
"use client";

// useState hook manages local component state (form inputs, error messages, loading state)
import { useState } from "react";
// useRouter hook provides programmatic navigation - used to redirect after successful login
import { useRouter } from "next/navigation";
// Link component from Next.js enables client-side navigation without full page reloads
import Link from "next/link";
// Import authentication utility functions from our custom auth library:
// - login: sends credentials to the backend API and returns a JWT token
// - setToken: stores the JWT access token in localStorage for subsequent API requests
// - setUser: stores the authenticated user object in localStorage for display purposes
// - getRoleBasedRedirect: determines which dashboard URL to redirect to based on user role
// - ApiError: custom error class for handling structured API error responses
import { login, setToken, setUser, getRoleBasedRedirect, ApiError } from "@/lib/auth";

// Default export makes this the page component for the /login route
export default function LoginPage() {
  // Initialize the Next.js router for programmatic navigation after login
  const router = useRouter();
  // State variable for the email input field - tracks what the user types
  const [email, setEmail] = useState("");
  // State variable for the password input field - tracks the entered password
  const [password, setPassword] = useState("");
  // State variable for displaying error messages - null means no error is shown
  const [error, setError] = useState<string | null>(null);
  // State variable to track whether the form is currently being submitted
  // Used to disable the submit button and show "Signing in..." text to prevent double submissions
  const [submitting, setSubmitting] = useState(false);

  // Async form submission handler - called when the user clicks "Sign in" or presses Enter
  async function onSubmit(e: React.FormEvent) {
    // Prevent the default browser form submission which would cause a full page reload
    e.preventDefault();
    // Clear any previous error message before attempting a new login
    setError(null);

    // Client-side validation: check if email field is empty or only whitespace
    if (!email.trim()) {
      return setError("Please enter your email address.");
    }
    // Client-side validation: check if password field is empty
    if (!password) {
      return setError("Please enter a password.");
    }

    // Set submitting state to true to disable the button and show loading text
    setSubmitting(true);
    try {
      // Call the login API function - sends email and password to the backend /auth/login endpoint
      // .trim() removes whitespace, .toLowerCase() normalises email for case-insensitive matching
      const data = await login({ email: email.trim().toLowerCase(), password });
      // Store the JWT access token in localStorage so it can be sent with future API requests
      setToken(data.access_token);
      // Store the user object (id, email, role, etc.) in localStorage for displaying user info
      setUser(data.user);
      // Navigate the user to their role-specific dashboard (e.g., /lecturer/dashboard, /admin/dashboard)
      router.push(getRoleBasedRedirect());
    } catch (err) {
      // Handle API-specific errors (e.g., 401 Unauthorized, 422 Validation Error)
      if (err instanceof ApiError) {
        // Display the detailed error message from the API response
        setError(err.detail);
      } else {
        // Handle unexpected errors - show the error message or a generic fallback
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      // Always reset the submitting state, whether login succeeded or failed
      // This re-enables the submit button for retry attempts
      setSubmitting(false);
    }
  }

  // Render the login form UI
  return (
    // Full-screen container - centers the login card vertically and horizontally
    // min-h-screen ensures it takes at least the full viewport height
    // flex + items-center + justify-center creates a centered flexbox layout
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Login card container - white background with rounded corners, border, and subtle shadow */}
      {/* max-w-md limits the width to 28rem (448px) for readability on large screens */}
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm bg-white">
        {/* Page heading - displays the application name */}
        <h1 className="text-2xl font-semibold text-center">Marking Moderation Tool</h1>
        {/* Subtitle text with muted gray color */}
        <p className="mt-1 text-sm text-gray-600 text-center">Sign in to continue.</p>

        {/* Conditional error banner - only renders when 'error' state is not null */}
        {/* Uses red styling to draw attention to the error message */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Login form - onSubmit calls our async handler when the form is submitted */}
        {/* space-y-4 adds vertical spacing between form fields */}
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {/* Email input field group */}
          <div>
            {/* Label element linked to input via htmlFor/id for accessibility */}
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            {/* Controlled input - value comes from state, onChange updates state */}
            {/* autoComplete="email" helps browsers autofill the email field */}
            <input
              id="email"
              type="email"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          {/* Password input field group */}
          <div>
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            {/* type="password" masks the input characters for security */}
            {/* autoComplete="current-password" helps password managers fill in saved credentials */}
            <input
              id="password"
              className="mt-1 w-full rounded-xl border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {/* Submit button - disabled while the form is being submitted to prevent double clicks */}
          {/* Conditional text shows "Signing in..." during submission for user feedback */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-black px-4 py-2 text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {/* Registration link - navigates to the register page for new users */}
        {/* Uses Next.js Link component for client-side navigation (no full page reload) */}
        <p className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

