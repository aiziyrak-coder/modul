import { useState } from 'react';
import { App, DatePicker, Select, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useAcademicYearsRef } from '../../../workload/api/workload-api';
import { useCreateContingentReport } from '../../api/contingent-report-api';
import type { PrefillMeta } from '../../model/types';

const { Text } = Typography;

interface IProps {
  onCreated: (id: string, meta: PrefillMeta) => void;
}

const CreateReportModal = ({ onCreated }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [yearId, setYearId] = useState<string | undefined>(undefined);
  const [asOf, setAsOf] = useState<Dayjs>(dayjs());

  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsRef();
  const create = useCreateContingentReport();

  const handleConfirm = async () => {
    if (!yearId) return;
    try {
      const res = await create.mutateAsync({ academicYearId: yearId, asOfDate: asOf.format('YYYY-MM-DD') });
      message.success(res.message || t('studyLoad.contingentReport.created'));
      hideModal();
      onCreated(res.id, res.meta);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  return (
    <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
      <div>
        <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          {t('studyLoad.contingentReport.form.academicYear')}
        </Text>
        <Select
          style={{ width: '100%' }}
          placeholder={t('studyLoad.contingentReport.form.academicYearPlaceholder')}
          loading={yearsLoading}
          value={yearId}
          onChange={(v: string) => setYearId(v)}
          options={years.map((y) => ({ value: y.id, label: y.title }))}
          showSearch
          optionFilterProp="label"
          aria-label={t('studyLoad.contingentReport.form.academicYear')}
        />
      </div>
      <div>
        <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          {t('studyLoad.contingentReport.form.asOfDate')}
        </Text>
        <DatePicker
          style={{ width: '100%' }}
          value={asOf}
          allowClear={false}
          format="DD.MM.YYYY"
          onChange={(d) => d && setAsOf(d)}
          aria-label={t('studyLoad.contingentReport.form.asOfDate')}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('studyLoad.contingentReport.form.prefillNote')}
        </Text>
      </div>
      <ModalFooter
        confirmLabel={t('studyLoad.contingentReport.form.submit')}
        onConfirm={() => void handleConfirm()}
        loading={create.isPending}
        confirmDisabled={!yearId}
        spacing="form"
      />
    </div>
  );
};

export default CreateReportModal;
