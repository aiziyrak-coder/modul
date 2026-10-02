import type { ReactNode } from 'react';
import { Tag, Tooltip } from '@/shared/ui';
import {
  CLOSE_REASON_LABEL,
  RESIDENT_STATUS_LABEL,
  labelOf,
  type ExpulsionOrder,
} from '../../api/expulsion-order-types';
import { formatDayKey, formatUzDateTime } from '../../lib/uz-day';
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

const hoursText = (h: number | null): string => (h === null ? '—' : `${h} soat`);
const PROGRAM_LABEL: Record<string, string> = {
  magistratura: 'Magistratura',
  ordinatura: 'Ordinatura',
};

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Fact>
      <FactLabel>{label}</FactLabel>
      <FactValue>{children}</FactValue>
    </Fact>
  );
}

function BasisFacts({ order }: { order: ExpulsionOrder }) {
  const r = order.resident;
  return (
    <Panel aria-label="Asos">
      <PanelHead>
        <PanelTitle>Asos</PanelTitle>
      </PanelHead>
      <FactGrid>
        <Item label="Rezident">{order.residentName}</Item>
        {r && <Item label="Dastur">{PROGRAM_LABEL[r.program] ?? r.program}</Item>}
        {r && <Item label="Mutaxassislik">{r.specialtyTitle ?? '—'}</Item>}
        {r && (
          <Item label="Kurs / guruh">
            {r.courseNumber !== null ? `${r.courseNumber}-kurs` : '—'} · {r.groupTitle ?? '—'}
          </Item>
        )}
        <Item label="O‘quv yili">{order.countingYear ?? '—'}</Item>
        <Item label="Loyiha ochilgan">{formatUzDateTime(order.draftedAt)}</Item>
        <Item label="Loyihadagi soat">{hoursText(order.hoursAtDraft)}</Item>
        <Item label="Joriy sababsiz soat">{hoursText(order.residentHours)}</Item>
        <Item label="Rezident holati">{labelOf(RESIDENT_STATUS_LABEL, order.residentStatus)}</Item>
        <Item label="E’lon qilingan">
          {order.noticesSentAt ? formatUzDateTime(order.noticesSentAt) : 'hali e’lon qilinmagan'}
        </Item>
      </FactGrid>
    </Panel>
  );
}

function EriEvidence({ order }: { order: ExpulsionOrder }) {
  if (!order.eriSerialNumber) return null;
  return (
    <Item label="ERI dalili">
      <Tooltip title="Akt — imzolangan qog‘oz va uning skani. ERI yozuvi faqat qo‘shimcha dalil.">
        <Tag color="default">ERI dalili (tekshirilmagan)</Tag>
      </Tooltip>
      {order.eriSerialNumber}
      {order.eriSignedAt ? ` · ${formatUzDateTime(order.eriSignedAt)}` : ''}
    </Item>
  );
}

function SignedFacts({ order }: { order: ExpulsionOrder }) {
  return (
    <>
      <FactGrid>
        <Item label="Buyruq raqami">{order.paperOrderNumber ?? '—'}</Item>
        <Item label="Buyruq sanasi">{formatDayKey(order.paperOrderDate)}</Item>
        <Item label="Imzolangan">{formatUzDateTime(order.signedAt)}</Item>
        <Item label="Imzolagan">{order.signedByName ?? '—'}</Item>
        <Item label="Imzodagi soat">{hoursText(order.hoursAtSign)}</Item>
        <Item label="Rezidentga qo‘llangan">
          {order.residentAppliedAt ? formatUzDateTime(order.residentAppliedAt) : 'hali qo‘llanmagan'}
        </Item>
        <EriEvidence order={order} />
      </FactGrid>
      {order.basisLostAt && (
        <PanelHint $tone="warning">
          Imzodan keyin soat {order.hoursAtBasisLost ?? '—'} ga tushdi (imzoda{' '}
          {order.hoursAtSign ?? '—'}) — holat o‘zgarmadi, qaror bo‘limda.
        </PanelHint>
      )}
    </>
  );
}

function RejectedFacts({ order }: { order: ExpulsionOrder }) {
  return (
    <FactGrid>
      <Item label="Rad etish sababi">{order.closeNote ?? '—'}</Item>
      <Item label="Rad etgan">{order.closedByName ?? '—'}</Item>
      <Item label="Rad etilgan">{formatUzDateTime(order.closedAt)}</Item>
      <Item label="O‘sha paytdagi soat">{hoursText(order.hoursAtClose)}</Item>
    </FactGrid>
  );
}

function CancelledFacts({ order }: { order: ExpulsionOrder }) {
  return (
    <FactGrid>
      <Item label="Sabab">{labelOf(CLOSE_REASON_LABEL, order.closeReason)}</Item>
      <Item label="Bekor qilingan">{formatUzDateTime(order.closedAt)}</Item>
      <Item label="O‘sha paytdagi soat">{hoursText(order.hoursAtClose)}</Item>
    </FactGrid>
  );
}

function DecisionFacts({ order }: { order: ExpulsionOrder }) {
  const body =
    order.status === 'imzolangan' ? <SignedFacts order={order} />
    : order.status === 'rad_etilgan' ? <RejectedFacts order={order} />
    : order.status === 'bekor_qilingan' ? <CancelledFacts order={order} />
    : null;
  if (!body) return null;
  return (
    <Panel aria-label="Qaror">
      <PanelHead>
        <PanelTitle>Qaror</PanelTitle>
      </PanelHead>
      {body}
    </Panel>
  );
}

export default function ExpulsionOrderFacts({ order }: { order: ExpulsionOrder }) {
  return (
    <>
      <BasisFacts order={order} />
      <DecisionFacts order={order} />
    </>
  );
}
