import { WarningFilled } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { WrapperRestore } from './style';

interface IProps {
  onConfirm: () => void;
  loading?: boolean;
}

const StaffRestoreConfirm = ({ onConfirm, loading = false }: IProps) => {
  const { t } = useTranslation();

  return (
    <WrapperRestore>
      <div className="confirmation">
        <span className="pulse">
          <WarningFilled style={{ color: 'var(--brand-warning)', fontSize: 24 }} />
        </span>
        <div className="title">{t('teacher.hr.staff.restore.title')}</div>
      </div>

      <ModalFooter
        confirmLabel={t('teacher.hr.staff.restore.confirm')}
        loading={loading}
        onConfirm={onConfirm}
      />
    </WrapperRestore>
  );
};

export default StaffRestoreConfirm;
