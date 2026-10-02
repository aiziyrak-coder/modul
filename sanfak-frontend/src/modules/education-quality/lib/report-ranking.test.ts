import { describe, it, expect } from 'vitest';
import { compareUnits, type RankableUnit } from './report-ranking';

const unit = (o: Partial<RankableUnit>): RankableUnit => ({
  teacherCount: 5,
  totalScore: 150,
  avgScore: 30,
  redCount: 0,
  redShare: 0,
  ...o,
});

const rank = (list: RankableUnit[]) => [...list].sort(compareUnits);

describe('report-ranking — compareUnits', () => {
  it('qizil ulush KAM bo\'lgan yuqorida (o\'rtacha ball past bo\'lsa ham)', () => {
    const yaxshi = unit({ redShare: 10, avgScore: 26 });
    const yomon = unit({ redShare: 60, avgScore: 80 });
    expect(rank([yomon, yaxshi])[0]).toBe(yaxshi);
  });

  it("qizil ulush TENG — o'rtacha ball kattasi yuqorida", () => {
    const past = unit({ redShare: 20, avgScore: 30 });
    const baland = unit({ redShare: 20, avgScore: 45 });
    expect(rank([past, baland])[0]).toBe(baland);
  });

  it("qizil ulush ham, ball ham teng — o'qituvchilar soni ko'pi yuqorida", () => {
    const kichik = unit({ redShare: 20, avgScore: 30, teacherCount: 3 });
    const katta = unit({ redShare: 20, avgScore: 30, teacherCount: 9 });
    expect(rank([kichik, katta])[0]).toBe(katta);
  });

  it("eng ko'p qizil ulushli birlik ENG PASTDA", () => {
    const a = unit({ redShare: 0 });
    const b = unit({ redShare: 35 });
    const c = unit({ redShare: 70 });
    expect(rank([b, c, a])).toEqual([a, b, c]);
  });

  it("hisobga olinadigan o'qituvchisi YO'Q birlik oxirga tushadi (0% qizil yutuq emas)", () => {
    const bosh = unit({ teacherCount: 0, totalScore: 0, avgScore: 0, redShare: 0 });
    const ishlagan = unit({ teacherCount: 4, redShare: 50, avgScore: 20 });
    expect(rank([bosh, ishlagan])[0]).toBe(ishlagan);
  });

  it("to'liq zanjir: qizil% → o'rtacha ball → o'qituvchilar soni", () => {
    const A = unit({ redShare: 20, avgScore: 40, teacherCount: 5 });
    const B = unit({ redShare: 20, avgScore: 32, teacherCount: 5 });
    const C = unit({ redShare: 20, avgScore: 28, teacherCount: 9 });
    const D = unit({ redShare: 20, avgScore: 28, teacherCount: 4 });
    const E = unit({ redShare: 55, avgScore: 90, teacherCount: 12 });

    expect(rank([D, E, B, C, A])).toEqual([A, B, C, D, E]);
  });

  it("ikkala birlik ham bo'sh — tartib o'zgarmaydi (barqaror)", () => {
    const a = unit({ teacherCount: 0 });
    const b = unit({ teacherCount: 0 });
    expect(compareUnits(a, b)).toBe(0);
  });
});
