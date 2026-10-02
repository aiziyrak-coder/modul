export interface ApiErrorBody {
  statusCode?: number;
  message?: string;
  detail?: string;
  reason?: string;
  submissionCount?: number;
}

export function apiErrorBody(err: unknown): ApiErrorBody {
  const data = (err as { response?: { data?: unknown } } | null)?.response?.data;
  return data && typeof data === 'object' ? (data as ApiErrorBody) : {};
}
