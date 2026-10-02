import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { App, Button, Descriptions, Divider, Spin, Tag } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, Card, DataTable, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import { useAcceptConference, useConference } from '../../api/conference-api';
import FileUploadGrid from '../../components/file-upload-grid';
import CompactButtons from '../../components/compact-buttons';
import {
  CONF_DOC_SLOTS,
  confAccept,
  type ConfDocSlot,
  type ConferenceType,
  type FileSlotConfig,
  type KafedraStatus,
} from '../../model/types';

interface DocLink {
  key: string;
  label: string;
  url: string;
}

const kafedraDocs = (
  k: KafedraStatus | null | undefined,
  t: (key: string) => string,
): DocLink[] => {
  if (!k) return [];
  if (k.docs.length) {
    return k.docs
      .filter((d) => d.fileUrl)
      .map((d, i) => ({ key: `doc${i}`, label: d.label, url: d.fileUrl }));
  }
  return CONF_DOC_SLOTS.filter((cfg) => k.documents[cfg.slot as ConfDocSlot]).map((cfg) => ({
    key: cfg.slot,
    label: t(`scientificDepartment.${cfg.labelKey}`),
    url: k.documents[cfg.slot as ConfDocSlot] as string,
  }));
};

const TYPE_COLORS: Record<ConferenceType, string> = {
  national: 'green',
  international: 'blue',
};

