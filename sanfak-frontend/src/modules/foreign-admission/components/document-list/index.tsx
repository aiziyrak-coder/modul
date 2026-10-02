import { Button, Empty, Flex, Tooltip } from 'antd';
import { DownloadOutlined, EyeOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { ApplicantDocument } from '../../model/types';

function formatSize(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function DocumentList({ documents }: { documents: ApplicantDocument[] }) {
  const { t } = useTranslation();

  if (!documents.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('foreignAdmission.docs.empty')} />;
  }

  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <Flex vertical gap={6}>
      {documents.map((doc, index) => {
        const size = formatSize(doc.fileSize);
        const name = doc.fileName;
        return (
          <Flex
            key={`${doc.fileUrl}-${index}`}
            align="center"
            gap={10}
            style={{
              padding: '8px 10px',
              border: '1px solid var(--color-border, #e3e8ef)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <FilePdfOutlined style={{ fontSize: 22, color: 'var(--brand-error)' }} />

            <Flex vertical style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-mute, #697586)' }}>
                {t(`foreignAdmission.docs.slot.${doc.slot}`)}
              </span>
              {name ? (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={name}
                >
                  {name}
                  {size ? ` · ${size}` : ''}
                </span>
              ) : null}
            </Flex>

            <Tooltip title={t('foreignAdmission.docs.view')}>
              <Button size="small" icon={<EyeOutlined />} onClick={() => open(doc.fileUrl)} />
            </Tooltip>
            <Tooltip title={t('foreignAdmission.docs.download')}>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                href={doc.fileUrl}
                download={name ?? true}
                target="_blank"
              />
            </Tooltip>
          </Flex>
        );
      })}
    </Flex>
  );
}
