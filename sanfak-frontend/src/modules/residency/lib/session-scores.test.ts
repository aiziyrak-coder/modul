import { describe, expect, it } from 'vitest';
import {
  applySavedScores,
  changedScores,
  draftValue,
  dropSavedEdits,
  invalidScoreIds,
  isScorable,
  isSessionGradable,
  isScoreInvalid,
  oldScaleRejectText,
  parseScoreText,
  toInputValue,
} from './session-scores';
import {
  SCORE_BLOCKED_TEXT,
  SESSION_SCORE_MAX,
  type LessonSession,
  type SessionRosterRow,
  type SessionState,
} from '../api/session-types';

const row = (
  residentId: string,
  state: SessionState,
  over: Partial<SessionRosterRow> = {},
): SessionRosterRow => ({
  id: `f-${residentId}`,
  residentId,
  fullName: residentId,
  specialtyTitle: null,
  courseNumber: null,
  groupTitle: null,
  state,
  outcomeReason: null,
  score: null,
  checkInTime: null,
  checkOutTime: null,
  scoreBlockedReason: null,
  ...over,
});

describe('isSessionGradable — bekor qilingan va `amaliy` (TZ 4.5.6, F1-Q3) baholanmaydi', () => {
  it('amaliy — e’lon qilingan bo‘lsa ham YO‘Q', () => {
    expect(isSessionGradable({ status: 'announced', lessonType: 'amaliy' })).toBe(false);
  });

  it.each(['maruza', 'test', 'oraliq_nazorat', 'yakuniy_nazorat', null] as const)(
    '%s + announced — ha; cancelled / noma’lum holat — yo‘q',
    (lessonType) => {
      expect(isSessionGradable({ status: 'announced', lessonType })).toBe(true);
      expect(isSessionGradable({ status: 'cancelled', lessonType })).toBe(false);
      expect(isSessionGradable({ status: null, lessonType })).toBe(false);
    },
  );
});

describe('parseScoreText / isScoreInvalid', () => {
  it('«0» — haqiqiy ball', () => {
    expect(parseScoreText('0')).toBe(0);
    expect(isScoreInvalid(0)).toBe(false);
  });

  it('vergul o‘nlik: «7,5» → 7.5; bo‘sh → null', () => {
    expect(parseScoreText('7,5')).toBe(7.5);
    expect(parseScoreText(' ')).toBeNull();
    expect(isScoreInvalid(null)).toBe(false);
  });

  it.each(['100.5', '-1', 'abc', '101'])('«%s» — yaroqsiz (0–100, LSC-Q1=A)', (raw) => {
    expect(isScoreInvalid(parseScoreText(raw))).toBe(true);
  });

  it.each(['100', '85', '72,5', '0'])('«%s» — chegara ichida', (raw) => {
    expect(isScoreInvalid(parseScoreText(raw))).toBe(false);
  });

  it('10 — chegara ichida', () => {
    expect(isScoreInvalid(parseScoreText('10'))).toBe(false);
  });

  it('SESSION_SCORE_MAX — 100 (backend `LESSON_SCORE_MAX` bilan bir xil)', () => {
    expect(SESSION_SCORE_MAX).toBe(100);
  });

  it('toInputValue — yaroqsiz/bo‘sh → null', () => {
    expect(toInputValue('abc')).toBeNull();
    expect(toInputValue('')).toBeNull();
    expect(toInputValue('8')).toBe(8);
  });
});

describe('isScorable — TZ 4.5.4 darvozasi', () => {
  it('faqat present + sababsiz + ruxsat', () => {
    expect(isScorable(row('r1', 'present'), true)).toBe(true);
    expect(isScorable(row('r1', 'present'), false)).toBe(false);
    expect(
      isScorable(row('r1', 'present', { scoreBlockedReason: 'Amaliyotga ball qo‘yilmaydi' }), true),
    ).toBe(false);
    expect(isScorable(row('r1', 'present', { residentId: null }), true)).toBe(false);
  });

  it.each(['absent', 'unmeasured', 'pending', 'excused'] as const)('%s — baholanmaydi', (state) => {
    expect(isScorable(row('r1', state), true)).toBe(false);
  });
});

