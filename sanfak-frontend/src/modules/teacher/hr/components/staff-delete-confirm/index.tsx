import { WarningFilled } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { WrapperDelete } from './style';

interface IProps {
  onConfirm: () => void;
  loading?: boolean;
}

const StaffDeleteConfirm = ({ onConfirm, loading = false }: IProps) => {
  const { t } = useTranslation();

  return (
    <WrapperDelete>
      <div className="confirmation">
        <span className="pulse">
          <WarningFilled style={{ color: 'var(--brand-warning)', fontSize: 24 }} />
        </span>
        <div className="title">{t('teacher.hr.staff.delete.title')}</div>
      </div>

      <ModalFooter
        danger
        confirmLabel={t('teacher.hr.staff.delete.confirm')}
        loading={loading}
        onConfirm={onConfirm}
      />
    </WrapperDelete>
  );
};

export default StaffDeleteConfirm;
