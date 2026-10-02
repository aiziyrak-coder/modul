export const WORKLOAD_SUPERSEDED_STATUS = 'superseded';

export function isWorkloadSuperseded(status: string | null | undefined): boolean {
  return status === WORKLOAD_SUPERSEDED_STATUS;
}

export function workloadVersionLabel(version: number | null | undefined): string | null {
  return typeof version === 'number' && version > 1 ? `v${version}` : null;
}

export interface OpenVersionConflict {
  message: string;
  openWorkloadId: string | null;
  openStatus: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

export function extractOpenVersionConflict(error: unknown): OpenVersionConflict | null {
  if (!isRecord(error) || !isRecord(error.response)) return null;
  const { status, data } = error.response;
  if (status !== 409 || !isRecord(data) || data.reason !== 'open_version_exists') return null;
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const openId = data.openWorkloadId;
  return {
    message,
    openWorkloadId: typeof openId === 'string' && openId ? openId : null,
    openStatus: typeof data.openStatus === 'string' ? data.openStatus : null,
  };
}
