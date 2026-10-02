import { describe, expect, it } from 'vitest';
import { mapAchievement } from './mapper';

const achievement = {
  _id: 'ACH-1',
  title: 'Maqola',
  status: 'pending',
};

describe('mapAchievement — reviewHistory', () => {
  it('🔴 tarix ko\u2018chadi — qayta yuborilgandan keyin ham sabab o\u2018qiladi', () => {
    const a = mapAchievement({
      ...achievement,
      reviewHistory: [
        {
          status: 'rejected',
          note: 'Hujjat sifati past',
          reviewedAt: '2026-09-01T10:00:00.000Z',
          supersededAt: '2026-09-02T08:00:00.000Z',
        },
      ],
    });

    expect(a.reviewHistory).toHaveLength(1);
    expect(a.reviewHistory[0]).toEqual({
      status: 'rejected',
      note: 'Hujjat sifati past',
      reviewedAt: '2026-09-01T10:00:00.000Z',
      supersededAt: '2026-09-02T08:00:00.000Z',
    });
  });

  it('bir necha rad etish — HAMMASI saqlanadi (massiv, skalyar emas)', () => {
    const a = mapAchievement({
      ...achievement,
      reviewHistory: [
        { status: 'rejected', note: 'birinchi' },
        { status: 'rejected', note: 'ikkinchi' },
      ],
    });
    expect(a.reviewHistory.map((h) => h.note)).toEqual(['birinchi', 'ikkinchi']);
  });

  it('maydon YO\u2018Q (eski javob) — bo\u2018sh massiv, `undefined` emas', () => {
    expect(mapAchievement(achievement).reviewHistory).toEqual([]);
  });

  it('bo\u2018sh izohli qaror — `note` bo\u2018sh satr', () => {
    const a = mapAchievement({ ...achievement, reviewHistory: [{ status: 'approved', note: null }] });
    expect(a.reviewHistory[0]).toMatchObject({ status: 'approved', note: '' });
  });
});
