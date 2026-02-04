import { apiRequest, ApiError } from "./api-client";

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  full_name: string | null;
  username: string;
  email: string;
  password: string;
  role: "lecturer" | "moderator" | "third_marker" | "admin";
}

interface User {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: credentials,
  });
}

export async function register(data: RegisterData): Promise<User> {
  return apiRequest<User>("/auth/register", {
    method: "POST",
    body: data,
  });
}

export async function getCurrentUser(): Promise<User> {
  return apiRequest<User>("/auth/me", { requireAuth: true });
}

export async function logout(): Promise<{ message: string }> {
  return apiRequest<{ message: string }>("/auth/logout", { requireAuth: true });
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("access_token", token);
  }
}

export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("access_token");
  }
  return null;
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("access_token");
  }
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function getUserRole(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const userJson = localStorage.getItem("user");
  if (!userJson) {
    return null;
  }
  try {
    const user = JSON.parse(userJson) as User;
    return user.role;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("user", JSON.stringify(user));
  }
}

export function getUser(): User | null {
  if (typeof window === "undefined") {
    return null;
  }
  const userJson = localStorage.getItem("user");
  if (!userJson) {
    return null;
  }
  try {
    return JSON.parse(userJson) as User;
  } catch {
    return null;
  }
}

export function clearUser(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("user");
  }
}

export function getRoleBasedRedirect(): string {
  const user = getUser();
  if (!user) {
    return "/login";
  }

  const roleRedirects: Record<string, string> = {
    lecturer: "/lecturer/dashboard",
    moderator: "/moderator/dashboard",
    third_marker: "/third-marker/dashboard",
    admin: "/admin/dashboard",
  };

  return roleRedirects[user.role] || "/login";
}

export type { User, LoginCredentials, RegisterData, AuthResponse };
export { ApiError };
