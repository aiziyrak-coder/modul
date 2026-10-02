import { DatePicker as AntDatePicker } from 'antd';
import type { DatePickerProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

interface Props extends Omit<DatePickerProps, 'onChange' | 'value'> {
  value?: string | null;
  onChange?: (value: string | null) => void;
  format?: string;
  label?: string;
  maxWidth?: string | number;
}

export function DatePicker({ value, onChange, format = 'YYYY-MM-DD', label, maxWidth, ...rest }: Props) {
  const dayjsValue = value ? dayjs(value) : null;

  const handleChange = (_: Dayjs | null, dateString: string | string[]) => {
    const str = Array.isArray(dateString) ? dateString[0] : dateString;
    onChange?.(str || null);
  };

  return (
    <div style={{ maxWidth }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: 6,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text, #121926)',
          }}
        >
          {label}
        </label>
      )}
      <AntDatePicker
        value={dayjsValue}
        onChange={handleChange}
        format={format}
        size="large"
        style={{ width: '100%' }}
        {...rest}
      />
    </div>
  );
}
