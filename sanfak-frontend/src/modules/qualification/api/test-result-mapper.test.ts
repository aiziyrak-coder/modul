import { describe, it, expect } from 'vitest';
import { mapTestResult, mapTestResultDetail } from './test-result-mapper';

describe('mapTestResult', () => {
  it('kirish: score ni totalCorrects/totalQuestions dan hisoblaydi', () => {
    const r = mapTestResult({
      _id: 't1',
      listener: { fullName: 'Ali Valiyev' },
      course: { title: 'Kardiologiya', form: 1 },
      totalQuestions: 20,
      totalCorrects: 15,
    });
    expect(r.score).toBe(75);
    expect(r.correctCount).toBe(15);
    expect(r.totalCount).toBe(20);
    expect(r.passed).toBeUndefined();
    expect(r.listenerName).toBe('Ali Valiyev');
    expect(r.form).toBe(1);
  });

  it('chiqish: percentage + isPassed ni ishlatadi', () => {
    const r = mapTestResult({
      _id: 't2',
      listener: { fullName: 'X' },
      course: { title: 'K', form: 2 },
      totalQuestions: 10,
      totalCorrects: 6,
      percentage: 60,
      isPassed: true,
    });
    expect(r.score).toBe(60);
    expect(r.passed).toBe(true);
  });

  it('detail: savollarni map qiladi', () => {
    const r = mapTestResultDetail({
      _id: 't3',
      questions: [
        {
          question: '2+2?',
          isSelectedCorrect: true,
          options: [
            { text: '4', isCorrect: true, isSelected: true },
            { text: '5', isCorrect: false, isSelected: false },
          ],
        },
      ],
    });
    const q0 = r.questions[0];
    expect(r.questions).toHaveLength(1);
    expect(q0?.isCorrect).toBe(true);
    expect(q0?.options[0]).toEqual({ text: '4', isCorrect: true, isSelected: true });
  });

  it('hujjat holati map qilinadi (kutilmoqda)', () => {
    const r = mapTestResult({
      _id: 't4',
      isPassed: true,
      earnedDocument: { kind: 1, status: 1, file: null },
    });
    expect(r.document).toEqual({ kind: 1, status: 1, fileUrl: '', rejectReason: '' });
  });

  it('rad etilgan hujjatda sabab saqlanadi', () => {
    const r = mapTestResult({
      _id: 't5',
      isPassed: true,
      earnedDocument: { kind: 1, status: 3, file: null, rejectReason: 'Ism xato' },
    });
    expect(r.document?.status).toBe(3);
    expect(r.document?.rejectReason).toBe('Ism xato');
  });

  it('ESKI hujjat (`status` maydonisiz) TASDIQLANGAN deb olinadi', () => {
    const r = mapTestResult({
      _id: 't6',
      isPassed: true,
      earnedDocument: { kind: 2, file: 'http://x.uz/a.pdf' },
    });
    expect(r.document).toEqual({
      kind: 2,
      status: 2,
      fileUrl: 'http://x.uz/a.pdf',
      rejectReason: '',
    });
  });

  it('hujjat yo‘q bo‘lsa maydon ham yo‘q', () => {
    expect(mapTestResult({ _id: 't7' }).document).toBeUndefined();
  });
});
