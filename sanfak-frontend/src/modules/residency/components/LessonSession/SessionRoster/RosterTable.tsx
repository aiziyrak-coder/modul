import { TableWrap, Table, Th, Td, Tr } from '../../common/Table';
import Badge from '../../common/Badge';
import { NumberField } from '../../common/NumberField';
import {
  PENDING_CLOSED_DAY_HINT,
  SCORE_BLOCKED_TEXT,
  SESSION_STATE_HINT,
  SESSION_STATE_LABEL,
  SESSION_SCORE_MAX,
  SESSION_STATE_VARIANT,
  type SessionRosterRow,
} from '../../../api/session-types';
import {
  draftValue,
  isScorable,
  parseScoreText,
  toInputValue,
  type ScoreEdits,
} from '../../../lib/session-scores';
import * as S from './style';

export interface RosterTableProps {
  rows: SessionRosterRow[];
  grading: boolean;
  edits: ScoreEdits;
  invalid: ReadonlySet<string>;
  rowErrors: Readonly<Record<string, string>>;
  saving: boolean;
  dayClosed: boolean;
  onEdit: (residentId: string, text: string) => void;
  onDiscard: (residentId: string) => void;
}

const EMPTY_CELL = { textAlign: 'center', color: '#7F8C8D', padding: 32 } as const;

const clockRange = (r: SessionRosterRow): string =>
  r.checkInTime && r.checkOutTime ? `${r.checkInTime}–${r.checkOutTime}` : '—';

const blockedReason = (r: SessionRosterRow): string | null =>
  r.scoreBlockedReason ?? (r.state === 'present' ? null : SCORE_BLOCKED_TEXT.notConfirmed);

const stateHint = (row: SessionRosterRow, dayClosed: boolean): string | null =>
  row.state === 'pending' && dayClosed ? PENDING_CLOSED_DAY_HINT : SESSION_STATE_HINT[row.state];

function StateCell({ row, dayClosed }: { row: SessionRosterRow; dayClosed: boolean }) {
  return (
    <span title={stateHint(row, dayClosed) ?? undefined}>
      <Badge variant={SESSION_STATE_VARIANT[row.state]}>{SESSION_STATE_LABEL[row.state]}</Badge>
    </span>
  );
}

interface CellProps {
  row: SessionRosterRow;
  edits: ScoreEdits;
  invalid: boolean;
  error: string | undefined;
  saving: boolean;
  onEdit: RosterTableProps['onEdit'];
  onDiscard: RosterTableProps['onDiscard'];
}

function DraftConflict({
  row,
  draft,
  saving,
  onDiscard,
}: {
  row: SessionRosterRow;
  draft: string;
  saving: boolean;
  onDiscard: () => void;
}) {
  return (
    <S.DraftConflict>
      {parseScoreText(draft) !== row.score && <span>{`Serverda hozir: ${row.score ?? '—'}`}</span>}
      <S.LinkBtn type="button" disabled={saving} onClick={onDiscard}>
        Qoralamani bekor qilish
      </S.LinkBtn>
    </S.DraftConflict>
  );
}

function EditableScore({
  row,
  residentId,
  edits,
  invalid,
  error,
  saving,
  onEdit,
  onDiscard,
}: CellProps & { residentId: string }) {
  const draft = edits[residentId];
  return (
    <>
      <NumberField
        aria-label={`${row.fullName ?? 'Rezident'} — dars bali`}
        status={invalid ? 'error' : undefined}
        disabled={saving}
        style={{ width: '100%' }}
        value={toInputValue(draftValue(row, edits))}
        placeholder="—"
        onChange={(v) => onEdit(residentId, v === null ? '' : String(v))}
      />
      {invalid && (
        <S.CellError>{`Ball 0–${SESSION_SCORE_MAX} oralig‘ida bo‘lishi kerak`}</S.CellError>
      )}
      {error && <S.CellError role="alert">{error}</S.CellError>}
      {error && draft !== undefined && (
        <DraftConflict
          row={row}
          draft={draft}
          saving={saving}
          onDiscard={() => onDiscard(residentId)}
        />
      )}
    </>
  );
}

function ReadonlyScore({ row, error }: Pick<CellProps, 'row' | 'error'>) {
  const reason = blockedReason(row);
  return (
    <>
      <span>{row.score ?? '—'}</span>
      {reason && <S.Muted>{reason}</S.Muted>}
      {error && <S.CellError role="alert">{error}</S.CellError>}
    </>
  );
}

function ScoreCell({ grading, ...cell }: CellProps & { grading: boolean }) {
  const residentId = cell.row.residentId;
  if (grading && residentId !== null && isScorable(cell.row, true)) {
    return <EditableScore {...cell} residentId={residentId} />;
  }
  return <ReadonlyScore row={cell.row} error={cell.error} />;
}

type RowProps = Omit<RosterTableProps, 'rows'> & { row: SessionRosterRow; index: number };

function RosterRow({ row: r, index, dayClosed, ...cell }: RowProps) {
  const { grading, edits, invalid, rowErrors, saving, onEdit, onDiscard } = cell;
  const rid = r.residentId;
  return (
    <Tr data-testid={`roster-row-${rid ?? r.id}`}>
      <Td>{index}</Td>
      <Td style={{ fontWeight: 500 }}>{r.fullName ?? '—'}</Td>
      <Td>{r.specialtyTitle ?? '—'}</Td>
      <Td>{r.courseNumber === null ? '—' : `${r.courseNumber}-kurs`}</Td>
      <Td>
        <StateCell row={r} dayClosed={dayClosed} />
      </Td>
      <Td style={{ whiteSpace: 'nowrap' }}>{clockRange(r)}</Td>
      <Td style={{ minWidth: 150 }}>
        <ScoreCell
          row={r}
          grading={grading}
          edits={edits}
          invalid={rid !== null && invalid.has(rid)}
          error={rid === null ? undefined : rowErrors[rid]}
          saving={saving}
          onEdit={onEdit}
          onDiscard={onDiscard}
        />
      </Td>
    </Tr>
  );
}

const COLUMNS = [
  '№',
  'F.I.Sh',
  'Mutaxassislik',
  'Kurs',
  'Holat',
  'Vaqt',
  `Ball (0–${SESSION_SCORE_MAX})`,
];

export default function RosterTable({ rows, ...rest }: RosterTableProps) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <Th key={c}>{c}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <RosterRow key={r.id} row={r} index={i + 1} {...rest} />
          ))}
          {rows.length === 0 && (
            <Tr>
              <Td colSpan={COLUMNS.length} style={EMPTY_CELL}>
                Ro‘yxatda rezident yo‘q
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
