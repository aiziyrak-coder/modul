import { Tag } from 'antd';
import FileTypeIcon from '../file-type-icon';
import { fileTagColor } from '../../lib/file-type';

export default function FileChip({ url }: { url: string | null }) {
  if (!url) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;

  return (
    <Tag
      icon={<FileTypeIcon name={url} size={13} />}
      color={fileTagColor(url)}
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--radius-md)',
        padding: '4px 10px',
        margin: 0,
      }}
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    >
      {url.split('?')[0]?.split('/').pop() || url}
    </Tag>
  );
}
