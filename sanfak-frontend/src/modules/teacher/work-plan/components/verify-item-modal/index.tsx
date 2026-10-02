import { LinkOutlined, PaperClipOutlined } from '@ant-design/icons';
import { ModalActions, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { formatCompletedDateLong } from '../../model/completed-item-helper';
import type { CompletedWorkItem } from '../../model/completed-item-types';
import { isSafeLink } from '../../model/safe-link';
import VerifyStatusBadge from '../verify-status-badge';
import { MetaRow, TitleRow, Wrapper } from './style';

interface IProps {
  item: CompletedWorkItem;
  onApprove: () => void;
  onReject: () => void;
}

const VerifyItemModal = ({ item, onApprove, onReject }: IProps) => {
  const { t } = useTranslation();
  const hideModal = useModalStore((s) => s.hideModal);
  const isPending = item.verification.status === 'pending';

  return (
    <Wrapper>
      <TitleRow>
        <div className="label">{t('teacher.personalPlan.table.title')}</div>
        <div className="value">{item.title}</div>
      </TitleRow>

      <MetaRow>
        <div>
          <div className="label">{t('teacher.personalPlan.completedItems.column.fullName')}</div>
          <div className="value">{item.teacherName ?? '—'}</div>
        </div>
        <div>
          <div className="label">{t('teacher.personalPlan.completedItems.column.academicYear')}</div>
          <div className="value">{item.academicYearTitle ?? '—'}</div>
        </div>
        <div>
          <div className="label">{t('teacher.personalPlan.completedItems.column.date')}</div>
          <div className="value">{formatCompletedDateLong(item.completedAt)}</div>
        </div>
        <div>
          <div className="label">{t('teacher.personalPlan.completedItems.column.status')}</div>
          <div className="value">
            <VerifyStatusBadge status={item.verification.status} comment={item.verification.comment} />
          </div>
        </div>
        <div>
          <div className="label">{t('teacher.personalPlan.table.link')}</div>
          <div className="value">
            {isSafeLink(item.link) ? (
              <a href={item.link} target="_blank" rel="noreferrer">
                <LinkOutlined /> {t('teacher.personalPlan.table.linkOpen')}
              </a>
            ) : (
              item.link || '—'
            )}
          </div>
        </div>
        <div>
          <div className="label">{t('teacher.personalPlan.completedItems.column.file')}</div>
          <div className="value">
            {isSafeLink(item.fileUrl) ? (
              <a href={item.fileUrl} target="_blank" rel="noreferrer" download>
                <PaperClipOutlined /> {t('teacher.personalPlan.completedItems.fileDownload')}
              </a>
            ) : (
              item.fileUrl || '—'
            )}
          </div>
        </div>
      </MetaRow>

      {isPending ? (
        <ModalActions
          actions={[
            {
              label: t('teacher.personalPlan.completedItems.reject.action'),
              variant: 'danger',
              onClick: onReject,
            },
            {
              label: t('teacher.personalPlan.completedItems.approve.action'),
              variant: 'primary',
              onClick: onApprove,
            },
          ]}
        />
      ) : (
        <ModalActions
          actions={[{ label: t('teacher.personalPlan.reports.view.close'), onClick: hideModal }]}
        />
      )}
    </Wrapper>
  );
};

export default VerifyItemModal;
