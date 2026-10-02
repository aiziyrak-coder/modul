import { useEffect, useState } from 'react';
import { Select, Spin } from '@/shared/ui';

export interface AsyncSelectOption {
  value: string;
  label: string;
}

interface LabeledValue {
  value: string;
  label: string;
}

interface AsyncSelectProps {
  value: string;
  onChange: (value: string, option?: AsyncSelectOption) => void;
  options: AsyncSelectOption[];
  onSearch: (search: string) => void;
  loading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  notFoundText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  knownOption?: AsyncSelectOption | null;
  fallbackLabel?: string;
}

export function AsyncSelect({
  value,
  onChange,
  options,
  onSearch,
  loading = false,
  placeholder = 'Tanlang',
  searchPlaceholder = 'Qidirish uchun yozing...',
  notFoundText = 'Topilmadi',
  disabled = false,
  allowClear = true,
  knownOption = null,
  fallbackLabel,
}: AsyncSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const [labelCache, setLabelCache] = useState<Record<string, string>>({});
  useEffect(() => {
    setLabelCache((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const o of options) {
        if (next[o.value] !== o.label) {
          next[o.value] = o.label;
          changed = true;
        }
      }
      if (knownOption && next[knownOption.value] !== knownOption.label) {
        next[knownOption.value] = knownOption.label;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [options, knownOption]);

  useEffect(() => {
    const t = setTimeout(() => onSearch(query), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const known = knownOption && knownOption.value === value ? knownOption.label : undefined;
  const selectedLabel = value
    ? (options.find((o) => o.value === value)?.label ?? known ?? labelCache[value] ?? fallbackLabel ?? value)
    : '';

  return (
    <Select<LabeledValue | null>
      showSearch
      labelInValue
      filterOption={false}
      value={value ? { value, label: selectedLabel } : null}
      onChange={(picked) => {
        if (!picked) {
          onChange('', undefined);
          return;
        }
        const opt = options.find((o) => o.value === picked.value);
        onChange(picked.value, opt ?? { value: picked.value, label: picked.label });
      }}
      onSearch={setQuery}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      loading={loading}
      disabled={disabled}
      allowClear={allowClear}
      placeholder={open ? searchPlaceholder : placeholder}
      notFoundContent={loading ? <Spin size="small" /> : notFoundText}
      style={{ width: '100%' }}
      size="large"
    />
  );
}
