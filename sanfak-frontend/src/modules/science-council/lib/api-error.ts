export function apiMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data;
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  return fallback;
}
