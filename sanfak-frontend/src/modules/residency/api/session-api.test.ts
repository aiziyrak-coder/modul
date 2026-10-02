import { createElement, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  asSessionState,
  fetchLessonSessions,
  mapAnnounceResult,
  mapLessonSession,
  mapLessonSessionDetail,
  mapRosterRow,
  saveSessionScores,
  SESSION_KEY,
  sessionErrorInfo,
  toAnnouncePayload,
  toListQuery,
  useAnnounceSession,
  useCancelSession,
  useSaveSessionScores,
  type BackendSession,
} from './session-api';
import type { LessonSessionDetail } from './session-types';
import { ATT_KEY } from './residency-api';
import { SCORE_BLOCKED_TEXT } from './session-types';

const h = vi.hoisted(() => ({
  fetchPaginated: vi.fn(),
  fetchOne: vi.fn(),
  postJson: vi.fn(),
  putJson: vi.fn(),
}));

vi.mock('@/shared/api', () => ({
  apiClient: { get: vi.fn() },
  fetchPaginated: h.fetchPaginated,
  fetchOne: h.fetchOne,
  postJson: h.postJson,
  putJson: h.putJson,
  fetchList: vi.fn(),
  patchJson: vi.fn(),
  deleteData: vi.fn(),
  uploadMultipart: vi.fn(),
}));

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

const session = (over: Partial<BackendSession> = {}): BackendSession => ({
  _id: 's1',
  day: '2026-09-27',
  group: { _id: 'g1', title: 'ORD-101' },
  groupTitle: 'ORD-101 (eski)',
  science: { _id: 'sc1', title: 'Kardiologiya' },
  scienceTitle: 'Kardiologiya (eski)',
  lessonType: 'amaliy',
  hours: 2,
  announcedBy: { _id: 'u1', lastName: 'Sobirov', firstName: 'Jasur', middleName: 'Nodirovich' },
  rosterScope: 'supervised',
  status: 'announced',
  framedCount: 12,
  canCancel: true,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  createdAt: '2026-09-27T04:00:00.000Z',
  ...over,
});

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
  return { qc, invalidate, wrapper };
}

const invalidatedKeys = (spy: ReturnType<typeof setup>['invalidate']) =>
  spy.mock.calls.map((c) => (c[0] as { queryKey: unknown[] }).queryKey);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('asSessionState — D-MODE 1 qulfi', () => {
  it.each(['unmeasured', 'present', 'absent', 'pending', 'excused'])('%s o‘zgarishsiz', (s) => {
    expect(asSessionState(s)).toBe(s);
  });

  it.each(['weird', undefined, null, '', 'ABSENT', 7])(
    'noma’lum (%s) → unmeasured, hech qachon absent',
    (v) => {
      expect(asSessionState(v)).toBe('unmeasured');
      expect(asSessionState(v)).not.toBe('absent');
    },
  );
});

