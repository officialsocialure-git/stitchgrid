import * as SecureStore from 'expo-secure-store';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://stitchgrid-backend.onrender.com/api';

type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  let token: string | null = null;
  const isPublicAuthRequest = /^\/auth\/(login|signup|google|forgot-password|reset-password)(\/|$)/.test(path);
  if (!isPublicAuthRequest) {
    try {
      token = await SecureStore.getItemAsync('sg_token');
    } catch {}
  }

  let response: Response;
  const controller = options.timeoutMs ? new AbortController() : undefined;
  const timeout = options.timeoutMs
    ? setTimeout(() => controller?.abort(), options.timeoutMs)
    : undefined;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch {
    if (controller?.signal.aborted) {
      throw new Error(`STITCHGRID server did not respond within ${Math.round((options.timeoutMs || 0) / 1000)} seconds. Please try again; if this repeats, the backend needs investigation.`);
    }
    throw new Error('Unable to reach STITCHGRID server. Please check your internet connection and try again.');
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return (payload?.data !== undefined ? payload.data : payload) as T;
}

export function apiGet<T>(path: string) {
  return apiRequest<T>(path);
}

export function apiPost<T>(path: string, body: unknown, timeoutMs = 45000) {
  return apiRequest<T>(path, { method: 'POST', body, timeoutMs });
}

export function apiPatch<T>(path: string, body: unknown) {
  return apiRequest<T>(path, { method: 'PATCH', body });
}

export function apiDelete<T>(path: string) {
  return apiRequest<T>(path, { method: 'DELETE' });
}