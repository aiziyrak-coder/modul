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

const RejectModal = ({ teacherName, onConfirm, loading = false }: IProps) => {
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
          <div className="label">{t('teacher.hr.reject.profileLabel')}</div>
          <div className="value">{teacherName}</div>
        </div>
      </InfoBox>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Typography.Text strong style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14 }}>
          {t('teacher.hr.reject.reasonLabel')} <span style={{ color: 'var(--brand-error)' }}>*</span>
        </Typography.Text>
        <Input.TextArea
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('teacher.hr.reject.reasonPlaceholder')}
          style={{ resize: 'none' }}
          disabled={loading}
        />
      </div>

      <ModalFooter
        danger
        confirmLabel={t('teacher.hr.reject.confirm')}
        loading={loading}
        confirmDisabled={isEmpty}
        onConfirm={() => void handleConfirm()}
      />
    </div>
  );
};

export default RejectModal;
