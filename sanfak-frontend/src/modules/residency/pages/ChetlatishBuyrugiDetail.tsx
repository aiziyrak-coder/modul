import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { AxiosError } from 'axios';
import { App } from '@/shared/ui';
import { MdArrowBack } from '../icons';
import { Btn, PageTitle } from '../components/common/FormElements';
import Badge from '../components/common/Badge';
import QueryNotice from '../components/common/QueryNotice';
import { Panel, PanelActions, PanelHead, PanelHint, PanelTitle } from '../components/common/InfoPanel';
import ExpulsionOrderFacts from '../components/ExpulsionOrderFacts';
import ExpulsionDraftPdfPanel from '../components/ExpulsionDraftPdfPanel';
import ExpulsionScanPanel from '../components/ExpulsionScanPanel';
import ExpulsionSignForm from '../components/ExpulsionSignForm';
import ExpulsionRejectModal from '../components/ExpulsionRejectModal';
import ExpulsionOrderHistory from '../components/ExpulsionOrderHistory';
import {
  useExpulsionOrder,
  useRejectExpulsionOrder,
  useSignExpulsionOrder,
} from '../api/expulsion-order-api';
import { toResumePayload, type SignPayload } from '../api/expulsion-order-mapper';
import {
  ORIGIN_LABEL,
  RESIDENT_STATUS_LABEL,
  STATUS_LABEL,
  STATUS_VARIANT,
  labelOf,
  type ExpulsionOrder,
} from '../api/expulsion-order-types';
import { combineState } from '../lib/query-state';
import { formatDayKey } from '../lib/uz-day';
import { useOrderErrorReporter } from '../lib/use-order-error';
import { listReturnPath } from '../lib/expulsion-list-search';

const LIST_PATH = '/residency/chetlatish-buyruqlari';
const SIGNED_TEXT = 'Buyruq imzolandi — rezident holati «chetlatilgan»';
const RESUMED_TEXT = 'Imzo yakunlandi — rezident holati «chetlatilgan»';

function signBlockedHint(order: ExpulsionOrder): string {
  if (!order.scan) return 'Imzolash uchun avval imzolangan qog‘oz skanini yuklang.';
  if (!order.residentActive) return 'Rezident nofaol — migratsiya yakunlanmagan.';
  return `Rezident holati imzoga mos emas: ${labelOf(RESIDENT_STATUS_LABEL, order.residentStatus)}.`;
}

function ResumeAlert({ order, pending, onResume }: { order: ExpulsionOrder; pending: boolean; onResume: () => void }) {
  return (
    <WarnPanel aria-label="Imzo yakunlanmagan">
      <PanelHead>
        <PanelTitle>Imzo yakunlanmagan — rezident holati hali o‘zgarmagan</PanelTitle>
      </PanelHead>
      <div style={{ fontSize: 13 }}>
        Buyruq imzolangan (№ {order.paperOrderNumber ?? '—'}, {formatDayKey(order.paperOrderDate)}), lekin
        rezidentga qo‘llanmagan.{' '}
        {order.flags.canResume
          ? 'Aynan saqlangan ma’lumot bilan qayta yuborib yakunlang.'
          : 'Imzoni bo‘lim xodimi yakunlashi kerak.'}
      </div>
      {order.flags.canResume && (
        <PanelActions>
          <Btn $variant="danger" disabled={pending} onClick={onResume}>
            Imzoni yakunlash
          </Btn>
        </PanelActions>
      )}
    </WarnPanel>
  );
}

interface DecisionProps {
  order: ExpulsionOrder;
  signPending: boolean;
  rejectPending: boolean;
  onSign: (payload: SignPayload) => Promise<void>;
  onReject: () => void;
}

function DecisionPanel({ order, signPending, rejectPending, onSign, onReject }: DecisionProps) {
  const { flags } = order;
  if (order.status !== 'loyiha' || !(flags.canSign || flags.canUploadScan || flags.canReject)) return null;
  return (
    <Panel aria-label="Qaror qabul qilish">
      <PanelHead>
        <PanelTitle>Qaror: imzolash yoki rad etish</PanelTitle>
      </PanelHead>
      {flags.canSign ? (
        <ExpulsionSignForm order={order} pending={signPending} onSubmit={onSign} />
      ) : (
        <PanelHint $tone="warning">{signBlockedHint(order)}</PanelHint>
      )}
      {flags.canReject && (
        <PanelActions>
          <Btn $variant="outline" disabled={rejectPending || signPending} onClick={onReject}>
            Rad etish
          </Btn>
        </PanelActions>
      )}
    </Panel>
  );
}

