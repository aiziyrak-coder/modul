import { useId } from 'react';
import Badge from '../common/Badge';
import QueryNotice from '../common/QueryNotice';
import RefreshNotice from '../common/RefreshNotice';
import {
  Fact,
  FactGrid,
  FactLabel,
  FactValue,
  Panel,
  PanelHead,
  PanelHint,
  PanelTitle,
} from '../common/InfoPanel';
import { useAttendanceContext } from '../../api/session-api';
import type { AttendanceContext, AttendanceSessionCounts } from '../../api/attendance-context';
import {
  SESSION_STATE_HINT,
  SESSION_STATE_LABEL,
  SESSION_STATE_VARIANT,
} from '../../api/session-types';
import { RESIDENT_STATUS_LABEL, labelOf } from '../../api/expulsion-order-types';
import type { Program } from '../../api/types';
import {
  SESSION_COUNT_ORDER,
  compactSummary,
  contextNotice,
  contextTitle,
  coverageText,
  isAttendanceTracked,
  unexcusedHoursText,
  type ContextNotice,
} from '../../lib/attendance-context-view';
import { Badges, CompactNote, Footer, Muted, Sub } from './style';

interface Props {
  residentId: string;
  program: Program | null;
  compact?: boolean;
}

type ContextQuery = ReturnType<typeof useAttendanceContext>;

const UNTRACKED_TEXT = 'Magistrantlar davomati tizimda kuzatilmaydi';
const THRESHOLD_TEXT = '6 soat — bildirgi, 72 soat — chetlatish buyrug‘i';
const UNMEASURED_NOTE =
  'O‘lchanmagan mashg‘ulot «kelmadi» hisoblanmaydi va sababsiz soatga kirmaydi.';
const FOOTER_TEXT = 'Barcha fanlar bo‘yicha · faqat ma’lumot — ball qo‘yishni cheklamaydi';
const EMPTY_SESSIONS_TEXT = 'Joriy o‘quv yilida mashg‘ulot e’lon qilinmagan';
const COVERAGE_HINT =
  'O‘lchangan mashg‘ulotlar (keldi + kelmadi + sababli) / kutilayotganlardan tashqari hammasi';

const COMPACT_TEXT: Record<Exclude<ContextNotice, 'ok'>, string> = {
  loading: 'Davomat: yuklanmoqda…',
  forbidden: 'Davomat: ko‘rish huquqi yo‘q',
  notFound: 'Davomat: rezident topilmadi',
  error: 'Davomat: ma’lumotni yuklab bo‘lmadi',
};

export default function AttendanceContextPanel({ residentId, program, compact }: Props) {
  const tracked = isAttendanceTracked(program);
  const q = useAttendanceContext(residentId, tracked);
  const titleId = useId();

  if (!tracked) {
    return compact ? (
      <CompactNote role="note">{UNTRACKED_TEXT}</CompactNote>
    ) : (
      <Muted role="note">{UNTRACKED_TEXT}</Muted>
    );
  }
  const notice = contextNotice(q);
  if (compact) return <CompactLine notice={notice} data={q.data} />;
  return (
    <Panel aria-labelledby={titleId}>
      <PanelHead>
        <PanelTitle id={titleId}>{contextTitle(q.data)}</PanelTitle>
        {q.data && notice !== 'notFound' && <StatusBadge status={q.data.residentStatus} />}
      </PanelHead>
      <PanelBody q={q} notice={notice} />
    </Panel>
  );
}

function PanelBody({ q, notice }: { q: ContextQuery; notice: ContextNotice }) {
  const retry = () => void q.refetch();
  if (notice === 'notFound') return <Sub role="status">Rezident topilmadi</Sub>;
  if (q.data) {
    return (
      <>
        {(notice === 'error' || notice === 'forbidden') && (
          <RefreshNotice state={notice} updatedAt={q.dataUpdatedAt} onRetry={retry} />
        )}
        <Facts ctx={q.data} />
      </>
    );
  }
  if (notice === 'ok') return null;
  return <QueryNotice compact state={notice} onRetry={retry} />;
}

function Facts({ ctx }: { ctx: AttendanceContext }) {
  const s = ctx.sessions;
  return (
    <>
      <FactGrid>
        <Fact>
          <FactLabel>Sababsiz soat</FactLabel>
          <FactValue>
            {unexcusedHoursText(ctx)}
            {(ctx.warningIssued || ctx.expulsionOrderCreated) && (
              <Badges>
                {ctx.warningIssued && <Badge variant="warning">Ogohlantirish berilgan</Badge>}
                {ctx.expulsionOrderCreated && (
                  <Badge variant="danger">Chetlatish loyihasi ochilgan</Badge>
                )}
              </Badges>
            )}
            <Sub>{THRESHOLD_TEXT}</Sub>
          </FactValue>
        </Fact>
        <Fact>
          <FactLabel>Mashg‘ulotlar</FactLabel>
          <FactValue>
            <SessionCounts sessions={s} />
          </FactValue>
        </Fact>
        <Fact>
          <FactLabel>Qamrov</FactLabel>
          <FactValue title={COVERAGE_HINT}>{coverageText(ctx)}</FactValue>
        </Fact>
      </FactGrid>
      {s && s.unmeasured > 0 && <PanelHint $tone="muted">{UNMEASURED_NOTE}</PanelHint>}
      <Footer>{FOOTER_TEXT}</Footer>
    </>
  );
}

function SessionCounts({ sessions }: { sessions: AttendanceSessionCounts | null }) {
  if (!sessions) return <>—</>;
  if (sessions.total === 0) return <Sub>{EMPTY_SESSIONS_TEXT}</Sub>;
  return (
    <Badges>
      {SESSION_COUNT_ORDER.map((k) => (
        <span key={k} title={SESSION_STATE_HINT[k] ?? undefined}>
          <Badge variant={SESSION_STATE_VARIANT[k]}>
            {SESSION_STATE_LABEL[k]}: {sessions[k]}
          </Badge>
        </span>
      ))}
      <Sub as="span">jami {sessions.total}</Sub>
    </Badges>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === null || status === 'oquvda') return null;
  return (
    <Badge variant={status === 'chetlatilgan' ? 'danger' : 'warning'}>
      {labelOf(RESIDENT_STATUS_LABEL, status)}
    </Badge>
  );
}

function CompactLine({
  notice,
  data,
}: {
  notice: ContextNotice;
  data: AttendanceContext | undefined;
}) {
  const failed = notice === 'error' || notice === 'forbidden';
  let text: string;
  if (notice === 'notFound' || !data) {
    text = COMPACT_TEXT[notice === 'ok' ? 'loading' : notice];
  } else {
    text = failed ? `${compactSummary(data)} (yangilab bo‘lmadi)` : compactSummary(data);
  }
  return (
    <CompactNote role="note" aria-label="Davomat xulosasi" $error={failed && !data}>
      {text}
    </CompactNote>
  );
}
