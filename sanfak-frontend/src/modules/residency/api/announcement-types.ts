export type Audience = 'umumiy' | 'magistratura' | 'ordinatura' | 'kafedra_mudirlari';

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
  bytes: number;
  mimeType: string;
  uploadedByName: string | null;
  uploadedAt: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: Audience;
  academicYear: string | null;
  academicYearRef: string | null;
  deadline: string | null;
  createdByName: string | null;
  createdAt: string | null;
  attachments: Attachment[];
  targetCourses: number[];
  targetSpecialties: string[];
  isRead: boolean;
}

export interface ReadStatsRow {
  user: string;
  fullName: string;
  courseNumber: number | null;
  specialtyTitle: string | null;
  readAt?: string;
}

export interface ReadStats {
  total: number;
  readCount: number;
  unreadCount: number;
  percent: number | null;
  read: ReadStatsRow[];
  unread: ReadStatsRow[];
}

export const AUDIENCES: Audience[] = [
  'umumiy',
  'magistratura',
  'ordinatura',
  'kafedra_mudirlari',
];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  umumiy: 'Umumiy',
  magistratura: 'Magistratura',
  ordinatura: 'Klinik ordinatura',
  kafedra_mudirlari: 'Kafedra mudirlari',
};

export const AUDIENCE_VARIANT: Record<Audience, string> = {
  umumiy: 'umumiy',
  magistratura: 'info',
  ordinatura: 'success',
  kafedra_mudirlari: 'warning',
};

export const ATTACHMENT_ACCEPT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.odt', '.ods', '.odp', '.rtf', '.txt', '.csv',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg',
  '.zip', '.rar', '.7z',
] as const;

export const ATTACHMENT_ACCEPT = ATTACHMENT_ACCEPT_EXTENSIONS.join(',');

const MB = 1024 * 1024;

export const ATTACHMENT_LIMITS = {
  maxFileSize: 25 * MB,
  maxFiles: 10,
  maxTotalSize: 100 * MB,
};

const PREVIEWABLE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export const isPreviewable = (a: Attachment): boolean =>
  PREVIEWABLE_TYPES.includes(a.type.toLowerCase());

const TYPE_EMOJI: Record<string, string> = {
  pdf: '📕',
  doc: '📘', docx: '📘', odt: '📘', rtf: '📘',
  xls: '📗', xlsx: '📗', ods: '📗', csv: '📗',
  ppt: '📙', pptx: '📙', odp: '📙',
  txt: '📄',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', webp: '🖼️', gif: '🖼️', svg: '🖼️',
  zip: '🗜️', rar: '🗜️', '7z': '🗜️',
};

export const attachmentEmoji = (type: string): string =>
  TYPE_EMOJI[type.toLowerCase()] ?? '📎';

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export const fileExtension = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
};

export function validateAttachmentFile(
  file: File,
  context: { existingCount: number; existingBytes: number; pendingBytes: number },
): string | null {
  const ext = `.${fileExtension(file.name)}`;
  if (!(ATTACHMENT_ACCEPT_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${file.name}" — bu turdagi fayl qabul qilinmaydi`;
  }
  if (file.size === 0) {
    return `"${file.name}" — bo‘sh fayl`;
  }
  if (file.size > ATTACHMENT_LIMITS.maxFileSize) {
    return `"${file.name}" — fayl hajmi ${formatFileSize(ATTACHMENT_LIMITS.maxFileSize)} dan oshmasligi kerak`;
  }
  if (context.existingCount >= ATTACHMENT_LIMITS.maxFiles) {
    return `Ko'pi bilan ${ATTACHMENT_LIMITS.maxFiles} ta fayl biriktirish mumkin`;
  }
  if (context.existingBytes + context.pendingBytes + file.size > ATTACHMENT_LIMITS.maxTotalSize) {
    return `Umumiy hajm ${formatFileSize(ATTACHMENT_LIMITS.maxTotalSize)} dan oshmasligi kerak`;
  }
  return null;
}