function useOrderDecisions(order: ExpulsionOrder) {
  const { message, modal } = App.useApp();
  const report = useOrderErrorReporter();
  const sign = useSignExpulsionOrder();
  const reject = useRejectExpulsionOrder();
  const [rejectOpen, setRejectOpen] = useState(false);

  const submitSign = async (payload: SignPayload, successText: string) => {
    try {
      await sign.mutateAsync({ id: order.id, payload });
      message.success(successText);
    } catch (err) {
      await report(err);
    }
  };

  const startResume = () => {
    const payload = toResumePayload(order);
    if (!payload) {
      message.error('Saqlangan imzo ma’lumoti to‘liq emas — sahifani yangilang.');
      return;
    }
    modal.confirm({
      title: 'Imzoni yakunlash',
      content: `№ ${payload.paperOrderNumber} (${formatDayKey(payload.paperOrderDate)}) buyruq bo‘yicha ${order.residentName} holati «chetlatilgan» bo‘ladi. Bu amalni qaytarib bo‘lmaydi.`,
      okText: 'Ha, yakunlash',
      okType: 'danger',
      cancelText: 'Bekor qilish',
      onOk: () => submitSign(payload, RESUMED_TEXT),
    });
  };

  const submitReject = async (reason: string) => {
    try {
      await reject.mutateAsync({ id: order.id, reason: reason.trim() });
      message.success('Loyiha rad etildi');
      setRejectOpen(false);
    } catch (err) {
      await report(err);
    }
  };

  return { sign, reject, rejectOpen, setRejectOpen, submitSign, startResume, submitReject };
}

function OrderView({ order }: { order: ExpulsionOrder }) {
  const d = useOrderDecisions(order);
  const { flags } = order;
  return (
    <>
      <TitleRow>
        <PageTitle style={{ marginBottom: 0 }}>{order.residentName} — chetlatish buyrug‘i</PageTitle>
        {order.status ? (
          <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        ) : (
          <Badge variant="nofaol">Noma’lum holat</Badge>
        )}
        {order.origin && <Badge variant="nofaol">{ORIGIN_LABEL[order.origin]}</Badge>}
      </TitleRow>
      {flags.needsResume && (
        <ResumeAlert order={order} pending={d.sign.isPending} onResume={d.startResume} />
      )}
      <ExpulsionOrderFacts order={order} />
      <ExpulsionDraftPdfPanel order={order} />
      <ExpulsionScanPanel order={order} />
      <DecisionPanel
        order={order}
        signPending={d.sign.isPending}
        rejectPending={d.reject.isPending}
        onSign={(payload) => d.submitSign(payload, SIGNED_TEXT)}
        onReject={() => d.setRejectOpen(true)}
      />
      <ExpulsionOrderHistory history={order.history} />
      {d.rejectOpen && flags.canReject && (
        <ExpulsionRejectModal
          residentName={order.residentName}
          pending={d.reject.isPending}
          onCancel={() => d.setRejectOpen(false)}
          onSubmit={d.submitReject}
        />
      )}
    </>
  );
}

const isNotFound = (err: unknown): boolean => err instanceof AxiosError && err.response?.status === 404;

export default function ChetlatishBuyrugiDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const orderQ = useExpulsionOrder(id);
  const state = combineState([orderQ]);

  const body = () => {
    if (!id || isNotFound(orderQ.error)) {
      return <NotFound>Buyruq topilmadi yoki rezident o‘chirilgan.</NotFound>;
    }
    if (orderQ.data) return <OrderView order={orderQ.data} />;
    if (state === 'ok') return null;
    return <QueryNotice state={state} onRetry={() => void orderQ.refetch()} />;
  };

  return (
    <div>
      <BackBtn type="button" onClick={() => navigate(listReturnPath(LIST_PATH, location.state))}>
        <MdArrowBack size={16} /> Buyruqlar ro‘yxati
      </BackBtn>
      {body()}
    </div>
  );
}

const WarnPanel = styled(Panel)`
  background: ${({ theme }) => theme.colors.warningLight};
  border-color: ${({ theme }) => theme.colors.warningBorder};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 18px;
`;

const NotFound = styled.div`
  padding: 28px;
  text-align: center;
  font-size: 13px;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.white};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 18px;
  &:hover {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
  }
`;
