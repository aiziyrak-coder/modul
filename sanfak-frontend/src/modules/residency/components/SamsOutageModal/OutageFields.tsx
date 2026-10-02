import type { Dayjs } from 'dayjs';
import { DatePicker, Textarea } from '@/shared/ui';
import { FormGroup, HelperText, Label } from '../common/FormElements';
import type { SamsDay } from '../../api/sams-status-types';
import { OUTAGE_REASON_MAX, validateOutageReason } from '../../lib/sams-outage-draft';

interface ReasonProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function OutageReasonField({ label, value, onChange }: ReasonProps) {
  const error = value ? validateOutageReason(value) : null;
  return (
    <FormGroup>
      <Textarea
        label={label}
        aria-label={label}
        rows={4}
        value={value}
        onChange={onChange}
        status={error ? 'error' : undefined}
      />
      <HelperText $error={Boolean(error)}>
        {error ? `${error} · ` : ''}
        {value.trim().length}/{OUTAGE_REASON_MAX}
      </HelperText>
    </FormGroup>
  );
}

interface DatesProps {
  from: SamsDay;
  to: SamsDay;
  today: SamsDay | null;
  onChange: (patch: { from?: SamsDay; to?: SamsDay }) => void;
}

export function OutageDateFields({ from, to, today, onChange }: DatesProps) {
  const disabledDate = (d: Dayjs): boolean => today !== null && d.format('YYYY-MM-DD') > today;
  return (
    <FormGroup style={{ display: 'flex', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <Label htmlFor="sams-outage-from">Boshlanish</Label>
        <DatePicker
          id="sams-outage-from"
          value={from || null}
          onChange={(v) => onChange({ from: v ?? '' })}
          disabledDate={disabledDate}
        />
      </div>
      <div style={{ flex: 1 }}>
        <Label htmlFor="sams-outage-to">Tugash</Label>
        <DatePicker
          id="sams-outage-to"
          value={to || null}
          onChange={(v) => onChange({ to: v ?? '' })}
          disabledDate={disabledDate}
        />
      </div>
    </FormGroup>
  );
}
