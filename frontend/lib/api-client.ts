// Base URL for all API requests, loaded from environment variable
// Set in .env.local as NEXT_PUBLIC_API_URL (e.g., http://localhost:8000/api/v1)
// NEXT_PUBLIC_ prefix makes it available in browser-side code
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// Union type restricting allowed HTTP methods for type safety
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// Configuration interface for API requests
interface ApiRequestOptions {
  method?: HttpMethod;              // HTTP method, defaults to GET
  body?: any;                       // Request body (will be JSON.stringified)
  headers?: Record<string, string>; // Additional custom headers
  requireAuth?: boolean;            // Whether to include JWT Bearer token
}

// Custom error class for API errors - extends Error with HTTP status and details
// This allows catching specific API errors vs generic JS errors
class ApiError extends Error {
  status: number;                           // HTTP status code (401, 404, 500, etc.)
  detail: string;                           // Human-readable error message from server
  errors?: Record<string, string[]>;        // Optional field-level validation errors

  constructor(status: number, detail: string, errors?: Record<string, string[]>) {
    super(detail);                // Pass message to parent Error class
    this.name = "ApiError";       // Set error name for stack traces
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

// Generic API request function - handles all HTTP communication with the backend
// T is a TypeScript generic: the caller specifies what type the response should be
async function apiRequest<T>(
  endpoint: string,                    // API path (e.g., "/auth/login")
  options: ApiRequestOptions = {}      // Optional configuration
): Promise<T> {
  // Destructure options with defaults (method=GET, requireAuth=false)
  const {
    method = "GET",
    body,
    headers = {},
    requireAuth = false,
  } = options;

  // Build full URL by combining base URL + endpoint
  const url = `${API_BASE_URL}${endpoint}`;
  // Set default Content-Type header and merge any custom headers
  const requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  // If authentication is required, attach the JWT Bearer token from localStorage
  if (requireAuth) {
    // Guard against server-side rendering where localStorage doesn't exist
    if (typeof window === "undefined") {
      throw new Error("Cannot access localStorage on server");
    }
    // Retrieve the stored JWT token
    const token = localStorage.getItem("access_token");
    if (!token) {
      // No token found = user not logged in
      throw new ApiError(401, "No authentication token found");
    }
    // Add Authorization header with Bearer scheme
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  // Build the fetch request options object
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  // Serialize the body as JSON if provided (for POST, PUT, PATCH requests)
  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    // Make the HTTP request using the browser's native fetch API
    const response = await fetch(url, requestOptions);

    // Handle non-2xx responses (errors from the server)
    if (!response.ok) {
      // Check if the error response is JSON (to extract error details)
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        // Throw ApiError with server-provided details
        throw new ApiError(
          response.status,
          errorData.detail || errorData.message || "Request failed",
          errorData.field_errors
        );
      }
      // Non-JSON error response (e.g., HTML error page)
      throw new ApiError(response.status, "Request failed");
    }

    // Parse and return successful JSON response, cast to generic type T
    return response.json();
  } catch (error) {
    // Re-throw ApiErrors as-is (already formatted)
    if (error instanceof ApiError) {
      throw error;
    }
    // Wrap unexpected errors (network failures, CORS, etc.) in ApiError
    throw new ApiError(0, error instanceof Error ? error.message : "Network error");
  }
}

// Export the request function and error class for use across the frontend
export { apiRequest, ApiError };
