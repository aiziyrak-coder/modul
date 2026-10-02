import { useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import { App } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { Btn, SectionTitle, StatCards } from '../../common/FormElements';
import StatCard from '../../common/StatCard';
import QueryNotice from '../../common/QueryNotice';
import { MdRefresh } from '../../../icons';
import {
  useLessonSession,
  useSaveSessionScores,
  type SaveScoresResult,
} from '../../../api/session-api';
import {
  SCORE_BLOCKED_TEXT,
  SESSION_SCORE_MAX,
  type LessonSession,
  type LessonSessionDetail,
  type SessionRosterRow,
  type SessionState,
} from '../../../api/session-types';
import { useResidencyCapabilities } from '../../../lib/capabilities';
import { combineState } from '../../../lib/query-state';
import {
  changedScores,
  dropSavedEdits,
  invalidScoreIds,
  isSessionGradable,
  type ScoreEdits,
} from '../../../lib/session-scores';
import { isLessonTypeGraded } from '../../../lib/lesson-type';
import { isPastDay } from '../../../lib/session-day';
import RosterTable from './RosterTable';
import SessionBanner from './SessionBanner';
import CancelSessionModal from './CancelSessionModal';
import * as S from './style';

const STAT_CARDS: Array<{ state: SessionState; icon: string; bg: string; label: string }> = [
  { state: 'present', icon: '✅', bg: '#EAFAF1', label: 'Keldi' },
  { state: 'absent', icon: '❌', bg: '#FDEDEC', label: 'Kelmadi' },
  { state: 'unmeasured', icon: '❔', bg: '#F4F6F9', label: 'O‘lchanmagan' },
  { state: 'pending', icon: '⏳', bg: '#EBF5FB', label: 'Kutilmoqda' },
  { state: 'excused', icon: '🕐', bg: '#FEF9E7', label: 'Sababli' },
];

function RosterStats({ rows }: { rows: SessionRosterRow[] }) {
  const counts = useMemo(() => {
    const c: Record<SessionState, number> = {
      present: 0,
      absent: 0,
      unmeasured: 0,
      pending: 0,
      excused: 0,
    };
    for (const r of rows) c[r.state] += 1;
    return c;
  }, [rows]);
  return (
    <StatCards>
      {STAT_CARDS.map((s) => (
        <StatCard
          key={s.state}
          icon={s.icon}
          iconBg={s.bg}
          number={counts[s.state]}
          label={s.label}
        />
      ))}
    </StatCards>
  );
}

const without = (obj: Readonly<Record<string, string>>, keys: readonly string[]) =>
  Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

function useGrading(sessionId: string, rows: SessionRosterRow[], grading: boolean) {
  const { message } = App.useApp();
  const saveM = useSaveSessionScores();
  const [edits, setEdits] = useState<ScoreEdits>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const changed = useMemo(() => changedScores(rows, edits, grading), [rows, edits, grading]);
  const invalid = useMemo(() => invalidScoreIds(rows, edits, grading), [rows, edits, grading]);

  const setEdit = (residentId: string, text: string) => {
    setEdits((e) => ({ ...e, [residentId]: text }));
    setRowErrors((r) => without(r, [residentId]));
  };

  const discard = (residentId: string) => {
    setEdits((e) => without(e, [residentId]));
    setRowErrors((r) => without(r, [residentId]));
  };

  const report = (res: SaveScoresResult) => {
    if (res.saved.length > 0) message.success(`${res.saved.length} ta ball saqlandi`);
    const last = res.failed[res.failed.length - 1];
    if (!last) return;
    if (res.failed.length === 1 || res.notSent.length > 0) message.error(last.message);
    else message.error(`${res.failed.length} ta ball saqlanmadi — sabablari qatorlarda`);
  };

  const save = async () => {
    if (saving || invalid.size > 0 || changed.length === 0) return;
    setSaving(true);
    try {
      const res = await saveM.mutateAsync({ sessionId, scores: changed });
      setEdits((e) => dropSavedEdits(e, res.saved));
      setRowErrors(Object.fromEntries(res.failed.map((f) => [f.resident, f.message])));
      report(res);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Ballarni saqlashda xatolik'));
    } finally {
      setSaving(false);
    }
  };

  return { edits, setEdit, discard, changed, invalid, rowErrors, save, saving };
}

function GradeToolbar({
  grading,
  saving,
  changedCount,
  invalidCount,
  refreshing,
  onSave,
  onRefresh,
}: {
  grading: boolean;
  saving: boolean;
  changedCount: number;
  invalidCount: number;
  refreshing: boolean;
  onSave: () => void;
  onRefresh: () => void;
}) {
  const dirty = changedCount > 0 || invalidCount > 0;
  return (
    <S.Toolbar>
      {grading && (
        <Btn
          $variant="primary"
          disabled={saving || changedCount === 0 || invalidCount > 0}
          onClick={onSave}
        >
          Ballarni saqlash
        </Btn>
      )}
      <Btn $variant="outline" disabled={dirty || refreshing} onClick={onRefresh}>
        <MdRefresh /> Yangilash
      </Btn>
      {grading && (
        <S.DirtyNote $error={invalidCount > 0}>
          {invalidCount > 0
            ? `${invalidCount} ta qatorda ball 0–${SESSION_SCORE_MAX} oralig‘idan tashqarida`
            : changedCount > 0
              ? `${changedCount} ta o‘zgarish saqlanmagan`
              : 'O‘zgarish yo‘q'}
        </S.DirtyNote>
      )}
    </S.Toolbar>
  );
}

function SessionInfoNote({ session }: { session: LessonSession }) {
  return (
    <S.InfoNote>
      Davomatni ustoz belgilamaydi — holat SAMS’dan avtomatik aniqlanadi (D-R2).{' '}
      {isLessonTypeGraded(session.lessonType)
        ? 'Ball faqat SAMS orqali kelgani tasdiqlangan rezidentga qo‘yiladi (TZ 4.5.4).'
        : `${SCORE_BLOCKED_TEXT.lessonTypeNotGraded} (TZ 4.5.6).`}
    </S.InfoNote>
  );
}

function RosterView({
  detail,
  canGrade,
  refreshing,
  onRefresh,
}: {
  detail: LessonSessionDetail;
  canGrade: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { session, roster } = detail;
  const grading = canGrade && isSessionGradable(session);
  const g = useGrading(session.id, roster, grading);
  const [cancelOpen, setCancelOpen] = useState(false);
  return (
    <>
      <SessionBanner
        session={session}
        onCancel={session.canCancel ? () => setCancelOpen(true) : undefined}
      />
      <SessionInfoNote session={session} />
      <RosterStats rows={roster} />
      <SectionTitle>Rezidentlar</SectionTitle>
      <GradeToolbar
        grading={grading}
        saving={g.saving}
        changedCount={g.changed.length}
        invalidCount={g.invalid.size}
        refreshing={refreshing}
        onSave={() => void g.save()}
        onRefresh={onRefresh}
      />
      <RosterTable
        rows={roster}
        grading={grading}
        edits={g.edits}
        invalid={g.invalid}
        rowErrors={g.rowErrors}
        saving={g.saving}
        dayClosed={isPastDay(session.day)}
        onEdit={g.setEdit}
        onDiscard={g.discard}
      />
      {cancelOpen && <CancelSessionModal session={session} onClose={() => setCancelOpen(false)} />}
    </>
  );
}

const isNotFound = (e: unknown) => e instanceof AxiosError && e.response?.status === 404;

export default function SessionRoster({ id }: { id: string }) {
  const q = useLessonSession(id);
  const { canGradeSession } = useResidencyCapabilities();
  const state = combineState([q]);
  const retry = () => void q.refetch();
  if (isNotFound(q.error)) return <S.NotFound>Mashg‘ulot topilmadi</S.NotFound>;
  if (!q.data) {
    return <QueryNotice state={state === 'ok' ? 'loading' : state} onRetry={retry} />;
  }
  return (
    <>
      {(state === 'error' || state === 'forbidden') && (
        <QueryNotice compact state={state} onRetry={retry} />
      )}
      <RosterView
        key={q.data.session.id}
        detail={q.data}
        canGrade={canGradeSession}
        refreshing={q.isFetching}
        onRefresh={retry}
      />
    </>
  );
}
