import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { App, Button, Descriptions, Spin, Tag } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, FileZipOutlined } from '@ant-design/icons';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useBackTo } from '../../lib/use-back-to';
import { downloadStartupArchive, useStartup } from '../../api/startup-api';
import FileTypeIcon from '../../components/file-type-icon';
import CompactButtons from '../../components/compact-buttons';
import { STARTUP_FILE_SLOTS, type StartupFileSlot } from '../../model/types';

export default function StartupDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const goBack = useBackTo('/scientific-department/startups');
  const { message } = App.useApp();
  const [zipping, setZipping] = useState(false);

  const { data: s, isLoading } = useStartup(id);

  const handleZip = async () => {
    if (!s) return;
    setZipping(true);
    try {
      await downloadStartupArchive(s.id, s.authorName, s.title);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setZipping(false);
    }
  };

  if (isLoading || !s) {
    return (
      <PageContainer title={t('scientificDepartment.startups.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  const hasAnyFile = STARTUP_FILE_SLOTS.some((cfg) => s.files[cfg.slot as StartupFileSlot]);

  const fileChips = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
      {STARTUP_FILE_SLOTS.map((cfg) => {
        const url = s.files[cfg.slot as StartupFileSlot];
        return (
          <div
            key={cfg.slot}
            onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              cursor: url ? 'pointer' : 'default',
              opacity: url ? 1 : 0.5,
            }}
          >
            <FileTypeIcon name={cfg.format} size={16} />
            <span style={{ fontSize: 12.5, flex: 1 }}>
              {t(`scientificDepartment.${cfg.labelKey}`)}
            </span>
            {url ? <DownloadOutlined style={{ color: 'var(--color-text-mute)' }} /> : null}
          </div>
        );
      })}
    </div>
  );

  return (
    <CompactButtons>
      <PageContainer title={t('scientificDepartment.startups.detailTitle')}>
        <Card size="small">
          <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={goBack}>
              {t('scientificDepartment.back')}
            </Button>
            {s.typeName ? <Tag color="blue">{s.typeName}</Tag> : null}
            <div style={{ flex: 1 }} />
            {hasAnyFile ? (
              <Button icon={<FileZipOutlined />} loading={zipping} onClick={handleZip}>
                {t('scientificDepartment.startups.downloadZip')}
              </Button>
            ) : null}
          </Flex>

          <Descriptions
            column={1}
            size="small"
            bordered
            styles={{
              label: {
                background: 'var(--color-bg-elevate)',
                fontWeight: 500,
                width: 220,
                color: 'var(--color-text-mute)',
              },
            }}
          >
            <Descriptions.Item label={t('scientificDepartment.startups.colTitle')}>
              <strong>{s.title}</strong>
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.startups.colAuthor')}>
              {s.authorName || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.startups.colType')}>
              {s.typeName || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.articles.colFaculty')}>
              {s.facultyName || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.articles.colDepartment')}>
              {s.departmentName || '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.articles.colDate')}>
              {s.date || '—'}
            </Descriptions.Item>
          </Descriptions>

          <div style={{ marginTop: 16, fontWeight: 500, fontSize: 13 }}>
            {t('scientificDepartment.startups.colFiles')}
          </div>
          {fileChips}
        </Card>

        <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
      </PageContainer>
    </CompactButtons>
  );
}
