import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { JOURNAL_TYPE_COLORS, type JournalType } from '../../model/types';

export default function TypeTag({ type }: { type: JournalType }) {
  const { t } = useTranslation();
  return (
    <Tag color={JOURNAL_TYPE_COLORS[type] ?? 'default'}>
      {t(`scientificDepartment.type.${type}`)}
    </Tag>
  );
}
