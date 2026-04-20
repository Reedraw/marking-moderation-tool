// Registration page component - allows new users to create an account
// "use client" is required because this component uses React hooks (useState, useRouter)
// for managing form state and performing client-side navigation
"use client";

// useState hook for managing form input values, error messages, and loading state
import { useState } from "react";
// Link component provides client-side navigation between pages without full page reloads
import Link from "next/link";
// useRouter hook enables programmatic navigation - used to redirect to login after successful registration
import { useRouter } from "next/navigation";
// Import the register API function and ApiError custom error class from our auth utility library
// register: sends new user data to the backend POST /auth/register endpoint
// ApiError: typed error class that contains structured error info from the API (detail, field errors)
import { register, ApiError } from "@/lib/auth";

// Define a TypeScript union type for the allowed user roles in the system
// This restricts the role dropdown to only these four valid values
type Role = "lecturer" | "moderator" | "third_marker" | "admin";

// Regular expression for password complexity validation (client-side)
// (?=.*[a-z]) - must contain at least one lowercase letter
// (?=.*[A-Z]) - must contain at least one uppercase letter
// (?=.*\d) - must contain at least one digit
// (?=.*[^A-Za-z0-9]) - must contain at least one special character
// .{8,} - must be at least 8 characters long overall
const PASSWORD_COMPLEXITY_REGEX = /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}/;

// Default export makes this the page component for the /register route
export default function RegisterPage() {
  // Initialise the Next.js router for programmatic navigation to /login after registration
  const router = useRouter();

  // State variables for each form input field - React controlled components pattern
  // Each input's value is stored in state and updated via onChange handlers
  const [fullName, setFullName] = useState(""); // Optional display name for dashboards
  const [username, setUsername] = useState(""); // Required unique username for identification
  const [email, setEmail] = useState(""); // Required email address
  const [role, setRole] = useState<Role>("lecturer"); // Selected role, defaults to "lecturer"
  const [password, setPassword] = useState(""); // Password input
  const [confirmPassword, setConfirmPassword] = useState(""); // Password confirmation for matching check

  // UI state variables for tracking form submission and displaying messages
  const [submitting, setSubmitting] = useState(false); // True while API call is in progress
  const [error, setError] = useState<string | null>(null); // Error message to display, null = no error
  const [successMsg, setSuccessMsg] = useState<string | null>(null); // Success message after registration

  // Async form submission handler - triggered when the form is submitted
  async function onSubmit(e: React.FormEvent) {
    // Prevent default browser form submission which would cause a page reload
    e.preventDefault();
    // Clear any existing error or success messages before processing
    setError(null);
    setSuccessMsg(null);

    // Trim whitespace from text inputs to avoid accidental spaces
    const fn = fullName.trim(); // Trimmed full name
    const u = username.trim(); // Trimmed username
    const em = email.trim(); // Trimmed email

    // Client-side validation checks - validate each field before making the API call
    // These provide immediate feedback without waiting for a server round-trip
    if (!u) {
      return setError("Please enter a username.");
    }
    if (!em) {
      return setError("Please enter an email.");
    }
    if (!password) {
      return setError("Please enter a password.");
    }
    // Check minimum password length
    if (password.length < 8) {
      return setError("Password must be at least 8 characters.");
    }
    // Test password against complexity regex (uppercase, lowercase, digit, special char)
    if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
      return setError(
        "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
    }
    // Verify password confirmation matches the original password
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }

    // All validation passed - set loading state and make the API call
    setSubmitting(true);
    try {
      // Call the register API function which sends a POST request to the backend
      // Sends full_name (nullable), username, email, password, and selected role
      await register({
        full_name: fn || null, // Send null if full name is empty (it's optional)
        username: u,
        email: em,
        password,
        role,
      });

      // Registration successful - show success message to the user
      setSuccessMsg("Account created. Redirecting to login...");
      // Wait 800ms then redirect to login page so the user can sign in with their new account
      setTimeout(() => router.push("/login"), 800);
    } catch (err) {
      // Handle API-specific errors with structured error responses
      if (err instanceof ApiError) {
        // If the API returned field-specific validation errors (e.g., "email already exists")
        if (err.errors) {
          // Flatten all field error arrays into a single comma-separated string
          const fieldErrors = Object.values(err.errors).flat().join(", ");
          setError(fieldErrors);
        } else {
          // Display the general error detail message from the API
          setError(err.detail);
        }
      } else {
        // Handle unexpected/network errors with a generic message
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      // Always reset submitting state to re-enable the form, regardless of success or failure
      setSubmitting(false);
    }
  }

  // Render the registration form UI
  return (
    // Full-screen container with light gray background, centered content
    // min-h-screen ensures it fills the viewport, flex centers the card
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      {/* Wrapper div that constrains the form width to max 448px (max-w-md) */}
      <div className="w-full max-w-md">
        {/* Registration card - white background with border, rounded corners, and shadow */}
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          {/* Header section with title and explanatory subtitle */}
          <div className="mb-5">
            <h1 className="text-2xl font-semibold">Create an account</h1>
            {/* Note explaining this is a prototype - in production, accounts would be managed differently */}
            <p className="mt-1 text-sm text-gray-600">
              Prototype registration. In a real system, accounts may be created by admins or SSO.
            </p>
          </div>

          {/* Conditional error alert - only renders when error state is not null */}
          {/* Red styling makes errors visually prominent to the user */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Conditional success alert - only renders when successMsg state is not null */}
          {/* Green styling indicates a positive outcome */}
          {successMsg && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMsg}
            </div>
          )}

          {/* Registration form - space-y-4 adds 1rem vertical gap between each field group */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Full name field - optional, used for display in dashboards */}
            <div>
              <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
              {/* Controlled input: value bound to state, onChange updates state on every keystroke */}
              {/* focus:ring-2 adds a visible focus ring for accessibility when the input is selected */}
              <input
                id="fullName"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Dr A. Patel"
                autoComplete="name"
              />
              {/* Helper text explaining the field is optional */}
              <div className="mt-1 text-xs text-gray-500">
                Optional — used for display in dashboards.
              </div>
            </div>

            {/* Username field - required, must be unique in the system */}
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
              {/* Helper text explaining the purpose of the username field */}
              <div className="mt-1 text-xs text-gray-500">
                Used for internal identification (unique).
              </div>
            </div>

            {/* Email field - required for authentication, type="email" enables browser validation */}
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

            {/* Role selection dropdown - determines user permissions in the system */}
            <div>
              <label htmlFor="role" className="text-sm font-medium">Role</label>
              {/* The 'as Role' cast tells TypeScript the value will always be one of our Role union type values */}
              <select
                id="role"
                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                {/* Four role options matching the backend user roles */}
                <option value="lecturer">Lecturer</option>
                <option value="moderator">Moderator</option>
                <option value="third_marker">Third Marker</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Password field - type="password" masks input, autoComplete="new-password" for password managers */}
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

            {/* Confirm password field - must match the password field for validation */}
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

            {/* Submit button - disabled during API call to prevent duplicate submissions */}
            {/* Shows "Creating account..." while submitting for user feedback */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Creating account..." : "Register"}
            </button>

            {/* Link to login page for users who already have an account */}
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