describe('mapLessonSession — SessionDTO', () => {
  it('ISO sana → kun kaliti; jonli nom snapshotdan ustun; announcedBy → teacher', () => {
    const s = mapLessonSession(session({ day: '2026-09-27T00:00:00.000Z' }));
    expect(s).toMatchObject({
      id: 's1',
      day: '2026-09-27',
      scienceId: 'sc1',
      scienceTitle: 'Kardiologiya',
      groupId: 'g1',
      groupTitle: 'ORD-101',
      lessonType: 'amaliy',
      hours: 2,
      teacherId: 'u1',
      teacherName: 'Sobirov Jasur Nodirovich',
      rosterScope: 'supervised',
      status: 'announced',
      rosterCount: 12,
      canCancel: true,
    });
  });

  it('faqat id (populate yo‘q) — id saqlanadi, nom snapshotdan', () => {
    const s = mapLessonSession(
      session({
        group: 'g2',
        science: 'sc2',
        announcedBy: 'u2',
        groupTitle: 'G',
        scienceTitle: 'F',
      }),
    );
    expect(s).toMatchObject({
      groupId: 'g2',
      groupTitle: 'G',
      scienceId: 'sc2',
      scienceTitle: 'F',
      teacherId: 'u2',
      teacherName: null,
    });
  });

  it('yo‘q maydonlar — xavfsiz standartlar', () => {
    const s = mapLessonSession({ _id: 'x' });
    expect(s).toMatchObject({
      day: '',
      scienceId: null,
      groupId: null,
      teacherName: null,
      lessonType: null,
      hours: null,
      status: null,
      rosterCount: 0,
      canCancel: false,
    });
  });

  it('noma’lum dars turi → null; framedCount NaN/manfiy → 0; canCancel faqat `true`', () => {
    const s = mapLessonSession(
      session({ lessonType: 'seminar', framedCount: Number.NaN, canCancel: null }),
    );
    expect(s.lessonType).toBeNull();
    expect(s.rosterCount).toBe(0);
    expect(s.canCancel).toBe(false);
    expect(mapLessonSession(session({ framedCount: -3 })).rosterCount).toBe(0);
  });

  it('bekor qilingan sessiya — sabab va kim bekor qilgani', () => {
    const s = mapLessonSession(
      session({
        status: 'cancelled',
        cancelledAt: '2026-09-27T06:00:00.000Z',
        cancelledBy: { _id: 'u9', lastName: 'Karimova', firstName: 'Dilnoza' },
        cancelReason: 'Xato guruh',
      }),
    );
    expect(s).toMatchObject({
      status: 'cancelled',
      cancelledByName: 'Karimova Dilnoza',
      cancelReason: 'Xato guruh',
    });
  });
});

describe('mapRosterRow — RosterDTO + holat maydonlari', () => {
  it('to‘liq qator', () => {
    const r = mapRosterRow({
      _id: 'f1',
      resident: {
        _id: 'r1',
        fullName: 'Aliyev Vali',
        specialtyTitle: 'Kardiologiya',
        courseNumber: 2,
        groupTitle: 'ORD-101',
      },
      state: 'present',
      score: 7.5,
      checkInTime: '08:52',
      checkOutTime: '14:10',
      scoreBlockedReason: null,
    });
    expect(r).toEqual({
      id: 'f1',
      residentId: 'r1',
      fullName: 'Aliyev Vali',
      specialtyTitle: 'Kardiologiya',
      courseNumber: 2,
      groupTitle: 'ORD-101',
      state: 'present',
      outcomeReason: null,
      score: 7.5,
      checkInTime: '08:52',
      checkOutTime: '14:10',
      scoreBlockedReason: null,
    });
  });

  it('rezident faqat id — fullName null, residentId bor; scoreBlockedReason standart null', () => {
    const r = mapRosterRow({ _id: 'f2', resident: 'r2', state: 'pending' });
    expect(r.residentId).toBe('r2');
    expect(r.fullName).toBeNull();
    expect(r.scoreBlockedReason).toBeNull();
    expect(r.score).toBeNull();
  });

  it('L2 (eski format) qatori: holat yo‘q → unmeasured; vaqt shakli buzuq → null', () => {
    const r = mapRosterRow({ _id: 'f3', resident: null, checkInTime: '8:5', checkOutTime: '' });
    expect(r).toMatchObject({
      residentId: null,
      state: 'unmeasured',
      checkInTime: null,
      checkOutTime: null,
    });
  });

  it('`0` — haqiqiy ball', () => {
    expect(mapRosterRow({ _id: 'f4', resident: 'r4', state: 'present', score: 0 }).score).toBe(0);
  });
});

