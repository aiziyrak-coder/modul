import { useState } from 'react';
import { App, Alert, Select, Skeleton, Typography } from 'antd';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useAcademicYearsRef } from '../../../workload/api/workload-api';
import { useApprovedWorkloadCount, useCreateWorkloadSummary } from '../../api/workload-summary-api';

const { Text } = Typography;

interface IProps {
  onCreated: (id: string) => void;
}

const CreateSummaryModal = ({ onCreated }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [yearId, setYearId] = useState<string | undefined>(undefined);

  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsRef();
  const { data: approvedCount, isFetching: countLoading } = useApprovedWorkloadCount(yearId);
  const create = useCreateWorkloadSummary();

  const canCreate = Boolean(yearId) && !countLoading && (approvedCount ?? 0) > 0;

  const handleConfirm = async () => {
    if (!yearId) return;
    try {
      const res = await create.mutateAsync(yearId);
      message.success(res.message || t('studyLoad.summary.created'));
      hideModal();
      onCreated(res.id);
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  return (
    <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
      <div>
        <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          {t('studyLoad.summary.form.academicYear')}
        </Text>
        <Select
          style={{ width: '100%' }}
          placeholder={t('studyLoad.summary.form.academicYearPlaceholder')}
          loading={yearsLoading}
          value={yearId}
          onChange={(v: string) => setYearId(v)}
          options={years.map((y) => ({ value: y.id, label: y.title }))}
          showSearch
          optionFilterProp="label"
          aria-label={t('studyLoad.summary.form.academicYear')}
        />
      </div>

      {yearId ? (
        countLoading ? (
          <Skeleton active paragraph={{ rows: 1 }} title={false} />
        ) : (approvedCount ?? 0) > 0 ? (
          <Alert
            type="info"
            showIcon
            message={t('studyLoad.summary.form.approvedCount', { count: approvedCount ?? 0 })}
            description={t('studyLoad.summary.form.approvedOnlyNote')}
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message={t('studyLoad.summary.form.noApproved')}
            description={t('studyLoad.summary.form.noApprovedHint')}
          />
        )
      ) : null}

      <ModalFooter
        confirmLabel={t('studyLoad.summary.form.submit')}
        onConfirm={() => void handleConfirm()}
        loading={create.isPending}
        confirmDisabled={!canCreate}
        spacing="form"
      />
    </div>
  );
};

export default CreateSummaryModal;
