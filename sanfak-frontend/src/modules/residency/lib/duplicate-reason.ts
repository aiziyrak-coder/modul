import type { DuplicateKey } from '../api/residency-api';

const TEXT: Record<DuplicateKey, string> = {
  user: 'Bu OneID akkaunt bilan talaba allaqachon mavjud',
  jshshir: 'Bu JSHSHIR bilan talaba allaqachon mavjud',
  passport: 'Bu pasport (seriya va raqam) bilan talaba allaqachon mavjud',
};

export function duplicateReasonText(key: DuplicateKey | undefined): string {
  return key ? TEXT[key] : 'Bunday talaba allaqachon mavjud';
}
