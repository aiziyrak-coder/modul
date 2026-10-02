import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { LESSON_KIND } from '../../model/topic.types';
import type { LessonKind } from '../../model/topic.types';

interface IProps {
  kind: LessonKind;
}

export default function LessonKindTag({ kind }: IProps) {
  const { t } = useTranslation();
  return kind === LESSON_KIND.THEORY ? (
    <Tag color="blue">{t('qualification.curriculum.kind.theory')}</Tag>
  ) : (
    <Tag color="green">{t('qualification.curriculum.kind.practice')}</Tag>
  );
}
