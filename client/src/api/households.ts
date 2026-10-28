import { Household, CreateHouseholdInput } from '../types/household';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed. Please try again.');
  }
  return data as T;
}

export async function getHouseholdsApi(weddingId: string): Promise<Household[]> {
  const res = await fetch(`/api/weddings/${weddingId}/households`, {
    method: 'GET',
    credentials: 'include',
  });
  return handleResponse<Household[]>(res);
}

export async function createHouseholdApi(
  weddingId: string,
  input: CreateHouseholdInput
): Promise<Household> {
  const res = await fetch(`/api/weddings/${weddingId}/households`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return handleResponse<Household>(res);
}

export async function updateHouseholdApi(
  householdId: string,
  input: Partial<CreateHouseholdInput>
): Promise<Household> {
  const res = await fetch(`/api/households/${householdId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return handleResponse<Household>(res);
}

export async function deleteHouseholdApi(
  householdId: string
): Promise<{ success: boolean; deletedId: string }> {
  const res = await fetch(`/api/households/${householdId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse<{ success: boolean; deletedId: string }>(res);
}

export interface CsvImportPreviewResponse {
  dryRun: boolean;
  totalParsed: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  toImportCount: number;
  duplicates: Array<{ rowNumber: number; name: string; phone: string; reason: string; canOverride?: boolean }>;
  invalidRows: Array<{ rowNumber: number; name: string; phone: string; validationError?: string }>;
  previewRows: Array<{
    rowNumber: number;
    name: string;
    primaryContactName: string;
    phone: string;
    expectedPartySize: number;
    notes?: string;
  }>;
  fileHash?: string;
}

export interface CsvImportCommitResponse {
  success: boolean;
  importedCount: number;
  duplicateCount: number;
  invalidCount: number;
  duplicates: Array<{ rowNumber: number; name: string; phone: string; reason: string; canOverride?: boolean }>;
  invalidRows: Array<{ rowNumber: number; name: string; phone: string; validationError?: string }>;
  importedHouseholds: Array<{
    id: string;
    name: string;
    primaryContactName: string;
    phone: string;
    expectedPartySize: number;
    inviteToken: string;
  }>;
}

export async function importHouseholdCsvApi(
  weddingId: string,
  file: File,
  dryRun = false,
  overrideRows?: number[],
  fileHash?: string
): Promise<CsvImportPreviewResponse | CsvImportCommitResponse> {
  const formData = new FormData();
  formData.append('file', file);

  let url = `/api/weddings/${weddingId}/households/import-csv?dryRun=${dryRun}`;
  if (overrideRows && overrideRows.length > 0) {
    url += `&overrideRows=${overrideRows.join(',')}`;
  }
  if (fileHash) {
    url += `&fileHash=${encodeURIComponent(fileHash)}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  return handleResponse<CsvImportPreviewResponse | CsvImportCommitResponse>(res);
}

