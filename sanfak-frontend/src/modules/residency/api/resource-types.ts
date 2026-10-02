export type ResourceType =
  | 'kitob'
  | 'atlas'
  | 'video'
  | 'metodik'
  | 'protokol'
  | 'qollanma';

export interface Resource {
  id: string;
  title: string;
  resourceType: ResourceType;
  specialtyId: string | null;
  specialtyTitle: string | null;
  departmentId: string | null;
  departmentTitle: string | null;
  author: string | null;
  publishYear: number | null;
  desc: string | null;
  fileUrl: string;
  fileName: string | null;
  fileSize: number | null;
  format: string | null;
  downloadCount: number;
  uploadedByName: string | null;
  createdAt: string | null;
}

export interface ResourceStats {
  total: number;
  pdf: number;
  video: number;
  downloads: number;
}

export const RESOURCE_TYPES: ResourceType[] = [
  'kitob',
  'atlas',
  'video',
  'metodik',
  'protokol',
  'qollanma',
];

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  kitob: 'Kitob',
  atlas: 'Atlas',
  video: 'Video',
  metodik: 'Metodik',
  protokol: 'Protokol',
  qollanma: 'Qo‘llanma',
};

export const RESOURCE_TYPE_EMOJI: Record<ResourceType, string> = {
  kitob: '📘',
  atlas: '🗺️',
  video: '🎬',
  metodik: '📝',
  protokol: '📋',
  qollanma: '📗',
};

export function formatVariant(format: string | null): string {
  const f = (format ?? '').toUpperCase();
  if (f === 'PDF') return 'danger';
  if (f === 'MP4') return 'info';
  if (f === 'DOCX' || f === 'DOC') return 'success';
  return 'umumiy';
}
