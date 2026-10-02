import { Tag } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { DocKind } from '../../model/course-type.types';

interface IProps {
  kind: DocKind;
}

const COLOR: Record<DocKind, string> = {
  sertifikat: 'green',
  malumotnoma: 'blue',
};

export default function DocKindTag({ kind }: IProps) {
  const { t } = useTranslation();
  return <Tag color={COLOR[kind]}>{t(`qualification.docKind.${kind}`)}</Tag>;
}
