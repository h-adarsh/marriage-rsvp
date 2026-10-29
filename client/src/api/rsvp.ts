import { PublicRsvpLookupResponse, SubmitRsvpPayload } from '../types/rsvp';

const API_BASE = '/api/rsvp';

/**
 * Handle API responses with user-friendly errors
 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 404) {
    throw new Error('This invitation link is invalid or has expired. Please check your link or contact the wedding planner.');
  }

  if (res.status === 429) {
    throw new Error('Too many attempts. For security, please wait a few moments before trying again.');
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Failed to process invitation. Please try again.');
  }

  return data as T;
}

/**
 * Fetch wedding invitation details by unguessable 128-bit token
 */
export async function getInvitationByToken(token: string): Promise<PublicRsvpLookupResponse> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  return handleResponse<PublicRsvpLookupResponse>(res);
}

/**
 * Submit or update guest RSVP responses
 */
export async function submitRsvpApi(
  token: string,
  payload: SubmitRsvpPayload
): Promise<{ success: boolean; message: string; submittedCount: number }> {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ success: boolean; message: string; submittedCount: number }>(res);
}