describe('scoreBlockedReason — MASHINA kodi → o‘zbekcha matn', () => {
  const blocked = (v: unknown) =>
    mapRosterRow({ _id: 'f', resident: 'r', state: 'present', scoreBlockedReason: v as string })
      .scoreBlockedReason;

  it('not_confirmed / row_missing / lesson_type_not_graded — o‘zbekcha matn, xom kod EMAS', () => {
    expect(blocked('not_confirmed')).toBe(SCORE_BLOCKED_TEXT.notConfirmed);
    expect(blocked('row_missing')).toBe(SCORE_BLOCKED_TEXT.rowMissing);
    expect(blocked('lesson_type_not_graded')).toBe(SCORE_BLOCKED_TEXT.lessonTypeNotGraded);
  });

  it('egasi matni (TZ 4.5.6, 2026-09-28) — so‘zma-so‘z', () => {
    expect(SCORE_BLOCKED_TEXT.lessonTypeNotGraded).toBe(
      'Amaliy mashg‘ulotga har dars uchun ball qo‘yilmaydi — oraliq nazorat orqali baholanadi',
    );
  });

  it('noma’lum kod — umumiy matn (baribir bloklangan, xom kod ko‘rinmaydi)', () => {
    for (const v of ['lesson_type_graded', 'toString', 'constructor', '', 7, true]) {
      expect(blocked(v)).toBe(SCORE_BLOCKED_TEXT.other);
    }
  });

  it('null/yo‘q — `null` (baholash mumkin; darvoza shu nullikka tayanadi)', () => {
    expect(blocked(null)).toBeNull();
    expect(blocked(undefined)).toBeNull();
  });
});

describe('mapLessonSessionDetail — `amaliy` baholanmaydi (TZ 4.5.6, F1-Q3)', () => {
  const roster = [
    { _id: 'f1', resident: 'r1', state: 'present', scoreBlockedReason: null },
    { _id: 'f2', resident: 'r2', state: 'present', scoreBlockedReason: 'row_missing' },
    { _id: 'f3', resident: 'r3', state: 'pending', scoreBlockedReason: 'not_confirmed' },
  ];
  const reasons = (lessonType: string | null) =>
    mapLessonSessionDetail({ session: session({ lessonType }), roster }).roster.map(
      (r) => r.scoreBlockedReason,
    );

  it('🔴 amaliy — HAR qator bloklangan, server kodi yo‘q/boshqa bo‘lsa ham (ustun)', () => {
    expect(reasons('amaliy')).toEqual([
      SCORE_BLOCKED_TEXT.lessonTypeNotGraded,
      SCORE_BLOCKED_TEXT.lessonTypeNotGraded,
      SCORE_BLOCKED_TEXT.lessonTypeNotGraded,
    ]);
  });

  it.each(['maruza', 'test', 'oraliq_nazorat', 'yakuniy_nazorat', null])(
    '%s — server kodi o‘zgarishsiz (null qator baholanadi)',
    (lessonType) => {
      expect(reasons(lessonType)).toEqual([
        null,
        SCORE_BLOCKED_TEXT.rowMissing,
        SCORE_BLOCKED_TEXT.notConfirmed,
      ]);
    },
  );
});

describe('mapAnnounceResult — `{session, framed, conflicts}`', () => {
  it('framed → rosterCount, conflicts → skipped', () => {
    const r = mapAnnounceResult({
      message: 'ok',
      session: session({ _id: 'new1' }),
      framed: 9,
      conflicts: [
        { resident: 'r1', session: 'old1' },
        { resident: null, session: 'old2' },
      ],
    });
    expect(r).toEqual({
      id: 'new1',
      rosterCount: 9,
      skipped: [{ residentId: 'r1', sessionId: 'old1' }],
    });
  });

  it('`session._id` yo‘q → id null; conflicts yo‘q → []', () => {
    expect(mapAnnounceResult({})).toEqual({ id: null, rosterCount: 0, skipped: [] });
  });
});

