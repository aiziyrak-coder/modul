import { Flex, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { RangePicker } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { STATUS_META, STATUS_ORDER } from '../model/status';
import { useApplicantCountries } from '../api/foreign-admission-api';
import { useCountryLocalizer } from '../lib/use-country-localizer';
import type { ForeignStatus } from '../model/types';

const CONTROL_H = 38;

export interface ApplicantFilters {
  search: string;
  country: string | undefined;
  status: ForeignStatus | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
}

interface Props {
  value: ApplicantFilters;
  onChange: (v: ApplicantFilters) => void;
}

export function ApplicantsFilters({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { data: countries, isLoading } = useApplicantCountries();
  const localizeCountry = useCountryLocalizer();

  const statusOptions = STATUS_ORDER.map((key) => ({
    value: key,
    label: t(STATUS_META[key].titleKey),
  }));

  return (
    <Flex gap={12} wrap style={{ marginBottom: 'var(--space-4)' }}>
      <Input
        placeholder={t('foreignAdmission.filters.search_ph')}
        prefix={<SearchOutlined />}
        allowClear
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        style={{ maxWidth: 320, flex: 1, height: CONTROL_H }}
      />
      <Select
        placeholder={t('foreignAdmission.filters.country_ph')}
        allowClear
        loading={isLoading}
        value={value.country}
        onChange={(v) => onChange({ ...value, country: v })}
        showSearch
        optionFilterProp="label"
        options={(countries ?? []).map((c) => ({ value: c, label: localizeCountry(c) }))}
        style={{ minWidth: 200, height: CONTROL_H }}
      />
      <Select
        placeholder={t('foreignAdmission.filters.status_ph')}
        allowClear
        value={value.status}
        onChange={(v) => onChange({ ...value, status: v })}
        options={statusOptions}
        style={{ minWidth: 200, height: CONTROL_H }}
      />
      <RangePicker
        maxWidth={260}
        size="middle"
        placeholder={[
          t('foreignAdmission.filters.rangeFrom'),
          t('foreignAdmission.filters.rangeTo'),
        ]}
        style={{ height: CONTROL_H, width: '100%' }}
        value={value.dateFrom && value.dateTo ? [value.dateFrom, value.dateTo] : null}
        onChange={(r) => onChange({ ...value, dateFrom: r?.[0], dateTo: r?.[1] })}
      />
    </Flex>
  );
}
