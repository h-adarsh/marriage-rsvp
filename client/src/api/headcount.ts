import { HeadcountData } from '../types/headcount';

export async function getFunctionHeadcountApi(
  functionId: string,
  params?: { maybePct?: number; staleDays?: number }
): Promise<HeadcountData> {
  const query = new URLSearchParams();
  if (params?.maybePct !== undefined) query.set('maybePct', String(params.maybePct));
  if (params?.staleDays !== undefined) query.set('staleDays', String(params.staleDays));

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`/api/functions/${functionId}/headcount${qs}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch headcount (${res.status})`);
  }

  return res.json();
}

/**
 * Downloads sanitized caterer CSV export from backend and parses filename
 */
export async function exportCatererCsvApi(
  functionId: string,
  maybePct?: number
): Promise<{ blob: Blob; filename: string }> {
  const query = new URLSearchParams();
  if (maybePct !== undefined) query.set('maybePct', String(maybePct));

  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`/api/functions/${functionId}/export-csv${qs}`, {
    credentials: 'include',
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to export caterer CSV (${res.status})`);
  }

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : `caterer_export_${Date.now()}.csv`;

  const blob = await res.blob();
  return { blob, filename };
}