describe('toAnnouncePayload / toListQuery', () => {
  it('🔴 tana kalitlari aynan 5 ta (status/score/manualVerified/date yo‘q)', () => {
    const stale = {
      day: '2026-09-27',
      science: 'sc1',
      lessonType: 'amaliy' as const,
      group: 'g1',
      hours: 2,
      status: 'present',
      score: 9,
      manualVerified: true,
      date: '2026-09-27',
    };
    const payload = toAnnouncePayload(stale);
    expect(Object.keys(payload).sort()).toEqual(['day', 'group', 'hours', 'lessonType', 'science']);
    expect(payload).toEqual({
      day: '2026-09-27',
      science: 'sc1',
      lessonType: 'amaliy',
      group: 'g1',
      hours: 2,
    });
  });

  it('kun filtri from=to; bo‘sh filtr ketmaydi', () => {
    expect(toListQuery({ page: 1, limit: 10 })).toEqual({ page: 1, limit: 10 });
    expect(
      toListQuery({
        page: 2,
        limit: 10,
        day: '2026-09-27',
        science: 'sc1',
        lessonType: 'amaliy',
        group: '',
        status: 'announced',
      }),
    ).toEqual({
      page: 2,
      limit: 10,
      from: '2026-09-27',
      to: '2026-09-27',
      science: 'sc1',
      lessonType: 'amaliy',
      status: 'announced',
    });
  });

  it('fetchLessonSessions — /residency-sessions/paginate va Paged shakli', async () => {
    h.fetchPaginated.mockResolvedValue({
      docs: [session()],
      totalDocs: 21,
      page: 3,
      totalPages: 3,
    });
    const res = await fetchLessonSessions({ page: 3, limit: 10, day: '2026-09-01' });
    expect(h.fetchPaginated).toHaveBeenCalledWith('/residency-sessions/paginate', {
      page: 3,
      limit: 10,
      from: '2026-09-01',
      to: '2026-09-01',
    });
    expect(res).toEqual({
      items: [mapLessonSession(session())],
      total: 21,
      page: 3,
      totalPages: 3,
    });
  });
});

describe('sessionErrorInfo', () => {
  it('reason + meta (day_not_announceable {from,to})', () => {
    const e = httpError(400, {
      status: 'error',
      statusCode: 400,
      message: 'Mashg‘ulot sanasi 2026-09-27 — 2027-08-31 oralig‘ida bo‘lishi kerak',
      detail: 'day_not_announceable',
      reason: 'day_not_announceable',
      from: '2026-09-27',
      to: '2027-08-31',
    });
    expect(sessionErrorInfo(e, 'x')).toEqual({
      status: 400,
      reason: 'day_not_announceable',
      message: 'Mashg‘ulot sanasi 2026-09-27 — 2027-08-31 oralig‘ida bo‘lishi kerak',
      meta: { from: '2026-09-27', to: '2027-08-31' },
    });
  });

  it('server matni yo‘q — sabab zaxirasi `detail` (mashina kodi) dan ustun', () => {
    const e = httpError(409, { detail: 'state_changed', reason: 'state_changed' });
    expect(sessionErrorInfo(e, 'x', { state_changed: 'Holat o‘zgardi' }).message).toBe(
      'Holat o‘zgardi',
    );
    expect(sessionErrorInfo(httpError(500), 'Zaxira').message).toBe('Zaxira');
    expect(sessionErrorInfo(new Error('tarmoq'), 'Zaxira')).toMatchObject({
      status: null,
      message: 'tarmoq',
    });
  });
});

