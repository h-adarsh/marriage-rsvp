import {
  Wedding,
  WeddingFunction,
  CreateWeddingInput,
  CreateFunctionInput,
} from '../types/wedding';

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed. Please try again.');
  }
  return data as T;
}

export async function getWeddingsApi(): Promise<Wedding[]> {
  const res = await fetch('/api/weddings', {
    method: 'GET',
    credentials: 'include',
  });
  return handleResponse<Wedding[]>(res);
}

export async function createWeddingApi(input: CreateWeddingInput): Promise<Wedding> {
  const res = await fetch('/api/weddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return handleResponse<Wedding>(res);
}

export async function deleteWeddingApi(weddingId: string): Promise<{ success: boolean; deletedId: string }> {
  const res = await fetch(`/api/weddings/${weddingId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse<{ success: boolean; deletedId: string }>(res);
}

export async function getFunctionsApi(weddingId: string): Promise<WeddingFunction[]> {
  const res = await fetch(`/api/weddings/${weddingId}/functions`, {
    method: 'GET',
    credentials: 'include',
  });
  return handleResponse<WeddingFunction[]>(res);
}

export async function createFunctionApi(weddingId: string, input: CreateFunctionInput): Promise<WeddingFunction> {
  const res = await fetch(`/api/weddings/${weddingId}/functions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  return handleResponse<WeddingFunction>(res);
}

export async function deleteFunctionApi(functionId: string): Promise<{ success: boolean; deletedId: string }> {
  const res = await fetch(`/api/functions/${functionId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  return handleResponse<{ success: boolean; deletedId: string }>(res);
}
