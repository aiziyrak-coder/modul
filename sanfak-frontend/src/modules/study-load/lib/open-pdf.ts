import type { MessageInstance } from 'antd/es/message/interface';
import type { TFunction } from 'i18next';
import { AxiosError } from 'axios';
import { apiClient } from '@/shared/api';

export async function openPdf(
  path: string,
  messageApi: MessageInstance,
  t: TFunction,
): Promise<void> {
  const newTab = window.open('', '_blank');

  try {
    const response = await apiClient.get<Blob>(path, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(response.data);

    if (newTab) {
      newTab.location.href = blobUrl;
    } else {
      window.location.href = blobUrl;
    }

    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  } catch (error) {
    newTab?.close();
    messageApi.error(resolvePdfErrorMessage(t, error));
  }
}

function resolvePdfErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof AxiosError) {
    const status = error.response?.status;
    if (status === 401) return t('studyLoad.pdf.sessionExpired');
    if (status === 403) return t('studyLoad.pdf.forbidden');
    if (status === 404) return t('studyLoad.pdf.notFound');
  }
  return t('studyLoad.pdf.openFailed');
}
