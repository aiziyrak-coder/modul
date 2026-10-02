import { useMemo, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { Alert, App, RangePicker } from '@/shared/ui';
import { usePermission } from '@/app/session';
import { Btn, FilterBar, PageTitle, Tab, Tabs } from '../components/common/FormElements';
import QueryNotice from '../components/common/QueryNotice';
import RefreshNotice from '../components/common/RefreshNotice';
import SamsSummary from '../components/SamsSummary';
import SamsStatusGrid, { type SamsDeclareTarget } from '../components/SamsStatusGrid';
import SamsWarnings from '../components/SamsWarnings';
import SamsOutages from '../components/SamsOutages';
import SamsOutageModal, { type SamsClinicOption } from '../components/SamsOutageModal';
import {
  useSamsGrid,
  useSamsOutages,
  useSamsOverview,
  type SamsWindow,
} from '../api/sams-status-api';
import { withOverviewPackets } from '../api/sams-status-mapper';
import type { SamsDay, SamsGrid, SamsOutageDraft, SamsOverview } from '../api/sams-status-types';
import { combineState } from '../lib/query-state';
import {
  countDayStates,
  defaultGridWindow,
  outageLayerState,
  validateGridWindow,
} from '../lib/sams-cell-state';
import { formatUzDateTime, uzToday } from '../lib/uz-day';

const SAMS_WRITE = 'residencyLesson:update';
const OVERLAY_LIMIT = 100;

type TabKey = 'grid' | 'warnings' | 'outages';

function StaleBanner({ overview }: { overview: SamsOverview }) {
  if (overview.liveness === 'never') {
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="SAMS’dan hali birorta paket kelmagan — barcha kunlar «o‘lchanmagan», hech kim «kelmadi» deb belgilanmaydi."
      />
    );
  }
  if (overview.liveness !== 'stale') return null;
  return (
    <Alert
      type="error"
      showIcon
      style={{ marginBottom: 16 }}
      message={`SAMS’dan paket kelmayapti (oxirgi: ${formatUzDateTime(overview.lastPacket?.receivedAt)})`}
      description="Bu vaqt «o‘lchanmagan» hisoblanadi — hech kim «kelmadi» deb belgilanmaydi."
    />
  );
}

function useGridWindow(today: SamsDay) {
  const { message } = App.useApp();
  const [custom, setCustom] = useState<SamsWindow | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const range = useMemo(() => custom ?? defaultGridWindow(today), [custom, today]);
  const apply = (next: [string, string] | null) => {
    if (!next) {
      setCustom(null);
      return;
    }
    const error = validateGridWindow(next[0], next[1]);
    if (error) {
      message.warning(error);
      setPickerKey((k) => k + 1);
      return;
    }
    setCustom({ from: next[0], to: next[1] });
  };
  return { range, pickerKey, isDefault: custom === null, apply, reset: () => setCustom(null) };
}

function useGridData(today: SamsDay, overview: SamsOverview) {
  const win = useGridWindow(today);
  const gridQ = useSamsGrid(win.range);
  const overlayQ = useSamsOutages(
    { page: 1, limit: OVERLAY_LIMIT, status: 'active', from: win.range.from, to: win.range.to },
    { poll: true },
  );
  const outages = overlayQ.isSuccess && !overlayQ.isPlaceholderData ? overlayQ.data.items : null;
  const outagesComplete = overlayQ.data?.hasNextPage !== true;
  const layer = outageLayerState(overlayQ.isError, outages, outagesComplete);
  const own = gridQ.isPlaceholderData ? undefined : gridQ.data;
  const grid = useMemo(
    () => (own ? withOverviewPackets(own, overview.clinics) : undefined),
    [own, overview.clinics],
  );
  const counts = useMemo(
    () => (grid ? countDayStates(grid, outages, today, outagesComplete) : null),
    [grid, outages, today, outagesComplete],
  );
  const gridFailed = !grid && gridQ.isError;
  return { win, gridQ, overlayQ, outages, outagesComplete, layer, grid, gridFailed, counts };
}

type GridData = ReturnType<typeof useGridData>;

function clinicOptions(overview: SamsOverview, grid: SamsGrid | undefined): SamsClinicOption[] {
  const map = new Map<string, string>();
  overview.clinics.forEach((c) => map.set(c.dbname, c.orgTitle));
  grid?.clinics.forEach((c) => map.set(c.dbname, c.orgTitle));
  return [...map.entries()]
    .map(([dbname, orgTitle]) => ({ dbname, orgTitle }))
    .sort((a, b) => a.orgTitle.localeCompare(b.orgTitle, 'uz'));
}

function warningTabCount(overview: SamsOverview): string {
  const w = overview.warnings;
  const values = w ? [w.unresolved, w.ambiguous, w.noSchedule, w.inactiveUser] : [];
  if (values.every((v) => v === null)) return '?';
  const total = values.reduce<number>((n, v) => n + (v ?? 0), 0);
  return values.some((v) => v === null) ? `${total}+?` : String(total);
}

function activeCount(q: { data?: { total: number }; isError: boolean }): string {
  if (q.data) return String(q.data.total);
  return q.isError ? '?' : '…';
}

function useTabLabels(overview: SamsOverview): Record<TabKey, string> {
  const activeQ = useSamsOutages({ page: 1, limit: 1, status: 'active' });
  return {
    grid: 'Klinikalar × kun',
    warnings: `Ogohlantirishlar (${warningTabCount(overview)})`,
    outages: `Uzilish oynalari (${activeCount(activeQ)} faol)`,
  };
}

