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

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      headers: this.getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(extractErrorMessage(json, res));
    return json.data !== undefined ? json.data : json;
  }
}

export const api = new ApiClient();
