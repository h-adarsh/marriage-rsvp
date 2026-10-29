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
