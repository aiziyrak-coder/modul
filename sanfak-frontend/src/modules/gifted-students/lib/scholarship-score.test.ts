import { describe, it, expect } from 'vitest';
import {
  REVIEW_PASSED,
  scholarshipColumnKeys,
  judgeTotal,
  averageJudgeTotal,
  isScholarshipWinner,
} from './scholarship-score';
import type { Scholarship, ScholarshipApplication } from '../data/types';

const J1 = 'judge-1';
const J2 = 'judge-2';

const rektor = (over: Partial<Scholarship> = {}): Scholarship => ({
  id: 'sch-r',
  name: 'Rektor stipendiyasi — Tibbiyot',
  description: '',
  type: 'rektor',
  minScore: 40,
  amount: '',
  deadline: '',
  active: true,
  judges: [J1, J2],
  criteria: [{ criteriaId: 'c1' }, { criteriaId: 'c2', categoryIds: ['k1', 'k2'] }],
  ...over,
});

const nomdor = (over: Partial<Scholarship> = {}): Scholarship => ({
  ...rektor(),
  id: 'sch-n',
  name: 'Nomdor stipendiya',
  type: 'nomdor',
  ...over,
});

const app = (over: Partial<ScholarshipApplication> = {}): ScholarshipApplication => ({
  id: 'app-1',
  studentId: 'st-1',
  scholarshipId: 'sch-r',
  scholarshipName: '',
  status: REVIEW_PASSED,
  appliedAt: '',
  reviewedAt: null,
  academicYear: '2025/2026',
  note: '',
  ...over,
});

const scores = (c1: number, k1: number, k2: number) => ({ c1, c2_k1: k1, c2_k2: k2 });

describe('scholarshipColumnKeys', () => {
  it('kategoriyali mezon `${criteriaId}_${categoryId}` ga yoyiladi', () => {
    expect(scholarshipColumnKeys(rektor())).toEqual(['c1', 'c2_k1', 'c2_k2']);
  });

  it('mezonsiz stipendiyada bo‘sh', () => {
    expect(scholarshipColumnKeys(rektor({ criteria: [] }))).toEqual([]);
    expect(scholarshipColumnKeys(undefined)).toEqual([]);
  });
});

describe('judgeTotal', () => {
  const keys = scholarshipColumnKeys(rektor());

  it('faqat stipendiyaning ustunlari qo‘shiladi', () => {
    expect(judgeTotal(scores(20, 15, 13), keys)).toBe(48);
  });

  it('to‘ldirilmagan katak 0 sanaladi', () => {
    expect(judgeTotal({ c1: 20 }, keys)).toBe(20);
  });

  it('stipendiyaga tegishli bo‘lmagan kalit hisobga kirmaydi', () => {
    expect(judgeTotal({ ...scores(20, 15, 13), begona: 100 }, keys)).toBe(48);
  });

  it('umuman baholamagan hakam — null (0 ball EMAS)', () => {
    expect(judgeTotal(undefined, keys)).toBeNull();
  });
});

describe('averageJudgeTotal', () => {
  const sch = rektor();
  const keys = scholarshipColumnKeys(sch);

  it('ikki hakamning o‘rtachasi', () => {
    const a = app({ judgeScores: { [J1]: scores(20, 15, 13), [J2]: scores(12, 10, 10) } });
    expect(averageJudgeTotal(a, sch.judges!, keys)).toBe(40);
  });

  it('baholamagan hakam o‘rtachani PASAYTIRMAYDI', () => {
    const a = app({ judgeScores: { [J1]: scores(20, 15, 13) } });
    expect(averageJudgeTotal(a, sch.judges!, keys)).toBe(48);
  });

  it('biriktirilmagan hakamning bali hisobga kirmaydi', () => {
    const a = app({ judgeScores: { [J1]: scores(20, 15, 13), begona: scores(0, 0, 0) } });
    expect(averageJudgeTotal(a, sch.judges!, keys)).toBe(48);
  });

  it('hech kim baholamagan — null', () => {
    expect(averageJudgeTotal(app(), sch.judges!, keys)).toBeNull();
    expect(averageJudgeTotal(app({ judgeScores: {} }), sch.judges!, keys)).toBeNull();
  });
});

describe('isScholarshipWinner — D-72 ning o‘zi', () => {
  it('o‘tish balidan o‘tgan talaba — g‘olib', () => {
    const a = app({ judgeScores: { [J1]: scores(20, 15, 13), [J2]: scores(12, 10, 10) } });
    expect(isScholarshipWinner(a, rektor())).toBe(true);
  });

  it('🔴 «Tavsiya etilmagan» talaba g‘olib DEYILMAYDI', () => {
    const a = app({ judgeScores: { [J1]: scores(5, 5, 5), [J2]: scores(5, 5, 5) } });
    expect(isScholarshipWinner(a, rektor())).toBe(false);
  });

  it('chegara — aynan o‘tish bali g‘olib sanaladi', () => {
    const a = app({ judgeScores: { [J1]: scores(40, 0, 0), [J2]: scores(40, 0, 0) } });
    expect(isScholarshipWinner(a, rektor())).toBe(true);
  });

  it('hali baholanmagan ariza g‘olib emas', () => {
    expect(isScholarshipWinner(app(), rektor())).toBe(false);
  });

  it('ko‘rikdan o‘tmagan ariza — ball yetsa ham g‘olib emas', () => {
    const scored = { [J1]: scores(50, 0, 0), [J2]: scores(50, 0, 0) };
    expect(isScholarshipWinner(app({ status: 'pending', judgeScores: scored }), rektor())).toBe(false);
    expect(isScholarshipWinner(app({ status: 'rejected', judgeScores: scored }), rektor())).toBe(false);
  });

  it('nomdor stipendiyada tasdiq YAKUNIY — hakam bali talab qilinmaydi', () => {
    expect(isScholarshipWinner(app(), nomdor())).toBe(true);
  });

  it('turi noma‘lum stipendiya nomdor kabi ishlaydi (ortga moslik)', () => {
    expect(isScholarshipWinner(app(), undefined)).toBe(true);
  });

  it('`approved` — O‘LIK token: mapper uni hech qachon qoldirmaydi', () => {
    expect(isScholarshipWinner(app({ status: 'approved' }), nomdor())).toBe(false);
  });
});
