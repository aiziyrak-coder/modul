import { useState } from 'react';
import { Input } from 'antd';
import { WarningFilled } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Wrapper } from './style';

interface IProps {
  onConfirm: (comment?: string) => void;
  loading?: boolean;
}

const ApprovePlanConfirm = ({ onConfirm, loading = false }: IProps) => {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');

  return (
    <Wrapper>
      <div className="confirmation">
        <span className="pulse">
          <WarningFilled style={{ color: 'var(--brand-warning)', fontSize: 24 }} />
        </span>
        <div className="title">{t('teacher.personalPlan.approve.title')}</div>
      </div>

      <Input.TextArea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('teacher.personalPlan.approve.commentPlaceholder')}
        disabled={loading}
        style={{ resize: 'none' }}
      />

      <ModalFooter
        confirmLabel={t('teacher.personalPlan.approve.confirm')}
        loading={loading}
        onConfirm={() => onConfirm(comment.trim() || undefined)}
      />
    </Wrapper>
  );
};

export default ApprovePlanConfirm;
