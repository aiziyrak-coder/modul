import { useState } from 'react';
import { Input, InputNumber, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { ActivitySection } from '../../model/types';
import { isValidOptionalLink } from '../../model/safe-link';
import { Wrapper } from './style';

interface IProps {
  section: ActivitySection;
  plannedCount?: number;
  onConfirm: (fileUrl?: string, link?: string, actualCount?: number) => void;
  loading?: boolean;
}

const CompleteActivityModal = ({
  section,
  plannedCount = 0,
  onConfirm,
  loading = false,
}: IProps) => {
  const { t } = useTranslation();
  const [fileUrl, setFileUrl] = useState('');
  const [link, setLink] = useState('');
  const [actualCount, setActualCount] = useState<number | null>(plannedCount);
  const showLink = section === 'researchWork';
  const fileUrlError = !isValidOptionalLink(fileUrl);
  const linkError = showLink && !isValidOptionalLink(link);

  return (
    <Wrapper>
      <div className="confirmation">
        <span className="pulse">
          <CheckCircleFilled style={{ color: 'var(--brand-success, #37CB94)', fontSize: 24 }} />
        </span>
        <div className="title">{t('teacher.personalPlan.complete.title')}</div>
      </div>

      <Typography.Text strong style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14 }}>
        {t('teacher.personalPlan.complete.fileUrlLabel')}
      </Typography.Text>
      <Input
        value={fileUrl}
        onChange={(e) => setFileUrl(e.target.value)}
        placeholder={t('teacher.personalPlan.complete.fileUrlPlaceholder')}
        disabled={loading}
        status={fileUrlError ? 'error' : undefined}
        style={{ marginBottom: showLink || fileUrlError ? 'var(--space-3)' : 0 }}
      />
      {fileUrlError ? (
        <Typography.Text type="danger" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
          {t('teacher.personalPlan.link.invalid')}
        </Typography.Text>
      ) : null}

      {showLink ? (
        <>
          <Typography.Text strong style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14 }}>
            {t('teacher.personalPlan.complete.linkLabel')}
          </Typography.Text>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={t('teacher.personalPlan.complete.linkPlaceholder')}
            disabled={loading}
            status={linkError ? 'error' : undefined}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          {linkError ? (
            <Typography.Text type="danger" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
              {t('teacher.personalPlan.link.invalid')}
            </Typography.Text>
          ) : null}
        </>
      ) : null}

      <Typography.Text strong style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: 14 }}>
        {t('teacher.personalPlan.complete.actualCountLabel')}
      </Typography.Text>
      <InputNumber
        value={actualCount}
        onChange={setActualCount}
        min={0}
        disabled={loading}
        style={{ width: '100%' }}
        placeholder={t('teacher.personalPlan.complete.actualCountPlaceholder')}
      />

      <ModalFooter
        confirmLabel={t('teacher.personalPlan.complete.confirm')}
        loading={loading}
        onConfirm={() => {
          if (fileUrlError || linkError) return;
          onConfirm(fileUrl.trim() || undefined, link.trim() || undefined, actualCount ?? undefined);
        }}
      />
    </Wrapper>
  );
};

export default CompleteActivityModal;
