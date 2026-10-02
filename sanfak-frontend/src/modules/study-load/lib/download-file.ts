import type { MessageInstance } from 'antd/es/message/interface';
import type { TFunction } from 'i18next';
import { AxiosError } from 'axios';
import { apiClient } from '@/shared/api';

export async function downloadFile(
  path: string,
  params: Record<string, string | undefined>,
  fallbackName: string,
  messageApi: MessageInstance,
  t: TFunction,
): Promise<boolean> {
  try {
    const response = await apiClient.get<Blob>(path, { params, responseType: 'blob' });
    const headers = response.headers as Record<string, unknown>;
    const name = fileNameFromDisposition(headers['content-disposition']) ?? fallbackName;
    saveBlob(response.data, name);
    return true;
  } catch (error) {
    messageApi.error(await resolveDownloadErrorMessage(t, error));
    return false;
  }
}

export function fileNameFromDisposition(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''));
    } catch {}
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const BLOB_READ_TIMEOUT_MS = 2_000;

async function blobToText(blob: Blob): Promise<string | null> {
  const read = new Promise<string | null>((resolve) => {
    if (typeof blob.text === 'function') {
      blob
        .text()
        .then((text) => resolve(text))
        .catch(() => resolve(null));
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(blob);
    } catch {
      resolve(null);
    }
  });
  const guard = new Promise<string | null>((resolve) => {
    setTimeout(() => resolve(null), BLOB_READ_TIMEOUT_MS);
  });
  return Promise.race([read, guard]);
}

async function serverMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof AxiosError)) return null;
  const data: unknown = error.response?.data;
  let raw: string | null = null;
  if (data instanceof Blob) {
    raw = await blobToText(data);
  } else if (typeof data === 'string') {
    raw = data;
  } else if (data && typeof data === 'object') {
    const msg = (data as { message?: unknown }).message;
    return typeof msg === 'string' && msg.trim() ? msg : null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const msg = (parsed as { message?: unknown })?.message;
    return typeof msg === 'string' && msg.trim() ? msg : null;
  } catch {
    return null;
  }
}

async function resolveDownloadErrorMessage(t: TFunction, error: unknown): Promise<string> {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === 401) return t('studyLoad.pdf.sessionExpired');
    if (status === 403) return t('studyLoad.pdf.forbidden');
    if (status === 404) return t('studyLoad.pdf.notFound');
    if (status === 409) return (await serverMessage(error)) ?? t('studyLoad.download.conflict');
  }
  return t('studyLoad.download.failed');
}
