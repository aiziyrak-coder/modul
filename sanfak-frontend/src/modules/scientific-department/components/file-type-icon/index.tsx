import {
  FileExcelOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FilePptOutlined,
  FileWordOutlined,
} from '@ant-design/icons';
import { fileKind, type FileKind } from '../../lib/file-type';

const BY_KIND: Record<FileKind, { Icon: typeof FileOutlined; color: string }> = {
  pdf: { Icon: FilePdfOutlined, color: 'var(--brand-error)' },
  word: { Icon: FileWordOutlined, color: 'var(--brand-info)' },
  excel: { Icon: FileExcelOutlined, color: 'var(--brand-primary)' },
  ppt: { Icon: FilePptOutlined, color: 'var(--brand-warning)' },
  image: { Icon: FileImageOutlined, color: 'var(--brand-warning)' },
  other: { Icon: FileOutlined, color: 'var(--color-text-mute)' },
};

export default function FileTypeIcon({
  name,
  size = 16,
}: {
  name?: string | null;
  size?: number;
}) {
  const { Icon, color } = BY_KIND[fileKind(name)];
  return <Icon style={{ color, fontSize: size }} />;
}
