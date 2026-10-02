import { useState } from 'react';
import { Input, Typography } from 'antd';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';

interface IProps {
  onConfirm: (comment: string) => void;
  loading?: boolean;
}

const RejectPlanModal = ({ onConfirm, loading = false }: IProps) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');

  const isEmpty = comment.trim().length === 0;

  return (
    <div style={{ padding: 'var(--space-4) var(--space-5) var(--space-5)' }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14 }}>
        {t('teacher.personalPlan.reject.reasonLabel')} <span style={{ color: 'var(--brand-error)' }}>*</span>
      </Typography.Text>
      <Input.TextArea
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('teacher.personalPlan.reject.reasonPlaceholder')}
        style={{ resize: 'none' }}
        disabled={loading}
      />

      <ModalFooter
        danger
        confirmLabel={t('teacher.personalPlan.reject.confirm')}
        loading={loading}
        confirmDisabled={isEmpty}
        onConfirm={() => onConfirm(comment.trim())}
      />
    </div>
  );
};

export default RejectPlanModal;
