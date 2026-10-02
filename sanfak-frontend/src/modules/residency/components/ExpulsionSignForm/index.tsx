import { useMemo, useState } from 'react';
import type { Dayjs } from 'dayjs';
import { App, DatePicker, Input } from '@/shared/ui';
import { Btn, FormGroup, HelperText, Label } from '../common/FormElements';
import { PanelHint } from '../common/InfoPanel';
import { toSignPayload, type SignPayload } from '../../api/expulsion-order-mapper';
import type { ExpulsionOrder } from '../../api/expulsion-order-types';
import {
  PAPER_NUMBER_MAX,
  signDateBounds,
  validateSignInput,
  type SignInputErrors,
} from '../../lib/sign-input';
import { formatDayKey } from '../../lib/uz-day';

interface Props {
  order: ExpulsionOrder;
  pending: boolean;
  onSubmit: (payload: SignPayload) => Promise<void>;
}

function ConfirmSummary({ order, payload, scanName }: { order: ExpulsionOrder; payload: SignPayload; scanName: string }) {
  return (
    <div>
      <p style={{ margin: '0 0 8px' }}>
        <b>{order.residentName}</b> — chetlatish buyrug‘i imzolanadi.
      </p>
      <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
        <li>Buyruq raqami: {payload.paperOrderNumber}</li>
        <li>Buyruq sanasi: {formatDayKey(payload.paperOrderDate)}</li>
        <li>Skan: {scanName}</li>
      </ul>
      <p style={{ margin: 0, color: '#E74C3C' }}>
        Rezident holati «chetlatilgan» bo‘ladi. Bu amalni qaytarib bo‘lmaydi.
      </p>
    </div>
  );
}

function useSignForm(order: ExpulsionOrder, onSubmit: Props['onSubmit']) {
  const { modal } = App.useApp();
  const [paperOrderNumber, setPaperOrderNumber] = useState('');
  const [paperOrderDate, setPaperOrderDate] = useState('');
  const [errors, setErrors] = useState<SignInputErrors>({});
  const bounds = useMemo(() => signDateBounds(order), [order]);

  const disabledDate = (d: Dayjs): boolean => {
    const key = d.format('YYYY-MM-DD');
    return key > bounds.max || (bounds.min !== null && key < bounds.min);
  };

  const submit = () => {
    const scan = order.scan;
    if (!scan) return;
    const found = validateSignInput({ paperOrderNumber, paperOrderDate }, bounds);
    setErrors(found);
    if (found.paperOrderNumber || found.paperOrderDate) return;
    const payload = toSignPayload(order.id, { paperOrderNumber, paperOrderDate, scanSha256: scan.sha256 });
    modal.confirm({
      title: 'Buyruqni imzolash',
      content: <ConfirmSummary order={order} payload={payload} scanName={scan.fileName} />,
      okText: 'Ha, imzolash',
      okType: 'danger',
      cancelText: 'Bekor qilish',
      onOk: () => onSubmit(payload),
    });
  };

  return {
    paperOrderNumber,
    setPaperOrderNumber,
    paperOrderDate,
    setPaperOrderDate,
    errors,
    disabledDate,
    submit,
  };
}

export default function ExpulsionSignForm({ order, pending, onSubmit }: Props) {
  const { paperOrderNumber, setPaperOrderNumber, paperOrderDate, setPaperOrderDate, errors, disabledDate, submit } =
    useSignForm(order, onSubmit);
  const scan = order.scan;
  if (!scan) return null;

  return (
    <div>
      <FormGroup>
        <Label htmlFor="expulsion-paper-number">Buyruq raqami</Label>
        <Input
          id="expulsion-paper-number"
          value={paperOrderNumber}
          maxLength={PAPER_NUMBER_MAX}
          placeholder="Masalan: 125-Ch"
          status={errors.paperOrderNumber ? 'error' : undefined}
          onChange={(e) => setPaperOrderNumber(e.target.value)}
        />
        {errors.paperOrderNumber && <HelperText $error>{errors.paperOrderNumber}</HelperText>}
      </FormGroup>
      <FormGroup>
        <Label htmlFor="expulsion-paper-date">Buyruq sanasi</Label>
        <DatePicker
          id="expulsion-paper-date"
          value={paperOrderDate || null}
          onChange={(v) => setPaperOrderDate(v ?? '')}
          disabledDate={disabledDate}
          maxWidth={260}
          status={errors.paperOrderDate ? 'error' : undefined}
        />
        {errors.paperOrderDate && <HelperText $error>{errors.paperOrderDate}</HelperText>}
      </FormGroup>
      <PanelHint $tone="muted">Skan: {scan.fileName}</PanelHint>
      <div style={{ marginTop: 14 }}>
        <Btn $variant="danger" disabled={pending} onClick={submit}>
          Imzolash
        </Btn>
      </div>
    </div>
  );
}