describe('saveSessionScores — ketma-ket, qator bo‘yicha xato', () => {
  it('hamma qator KETMA-KET yuboriladi (parallel emas), to‘g‘ri URL va tana', async () => {
    const order: string[] = [];
    let inFlight = 0;
    h.putJson.mockImplementation(async (url: string) => {
      inFlight += 1;
      expect(inFlight).toBe(1);
      order.push(url);
      await Promise.resolve();
      inFlight -= 1;
      return { message: 'ok', outcome: 'present', score: 8 };
    });
    const res = await saveSessionScores('s1', [
      { resident: 'r1', score: 8 },
      { resident: 'r2', score: null },
    ]);
    expect(order).toEqual([
      '/residency-sessions/s1/entries/r1/score',
      '/residency-sessions/s1/entries/r2/score',
    ]);
    expect(h.putJson.mock.calls.map((c) => c[1])).toEqual([{ score: 8 }, { score: null }]);
    expect(res).toEqual({
      saved: [
        { resident: 'r1', score: 8 },
        { resident: 'r2', score: null },
      ],
      failed: [],
      notSent: [],
    });
  });

  it('409 not_confirmed / state_changed — keyingi qator baribir yuboriladi', async () => {
    h.putJson
      .mockRejectedValueOnce(
        httpError(409, {
          reason: 'not_confirmed',
          message: 'Rezident SAMS orqali kelgani tasdiqlanmagan',
          outcome: 'pending',
        }),
      )
      .mockRejectedValueOnce(httpError(409, { reason: 'state_changed', detail: 'state_changed' }))
      .mockResolvedValueOnce({});
    const res = await saveSessionScores('s1', [
      { resident: 'r1', score: 5 },
      { resident: 'r2', score: 6 },
      { resident: 'r3', score: 7 },
    ]);
    expect(h.putJson).toHaveBeenCalledTimes(3);
    expect(res.saved).toEqual([{ resident: 'r3', score: 7 }]);
    expect(res.failed).toEqual([
      {
        resident: 'r1',
        reason: 'not_confirmed',
        message: 'Rezident SAMS orqali kelgani tasdiqlanmagan',
      },
      {
        resident: 'r2',
        reason: 'state_changed',
        message: 'Holat o‘zgardi — ro‘yxat yangilandi, qayta urinib ko‘ring',
      },
    ]);
    expect(res.notSent).toEqual([]);
  });

  it('sessiya darajasidagi xato (session_cancelled) — qolganlari yuborilmaydi', async () => {
    h.putJson.mockRejectedValueOnce(
      httpError(409, { reason: 'session_cancelled', message: 'Bekor qilingan' }),
    );
    const res = await saveSessionScores('s1', [
      { resident: 'r1', score: 5 },
      { resident: 'r2', score: 6 },
    ]);
    expect(h.putJson).toHaveBeenCalledTimes(1);
    expect(res.failed.map((f) => f.reason)).toEqual(['session_cancelled']);
    expect(res.notSent).toEqual(['r2']);
  });

  it.each([401, 403])(
    'sessiya darajasi — %i (reason yo‘q): birinchi PUT rad etildi, qolganlari YUBORILMAYDI',
    async (status) => {
      h.putJson.mockRejectedValueOnce(httpError(status, { message: 'Ruxsat yo‘q' }));
      const res = await saveSessionScores('s1', [
        { resident: 'r1', score: 5 },
        { resident: 'r2', score: 6 },
        { resident: 'r3', score: 7 },
      ]);
      expect(h.putJson).toHaveBeenCalledTimes(1);
      expect(res.saved).toEqual([]);
      expect(res.failed).toEqual([{ resident: 'r1', reason: null, message: 'Ruxsat yo‘q' }]);
      expect(res.notSent).toEqual(['r2', 'r3']);
    },
  );

  it('🔴 409 lesson_type_not_graded — sessiya darajasi: to‘xtaydi, EGASI matni (server matni emas)', async () => {
    h.putJson.mockRejectedValueOnce(
      httpError(409, {
        reason: 'lesson_type_not_graded',
        message: "Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi",
      }),
    );
    const res = await saveSessionScores('s1', [
      { resident: 'r1', score: 5 },
      { resident: 'r2', score: 6 },
      { resident: 'r3', score: null },
    ]);
    expect(h.putJson).toHaveBeenCalledTimes(1);
    expect(res.saved).toEqual([]);
    expect(res.failed).toEqual([
      {
        resident: 'r1',
        reason: 'lesson_type_not_graded',
        message: SCORE_BLOCKED_TEXT.lessonTypeNotGraded,
      },
    ]);
    expect(res.notSent).toEqual(['r2', 'r3']);
  });

  it('boshqa sabab — server matni saqlanadi (qotirilgan matn faqat lesson_type_not_graded da)', async () => {
    h.putJson.mockRejectedValueOnce(
      httpError(409, { reason: 'session_cancelled', message: 'Server matni' }),
    );
    const res = await saveSessionScores('s1', [{ resident: 'r1', score: 5 }]);
    expect(res.failed[0]?.message).toBe('Server matni');
  });

  it('403 o‘rtada — oldingisi saqlangan, keyingisi yuborilmaydi', async () => {
    h.putJson.mockResolvedValueOnce({}).mockRejectedValueOnce(httpError(403));
    const res = await saveSessionScores('s1', [
      { resident: 'r1', score: 5 },
      { resident: 'r2', score: 6 },
      { resident: 'r3', score: 7 },
    ]);
    expect(h.putJson).toHaveBeenCalledTimes(2);
    expect(res.saved).toEqual([{ resident: 'r1', score: 5 }]);
    expect(res.failed.map((f) => f.resident)).toEqual(['r2']);
    expect(res.notSent).toEqual(['r3']);
  });
});

