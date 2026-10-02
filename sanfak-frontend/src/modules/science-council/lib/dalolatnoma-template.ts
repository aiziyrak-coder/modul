import type { ScientificWork, ReviewType } from '../model/types';
import { DOCUMENT_CATEGORIES } from './document-categories';

const INSTITUTE = "Farg'ona jamoat salomatligi tibbiyot instituti";

export function formatActDate(value?: string | Date | null): string {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export interface DalolatnomaVars {
  date: string;
  researcher: string;
  title: string;
  specialtyCode: string;
  specialtyTitle: string;
}

const BLANK = '__________';

export function collectVars(work: ScientificWork): DalolatnomaVars {
  return {
    date: formatActDate(work.protocol?.generatedAt),
    researcher: work.researcher?.name || work.externalAuthor?.name || BLANK,
    title: work.title || BLANK,
    specialtyCode: work.specialty?.code || BLANK,
    specialtyTitle: work.specialty?.title || BLANK,
  };
}

export function buildHeading(vars: DalolatnomaVars): string[] {
  return [
    `${INSTITUTE}ning dastlabki ekspertiza guruhining`,
    `(${vars.date}-yildagi dalolatnomasi)`,
    'XULOSASI',
  ];
}

export function buildIntro(vars: DalolatnomaVars): string {
  return (
    `${INSTITUTE} mustaqil izlanuvchisi ${vars.researcher}ning ` +
    `“${vars.title}” mavzusida ${vars.specialtyCode} – ${vars.specialtyTitle} ` +
    `ixtisosligi bo‘yicha tibbiyot fanlari bo‘yicha falsafa doktori (PhD) ` +
    `ilmiy darajasini olish uchun taqdim etilgan birlamchi hujjatlari bo‘yicha:`
  );
}

export interface DalolatnomaItem {
  no: number;
  text: string;
  docLabel: string;
  memberName: string;
}

export function buildItems(work: ScientificWork, lang: string): DalolatnomaItem[] {
  const items: DalolatnomaItem[] = [];
  const reviews = work.reviews ?? [];

  for (const cat of DOCUMENT_CATEGORIES) {
    const order = work.docAssignments?.[cat.key] ?? [];
    const docReviews = reviews
      .filter((r) => r.docKey === cat.key && r.text?.trim())
      .sort((a, b) => {
        const ia = order.indexOf(a.memberId);
        const ib = order.indexOf(b.memberId);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

    for (const r of docReviews) {
      items.push({
        no: items.length + 1,
        text: r.text.trim(),
        docLabel: lang === 'ru' ? cat.labelRu : cat.labelUz,
        memberName: r.memberName,
      });
    }
  }
  return items;
}

export const SIGNATURE_BLOCK = {
  viceRector: 'U.Boltaboyev',
  executor: 'A.R.Muradimova',
  executorPhone: '+998916084289',
} as const;

export function buildFinalConclusion(
  vars: DalolatnomaVars,
  recommended: boolean,
): string {
  const lines = [
    'Xulosa qilib:',
    `1. Tadqiqotchi ${vars.researcher}ning taqdim etgan birlamchi hujjatlari ` +
      `O‘zbekiston Respublikasi Oliy Attestatsiya Komissiyasining dissertatsiyalari (PhD) ` +
      `talablariga muvofiq rasmiylashtirilgan${recommended ? 'ligini tasdiqlaydi' : 'ligi tasdiqlanmadi'}.`,
    recommended
      ? `2. Tadqiqotchi ${vars.researcher}ning keyingi himoya bosqichga tavsiya etiladi.`
      : `2. Tadqiqotchi ${vars.researcher}ning keyingi himoya bosqichga tavsiya etilmaydi.`,
    '',
    `O‘quv ishlari bo‘yicha prorektor\t\t\t${SIGNATURE_BLOCK.viceRector}`,
    '',
    `Ijrochi: ${SIGNATURE_BLOCK.executor}`,
    SIGNATURE_BLOCK.executorPhone,
  ];
  return lines.join('\n');
}

export function isRecommended(reviews: { type: ReviewType }[]): boolean {
  return !reviews.some((r) => r.type === 'negative');
}
