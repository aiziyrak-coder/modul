import { useState } from 'react';
import { Alert, App, Select, Typography } from 'antd';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useAcademicYearsRef } from '../../../workload/api/workload-api';
import { httpStatus, useCreateDeptContingent } from '../../api/department-contingent-api';

const { Text } = Typography;

interface IProps {
  onCreated: (id: string) => void;
}

const CreateContingentModal = ({ onCreated }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [yearId, setYearId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const { data: years = [], isLoading: yearsLoading } = useAcademicYearsRef();
  const create = useCreateDeptContingent();

  const handleConfirm = async () => {
    if (!yearId) return;
    setError(null);
    try {
      const res = await create.mutateAsync(yearId);
      message.success(res.message || t('studyLoad.deptContingent.created'));
      hideModal();
      onCreated(res.id);
    } catch (err) {
      setError(httpStatus(err) === 409 ? t('studyLoad.deptContingent.form.exists') : getApiErrorMessage(err));
    }
  };

  return (
    <div style={{ padding: 'var(--space-5) var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
      <div>
        <Text strong style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          {t('studyLoad.deptContingent.form.academicYear')}
        </Text>
        <Select
          style={{ width: '100%' }}
          placeholder={t('studyLoad.deptContingent.form.academicYearPlaceholder')}
          loading={yearsLoading}
          value={yearId}
          onChange={(v: string) => {
            setYearId(v);
            setError(null);
          }}
          options={years.map((y) => ({ value: y.id, label: y.title }))}
          showSearch
          optionFilterProp="label"
          aria-label={t('studyLoad.deptContingent.form.academicYear')}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('studyLoad.deptContingent.form.note')}
        </Text>
      </div>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <ModalFooter
        confirmLabel={t('studyLoad.deptContingent.form.submit')}
        onConfirm={() => void handleConfirm()}
        loading={create.isPending}
        confirmDisabled={!yearId}
        spacing="form"
      />
    </div>
  );
};

export default CreateContingentModal;
