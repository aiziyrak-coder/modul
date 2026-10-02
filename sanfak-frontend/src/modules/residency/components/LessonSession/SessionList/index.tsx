import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, Select } from '@/shared/ui';
import { Btn, FilterBar } from '../../common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../../common/Table';
import Badge from '../../common/Badge';
import Pager from '../../common/Pager';
import QueryNotice from '../../common/QueryNotice';
import { MdAdd, MdVisibility } from '../../../icons';
import { useSciences } from '../../../api/residency-api';
import { useLessonSessions } from '../../../api/session-api';
import {
  SESSION_STATUS_LABEL,
  SESSION_STATUS_VARIANT,
  type LessonSession,
  type SessionListParams,
  type SessionStatus,
} from '../../../api/session-types';
import type { LessonType, RefOption } from '../../../api/types';
import { useResidencyCapabilities } from '../../../lib/capabilities';
import { LESSON_LABEL, LESSON_TYPES, lessonLabel } from '../../../lib/lesson-type';
import { sessionDetailPath } from '../../../lib/journal-tab';
import { combineState } from '../../../lib/query-state';
import { useSessionGroupOptions } from '../../../lib/session-groups';
import { formatDayKey } from '../../../lib/uz-day';
import AnnounceModal from '../AnnounceModal';

const PAGE_SIZE = 10;
const EMPTY_CELL = { textAlign: 'center', color: '#7F8C8D', padding: 32 } as const;

interface Filters {
  day: string;
  science: string;
  lessonType: '' | LessonType;
  group: string;
  status: '' | SessionStatus;
}
const EMPTY_FILTERS: Filters = { day: '', science: '', lessonType: '', group: '', status: '' };

function toParams(f: Filters, page: number): SessionListParams {
  return {
    page,
    limit: PAGE_SIZE,
    day: f.day || undefined,
    science: f.science || undefined,
    lessonType: f.lessonType || undefined,
    group: f.group || undefined,
    status: f.status || undefined,
  };
}

const LESSON_OPTIONS = [
  { value: '', label: 'Barcha dars turi' },
  ...LESSON_TYPES.map((l) => ({ value: l as string, label: LESSON_LABEL[l] })),
];
const STATUS_OPTIONS = [
  { value: '', label: 'Holat — barchasi' },
  { value: 'announced', label: SESSION_STATUS_LABEL.announced },
  { value: 'cancelled', label: SESSION_STATUS_LABEL.cancelled },
];
const refOptions = (all: string, list: readonly RefOption[]) => [
  { value: '', label: all },
  ...list.map((x) => ({ value: x.id, label: x.title })),
];

type SelectKey = Exclude<keyof Filters, 'day'>;
const BOX = { width: 'auto', minWidth: 150 } as const;

function FilterSelect({
  label,
  field,
  filters,
  onChange,
  options,
  search = false,
}: {
  label: string;
  field: SelectKey;
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  options: Array<{ value: string; label: string }>;
  search?: boolean;
}) {
  return (
    <Select
      aria-label={label}
      value={filters[field]}
      showSearch={search}
      optionFilterProp="label"
      style={BOX}
      onChange={(v: string) => onChange({ [field]: v } as Partial<Filters>)}
      options={options}
    />
  );
}

function SessionFilters({
  filters,
  onChange,
  sciences,
  groups,
  action,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  sciences: RefOption[];
  groups: RefOption[];
  action: ReactNode;
}) {
  const common = { filters, onChange };
  return (
    <FilterBar>
      <DatePicker
        aria-label="Sana"
        value={filters.day || null}
        style={{ width: '100%', minWidth: 180 }}
        onChange={(v) => onChange({ day: v ?? '' })}
      />
      <FilterSelect
        label="Fan"
        field="science"
        search
        options={refOptions('Barcha fanlar', sciences)}
        {...common}
      />
      <FilterSelect label="Dars turi" field="lessonType" options={LESSON_OPTIONS} {...common} />
      <FilterSelect
        label="Guruh"
        field="group"
        search
        options={refOptions('Barcha guruh', groups)}
        {...common}
      />
      <FilterSelect label="Holat" field="status" options={STATUS_OPTIONS} {...common} />
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </FilterBar>
  );
}

