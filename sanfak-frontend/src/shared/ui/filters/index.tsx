import type { ReactNode } from 'react';
import { Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import * as S from './styles';

export interface FilterSelect {
  key: string;
  placeholder: string;
  value?: string;
  options: { label: string; value: string }[];
  onChange: (value?: string) => void;
}

export interface FiltersProps {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearch: (value: string) => void;
  selects?: FilterSelect[];
  hideSearch?: boolean;
  extra?: ReactNode;
}

export function Filters({
  searchValue,
  searchPlaceholder = 'search',
  onSearch,
  selects = [],
  hideSearch = false,
  extra,
}: FiltersProps) {
  const { t } = useTranslation();
  return (
    <S.FiltersBar>
      {!hideSearch && (
        <Input
          defaultValue={searchValue}
          prefix={<SearchOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)' }} />}
          placeholder={t(searchPlaceholder)}
          allowClear
          onChange={(e) => onSearch(e.target.value)}
          style={{ maxWidth: 280, height: 38 }}
        />
      )}
      {selects.map((select) => (
        <Select
          key={select.key}
          value={select.value}
          placeholder={t(select.placeholder)}
          options={select.options}
          onChange={(value) => select.onChange(value)}
          allowClear
          style={{ minWidth: 160, height: 38 }}
        />
      ))}
      <S.Spacer />
      {extra}
    </S.FiltersBar>
  );
}
