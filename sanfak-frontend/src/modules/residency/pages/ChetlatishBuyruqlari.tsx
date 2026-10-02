import { useMemo, type KeyboardEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { Alert, Select, Tag } from '@/shared/ui';
import { Btn, FilterBar, PageTitle, Tab, Tabs } from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import Pager from '../components/common/Pager';
import QueryNotice from '../components/common/QueryNotice';
import { useExpulsionOrders, type ExpulsionOrderListParams } from '../api/expulsion-order-api';
import {
  ORIGIN_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  type ExpulsionOrder,
} from '../api/expulsion-order-types';
import { combineState } from '../lib/query-state';
import { formatUzDay } from '../lib/uz-day';
import {
  parseListView,
  toListSearch,
  toOrigin,
  type ListReturnState,
  type ListTab,
  type ListView,
} from '../lib/expulsion-list-search';

const TABS: ReadonlyArray<{ key: ListTab; label: string }> = [
  { key: 'loyiha', label: STATUS_LABEL.loyiha },
  { key: 'imzolangan', label: STATUS_LABEL.imzolangan },
  { key: 'rad_etilgan', label: STATUS_LABEL.rad_etilgan },
  { key: 'bekor_qilingan', label: STATUS_LABEL.bekor_qilingan },
  { key: 'all', label: 'Barchasi' },
];

const ORIGIN_OPTIONS = [
  { value: '', label: 'Manba — barchasi' },
  { value: 'tizim', label: ORIGIN_LABEL.tizim },
  { value: 'meros', label: ORIGIN_LABEL.meros },
];

const PAGE_SIZE = 20;
const PROBE_LIMIT = 100;
const PROBE_PARAMS: ExpulsionOrderListParams = { page: 1, limit: PROBE_LIMIT, status: 'imzolangan' };
const DETAIL_PATH = '/residency/chetlatish-buyruqlari';
const PROGRAM_LABEL: Record<string, string> = { magistratura: 'Magistratura', ordinatura: 'Ordinatura' };

function listParams({ page, tab, origin }: ListView): ExpulsionOrderListParams {
  const params: ExpulsionOrderListParams = { page, limit: PAGE_SIZE };
  if (tab !== 'all') params.status = tab;
  if (origin) params.origin = origin;
  return params;
}

function residentLine(o: ExpulsionOrder): string {
  const r = o.resident;
  if (!r) return '';
  const parts = [
    PROGRAM_LABEL[r.program] ?? r.program,
    r.courseNumber !== null ? `${r.courseNumber}-kurs` : null,
    r.specialtyTitle,
  ];
  return parts.filter(Boolean).join(' · ');
}

const hours = (h: number | null): string => (h === null ? '—' : String(h));

function OrderRow({ order, onOpen }: { order: ExpulsionOrder; onOpen: (id: string) => void }) {
  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter') onOpen(order.id);
  };
  return (
    <Tr $clickable tabIndex={0} onClick={() => onOpen(order.id)} onKeyDown={onKeyDown}>
      <Td>
        <Name>{order.residentName}</Name>
        {order.resident && <Sub>{residentLine(order)}</Sub>}
      </Td>
      <Td>{order.countingYear ?? '—'}</Td>
      <Td style={{ whiteSpace: 'nowrap' }}>{formatUzDay(order.draftedAt)}</Td>
      <Td style={{ whiteSpace: 'nowrap' }}>
        {hours(order.hoursAtDraft)} → {hours(order.residentHours)}
      </Td>
      <Td>
        <Cell>
          {order.status ? (
            <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
          ) : (
            <Badge variant="nofaol">Noma’lum</Badge>
          )}
          {order.flags.needsResume && <Badge variant="danger">Imzo yakunlanmagan</Badge>}
          {order.basisLostAt && <Badge variant="warning">Soat 72 dan tushgan</Badge>}
          {order.scan && <Tag>Skan</Tag>}
        </Cell>
      </Td>
      <Td>{order.origin ? ORIGIN_LABEL[order.origin] : '—'}</Td>
    </Tr>
  );
}

function OrdersTable({ rows, onOpen }: { rows: ExpulsionOrder[]; onOpen: (id: string) => void }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>F.I.Sh</Th>
            <Th>O‘quv yili</Th>
            <Th>Loyiha sanasi</Th>
            <Th>Soat</Th>
            <Th>Holat</Th>
            <Th>Manba</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <OrderRow key={o.id} order={o} onOpen={onOpen} />
          ))}
          {rows.length === 0 && (
            <Tr>
              <Td colSpan={6} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                Buyruqlar yo‘q
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function StatusTabs({ value, onChange }: { value: ListTab; onChange: (key: ListTab) => void }) {
  return (
    <Tabs role="tablist">
      {TABS.map((t) => (
        <Tab
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          $active={value === t.key}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </Tab>
      ))}
    </Tabs>
  );
}

function HalfSignedAlert({ count, onShow }: { count: number; onShow: () => void }) {
  if (count <= 0) return null;
  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message={`${count} ta buyruqning imzosi yakunlanmagan — rezident holati hali o‘zgarmagan`}
      description="Buyruqni oching va «Imzoni yakunlash» tugmasi bilan aynan saqlangan ma’lumotni qayta yuboring."
      action={
        <Btn $size="sm" $variant="danger" onClick={onShow}>
          Ko‘rsatish
        </Btn>
      }
    />
  );
}

function useListView() {
  const [search, setSearch] = useSearchParams();
  const view = parseListView(search);
  const update = (next: Partial<ListView>) =>
    setSearch(toListSearch({ ...view, ...next }), { replace: true });
  return { view, search, update };
}

export default function ChetlatishBuyruqlari() {
  const navigate = useNavigate();
  const { view, search, update } = useListView();
  const { tab, origin, page } = view;

  const listQ = useExpulsionOrders(listParams(view));
  const probeQ = useExpulsionOrders(PROBE_PARAMS);
  const halfSigned = useMemo(
    () => (probeQ.data?.items ?? []).filter((o) => o.flags.needsResume).length,
    [probeQ.data],
  );
  const state = combineState([listQ]);
  const rows = listQ.data?.items ?? [];

  const selectTab = (key: ListTab) => update({ tab: key, page: 1 });
  const selectOrigin = (value: string) => update({ origin: toOrigin(value), page: 1 });
  const setPage = (next: number) => update({ page: next });
  const open = (id: string) => {
    const state: ListReturnState = { listSearch: search.toString() };
    navigate(`${DETAIL_PATH}/${id}`, { state });
  };

  return (
    <div>
      <PageTitle>Chetlatish buyruqlari</PageTitle>
      <HalfSignedAlert count={halfSigned} onShow={() => selectTab('imzolangan')} />
      <StatusTabs value={tab} onChange={selectTab} />
      <FilterBar>
        <Select
          aria-label="Manba"
          value={origin}
          style={{ width: 'auto', minWidth: 190 }}
          onChange={selectOrigin}
          options={ORIGIN_OPTIONS}
        />
        {listQ.data && <Muted>Jami: {listQ.data.total}</Muted>}
      </FilterBar>

      {state !== 'ok' && <QueryNotice state={state} onRetry={() => void listQ.refetch()} />}

      {state === 'ok' && <OrdersTable rows={rows} onOpen={open} />}
      <Pager page={page} totalPages={listQ.data?.totalPages ?? 1} onPage={setPage} />
    </div>
  );
}

const Name = styled.div`
  font-weight: 600;
`;

const Sub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const Cell = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
`;

const Muted = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
