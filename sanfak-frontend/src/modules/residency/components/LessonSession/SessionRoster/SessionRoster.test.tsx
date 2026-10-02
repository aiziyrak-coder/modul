import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntdApp, ConfigProvider } from 'antd';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { theme } from '../../../styles/theme';
import {
  PENDING_CLOSED_DAY_HINT,
  SCORE_BLOCKED_TEXT,
  SESSION_STATE_HINT,
  type LessonSession,
  type LessonSessionDetail,
  type SessionRosterRow,
  type SessionScoreInput,
  type SessionState,
} from '../../../api/session-types';
import type * as SessionApi from '../../../api/session-api';
import type * as SharedApi from '@/shared/api';
import type { SaveScoresResult } from '../../../api/session-api';
import {
  mapLessonSessionDetail,
  saveSessionScores,
  type BackendRosterRow,
} from '../../../api/session-api';
import { uzToday } from '../../../lib/uz-day';
import SessionRoster from './index';

interface QueryLike {
  data: LessonSessionDetail | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

const m = vi.hoisted(() => ({
  canGradeSession: true,
  query: null as unknown as QueryLike,
  save: vi.fn(),
  cancel: vi.fn(),
  putJson: vi.fn(),
}));

vi.mock('@/shared/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharedApi>()),
  putJson: (...args: unknown[]) => m.putJson(...args),
}));
vi.mock('../../../lib/capabilities', () => ({
  useResidencyCapabilities: () => ({ canGradeSession: m.canGradeSession }),
}));
vi.mock('../../../api/session-api', async (importOriginal) => ({
  ...(await importOriginal<typeof SessionApi>()),
  useLessonSession: () => m.query,
  useSaveSessionScores: () => ({ mutateAsync: m.save, isPending: false }),
  useCancelSession: () => ({ mutateAsync: m.cancel, isPending: false }),
}));

const SESSION: LessonSession = {
  id: 's1',
  day: '2026-09-27',
  scienceId: 'sc1',
  scienceTitle: 'Kardiologiya',
  lessonType: 'maruza',
  groupId: 'g1',
  groupTitle: 'ORD-101',
  hours: 2,
  teacherId: 'u1',
  teacherName: 'Sobirov Jasur',
  rosterScope: 'supervised',
  status: 'announced',
  rosterCount: 5,
  canCancel: false,
  cancelledAt: null,
  cancelledByName: null,
  cancelReason: null,
  createdAt: null,
};

const row = (
  residentId: string,
  state: SessionState,
  over: Partial<SessionRosterRow> = {},
): SessionRosterRow => ({
  id: `f-${residentId}`,
  residentId,
  fullName: `Rezident ${residentId}`,
  specialtyTitle: 'Kardiologiya',
  courseNumber: 1,
  groupTitle: 'ORD-101',
  state,
  outcomeReason: null,
  score: null,
  checkInTime: null,
  checkOutTime: null,
  scoreBlockedReason: null,
  ...over,
});

const wp5Row = (
  residentId: string,
  state: string,
  scoreBlockedReason: string | null,
  over: Partial<BackendRosterRow> = {},
): BackendRosterRow => ({
  _id: `f-${residentId}`,
  resident: { _id: residentId, fullName: `Rezident ${residentId}` },
  state,
  score: null,
  checkInTime: null,
  checkOutTime: null,
  scoreBlockedReason,
  ...over,
});

const FIVE: SessionRosterRow[] = [
  row('rP', 'present', { checkInTime: '08:52', checkOutTime: '14:10' }),
  row('rA', 'absent'),
  row('rU', 'unmeasured'),
  row('rW', 'pending'),
  row('rE', 'excused'),
];

const ok = (roster: SessionRosterRow[], session: Partial<LessonSession> = {}): QueryLike => ({
  data: { session: { ...SESSION, ...session }, roster },
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
});

const httpError = (status: number, data: Record<string, unknown> = {}) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

interface SaveArgs {
  sessionId: string;
  scores: SessionScoreInput[];
}
const realSave = ({ sessionId, scores }: SaveArgs) => saveSessionScores(sessionId, scores);

