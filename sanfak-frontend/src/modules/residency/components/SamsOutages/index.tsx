import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Select, Tooltip } from '@/shared/ui';
import Badge from '../common/Badge';
import Pager from '../common/Pager';
import QueryNotice from '../common/QueryNotice';
import RefreshNotice from '../common/RefreshNotice';
import TruncCell from '../common/TruncCell';
import { Btn, FilterBar } from '../common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../common/Table';
import { useSamsOutages } from '../../api/sams-status-api';
import type { SamsOutage, SamsOutageStatusFilter } from '../../api/sams-status-types';
import { combineState } from '../../lib/query-state';
import { outageSpanDays } from '../../lib/sams-outage-draft';
import { formatDayKey, formatUzDateTime } from '../../lib/uz-day';
import CancelOutageModal from './CancelOutageModal';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: Array<{ value: SamsOutageStatusFilter; label: string }> = [
  { value: 'active', label: 'Faol' },
  { value: 'cancelled', label: 'Bekor qilingan' },
  { value: 'all', label: 'Barchasi' },
];

interface Props {
  canWrite: boolean;
}

function StatusCell({ outage }: { outage: SamsOutage }) {
  if (outage.status === 'active') return <Badge variant="faol">Faol</Badge>;
  const tip = (
    <div>
      <div>Bekor qildi: {outage.cancelledByName ?? '—'}</div>
      <div>Qachon: {formatUzDateTime(outage.cancelledAt)}</div>
      <div>Sabab: {outage.cancelReason ?? '—'}</div>
    </div>
  );
  return (
    <Tooltip title={tip}>
      <span>
        <Badge variant="nofaol">Bekor qilingan</Badge>
      </span>
    </Tooltip>
  );
}

function OutageRow({
  outage,
  canWrite,
  onCancel,
}: {
  outage: SamsOutage;
  canWrite: boolean;
  onCancel: (o: SamsOutage) => void;
}) {
  const span = outageSpanDays(outage.from, outage.to);
  return (
    <Tr>
      <Td style={{ whiteSpace: 'nowrap' }}>
        {formatDayKey(outage.from)} – {formatDayKey(outage.to)}
        {span !== null && <Sub>{span} kun</Sub>}
      </Td>
      <Td>{outage.dbname ? (outage.orgTitle ?? outage.dbname) : <b>Barcha klinikalar</b>}</Td>
      <Td>
        <TruncCell text={outage.reason} />
      </Td>
      <Td>
        {outage.createdByName ?? '—'}
        <Sub>{formatUzDateTime(outage.createdAt)}</Sub>
      </Td>
      <Td>
        <StatusCell outage={outage} />
      </Td>
      <Td>
        {canWrite && outage.status === 'active' && (
          <Btn $size="sm" $variant="danger" onClick={() => onCancel(outage)}>
            Bekor qilish
          </Btn>
        )}
      </Td>
    </Tr>
  );
}

function OutagesTable({
  rows,
  canWrite,
  onCancel,
}: {
  rows: SamsOutage[];
  canWrite: boolean;
  onCancel: (o: SamsOutage) => void;
}) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>Oraliq</Th>
            <Th>Klinika</Th>
            <Th>Sabab</Th>
            <Th>E’lon qildi</Th>
            <Th>Holat</Th>
            <Th>Amal</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <OutageRow key={o.id} outage={o} canWrite={canWrite} onCancel={onCancel} />
          ))}
          {rows.length === 0 && (
            <Tr>
              <Td colSpan={6} style={{ textAlign: 'center', padding: 28 }}>
                <Muted>Uzilish oynalari yo‘q</Muted>
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}

function useClampedPage(
  totalPages: number | undefined,
  page: number,
  setPage: (p: number) => void,
) {
  useEffect(() => {
    if (totalPages === undefined) return;
    const last = Math.max(1, totalPages);
    if (page > last) setPage(last);
  }, [totalPages, page, setPage]);
}

export default function SamsOutages({ canWrite }: Props) {
  const [status, setStatus] = useState<SamsOutageStatusFilter>('active');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<SamsOutage | null>(null);
  const query = useSamsOutages({ page, limit: PAGE_SIZE, status });
  const state = combineState([query]);
  const retry = () => void query.refetch();
  useClampedPage(query.isPlaceholderData ? undefined : query.data?.totalPages, page, setPage);
  const selectStatus = (v: SamsOutageStatusFilter) => {
    setStatus(v);
    setPage(1);
  };

  return (
    <div>
      <FilterBar>
        <Select
          aria-label="Holat"
          value={status}
          style={{ width: 'auto', minWidth: 180 }}
          options={STATUS_OPTIONS}
          onChange={selectStatus}
        />
        {query.data && <Muted>Jami: {query.data.total}</Muted>}
      </FilterBar>
      {!query.data && (
        <QueryNotice state={state === 'ok' ? 'loading' : state} onRetry={retry} compact />
      )}
      {query.data && (
        <>
          <RefreshNotice state={state} updatedAt={query.dataUpdatedAt} onRetry={retry} />
          <OutagesTable rows={query.data.items} canWrite={canWrite} onCancel={setTarget} />
        </>
      )}
      <Pager page={page} totalPages={query.data?.totalPages ?? 1} onPage={setPage} />
      {target && <CancelOutageModal outage={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

const Sub = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 2px;
`;

const Muted = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
