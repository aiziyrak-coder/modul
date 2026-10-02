import { DatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import dayjs, { type Dayjs } from 'dayjs';

const { RangePicker: AntRangePicker } = DatePicker;

interface Props extends Omit<RangePickerProps, 'onChange' | 'value'> {
  value?: [string, string] | null;
  onChange?: (range: [string, string] | null) => void;
  format?: string;
  label?: string;
  maxWidth?: string | number;
}

export function RangePicker({
  value,
  onChange,
  format = 'YYYY-MM-DD',
  label,
  maxWidth,
  ...rest
}: Props) {
  const dayjsValue: [Dayjs, Dayjs] | null =
    value?.[0] && value?.[1]
      ? [dayjs(value[0]), dayjs(value[1])]
      : null;

  const handleChange = (
    _: [Dayjs | null, Dayjs | null] | null,
    dateStrings: [string, string],
  ) => {
    if (dateStrings[0] && dateStrings[1]) onChange?.([dateStrings[0], dateStrings[1]]);
    else onChange?.(null);
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
      <AntRangePicker
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
