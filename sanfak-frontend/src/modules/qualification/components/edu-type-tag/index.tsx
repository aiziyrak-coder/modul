import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { EDU_TYPE } from '../../model/student.types';
import type { EduType } from '../../model/student.types';

interface IProps {
  type: EduType;
}

export default function EduTypeTag({ type }: IProps) {
  const { t } = useTranslation();
  return type === EDU_TYPE.GRANT ? (
    <Tag color="blue">{t('qualification.students.edu.grant')}</Tag>
  ) : (
    <Tag color="gold">{t('qualification.students.edu.contract')}</Tag>
  );
}
