import { WarningFilled } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { WrapperApprove } from './style';

interface IProps {
  onConfirm: () => void;
  loading?: boolean;
}

const ApproveConfirm = ({ onConfirm, loading = false }: IProps) => {
  const { t } = useTranslation();

  return (
    <WrapperApprove>
      <div className="confirmation">
        <span className="pulse">
          <WarningFilled style={{ color: 'var(--brand-warning)', fontSize: 24 }} />
        </span>
        <div className="title">{t('teacher.hr.approve.title')}</div>
      </div>

      <ModalFooter
        confirmLabel={t('teacher.hr.approve.confirm')}
        loading={loading}
        onConfirm={onConfirm}
      />
    </WrapperApprove>
  );
};

export default ApproveConfirm;
