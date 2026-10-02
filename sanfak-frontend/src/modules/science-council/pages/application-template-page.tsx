import { useCallback } from 'react';
import { Button, Upload, Empty, Popconfirm, Skeleton, App as AntApp } from 'antd';
import type { UploadProps } from 'antd';
import {
  DeleteOutlined, DownloadOutlined, FilePdfOutlined, InfoCircleOutlined, UploadOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useApplicationTemplate,
  useUploadApplicationTemplate,
  useDeleteApplicationTemplate,
} from '../api/science-council-api';
import { apiMessage } from '../lib/api-error';
import { Card, FieldLabel, InfoNote, TemplateBox } from '../components/settings-styles';

export default function ApplicationTemplatePage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();

  const { data: template, isLoading } = useApplicationTemplate();
  const uploadMut = useUploadApplicationTemplate();
  const deleteMut = useDeleteApplicationTemplate();

  const uploadProps: UploadProps = {
    accept: '.pdf',
    maxCount: 1,
    showUploadList: false,
    beforeUpload: (file) => {
      void (async () => {
        try {
          await uploadMut.mutateAsync(file as unknown as File);
          message.success(t('scienceCouncil.settings.templateUploaded'));
        } catch (err) {
          message.error(apiMessage(err, t('scienceCouncil.settings.templateFailed')));
        }
      })();
      return false;
    },
  };

  const handleDelete = useCallback(async () => {
    try {
      await deleteMut.mutateAsync();
      message.success(t('scienceCouncil.settings.deleted'));
    } catch (err) {
      message.error(apiMessage(err, t('scienceCouncil.settings.deleteFailed')));
    }
  }, [deleteMut, message, t]);

  return (
    <PageContainer title={t('scienceCouncil.nav.applicationTemplate')}>
      <InfoNote>
        <InfoCircleOutlined style={{ color: 'var(--brand-primary, #34c18c)', fontSize: 16, marginTop: 2 }} />
        <span>{t('scienceCouncil.settings.templateInfo')}</span>
      </InfoNote>

      <Card>
        <TemplateBox>
          <div>
            <FieldLabel>{t('scienceCouncil.settings.templateField')}</FieldLabel>
            {isLoading ? (
              <Skeleton.Input active size="small" style={{ width: 220 }} />
            ) : template ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FilePdfOutlined style={{ color: 'var(--brand-error, #F04438)', fontSize: 18 }} />
                <span style={{ fontWeight: 600 }}>{template.fileName}</span>
                {template.size !== null && (
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)' }}>
                    {template.size} {template.unit}
                  </span>
                )}
              </div>
            ) : (
              <span style={{ color: 'var(--color-text-tertiary, #667085)' }}>
                {t('scienceCouncil.settings.templateEmpty')}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {template && (
              <>
                <Button
                  icon={<DownloadOutlined />}
                  href={template.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('scienceCouncil.settings.templateDownload')}
                </Button>
                <Popconfirm
                  title={t('scienceCouncil.settings.deleteTemplate')}
                  okText={t('scienceCouncil.doc.deleteOk')}
                  cancelText={t('scienceCouncil.cancel')}
                  okButtonProps={{ danger: true }}
                  onConfirm={handleDelete}
                >
                  <Button danger icon={<DeleteOutlined />} loading={deleteMut.isPending}>
                    {t('scienceCouncil.delete')}
                  </Button>
                </Popconfirm>
              </>
            )}
            <Upload {...uploadProps}>
              <Button type="primary" icon={<UploadOutlined />} loading={uploadMut.isPending}>
                {template
                  ? t('scienceCouncil.settings.templateReplace')
                  : t('scienceCouncil.settings.templateUpload')}
              </Button>
            </Upload>
          </div>
        </TemplateBox>

        {!isLoading && !template && (
          <Empty
            image={<FilePdfOutlined style={{ fontSize: 44, color: 'var(--color-text-quaternary, #D0D5DD)' }} />}
            description={t('scienceCouncil.settings.templateEmptyHint')}
            style={{ padding: '48px 0' }}
          />
        )}
      </Card>
    </PageContainer>
  );
}
