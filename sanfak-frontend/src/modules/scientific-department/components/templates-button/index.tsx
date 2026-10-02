import { useState } from 'react';
import { Button, Empty } from 'antd';
import Modal from '../scroll-modal';
import { DownloadOutlined, FileTextOutlined, FileWordOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { useTemplates } from '../../api/template-api';
import type { TemplateCategory } from '../../model/types';

export default function TemplatesButton({ category }: { category: TemplateCategory }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: templates = [], isLoading } = useTemplates(category);

  return (
    <>
      <Button icon={<FileTextOutlined />} onClick={() => setOpen(true)}>
        {t('scientificDepartment.templates.nav')}
      </Button>
      <Modal centered
        title={t('scientificDepartment.templates.nav')}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={580}
        loading={isLoading}
      >
        {templates.length === 0 ? (
          <Empty description={t('scientificDepartment.templates.empty')} />
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 4px',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <FileWordOutlined style={{ color: 'var(--brand-info)', fontSize: 26 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{tpl.name}</div>
                {tpl.description ? (
                  <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
                    {tpl.description}
                  </div>
                ) : null}
                <div style={{ fontSize: 11.5, color: 'var(--color-text-mute)', marginTop: 2 }}>
                  {[tpl.fileName, tpl.fileSize].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Button
                type="primary"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => window.open(tpl.fileUrl, '_blank', 'noopener,noreferrer')}
              >
                {t('scientificDepartment.templates.download')}
              </Button>
            </div>
          ))
        )}
      </Modal>
    </>
  );
}