describe('mutatsiyalar keshni yangilaydi', () => {
  it('e’lon — `day` tanasi, natija moslangan, SESSION_KEY + ATT_KEY', async () => {
    h.postJson.mockResolvedValue({ session: session({ _id: 'n1' }), framed: 3, conflicts: [] });
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useAnnounceSession(), { wrapper });
    const out = await result.current.mutateAsync({
      day: '2026-09-28',
      science: 'sc1',
      lessonType: 'maruza',
      group: 'g1',
      hours: 4,
    });

    expect(h.postJson).toHaveBeenCalledWith('/residency-sessions', {
      day: '2026-09-28',
      group: 'g1',
      science: 'sc1',
      lessonType: 'maruza',
      hours: 4,
    });
    expect(out).toEqual({ id: 'n1', rosterCount: 3, skipped: [] });
    await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual([[SESSION_KEY], [ATT_KEY]]));
  });

  it('bekor qilish — trim qilingan sabab; xatoda ham kesh yangilanadi', async () => {
    h.putJson.mockRejectedValue(httpError(409, { reason: 'session_day_closed' }));
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useCancelSession(), { wrapper });
    await expect(
      result.current.mutateAsync({ id: 's1', reason: '  Xato guruh  ' }),
    ).rejects.toBeInstanceOf(AxiosError);
    expect(h.putJson).toHaveBeenCalledWith('/residency-sessions/s1/cancel', {
      reason: 'Xato guruh',
    });
    await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual([[SESSION_KEY], [ATT_KEY]]));
  });

  it('ball saqlash — natija qaytadi va kesh yangilanadi', async () => {
    h.putJson.mockResolvedValue({});
    const { invalidate, wrapper } = setup();
    const { result } = renderHook(() => useSaveSessionScores(), { wrapper });
    const out = await result.current.mutateAsync({
      sessionId: 's1',
      scores: [{ resident: 'r1', score: 9 }],
    });
    expect(out.saved).toHaveLength(1);
    await waitFor(() => expect(invalidatedKeys(invalidate)).toEqual([[SESSION_KEY], [ATT_KEY]]));
  });

  it('ball saqlash — server tasdiqlagan qiymat keshga `mutateAsync` qaytishidan OLDIN yoziladi', async () => {
    h.putJson
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(httpError(409, { reason: 'not_confirmed' }))
      .mockResolvedValueOnce({});
    const { qc, wrapper } = setup();
    const key = (id: string) => [SESSION_KEY, 'detail', id];
    const detail = (id: string) =>
      mapLessonSessionDetail({
        session: session({ _id: id, lessonType: 'maruza' }),
        roster: [
          { _id: 'f1', resident: { _id: 'r1' }, state: 'present', score: null },
          { _id: 'f2', resident: { _id: 'r2' }, state: 'present', score: 4 },
          { _id: 'f3', resident: { _id: 'r3' }, state: 'present', score: 6 },
          { _id: 'f4', resident: { _id: 'r4' }, state: 'present', score: 1 },
        ],
      });
    qc.setQueryData(key('s1'), detail('s1'));
    qc.setQueryData(key('s2'), detail('s2'));
    const { result } = renderHook(() => useSaveSessionScores(), { wrapper });

    await result.current.mutateAsync({
      sessionId: 's1',
      scores: [
        { resident: 'r1', score: 8 },
        { resident: 'r2', score: 5 },
        { resident: 'r3', score: null },
      ],
    });

    const scores = (id: string) =>
      qc.getQueryData<LessonSessionDetail>(key(id))?.roster.map((r) => [r.residentId, r.score]);
    expect(scores('s1')).toEqual([
      ['r1', 8],
      ['r2', 4],
      ['r3', null],
      ['r4', 1],
    ]);
    expect(scores('s2')).toEqual([
      ['r1', null],
      ['r2', 4],
      ['r3', 6],
      ['r4', 1],
    ]);
    await result.current.mutateAsync({ sessionId: 's9', scores: [{ resident: 'r1', score: 2 }] });
    expect(qc.getQueryData(key('s9'))).toBeUndefined();
  });
});
