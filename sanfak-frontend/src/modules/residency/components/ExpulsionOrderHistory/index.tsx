import { useMemo } from 'react';
import { Timeline } from 'antd';
import {
  HISTORY_ACTION_LABEL,
  HISTORY_SOURCE_LABEL,
  labelOf,
  type ExpulsionHistoryItem,
} from '../../api/expulsion-order-types';
import { formatUzDateTime } from '../../lib/uz-day';
import { Panel, PanelHead, PanelHint, PanelTitle } from '../common/InfoPanel';

const ACTION_COLOR: Record<string, string> = {
  imzolandi: 'red',
  rad_etildi: 'blue',
  bekor_qilindi: 'gray',
  asos_72_dan_past: 'orange',
};

function chronological(history: ExpulsionHistoryItem[]): ExpulsionHistoryItem[] {
  return history
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.at ?? '').localeCompare(b.item.at ?? '') || a.index - b.index)
    .map(({ item }) => item);
}

function HistoryEntry({ item }: { item: ExpulsionHistoryItem }) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{labelOf(HISTORY_ACTION_LABEL, item.action)}</div>
      <div style={{ fontSize: 12, color: '#7F8C8D' }}>
        {formatUzDateTime(item.at)} · {labelOf(HISTORY_SOURCE_LABEL, item.source)} ·{' '}
        {item.actorName ?? 'Tizim'}
        {item.hours !== null ? ` · ${item.hours} soat` : ''}
      </div>
      {item.note && <div style={{ fontSize: 12, marginTop: 2 }}>{item.note}</div>}
    </div>
  );
}

export default function ExpulsionOrderHistory({ history }: { history: ExpulsionHistoryItem[] }) {
  const items = useMemo(
    () =>
      chronological(history).map((item, i) => ({
        key: `${item.at ?? 'na'}-${i}`,
        color: ACTION_COLOR[item.action] ?? 'green',
        children: <HistoryEntry item={item} />,
      })),
    [history],
  );

  return (
    <Panel aria-label="Tarix">
      <PanelHead>
        <PanelTitle>Tarix</PanelTitle>
      </PanelHead>
      {items.length ? <Timeline items={items} /> : <PanelHint $tone="muted">Tarix bo‘sh.</PanelHint>}
    </Panel>
  );
}