function StatusCell({ s }: { s: LessonSession }) {
  if (!s.status) return <Badge variant="nofaol">Noma’lum</Badge>;
  return (
    <span title={s.cancelReason ?? undefined}>
      <Badge variant={SESSION_STATUS_VARIANT[s.status]}>{SESSION_STATUS_LABEL[s.status]}</Badge>
    </span>
  );
}

function SessionRow({
  s,
  index,
  onOpen,
}: {
  s: LessonSession;
  index: number;
  onOpen: (id: string) => void;
}) {
  return (
    <Tr>
      <Td>{index}</Td>
      <Td style={{ whiteSpace: 'nowrap' }}>{formatDayKey(s.day)}</Td>
      <Td>{s.scienceTitle ?? '—'}</Td>
      <Td>{lessonLabel(s.lessonType)}</Td>
      <Td>{s.groupTitle ?? '—'}</Td>
      <Td>{s.hours ?? '—'}</Td>
      <Td>{s.teacherName ?? '—'}</Td>
      <Td>{s.rosterCount}</Td>
      <Td>
        <StatusCell s={s} />
      </Td>
      <Td>
        <Btn
          $variant="ghost"
          $size="sm"
          title="Ochish"
          aria-label="Ochish"
          onClick={() => onOpen(s.id)}
        >
          <MdVisibility />
        </Btn>
      </Td>
    </Tr>
  );
}

const COLUMNS = [
  '№',
  'Sana',
  'Fan',
  'Dars turi',
  'Guruh',
  'Soat',
  'O‘qituvchi',
  'Rezidentlar',
  'Holat',
  'Amallar',
];

function SessionTable({
  rows,
  offset,
  emptyText,
  onOpen,
}: {
  rows: LessonSession[];
  offset: number;
  emptyText: string;
  onOpen: (id: string) => void;
}) {
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
          {rows.map((s, i) => (
            <SessionRow key={s.id} s={s} index={offset + i + 1} onOpen={onOpen} />
          ))}
          {rows.length === 0 && (
            <Tr>
              <Td colSpan={COLUMNS.length} style={EMPTY_CELL}>
                {emptyText}
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function emptyText(fetching: boolean, filters: Filters): string {
  if (fetching) return 'Yuklanmoqda…';
  return Object.values(filters).some(Boolean)
    ? 'Filtrga mos mashg‘ulot topilmadi'
    : 'Hali mashg‘ulot e’lon qilinmagan';
}

export default function SessionList() {
  const navigate = useNavigate();
  const { isOffice, canAnnounceSession } = useResidencyCapabilities();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [announcing, setAnnouncing] = useState(false);
  const listQ = useLessonSessions(toParams(filters, page));
  const { data: sciences = [] } = useSciences();
  const groups = useSessionGroupOptions(isOffice);
  const state = combineState([listQ]);

  const open = (id: string) => navigate(sessionDetailPath(id));
  const update = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const onAnnounced = (id: string | null) => {
    setAnnouncing(false);
    if (id) open(id);
  };
  const announceBtn = canAnnounceSession ? (
    <Btn $variant="primary" onClick={() => setAnnouncing(true)}>
      <MdAdd /> Mashg‘ulot e’lon qilish
    </Btn>
  ) : null;

  return (
    <div>
      <SessionFilters
        filters={filters}
        onChange={update}
        sciences={sciences}
        groups={groups.options}
        action={announceBtn}
      />
      {state !== 'ok' && <QueryNotice state={state} onRetry={() => void listQ.refetch()} />}
      {state === 'ok' && (
        <SessionTable
          rows={listQ.data?.items ?? []}
          offset={(page - 1) * PAGE_SIZE}
          emptyText={emptyText(listQ.isFetching, filters)}
          onOpen={open}
        />
      )}
      <Pager page={page} totalPages={listQ.data?.totalPages ?? 1} onPage={setPage} />
      {announcing && (
        <AnnounceModal onClose={() => setAnnouncing(false)} onAnnounced={onAnnounced} />
      )}
    </div>
  );
}