describe('changedScores', () => {
  it('«0» 0 bo‘lib ketadi; o‘zgarmagan qiymat ketmaydi', () => {
    const rows = [row('r1', 'present'), row('r2', 'present', { score: 6 })];
    expect(changedScores(rows, { r1: '0', r2: '6' }, true)).toEqual([{ resident: 'r1', score: 0 }]);
  });

  it('ballangan qatorda «» → null (tozalash); ballanmaganida «» ketmaydi', () => {
    const rows = [row('r1', 'present', { score: 6 }), row('r2', 'present')];
    expect(changedScores(rows, { r1: '', r2: '' }, true)).toEqual([
      { resident: 'r1', score: null },
    ]);
  });

  it('absent/unmeasured/pending/excused qatorlari qoralama bo‘lsa ham HECH QACHON ketmaydi', () => {
    const rows = (['absent', 'unmeasured', 'pending', 'excused'] as const).map((s, i) =>
      row(`r${i}`, s),
    );
    expect(changedScores(rows, { r0: '5', r1: '5', r2: '5', r3: '5' }, true)).toEqual([]);
  });

  it('scoreBlockedReason bor qator ketmaydi', () => {
    const rows = [row('r1', 'present', { scoreBlockedReason: SCORE_BLOCKED_TEXT.rowMissing })];
    expect(changedScores(rows, { r1: '9' }, true)).toEqual([]);
  });

  it('yaroqsiz qiymat ketmaydi, lekin invalidScoreIds da ko‘rinadi', () => {
    const rows = [row('r1', 'present'), row('r2', 'present')];
    const edits = { r1: '101', r2: '8' };
    expect(changedScores(rows, edits, true)).toEqual([{ resident: 'r2', score: 8 }]);
    expect([...invalidScoreIds(rows, edits, true)]).toEqual(['r1']);
  });

  it('canGrade=false → []', () => {
    expect(changedScores([row('r1', 'present')], { r1: '8' }, false)).toEqual([]);
    expect(invalidScoreIds([row('r1', 'present')], { r1: '101' }, false).size).toBe(0);
  });

  it('draftValue — tahrir bo‘lsa u, aks holda server qiymati', () => {
    const r = row('r1', 'present', { score: 4 });
    expect(draftValue(r, {})).toBe('4');
    expect(draftValue(r, { r1: '9' })).toBe('9');
    expect(draftValue(row('r2', 'present', { score: 0 }), {})).toBe('0');
  });
});

describe('dropSavedEdits — saqlashdan keyin qoralama', () => {
  it('saqlangan qiymat bilan bir xil tahrir chiqadi («8», «8,0», «» ↔ null)', () => {
    const saved = [
      { resident: 'r1', score: 8 },
      { resident: 'r2', score: 8 },
      { resident: 'r3', score: null },
    ];
    expect(dropSavedEdits({ r1: '8', r2: '8,0', r3: '' }, saved)).toEqual({});
  });

  it('🔴 saqlash DAVOMIDA yozilgan yangi qiymat (8 ketdi, 9 yozildi) QOLADI', () => {
    expect(dropSavedEdits({ r1: '9' }, [{ resident: 'r1', score: 8 }])).toEqual({ r1: '9' });
    expect(dropSavedEdits({ r1: '' }, [{ resident: 'r1', score: 8 }])).toEqual({ r1: '' });
    expect(dropSavedEdits({ r1: '101' }, [{ resident: 'r1', score: 8 }])).toEqual({ r1: '101' });
  });

  it('saqlanmagan (rad etilgan / yuborilmagan) qatorlar tegilmaydi', () => {
    expect(dropSavedEdits({ r1: '8', r2: '5' }, [{ resident: 'r1', score: 8 }])).toEqual({
      r2: '5',
    });
  });
});

describe('applySavedScores — server tasdiqlagan ball keshga (F1-Q9)', () => {
  const session = { id: 's1' } as LessonSession;
  const detail = {
    session,
    roster: [
      row('r1', 'present'),
      row('r2', 'present', { score: 4 }),
      row('r3', 'present', { score: 6 }),
      { ...row('x', 'present', { score: 2 }), residentId: null },
    ],
  };

  it('faqat saqlangan qatorlar yangilanadi (tozalash — null); qolgani va residentId=null tegilmaydi', () => {
    const out = applySavedScores(detail, [
      { resident: 'r1', score: 8 },
      { resident: 'r3', score: null },
    ]);
    expect(out.roster.map((r) => r.score)).toEqual([8, 4, null, 2]);
    expect(out.session).toBe(session);
    expect(out.roster[1]).toBe(detail.roster[1]);
    expect(detail.roster.map((r) => r.score)).toEqual([null, 4, 6, 2]);
  });

  it('saqlangan qator yo‘q — o‘sha obyekt qaytadi', () => {
    expect(applySavedScores(detail, [])).toBe(detail);
  });
});

describe('oldScaleRejectText — eski backend 10 dan katta ballni rad etdi', () => {
  const JOI_MAX_10 = '"score" must be less than or equal to 10';

  it('🔴 400 + Joi `max(10)` → o‘zbekcha sabab, xom inglizcha matn EMAS', () => {
    const text = oldScaleRejectText(400, JOI_MAX_10);
    expect(text).toBe(
      'Server hali eski 0–10 shkalasida — ball saqlanmadi, administratorga xabar bering',
    );
    expect(text).not.toMatch(/must be/);
  });

  it('boshqa status yoki boshqa 400 matni — moslik yo‘q (server matni qoladi)', () => {
    expect(oldScaleRejectText(409, JOI_MAX_10)).toBeNull();
    expect(oldScaleRejectText(null, JOI_MAX_10)).toBeNull();
    expect(oldScaleRejectText(400, '"score" must be a number')).toBeNull();
    expect(oldScaleRejectText(400, 'Ballni saqlab bo‘lmadi')).toBeNull();
  });

  it('server chegarasi FE chegarasidan kichik EMAS (yangi backend, 100) — moslik yo‘q', () => {
    expect(oldScaleRejectText(400, '"score" must be less than or equal to 100')).toBeNull();
    expect(oldScaleRejectText(400, '"score" must be less than or equal to 99.5')).toMatch(
      /0–99\.5 shkalasida/,
    );
  });
});
