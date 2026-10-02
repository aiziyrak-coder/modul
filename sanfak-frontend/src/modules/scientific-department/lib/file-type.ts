export function fileExt(nameOrUrl?: string | null): string {
  if (!nameOrUrl) return '';
  const clean = nameOrUrl.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  return dot > -1 ? last.slice(dot + 1).toLowerCase() : '';
}

export type FileKind = 'pdf' | 'word' | 'excel' | 'ppt' | 'image' | 'other';

export function fileKind(nameOrUrl?: string | null): FileKind {
  const ext = fileExt(nameOrUrl);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx' || ext === 'rtf') return 'word';
  if (ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'excel';
  if (ext === 'ppt' || ext === 'pptx') return 'ppt';
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp') return 'image';
  return 'other';
}

export function fileTagColor(nameOrUrl?: string | null): string {
  const map: Record<FileKind, string> = {
    pdf: 'error',
    word: 'blue',
    excel: 'green',
    ppt: 'orange',
    image: 'gold',
    other: 'default',
  };
  return map[fileKind(nameOrUrl)];
}
