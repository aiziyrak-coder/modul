import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { CourseStatus } from '../../model/course.types';

interface IProps {
  status: CourseStatus;
}

const META: Record<CourseStatus, { color: string; key: string }> = {
  1: { color: 'blue', key: 'qualification.courses.status.planned' },
  2: { color: 'green', key: 'qualification.courses.status.active' },
  3: { color: 'default', key: 'qualification.courses.status.finished' },
};

export default function CourseStatusTag({ status }: IProps) {
  const { t } = useTranslation();
  const meta = META[status] ?? META[1];
  return <Tag color={meta.color}>{t(meta.key)}</Tag>;
}
