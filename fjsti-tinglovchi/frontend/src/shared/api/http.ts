import { AxiosError } from 'axios';
import { apiClient } from './client';

export async function fetchOne<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await apiClient.get<T>(url, { params });
  return res.data;
}

export interface Paginated<T> {
  docs: T[];
  totalDocs: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export async function fetchPaginated<T>(
  url: string,
  params: { page: number; limit: number; [key: string]: unknown },
): Promise<Paginated<T>> {
  const res = await apiClient.get<Paginated<T>>(url, { params });
  return res.data;
}

export async function fetchList<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<T[]> {
  const res = await apiClient.get<T[]>(url, { params });
  return res.data;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await apiClient.post<T>(url, body);
  return res.data;
}

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  const res = await apiClient.put<T>(url, body);
  return res.data;
}

export async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await apiClient.patch<T>(url, body);
  return res.data;
}

export async function deleteData<T = unknown>(url: string): Promise<T> {
  const res = await apiClient.delete<T>(url);
  return res.data;
}

export async function uploadMultipart<T>(
  url: string,
  method: 'POST' | 'PUT',
  fields: Record<string, string | number | boolean | File | File[] | null | undefined>,
): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((file) => form.append(key, file));
    } else if (value instanceof File) {
      form.append(key, value);
    } else {
      form.append(key, String(value));
    }
  }
  const res = await apiClient.request<T>({
    url,
    method,
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as
      | { message?: string; detail?: string; error?: string }
      | undefined;
    return data?.message ?? data?.error ?? data?.detail ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}
