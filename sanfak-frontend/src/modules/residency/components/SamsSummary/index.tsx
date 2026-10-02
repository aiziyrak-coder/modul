import type { ReactNode } from 'react';
import styled from 'styled-components';
import StatCard from '../common/StatCard';
import { StatCards } from '../common/FormElements';
import type { SamsOverview, SamsWarningCounts } from '../../api/sams-status-types';
import {
  packetAgeMinutes,
  todayCoverage,
  type DayStateCounts,
  type OutageLayerState,
} from '../../lib/sams-cell-state';
import { formatDayKey, formatUzClock, formatUzDateTime } from '../../lib/uz-day';

interface Props {
  overview: SamsOverview;
  counts: DayStateCounts | null;
  gridFailed: boolean;
  layer: OutageLayerState;
}

const Sub = styled.span<{ $danger?: boolean }>`
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.textMuted)};
`;

function label(main: string, sub?: ReactNode, danger?: boolean) {
  return (
    <>
      {main}
      {sub && <Sub $danger={danger}>{sub}</Sub>}
    </>
  );
}

function packetCard(o: SamsOverview) {
  const at = o.lastPacket?.receivedAt ?? null;
  if (o.liveness === 'never' || !at) {
    return {
      number: '—',
      label: label('Oxirgi paket (SAMS)', 'Hali birorta paket kelmagan', true),
    };
  }
  const age = packetAgeMinutes(o.now, at);
  const ageText = age === null ? formatUzDateTime(at) : `${age} daqiqa oldin`;
  const stale = o.liveness === 'stale';
  return {
    number: formatUzClock(at),
    label: label('Oxirgi paket (SAMS)', stale ? `Paket kelmayapti · ${ageText}` : ageText, stale),
  };
}

function gapText(o: SamsOverview): string | undefined {
  if (!o.gapDays) return undefined;
  const oldest = o.oldestGap ? ` (eng eskisi ${formatDayKey(o.oldestGap)})` : '';
  return `Yetkazilmagan kunlar: ${o.gapDays}${oldest}`;
}

const PERSON_KEYS = ['unresolved', 'ambiguous', 'noSchedule', 'inactiveUser'] as const;

function warningsCard(w: SamsWarningCounts | null) {
  const values = w ? PERSON_KEYS.map((k) => w[k]) : [];
  if (!w || values.every((v) => v === null)) {
    return { number: '—', label: label('Ogohlantirishlar', 'Ma’lumot kelmagan') };
  }
  const total = values.reduce<number>((n, v) => n + (v ?? 0), 0);
  const partial = values.some((v) => v === null);
  const tenant = w.tenantChangedAt
    ? `Klinikalar soni o‘zgargan: ${formatUzDateTime(w.tenantChangedAt)}`
    : undefined;
  return {
    number: partial ? `${total} (to‘liq emas)` : String(total),
    label: label('Ogohlantirishlar (rezidentlar)', tenant),
  };
}

const gridFailedCard = (title: string) => ({
  number: '—',
  label: label(title, 'Jadvalni yuklab bo‘lmadi', true),
});

function unmeasuredCard(o: SamsOverview, counts: DayStateCounts | null, gridFailed: boolean) {
  const title = 'O‘lchanmagan kunlar (oynada)';
  if (!counts && gridFailed) return gridFailedCard(title);
  return { number: counts ? counts.unmeasured : '—', label: label(title, gapText(o)) };
}

const LAYER_REASON: Record<Exclude<OutageLayerState, 'known'>, [string, boolean]> = {
  failed: ['Uzilish oynalarini yuklab bo‘lmadi — tekshirilmagan', true],
  partial: ['Uzilish qatlami to‘liq emas — tekshirilmagan', false],
  loading: ['Uzilish oynalari tekshirilmoqda…', false],
};

function suspectCard(counts: DayStateCounts | null, layer: OutageLayerState, gridFailed: boolean) {
  const title = 'Shubhali kunlar';
  if (!counts && gridFailed) return gridFailedCard(title);
  if (layer !== 'known') {
    const [why, danger] = LAYER_REASON[layer];
    return { number: '—', label: label(title, why, danger) };
  }
  if (!counts || counts.suspect === null)
    return { number: '—', label: label(title, 'Uzilish oynalari tekshirilmoqda…') };
  return {
    number: counts.suspect,
    label: label(title, '0 skan, uzilish e’lon qilinmagan', counts.suspect > 0),
  };
}

export default function SamsSummary({ overview, counts, gridFailed, layer }: Props) {
  const packet = packetCard(overview);
  const coverage = todayCoverage(overview);
  const warnings = warningsCard(overview.warnings);
  const unmeasured = unmeasuredCard(overview, counts, gridFailed);
  const suspect = suspectCard(counts, layer, gridFailed);
  return (
    <StatCards>
      <StatCard number={packet.number} label={packet.label} />
      <StatCard
        number={coverage ? `${coverage.scanned}/${coverage.expected}` : '—'}
        label={label('Bugungi qamrov (skanerlangan / kutilgan)', 'Kun yopilmagan — dastlabki son')}
      />
      <StatCard number={unmeasured.number} label={unmeasured.label} />
      <StatCard number={suspect.number} label={suspect.label} />
      <StatCard number={warnings.number} label={warnings.label} />
    </StatCards>
  );
}
