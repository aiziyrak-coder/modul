import { WarningFilled } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Wrapper } from './style';

interface IProps {
  onConfirm: () => void;
  loading?: boolean;
}

const VerifyConfirm = ({ onConfirm, loading = false }: IProps) => {
  const { t } = useTranslation();

  return (
    <Wrapper>
      <div className="confirmation">
        <span className="pulse">
          <WarningFilled style={{ color: 'var(--brand-warning)', fontSize: 24 }} />
        </span>
        <div className="title">{t('teacher.personalPlan.completedItems.confirm.title')}</div>
      </div>

      <ModalFooter
        confirmLabel={t('teacher.personalPlan.completedItems.confirm.confirm')}
        loading={loading}
        onConfirm={onConfirm}
      />
    </Wrapper>
  );
};

export default VerifyConfirm;