export default function ConferenceDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const goBack = useBackTo('/scientific-department/conferences');
  const { message } = App.useApp();
  const can = usePermission();

  const canManage = can('conference:create');
  const isKafedra = can('conference:update') && !canManage;

  const { data: c, isLoading } = useConference(id);
  const acceptConference = useAcceptConference();

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [slotFiles, setSlotFiles] = useState<Record<string, File | undefined>>({});

  const acceptedCount = useMemo(
    () => (c?.kafedras ?? []).filter((k) => k.status === 'accepted').length,
    [c],
  );

  const myDocs = useMemo(() => kafedraDocs(c?.myKafedra, t), [c, t]);

  const acceptSlots: FileSlotConfig[] = useMemo(() => {
    const docs = c?.requiredDocs ?? [];
    if (!docs.length) return CONF_DOC_SLOTS;
    return docs.map((d, i) => ({
      slot: `doc${i}`,
      labelKey: '',
      label: d.label,
      accept: confAccept(d.fileType),
      format: confAccept(d.fileType).split(',')[0] ?? '.pdf',
      group: 'main' as const,
    }));
  }, [c]);

  if (isLoading || !c) {
    return (
      <PageContainer title={t('scientificDepartment.conferences.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  const infoItems = c.requiredDocs.length
    ? c.requiredDocs.map((d) => d.label)
    : c.requiredInfo;

  const total = c.kafedras.length;
  const pendingCount = total - acceptedCount;

  const closeAccept = () => {
    setAcceptOpen(false);
    setSlotFiles({});
  };

  const handleAccept = async () => {
    const missing = acceptSlots.some((cfg) => !slotFiles[cfg.slot]);
    if (missing) {
      message.error(t('scientificDepartment.conferences.docsRequired'));
      return;
    }
    try {
      await acceptConference.mutateAsync({ id: c.id, slotFiles });
      message.success(t('scientificDepartment.conferences.accepted'));
      closeAccept();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const clock = (color: string) => <ClockCircleOutlined style={{ color, marginRight: 6 }} />;

  const kafedraColumns: ColumnDef<KafedraStatus, unknown>[] = [
    {
      id: 'department',
      header: t('scientificDepartment.conferences.colKafedra'),
      cell: ({ row }) => row.original.departmentName || '—',
    },
    {
      id: 'status',
      header: t('scientificDepartment.conferences.colStatus'),
      size: 160,
      cell: ({ row }) =>
        row.original.status === 'accepted' ? (
          <Tag color="success">{t('scientificDepartment.conferences.accepted')}</Tag>
        ) : (
          <Tag>{t('scientificDepartment.conferences.notAccepted')}</Tag>
        ),
    },
    {
      id: 'documents',
      header: t('scientificDepartment.conferences.uploadedDocs'),
      cell: ({ row }) => {
        const uploaded = kafedraDocs(row.original, t);
        if (!uploaded.length) {
          return (
            <span style={{ color: 'var(--color-text-mute)', fontSize: 12 }}>
              {t('scientificDepartment.conferences.noDocs')}
            </span>
          );
        }
        return (
          <Flex gap={8} wrap>
            {uploaded.map((d) => {
              const url = d.url;
              return (
                <Tag
                  key={d.key}
                  color="success"
                  icon={<DownloadOutlined />}
                  style={{ cursor: 'pointer', margin: 0 }}
                  onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                >
                  {d.label}
                </Tag>
              );
            })}
          </Flex>
        );
      },
    },
  ];

  return (
    <CompactButtons>
    <PageContainer title={t('scientificDepartment.conferences.detailTitle')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          <Tag color={TYPE_COLORS[c.type]}>
            {t(`scientificDepartment.conferences.type.${c.type}`)}
          </Tag>
          <div style={{ flex: 1 }} />
          {c.status === 'active' ? (
            <Tag color="success">{t('scientificDepartment.conferences.statusActive')}</Tag>
          ) : (
            <Tag>{t('scientificDepartment.conferences.statusClosed')}</Tag>
          )}
        </Flex>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: infoItems.length ? '1fr 1fr' : '1fr',
            gap: 16,
            alignItems: 'start',
          }}
        >
        <Descriptions
          column={1}
          size="small"
          bordered
          styles={{
            label: {
              background: 'var(--color-bg-elevate)',
              fontWeight: 500,
              width: 240,
              color: 'var(--color-text-mute)',
            },
          }}
        >
          <Descriptions.Item label={t('scientificDepartment.conferences.colTitle')}>
            <strong>{c.title}</strong>
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.conferences.colType')}>
            <Tag color={TYPE_COLORS[c.type]}>
              {t(`scientificDepartment.conferences.type.${c.type}`)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.conferences.deadline')}>
            {clock('var(--brand-warning)')}
            {c.deadline || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.conferences.beforeDeadline')}>
            {clock('var(--brand-primary)')}
            {c.beforeDeadline || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.conferences.afterDeadline')}>
            {clock('var(--brand-info)')}
            {c.afterDeadline || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.conferences.colDate')}>
            {c.date || '—'}
          </Descriptions.Item>
        </Descriptions>

        {infoItems.length ? (
          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              height: '100%',
            }}
          >
            <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
              <FileTextOutlined style={{ color: 'var(--brand-primary)' }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {t('scientificDepartment.conferences.requiredInfo')}
              </span>
            </Flex>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.8 }}>
              {infoItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ol>
          </div>
        ) : null}
        </div>

        {isKafedra && c.status === 'active' ? (
          c.acceptedByMe ? (
            <>
              <div style={{ marginTop: 16 }}>
                <Tag icon={<CheckCircleOutlined />} color="success">
                  {t('scientificDepartment.conferences.acceptedTag')}
                </Tag>
              </div>
              {myDocs.length ? (
                <>
                  <Divider style={{ margin: '24px 0 12px', fontSize: 13.5, fontWeight: 600 }}>
                    {t('scientificDepartment.conferences.uploadedDocs')}
                  </Divider>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {myDocs.map((d) => {
                      const url = d.url;
                      return (
                        <div
                          key={d.key}
                          onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '8px 12px',
                            border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, #fff)',
                            background: 'var(--brand-primary-soft)',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                          }}
                        >
                          <FileTextOutlined style={{ color: 'var(--brand-primary)' }} />
                          <span style={{ fontSize: 12.5, flex: 1 }}>{d.label}</span>
                          {c.myKafedra?.acceptedAt ? (
                            <span style={{ fontSize: 11.5, color: 'var(--color-text-mute)' }}>
                              {c.myKafedra.acceptedAt}
                            </span>
                          ) : null}
                          <DownloadOutlined style={{ color: 'var(--color-text-mute)' }} />
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <div
              style={{
                marginTop: 16,
                border: '1px dashed var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
              }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--color-text-soft)', marginBottom: 10 }}>
                {t('scientificDepartment.conferences.acceptCaption')}
              </div>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => setAcceptOpen(true)}
              >
                {t('scientificDepartment.conferences.accept')}
              </Button>
            </div>
          )
        ) : null}
      </Card>

      {canManage ? (
        <Card size="small" style={{ marginTop: 16 }}>
          <Divider style={{ marginTop: 4, marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
            <Flex align="center" gap={8}>
              <TeamOutlined style={{ color: 'var(--color-text-soft)' }} />
              {t('scientificDepartment.conferences.kafedraStatus')}
            </Flex>
          </Divider>
          <Flex gap={8} wrap style={{ marginBottom: 16 }}>
            <Tag color="success">
              {t('scientificDepartment.conferences.summaryAccepted', { n: acceptedCount })}
            </Tag>
            <Tag>{t('scientificDepartment.conferences.summaryPending', { n: pendingCount })}</Tag>
            <Tag color="blue">
              {t('scientificDepartment.conferences.summaryTotal', { n: total })}
            </Tag>
          </Flex>
          <DataTable<KafedraStatus>
            data={c.kafedras}
            columns={kafedraColumns}
            page={1}
          />
        </Card>
      ) : null}

      <Modal centered
        title={t('scientificDepartment.conferences.acceptTitle')}
        open={acceptOpen}
        onCancel={closeAccept}
        onOk={handleAccept}
        okText={t('scientificDepartment.conferences.acceptAndSend')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={acceptConference.isPending}
        width={560}
      >
        <div
          style={{
            background: 'var(--brand-primary-soft)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, #fff)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          <div style={{ color: 'var(--color-text-mute)', fontSize: 12 }}>
            {t('scientificDepartment.conferences.colTitle')}:
          </div>
          <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--brand-primary)' }}>
            {c.title}
          </div>
        </div>
        <FileUploadGrid
          slots={acceptSlots}
          value={slotFiles}
          onChange={(next) => setSlotFiles(next as Record<string, File | undefined>)}
        />
      </Modal>
    </PageContainer>
    </CompactButtons>
  );
}
