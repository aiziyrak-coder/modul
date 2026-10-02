import { describe, it, expect } from 'vitest';
import {
  buildFinalConclusion,
  buildHeading,
  buildIntro,
  buildItems,
  collectVars,
  formatActDate,
  isRecommended,
  SIGNATURE_BLOCK,
} from './dalolatnoma-template';
import type { ScientificWork } from '../model/types';

const work = {
  id: 'w1',
  title: 'Pnevmoniyadan vafot etgan bolalarda buyrak usti bezi patologik anatomiyasi',
  externalAuthor: { name: 'Orinbayev Jumabay Tileubayevich', workplace: '', position: '' },
  specialty: { id: 's1', title: 'Patologik anatomiya', code: '14.00.15', branch: null },
  protocol: { generatedAt: '2026-05-15T00:00:00.000Z' },
  docAssignments: { dissertation: ['m1', 'm2'], abstract: ['m1'] },
  reviews: [
    { id: 'r1', memberId: 'm2', memberName: 'Aliyev A.', docKey: 'dissertation', type: 'positive', text: 'Ikkinchi a\'zo matni', reviewedAt: '2026-05-01' },
    { id: 'r2', memberId: 'm1', memberName: 'Valiyev V.', docKey: 'dissertation', type: 'neutral', text: 'Birinchi a\'zo matni', reviewedAt: '2026-05-02' },
    { id: 'r3', memberId: 'm1', memberName: 'Valiyev V.', docKey: 'abstract', type: 'positive', text: 'Avtoreferat matni', reviewedAt: '2026-05-03' },
    { id: 'r4', memberId: 'm2', memberName: 'Aliyev A.', docKey: 'abstract', type: 'positive', text: '   ', reviewedAt: '2026-05-04' },
  ],
} as unknown as ScientificWork;

describe('formatActDate', () => {
  it('kun.oy.yil formatiga o\'giradi', () => {
    expect(formatActDate('2026-05-15T00:00:00.000Z')).toBe('15.05.2026');
  });

  it('bir xonali kun/oyni nol bilan to\'ldiradi', () => {
    expect(formatActDate('2026-01-05T00:00:00.000Z')).toBe('05.01.2026');
  });

  it('buzuq sana — bo\'sh satr (dalolatnoma baribir ochilsin)', () => {
    expect(formatActDate('salom')).toBe('');
  });
});

describe('collectVars', () => {
  it('tashqi muallif, ixtisoslik va sanani yig\'adi', () => {
    expect(collectVars(work)).toEqual({
      date: '15.05.2026',
      researcher: 'Orinbayev Jumabay Tileubayevich',
      title: work.title,
      specialtyCode: '14.00.15',
      specialtyTitle: 'Patologik anatomiya',
    });
  });

  it('ma\'lumot yo\'q joyni bo\'sh qoldirmaydi — to\'ldirish uchun chiziq qo\'yadi', () => {
    const bare = { title: '', protocol: {}, reviews: [] } as unknown as ScientificWork;
    const vars = collectVars(bare);
    expect(vars.researcher).toBe('__________');
    expect(vars.specialtyCode).toBe('__________');
  });
});

describe('buildHeading / buildIntro', () => {
  it('sarlavhaga dalolatnoma sanasi qo\'yiladi', () => {
    const h = buildHeading(collectVars(work));
    expect(h[1]).toBe('(15.05.2026-yildagi dalolatnomasi)');
    expect(h[2]).toBe('XULOSASI');
  });

  it('kirish matniga F.I.Sh, ish nomi, shifr va ixtisoslik nomi kiradi', () => {
    const intro = buildIntro(collectVars(work));
    expect(intro).toContain('Orinbayev Jumabay Tileubayevich');
    expect(intro).toContain(work.title);
    expect(intro).toContain('14.00.15');
    expect(intro).toContain('Patologik anatomiya');
  });
});

describe('buildItems', () => {
  const items = buildItems(work, 'uz');

  it('raqamlash 1 dan boshlanadi va uzluksiz', () => {
    expect(items.map((i) => i.no)).toEqual([1, 2, 3]);
  });

  it('BAHO TURI (ijobiy/salbiy/neytral) bandga KIRMAYDI', () => {
    for (const it of items) {
      expect(it).not.toHaveProperty('type');
      expect(it.text).not.toMatch(/ijobiy|salbiy|neytral/i);
    }
  });

  it('bo\'sh matnli xulosa tushib qoladi (raqam behuda ketmasin)', () => {
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.text.trim() === '')).toBe(false);
  });

  it('hujjatga biriktirilgan a\'zolar TARTIBIDA joylashadi', () => {
    expect(items.map((i) => i.text)).toEqual([
      "Birinchi a'zo matni",
      "Ikkinchi a'zo matni",
      'Avtoreferat matni',
    ]);
  });
});

describe('isRecommended / buildFinalConclusion', () => {
  it('salbiy xulosa bo\'lmasa — tavsiya etiladi', () => {
    expect(isRecommended([{ type: 'positive' }, { type: 'neutral' }])).toBe(true);
  });

  it('bitta salbiy ham tavsiyani bekor qiladi', () => {
    expect(isRecommended([{ type: 'positive' }, { type: 'negative' }])).toBe(false);
  });

  it('"Xulosa qilib:" bilan boshlanadi va F.I.Sh ni ishlatadi', () => {
    const text = buildFinalConclusion(collectVars(work), true);
    expect(text.startsWith('Xulosa qilib:')).toBe(true);
    expect(text).toContain('Orinbayev Jumabay Tileubayevich');
    expect(text).toContain('tavsiya etiladi');
  });

  it('tavsiya etilmasa — matn ham teskari bo\'ladi', () => {
    const text = buildFinalConclusion(collectVars(work), false);
    expect(text).toContain('tavsiya etilmaydi');
  });

  it('imzo bloki — prorektor F.I.Sh bilan chiqadi', () => {
    const text = buildFinalConclusion(collectVars(work), true);
    expect(text).toContain('O‘quv ishlari bo‘yicha prorektor');
    expect(text).toContain(SIGNATURE_BLOCK.viceRector);
  });

  it('imzo bloki — ijrochi va uning telefoni chiqadi', () => {
    const text = buildFinalConclusion(collectVars(work), true);
    expect(text).toContain(`Ijrochi: ${SIGNATURE_BLOCK.executor}`);
    expect(text).toContain(SIGNATURE_BLOCK.executorPhone);
  });

  it('imzo bloki xulosa bandlaridan KEYIN turadi', () => {
    const text = buildFinalConclusion(collectVars(work), true);
    expect(text.indexOf('2. Tadqiqotchi')).toBeLessThan(text.indexOf('prorektor'));
    expect(text.indexOf('prorektor')).toBeLessThan(text.indexOf('Ijrochi:'));
  });

  it('tavsiya etilmagan holatda ham imzo bloki saqlanadi', () => {
    const text = buildFinalConclusion(collectVars(work), false);
    expect(text).toContain(SIGNATURE_BLOCK.viceRector);
    expect(text).toContain(SIGNATURE_BLOCK.executorPhone);
  });
});