const tree = (id: string) => (
  <ConfigProvider>
    <AntdApp>
      <ThemeProvider theme={theme as unknown as DefaultTheme}>
        <SessionRoster id={id} />
      </ThemeProvider>
    </AntdApp>
  </ConfigProvider>
);

function renderRoster(id = 's1') {
  const view = render(tree(id));
  return { ...view, rerender: (next = id) => view.rerender(tree(next)) };
}

const inputs = () => screen.queryAllByRole('spinbutton');
const typeScore = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const saveBtn = () => screen.getByRole('button', { name: 'Ballarni saqlash' });
const rowOf = (residentId: string) => screen.getByTestId(`roster-row-${residentId}`);

const RENDER_TIMEOUT_MS = 30_000;

beforeEach(() => {
  m.canGradeSession = true;
  m.query = ok(FIVE);
  m.save = vi.fn();
  m.cancel = vi.fn();
  m.putJson = vi.fn();
});

describe('SessionRoster — holat va ball darvozasi', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('5 holatdan faqat `present` qatorida ball maydoni bor', () => {
    renderRoster();
    expect(inputs()).toHaveLength(1);
    expect(within(rowOf('rP')).getByRole('spinbutton')).toBeInTheDocument();
    expect(within(rowOf('rP')).getByText('08:52–14:10')).toBeInTheDocument();
  });

  it('o‘lchanmagan qator «O‘lchanmagan», «Kelmadi» EMAS (D-MODE 1)', () => {
    renderRoster();
    const r = rowOf('rU');
    expect(within(r).getByText('O‘lchanmagan')).toBeInTheDocument();
    expect(within(r).queryByText('Kelmadi')).toBeNull();
    expect(
      within(r).getByTitle('SAMS ma’lumoti yo‘q — «kelmadi» hisoblanmaydi'),
    ).toBeInTheDocument();
  });

  it('o‘tgan kun `pending` — «kun yopilgan» izohi, nishon baribir «Kutilmoqda» (Kelmadi EMAS)', () => {
    m.query = ok([row('rW', 'pending'), row('rU', 'unmeasured')], { day: '2020-01-06' });
    renderRoster();
    const r = rowOf('rW');
    expect(within(r).getByTitle(PENDING_CLOSED_DAY_HINT)).toHaveTextContent('Kutilmoqda');
    expect(within(r).queryByText('Kelmadi')).toBeNull();
    expect(within(r).queryByTitle(SESSION_STATE_HINT.pending!)).toBeNull();
    expect(within(rowOf('rU')).getByTitle(SESSION_STATE_HINT.unmeasured!)).toBeInTheDocument();
  });

  it.each([
    ['bugun', uzToday()],
    ['kelajak', '2099-01-05'],
  ])('%s `pending` — «kun hali yopilmagan» izohi qoladi', (_label, day) => {
    m.query = ok([row('rW', 'pending')], { day });
    renderRoster();
    expect(within(rowOf('rW')).getByTitle(SESSION_STATE_HINT.pending!)).toBeInTheDocument();
    expect(within(rowOf('rW')).queryByTitle(PENDING_CLOSED_DAY_HINT)).toBeNull();
  });

  it('holat kartochkalari rosterdan sanaladi', () => {
    renderRoster();
    for (const label of ['Keldi', 'Kelmadi', 'O‘lchanmagan', 'Kutilmoqda', 'Sababli']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('🔴 baho bloklash kodlari (xom DTO → mapper) — matn ko‘rinadi, xom kod HECH QACHON', () => {
    const detail = mapLessonSessionDetail({
      session: { _id: 's1', day: '2099-01-05', status: 'announced', lessonType: 'maruza' },
      roster: [
        wp5Row('r1', 'pending', 'not_confirmed'),
        wp5Row('r2', 'present', 'row_missing', { score: 6 }),
        wp5Row('r3', 'present', null),
        wp5Row('r4', 'absent', 'kelajak_kodi'),
        wp5Row('r5', 'present', 'lesson_type_not_graded'),
      ],
    });
    m.query = ok(detail.roster, detail.session);
    renderRoster();

    expect(document.body.textContent).not.toMatch(
      /not_confirmed|row_missing|lesson_type|kelajak_kodi/,
    );
    expect(within(rowOf('r1')).getByText(SCORE_BLOCKED_TEXT.notConfirmed)).toBeInTheDocument();
    expect(within(rowOf('r2')).getByText(SCORE_BLOCKED_TEXT.rowMissing)).toBeInTheDocument();
    expect(within(rowOf('r2')).getByText('6')).toBeInTheDocument();
    expect(within(rowOf('r2')).queryByRole('spinbutton')).toBeNull();
    expect(within(rowOf('r3')).getByRole('spinbutton')).toBeInTheDocument();
    expect(within(rowOf('r4')).getByText(SCORE_BLOCKED_TEXT.other)).toBeInTheDocument();
    expect(
      within(rowOf('r5')).getByText(SCORE_BLOCKED_TEXT.lessonTypeNotGraded),
    ).toBeInTheDocument();
    expect(inputs()).toHaveLength(1);
  });

  it('sabab yo‘q: present emas — zaxira matn; present — matn yo‘q', () => {
    renderRoster();
    for (const rid of ['rA', 'rU', 'rW', 'rE']) {
      expect(within(rowOf(rid)).getByText(SCORE_BLOCKED_TEXT.notConfirmed)).toBeInTheDocument();
    }
    expect(within(rowOf('rP')).queryByText(SCORE_BLOCKED_TEXT.notConfirmed)).toBeNull();
  });

  it('canGradeSession=false — maydon ham, saqlash tugmasi ham yo‘q', () => {
    m.canGradeSession = false;
    renderRoster();
    expect(inputs()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Ballarni saqlash' })).toBeNull();
  });
});

describe('SessionRoster — saqlash', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('101 — qatorda oraliq xatosi, saqlash o‘chiq (0–100, LSC-Q1=A)', () => {
    renderRoster();
    typeScore(inputs()[0]!, '101');
    expect(screen.getByText('Ball 0–100 oralig‘ida bo‘lishi kerak')).toBeInTheDocument();
    expect(screen.getByText('1 ta qatorda ball 0–100 oralig‘idan tashqarida')).toBeInTheDocument();
    expect(saveBtn()).toBeDisabled();
  });

  it('ustun sarlavhasi «Ball (0–100)», maydon nomi «… — dars bali» (LSC-Q8=A)', () => {
    renderRoster();
    expect(screen.getByRole('columnheader', { name: 'Ball (0–100)' })).toBeInTheDocument();
    expect(within(screen.getByRole('table')).queryByText(/belgi/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /belgi/i })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Rezident rP — dars bali' })).toBeInTheDocument();
  });

  it('🔴 «85» — haqiqiy saqlash: PUT tanasi {score: 85}, qator saqlanadi (LSC-Q1=A)', async () => {
    m.putJson.mockResolvedValue({});
    m.save.mockImplementation(realSave);
    renderRoster();
    typeScore(inputs()[0]!, '85');
    expect(screen.queryByText(/oralig‘ida bo‘lishi kerak/)).toBeNull();
    fireEvent.click(saveBtn());

    expect(await screen.findByText('1 ta ball saqlandi')).toBeInTheDocument();
    expect(m.putJson).toHaveBeenCalledTimes(1);
    expect(m.putJson).toHaveBeenCalledWith('/residency-sessions/s1/entries/rP/score', {
      score: 85,
    });
    expect(screen.getByText('O‘zgarish yo‘q')).toBeInTheDocument();
  });

  it('🔴 eski backend (max 10) 400 — qatorda o‘zbekcha sabab, xom Joi matni yo‘q, qoralama qoladi', async () => {
    m.putJson.mockRejectedValue(
      httpError(400, {
        statusCode: 400,
        message: '"score" must be less than or equal to 10',
        detail: '"score" must be less than or equal to 10',
      }),
    );
    m.save.mockImplementation(realSave);
    renderRoster();
    typeScore(inputs()[0]!, '85');
    fireEvent.click(saveBtn());

    const OLD_SCALE =
      'Server hali eski 0–10 shkalasida — ball saqlanmadi, administratorga xabar bering';
    await waitFor(() =>
      expect(within(rowOf('rP')).getByRole('alert')).toHaveTextContent(OLD_SCALE),
    );
    expect(await screen.findAllByText(OLD_SCALE)).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/must be less than/);
    expect(inputs()[0]).toHaveValue('85');
  });

  it('8 → faqat [{resident, score: 8}] yuboriladi', async () => {
    m.save.mockResolvedValue({ saved: [{ resident: 'rP', score: 8 }], failed: [], notSent: [] });
    renderRoster();
    expect(saveBtn()).toBeDisabled();
    typeScore(inputs()[0]!, '8');
    fireEvent.click(saveBtn());
    await waitFor(() => expect(m.save).toHaveBeenCalledTimes(1));
    expect(m.save).toHaveBeenCalledWith({
      sessionId: 's1',
      scores: [{ resident: 'rP', score: 8 }],
    });
    expect(await screen.findByText('1 ta ball saqlandi')).toBeInTheDocument();
  });

  it('saqlash davomida ball maydonlari qulflanadi (yozilgan qiymat jim yo‘qolmasin)', async () => {
    let resolve: (v: SaveScoresResult) => void = () => {};
    m.save.mockReturnValue(
      new Promise<SaveScoresResult>((r) => {
        resolve = r;
      }),
    );
    renderRoster();
    typeScore(inputs()[0]!, '8');
    fireEvent.click(saveBtn());
    await waitFor(() => expect(inputs()[0]).toBeDisabled());
    expect(saveBtn()).toBeDisabled();

    resolve({ saved: [{ resident: 'rP', score: 8 }], failed: [], notSent: [] });
    await waitFor(() => expect(inputs()[0]).toBeEnabled());
    expect(m.save).toHaveBeenCalledTimes(1);
  });

  it('«Yangilash» qoralama bor paytda o‘chiq', () => {
    renderRoster();
    const refresh = screen.getByRole('button', { name: /Yangilash/ });
    expect(refresh).toBeEnabled();
    typeScore(inputs()[0]!, '7');
    expect(refresh).toBeDisabled();
    expect(screen.getByText('1 ta o‘zgarish saqlanmagan')).toBeInTheDocument();
  });

  it('409 not_confirmed — xato o‘sha qatorda, qoralama saqlanadi', async () => {
    m.query = ok([row('r1', 'present'), row('r2', 'present')]);
    m.save.mockResolvedValue({
      saved: [{ resident: 'r2', score: 9 }],
      failed: [
        {
          resident: 'r1',
          reason: 'not_confirmed',
          message: 'SAMS orqali kelgani tasdiqlanmagan — ball qo‘yilmaydi',
        },
      ],
      notSent: [],
    });
    renderRoster();
    typeScore(within(rowOf('r1')).getByRole('spinbutton'), '5');
    typeScore(within(rowOf('r2')).getByRole('spinbutton'), '9');
    fireEvent.click(saveBtn());

    await waitFor(() =>
      expect(within(rowOf('r1')).getByRole('alert')).toHaveTextContent(
        'SAMS orqali kelgani tasdiqlanmagan',
      ),
    );
    expect(within(rowOf('r1')).getByRole('spinbutton')).toHaveValue('5');
    expect(screen.getByText('1 ta o‘zgarish saqlanmagan')).toBeInTheDocument();
  });

  it('🔴 409 state_changed + qayta o‘qilgan boshqa ball — server qiymati ko‘rinadi, qoralamani tashlash mumkin', async () => {
    const CHANGED = 'Yozuv shu orada o‘zgardi — sahifani yangilab, qayta urinib ko‘ring';
    const conflict: SaveScoresResult = {
      saved: [],
      failed: [{ resident: 'rP', reason: 'state_changed', message: CHANGED }],
      notSent: [],
    };
    m.query = ok([row('rP', 'present')]);
    m.save.mockResolvedValueOnce(conflict);
    const view = renderRoster();
    typeScore(inputs()[0]!, '8');
    expect(
      within(rowOf('rP')).queryByRole('button', { name: 'Qoralamani bekor qilish' }),
    ).toBeNull();
    fireEvent.click(saveBtn());
    await waitFor(() =>
      expect(within(rowOf('rP')).getByRole('alert')).toHaveTextContent(CHANGED),
    );

    m.query = ok([row('rP', 'present', { score: 9 })]);
    view.rerender();
    const r = rowOf('rP');
    const discard = () => within(r).getByRole('button', { name: 'Qoralamani bekor qilish' });
    expect(within(r).getByRole('spinbutton')).toHaveValue('8');
    expect(within(r).getByText('Serverda hozir: 9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Yangilash/ })).toBeDisabled();

    let resolve: (v: SaveScoresResult) => void = () => {};
    m.save.mockReturnValueOnce(
      new Promise<SaveScoresResult>((res) => {
        resolve = res;
      }),
    );
    fireEvent.click(saveBtn());
    await waitFor(() => expect(discard()).toBeDisabled());
    resolve(conflict);
    await waitFor(() => expect(discard()).toBeEnabled());

    fireEvent.click(discard());
    expect(within(r).getByRole('spinbutton')).toHaveValue('9');
    expect(within(r).queryByRole('alert')).toBeNull();
    expect(within(r).queryByText('Serverda hozir: 9')).toBeNull();
    expect(screen.getByRole('button', { name: /Yangilash/ })).toBeEnabled();
    expect(screen.getByText('O‘zgarish yo‘q')).toBeInTheDocument();
    expect(saveBtn()).toBeDisabled();
  });

  it('rad etilgan qoralama server qiymatiga teng — «Serverda hozir» yo‘q, tashlash bor; saqlangan qatorda yo‘q', async () => {
    m.query = ok([row('r1', 'present'), row('r2', 'present')]);
    m.save.mockResolvedValue({
      saved: [{ resident: 'r2', score: 7 }],
      failed: [{ resident: 'r1', reason: 'state_changed', message: 'ROW-CHANGED' }],
      notSent: [],
    });
    const view = renderRoster();
    typeScore(within(rowOf('r1')).getByRole('spinbutton'), '8');
    typeScore(within(rowOf('r2')).getByRole('spinbutton'), '7');
    fireEvent.click(saveBtn());
    await waitFor(() =>
      expect(within(rowOf('r1')).getByRole('alert')).toHaveTextContent('ROW-CHANGED'),
    );

    m.query = ok([row('r1', 'present', { score: 8 }), row('r2', 'present', { score: 7 })]);
    view.rerender();
    expect(within(rowOf('r1')).queryByText(/Serverda hozir/)).toBeNull();
    expect(
      within(rowOf('r1')).getByRole('button', { name: 'Qoralamani bekor qilish' }),
    ).toBeInTheDocument();
    expect(
      within(rowOf('r2')).queryByRole('button', { name: 'Qoralamani bekor qilish' }),
    ).toBeNull();
  });

  it('qator xatosidan keyin sessiya darajasida to‘xtash — toast sababning O‘ZI, sanoq emas', async () => {
    m.query = ok([row('r1', 'present'), row('r2', 'present'), row('r3', 'present')]);
    m.save.mockResolvedValue({
      saved: [],
      failed: [
        { resident: 'r1', reason: 'not_confirmed', message: 'ROW-ONE-REASON' },
        { resident: 'r2', reason: 'session_cancelled', message: 'SESSION-STOP-REASON' },
      ],
      notSent: ['r3'],
    });
    renderRoster();
    typeScore(within(rowOf('r1')).getByRole('spinbutton'), '5');
    typeScore(within(rowOf('r2')).getByRole('spinbutton'), '6');
    typeScore(within(rowOf('r3')).getByRole('spinbutton'), '7');
    fireEvent.click(saveBtn());

    await waitFor(() =>
      expect(within(rowOf('r2')).getByRole('alert')).toHaveTextContent('SESSION-STOP-REASON'),
    );
    expect(await screen.findAllByText('SESSION-STOP-REASON')).toHaveLength(2);
    expect(screen.queryByText(/ta ball saqlanmadi/)).toBeNull();
    expect(within(rowOf('r3')).getByRole('spinbutton')).toHaveValue('7');
  });

  it('bir nechta QATOR xatosi (yuborilmagan yo‘q) — «N ta ball saqlanmadi — sabablari qatorlarda»', async () => {
    m.query = ok([row('r1', 'present'), row('r2', 'present')]);
    m.save.mockResolvedValue({
      saved: [],
      failed: [
        { resident: 'r1', reason: 'not_confirmed', message: 'ROW-ONE-REASON' },
        { resident: 'r2', reason: 'state_changed', message: 'ROW-TWO-REASON' },
      ],
      notSent: [],
    });
    renderRoster();
    typeScore(within(rowOf('r1')).getByRole('spinbutton'), '5');
    typeScore(within(rowOf('r2')).getByRole('spinbutton'), '6');
    fireEvent.click(saveBtn());

    expect(
      await screen.findByText('2 ta ball saqlanmadi — sabablari qatorlarda'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('ROW-TWO-REASON')).toHaveLength(1);
  });
});

describe('SessionRoster — amaliy: dars bali yo‘q (TZ 4.5.6)', { timeout: RENDER_TIMEOUT_MS }, () => {
  const TEXT = SCORE_BLOCKED_TEXT.lessonTypeNotGraded;

  it('🔴 xom DTO → har qatorda egasi matni; maydon ham, saqlash ham yo‘q', () => {
    const detail = mapLessonSessionDetail({
      session: { _id: 's1', day: '2099-01-05', status: 'announced', lessonType: 'amaliy' },
      roster: [
        wp5Row('r1', 'present', 'lesson_type_not_graded', { score: 7 }),
        wp5Row('r2', 'present', null),
        wp5Row('r3', 'pending', 'not_confirmed'),
      ],
    });
    m.query = ok(detail.roster, detail.session);
    renderRoster();

    expect(inputs()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Ballarni saqlash' })).toBeNull();
    for (const rid of ['r1', 'r2', 'r3']) {
      expect(within(rowOf(rid)).getByText(TEXT)).toBeInTheDocument();
    }
    expect(within(rowOf('r1')).getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/oraliq nazorat orqali baholanadi \(TZ 4\.5\.6\)/)).toBeInTheDocument();
    expect(screen.queryByText(/TZ 4\.5\.4/)).toBeNull();
  });

  it('server sababsiz `present` qator ham — `amaliy` sessiyada tahrirlanmaydi (FE darvozasi)', () => {
    m.query = ok([row('rP', 'present')], { lessonType: 'amaliy' });
    renderRoster();
    expect(inputs()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Ballarni saqlash' })).toBeNull();
  });

  it('noma’lum tur, server 409 lesson_type_not_graded — qoralamalar QOLADI, egasi matni ko‘rinadi', async () => {
    m.query = ok([row('r1', 'present'), row('r2', 'present')], { lessonType: null });
    m.save.mockResolvedValue({
      saved: [],
      failed: [{ resident: 'r1', reason: 'lesson_type_not_graded', message: TEXT }],
      notSent: ['r2'],
    });
    renderRoster();
    typeScore(within(rowOf('r1')).getByRole('spinbutton'), '5');
    typeScore(within(rowOf('r2')).getByRole('spinbutton'), '6');
    fireEvent.click(saveBtn());

    await waitFor(() => expect(within(rowOf('r1')).getByRole('alert')).toHaveTextContent(TEXT));
    expect(await screen.findAllByText(TEXT)).toHaveLength(2);
    expect(screen.queryByText(/ta ball saqlanmadi/)).toBeNull();
    expect(within(rowOf('r1')).getByRole('spinbutton')).toHaveValue('5');
    expect(within(rowOf('r2')).getByRole('spinbutton')).toHaveValue('6');
    expect(screen.getByText('2 ta o‘zgarish saqlanmagan')).toBeInTheDocument();
  });
});

describe('SessionRoster — qoralama qayta yuklashda yo‘qolmaydi', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('fon so‘rovi yiqildi (data bor) — roster va qoralama QOLADI, ixcham xato + qayta urinish', () => {
    const view = renderRoster();
    typeScore(inputs()[0]!, '7');

    const refetch = vi.fn();
    m.query = { ...ok(FIVE), isError: true, error: httpError(500), refetch };
    view.rerender();
    expect(inputs()).toHaveLength(1);
    expect(inputs()[0]).toHaveValue('7');
    expect(screen.getByText(/Ma.lumotni yuklab bo.lmadi/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Qayta urinish/i }));
    expect(refetch).toHaveBeenCalledTimes(1);

    m.query = ok(FIVE);
    view.rerender();
    expect(inputs()[0]).toHaveValue('7');
    expect(screen.queryByText(/Ma.lumotni yuklab bo.lmadi/)).toBeNull();
  });

  it('data yo‘q va xato — to‘liq xato ko‘rinishi (roster yo‘q)', () => {
    m.query = { ...ok([]), data: undefined, isError: true, error: httpError(500) };
    renderRoster();
    expect(screen.getByText(/Ma.lumotni yuklab bo.lmadi/)).toBeInTheDocument();
    expect(screen.queryByText('Rezidentlar')).toBeNull();
  });

  it('boshqa sessiyaga o‘tish (keshda bor) — qoralama u yerga O‘TMAYDI', () => {
    const view = renderRoster('s1');
    typeScore(inputs()[0]!, '7');
    expect(inputs()[0]).toHaveValue('7');

    m.query = ok(FIVE, { id: 's2' });
    view.rerender('s2');
    expect(inputs()[0]).toHaveValue('');
    expect(screen.getByText('O‘zgarish yo‘q')).toBeInTheDocument();
  });
});

describe('SessionRoster — holatlar va bekor qilish', { timeout: RENDER_TIMEOUT_MS }, () => {
  it('404 — «Mashg‘ulot topilmadi»', () => {
    m.query = { ...ok([]), data: undefined, isError: true, error: httpError(404) };
    renderRoster();
    expect(screen.getByText('Mashg‘ulot topilmadi')).toBeInTheDocument();
  });

  it('403 — ruxsat yo‘qligi aytiladi', () => {
    m.query = { ...ok([]), data: undefined, isError: true, error: httpError(403) };
    renderRoster();
    expect(screen.getByText(/ko.rish huquqingiz yo.q/i)).toBeInTheDocument();
  });

  it('canCancel=false — «Bekor qilish» tugmasi yo‘q', () => {
    renderRoster();
    expect(screen.queryByRole('button', { name: 'Bekor qilish' })).toBeNull();
  });

  it('canCancel — sabab 2+ belgi, keyin mutateAsync({id, reason})', async () => {
    m.query = ok(FIVE, { canCancel: true });
    m.cancel.mockResolvedValue({});
    renderRoster();
    fireEvent.click(screen.getByRole('button', { name: 'Bekor qilish' }));
    const confirm = screen.getByRole('button', { name: 'Bekor qilishni tasdiqlash' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Sabab *'), {
      target: { value: 'Xato guruh tanlangan' },
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(m.cancel).toHaveBeenCalledWith({ id: 's1', reason: 'Xato guruh tanlangan' }),
    );
  });

  it('bekor qilingan sessiya — baholash yo‘q, sabab ko‘rinadi', () => {
    m.query = ok([row('rP', 'present')], { status: 'cancelled', cancelReason: 'Xato guruh' });
    renderRoster();
    expect(inputs()).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Ballarni saqlash' })).toBeNull();
    expect(screen.getByText(/«Xato guruh»/)).toBeInTheDocument();
  });
});
