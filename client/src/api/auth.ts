import { LoginCredentials, RegisterCredentials, PlannerUser } from '../types/auth';

const API_BASE = '/api/auth';

/**
 * Handle API response and extract JSON or error message
 */
async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'An unexpected error occurred. Please try again.');
  }
  return data as T;
}

export async function loginApi(credentials: LoginCredentials): Promise<PlannerUser> {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });
  return handleResponse<PlannerUser>(res);
}

export async function registerApi(credentials: RegisterCredentials): Promise<PlannerUser> {
  const res = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  });
  return handleResponse<PlannerUser>(res);
}

export async function logoutApi(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse<{ success: boolean }>(res);
}

export async function getMeApi(): Promise<PlannerUser> {
  const res = await fetch(`${API_BASE}/me`, {
    method: 'GET',
    credentials: 'include',
  });
  return handleResponse<PlannerUser>(res);
}
