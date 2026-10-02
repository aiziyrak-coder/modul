import { Select } from '@/shared/ui';

export interface ChipOption {
  value: string;
  label: string;
}

interface Props {
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
  loading?: boolean;
  notFoundText?: string;
  disabled?: boolean;
  ariaLabel: string;
}

export default function MultiChipSelect({
  options,
  value,
  onChange,
  emptyHint = 'Barchasi',
  loading = false,
  notFoundText = 'Variant yo‘q',
  disabled = false,
  ariaLabel,
}: Props) {
  return (
    <Select<string[]>
      mode="multiple"
      aria-label={ariaLabel}
      value={value}
      onChange={(next) => onChange(next)}
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      loading={loading}
      notFoundContent={notFoundText}
      disabled={disabled}
      placeholder={emptyHint}
      allowClear
      maxTagCount="responsive"
      style={{ width: '100%' }}
      size="large"
    />
  );
}
