import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { THESIS_TYPE_COLORS, type ThesisType } from '../../model/types';

export default function ThesisTypeTag({ type }: { type: ThesisType }) {
  const { t } = useTranslation();
  return (
    <Tag color={THESIS_TYPE_COLORS[type] ?? 'default'}>
      {t(`scientificDepartment.thesisType.${type}`)}
    </Tag>
  );
}
