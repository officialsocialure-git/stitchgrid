import { API_BASE_URL } from "@/constants";

function extractErrorMessage(json: any, res: Response): string {
  if (json?.error?.message) return json.error.message;
  if (json?.message) return json.message;
  if (json?.error?.details?.fieldErrors) {
    const fieldErrors = json.error.details.fieldErrors;
    const messages = Object.entries(fieldErrors).flatMap(([field, errors]) =>
      Array.isArray(errors) ? errors.map((err) => `${field}: ${err}`) : []
    );
    if (messages.length > 0) return messages.join("; ");
  }
  if (json?.error?.details?.formErrors?.length > 0) {
    return json.error.details.formErrors.join("; ");
  }
  return `Request failed (${res.status})`;
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("sg_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  private async request(url: string, options: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, options);
      const requestHeaders = new Headers(options.headers);
      const hasAuthenticatedRequest = requestHeaders.has("Authorization");

      // A 401 on a request carrying an access token means the current session
      // is no longer valid. Clear only auth state and send the user to sign in.
      if (response.status === 401 && hasAuthenticatedRequest && typeof window !== "undefined") {
        localStorage.removeItem("sg_token");
        localStorage.removeItem("sg_user");
        localStorage.removeItem("sg_membership");
        window.dispatchEvent(new CustomEvent("sg_session_expired"));
        if (window.location.pathname !== "/login") {
          window.location.assign("/login?session=expired");
        }
      }

      return response;
    } catch (err: any) {
      if (err instanceof TypeError || err?.name === "TypeError" || String(err?.message || "").includes("fetch")) {
        throw new Error(
          "Unable to reach STITCHGRID backend server. Please verify your connection or retry in a few moments."
        );
      }
      throw err;
    }
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.request(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.request(`${API_BASE_URL}${path}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await this.request(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await this.request(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }
}

export const api = new ApiClient();