function PageTabs({
  value,
  onChange,
  labels,
}: {
  value: TabKey;
  onChange: (t: TabKey) => void;
  labels: Record<TabKey, string>;
}) {
  const keys: TabKey[] = ['grid', 'warnings', 'outages'];
  return (
    <Tabs role="tablist" style={{ flexWrap: 'wrap' }}>
      {keys.map((key) => (
        <Tab
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          $active={value === key}
          onClick={() => onChange(key)}
        >
          {labels[key]}
        </Tab>
      ))}
    </Tabs>
  );
}

function GridWindowBar({ data, today }: { data: GridData; today: SamsDay }) {
  const { win, overlayQ } = data;
  return (
    <FilterBar>
      <RangePicker
        key={win.pickerKey}
        aria-label="Jadval oynasi"
        value={[win.range.from, win.range.to]}
        onChange={win.apply}
        allowClear={false}
        disabledDate={(d) => d.format('YYYY-MM-DD') > today}
        maxWidth={300}
      />
      {!win.isDefault && (
        <Btn $size="sm" $variant="ghost" onClick={win.reset}>
          Oxirgi 14 kun
        </Btn>
      )}
      {overlayQ.isError && (
        <Hint $danger>
          Uzilish oynalarini yuklab bo‘lmadi — «0 skan» kunlari tekshirilmagan (qizil emas),
          kataklar bosilmaydi.
        </Hint>
      )}
      {overlayQ.data?.hasNextPage && (
        <Hint>
          Uzilish qatlami to‘liq emas (oynada {OVERLAY_LIMIT} tadan ko‘p) — qoplanmagan «0 skan»
          kunlari tekshirilmagan, kataklar bosilmaydi.
        </Hint>
      )}
    </FilterBar>
  );
}

function GridTab({
  data,
  today,
  canWrite,
  onDeclare,
}: {
  data: GridData;
  today: SamsDay;
  canWrite: boolean;
  onDeclare: (target: SamsDeclareTarget) => void;
}) {
  const { gridQ, outages, outagesComplete, grid } = data;
  const state = combineState([gridQ]);
  const retry = () => void gridQ.refetch();
  return (
    <>
      <GridWindowBar data={data} today={today} />
      {!grid && <QueryNotice state={state === 'ok' ? 'loading' : state} onRetry={retry} compact />}
      {grid && (
        <>
          <RefreshNotice state={state} updatedAt={gridQ.dataUpdatedAt} onRetry={retry} />
          <SamsStatusGrid
            grid={grid}
            today={today}
            outages={outages}
            outagesComplete={outagesComplete}
            canWrite={canWrite}
            onDeclare={onDeclare}
          />
        </>
      )}
    </>
  );
}

interface ViewProps {
  overview: SamsOverview;
  canWrite: boolean;
  refresh: ReactNode;
}

function SamsHolatiView({ overview, canWrite, refresh }: ViewProps) {
  const today = overview.today ?? uzToday();
  const [tab, setTab] = useState<TabKey>('grid');
  const [draft, setDraft] = useState<SamsOutageDraft | null>(null);
  const data = useGridData(today, overview);
  const labels = useTabLabels(overview);
  const clinics = useMemo(() => clinicOptions(overview, data.grid), [overview, data.grid]);

  return (
    <div>
      <Head>
        <PageTitle style={{ marginBottom: 0 }}>SAMS holati</PageTitle>
        {canWrite && (
          <Btn
            $variant="primary"
            onClick={() => setDraft({ from: '', to: '', dbname: '', reason: '' })}
          >
            + Uzilish oynasi
          </Btn>
        )}
      </Head>
      {refresh}
      <StaleBanner overview={overview} />
      <SamsSummary
        overview={overview}
        counts={data.counts}
        gridFailed={data.gridFailed}
        layer={data.layer}
      />
      <PageTabs value={tab} onChange={setTab} labels={labels} />
      {tab === 'grid' && (
        <GridTab
          data={data}
          today={today}
          canWrite={canWrite}
          onDeclare={({ dbname, day }) => setDraft({ from: day, to: day, dbname, reason: '' })}
        />
      )}
      {tab === 'warnings' && <SamsWarnings />}
      {tab === 'outages' && <SamsOutages canWrite={canWrite} />}
      {draft && (
        <SamsOutageModal
          draft={draft}
          clinics={clinics}
          today={overview.today}
          onClose={() => setDraft(null)}
        />
      )}
    </div>
  );
}

export default function SamsHolati() {
  const can = usePermission();
  const canWrite = can(SAMS_WRITE);
  const overviewQ = useSamsOverview();
  const state = combineState([overviewQ]);
  const retry = () => void overviewQ.refetch();

  if (!overviewQ.data) {
    return (
      <div>
        <PageTitle>SAMS holati</PageTitle>
        <QueryNotice state={state === 'ok' ? 'loading' : state} onRetry={retry} />
      </div>
    );
  }
  return (
    <SamsHolatiView
      overview={overviewQ.data}
      canWrite={canWrite}
      refresh={<RefreshNotice state={state} updatedAt={overviewQ.dataUpdatedAt} onRetry={retry} />}
    />
  );
}

const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const Hint = styled.span<{ $danger?: boolean }>`
  font-size: 12px;
  color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.textMuted)};
`;
