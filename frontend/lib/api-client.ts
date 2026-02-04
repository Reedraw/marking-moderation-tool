const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  requireAuth?: boolean;
}

class ApiError extends Error {
  status: number;
  detail: string;
  errors?: Record<string, string[]>;

  constructor(status: number, detail: string, errors?: Record<string, string[]>) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.errors = errors;
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    requireAuth = false,
  } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  const requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (requireAuth) {
    if (typeof window === "undefined") {
      throw new Error("Cannot access localStorage on server");
    }
    const token = localStorage.getItem("access_token");
    if (!token) {
      throw new ApiError(401, "No authentication token found");
    }
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new ApiError(
          response.status,
          errorData.detail || errorData.message || "Request failed",
          errorData.field_errors
        );
      }
      throw new ApiError(response.status, "Request failed");
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, error instanceof Error ? error.message : "Network error");
  }
}

export { apiRequest, ApiError };
