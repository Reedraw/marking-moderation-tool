// Import the generic API request function and custom error class from our API client
import { apiRequest, ApiError } from "./api-client";

// Interface for login form data - email and password
interface LoginCredentials {
  email: string;
  password: string;
}

// Interface for registration form data
// Matches the backend Pydantic RegisterRequest model
interface RegisterData {
  full_name: string | null;                                              // Optional display name
  username: string;                                                       // Unique username
  email: string;                                                          // Unique email address
  password: string;                                                       // Plain text (hashed server-side with Argon2)
  role: "lecturer" | "moderator" | "third_marker" | "admin";             // Role determines access permissions
}

// Interface for user data returned from the backend
// Matches the backend UserResponse Pydantic model
interface User {
  id: string;              // UUID primary key
  username: string;
  email: string;
  full_name: string | null;
  role: string;            // User's role (lecturer, moderator, third_marker, admin)
  is_active: boolean;      // Whether account is active (can be deactivated by admin)
  created_at: string;      // ISO timestamp of account creation
  updated_at: string;      // ISO timestamp of last update
}

// Interface for the login response containing both token and user data
interface AuthResponse {
  access_token: string;    // JWT token for authenticating subsequent requests
  token_type: string;      // Always "bearer" - standard OAuth2 token type
  user: User;              // Full user object returned with the token
}

// Send login credentials to the backend and receive a JWT token + user data
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: credentials,
  });
}

// Register a new user account - returns the created user (without token)
export async function register(data: RegisterData): Promise<User> {
  return apiRequest<User>("/auth/register", {
    method: "POST",
    body: data,
  });
}

// Fetch the currently authenticated user's profile from the /auth/me endpoint
export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me", { requireAuth: true });
}

// Log out the current user - invalidates the token server-side
export async function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", { requireAuth: true });
}

// Store the JWT access token in browser localStorage for persistent sessions
export function setToken(token: string): void {
  // Guard against server-side rendering (Next.js SSR) where window doesn't exist
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", token);
  }
}

// Retrieve the stored JWT token from localStorage
export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;  // Return null on server-side
}

// Remove the JWT token from localStorage (used during logout)
export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
}

// Quick check if user has a stored token (doesn't validate token expiry)
export function isAuthenticated(): boolean {
  return getToken() !== null;
}

// Extract the user's role from the stored user object in localStorage
// Used for role-based UI rendering (showing/hiding features per role)
export function getUserRole(): string | null {
  if (typeof window === "undefined") {
    return null;  // Server-side guard
  }
  const userJson = localStorage.getItem("user");
  if (!userJson) {
    return null;  // No stored user data
  }
  try {
    // Parse the stored JSON string back into a User object
    const user = JSON.parse(userJson) as User;
    return user.role;
  } catch {
    return null;  // Handle corrupted/invalid JSON gracefully
  }
}

// Store the full user object in localStorage as JSON string
// Called after login to persist user data across page refreshes
export function setUser(user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(user));
  }
}

// Retrieve the stored user object from localStorage
export function getUser(): User | null {
  if (typeof window === "undefined") {
    return null;  // Server-side guard
  }
  const userJson = localStorage.getItem("user");
  if (!userJson) {
    return null;  // No stored user
  }
  try {
    return JSON.parse(userJson) as User;
  } catch {
    return null;  // Handle corrupted JSON
  }
}

// Remove the stored user object from localStorage (used during logout)
export function clearUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
  }
}

// Determine which dashboard to redirect to based on the user's role
// Each role has its own dashboard with role-specific features
export function getRoleBasedRedirect(): string {
  const user = getUser();
  if (!user) {
    return "/login";  // No user = redirect to login page
  }

  // Map each role to its corresponding dashboard URL
  const roleRedirects: Record<string, string> = {
    lecturer: "/lecturer/dashboard",
    moderator: "/moderator/dashboard",
    third_marker: "/third-marker/dashboard",
    admin: "/admin/dashboard",
  };

  // Look up the role, default to login page if role is unknown
  return roleRedirects[user.role] || "/login";
}

// Re-export types and ApiError for convenient imports from this module
export type { User, LoginCredentials, RegisterData, AuthResponse };
export { ApiError };
