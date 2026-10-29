import {
  FunctionCheckinOverview,
  RecordCheckinPayload,
  CheckinDetailItem,
  UpdateCheckinPayload,
} from '../types/checkin';

/**
 * Fetch venue check-in overview, summary, and guest arrivals
 */
export async function getFunctionCheckinOverviewApi(
  functionId: string
): Promise<FunctionCheckinOverview> {
  const res = await fetch(`/api/functions/${functionId}/checkins`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch check-in overview (${res.status})`);
  }

  return res.json();
}

/**
 * Record a guest arrival (invited household or walk-in)
 */
export async function recordCheckinApi(
  functionId: string,
  payload: RecordCheckinPayload
): Promise<{ checkin: CheckinDetailItem; isNew: boolean }> {
  const res = await fetch(`/api/functions/${functionId}/checkins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to record check-in (${res.status})`);
  }

  return res.json();
}

/**
 * Undo / remove a check-in
 */
export async function undoCheckinApi(
  functionId: string,
  checkinId: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/functions/${functionId}/checkins/${checkinId}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to undo check-in (${res.status})`);
  }

  return res.json();
}

/**
 * Adjust check-in party size or notes
 */
export async function updateCheckinApi(
  functionId: string,
  checkinId: string,
  payload: UpdateCheckinPayload
): Promise<CheckinDetailItem> {
  const res = await fetch(`/api/functions/${functionId}/checkins/${checkinId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to update check-in (${res.status})`);
  }

  return res.json();
}

