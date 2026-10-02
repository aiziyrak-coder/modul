import { useState } from 'react';
import { Input, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { InfoBox } from './style';

interface IProps {
  teacherName: string;
  onConfirm: (comment: string) => Promise<void>;
  loading?: boolean;
}

const VerifyRejectModal = ({ teacherName, onConfirm, loading = false }: IProps) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');

  const isEmpty = comment.trim().length === 0;

  const handleConfirm = async () => {
    if (isEmpty) return;
    await onConfirm(comment.trim());
  };

  return (
    <div style={{ padding: 'var(--space-4) var(--space-5) var(--space-5)' }}>
      <InfoBox>
        <InfoCircleOutlined className="icon" />
        <div>
          <div className="label">{t('teacher.personalPlan.completedItems.rejectModal.planLabel')}</div>
          <div className="value">{teacherName}</div>
        </div>
      </InfoBox>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14 }}>
          {t('teacher.personalPlan.completedItems.rejectModal.reasonLabel')}{' '}
          <span style={{ color: 'var(--brand-error)' }}>*</span>
        </Typography.Text>
        <Input.TextArea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('teacher.personalPlan.completedItems.rejectModal.reasonPlaceholder')}
          style={{ resize: 'none' }}
          disabled={loading}
        />
      </div>

      <ModalFooter
        danger
        confirmLabel={t('teacher.personalPlan.completedItems.rejectModal.confirm')}
        loading={loading}
        confirmDisabled={isEmpty}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
};

export default VerifyRejectModal;
