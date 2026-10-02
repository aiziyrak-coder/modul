import { useMemo, type ReactNode } from 'react';
import { DeleteOutlined, DownloadOutlined, PaperClipOutlined } from '@ant-design/icons';
import { Alert, Button, Drawer, Flex, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import type { CouncilRole, OfficialDocs, RankApplication } from '../../model/types';
import { useDocSetting } from '../../api/council-api';
import { StatusTag } from '../status-tag';

const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’‘ʻ`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const { Text } = Typography;

const fmt = (d?: string | null) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const RANK_TYPE_LABEL: Record<string, string | undefined> = {
  dotsent: 'Dotsent',
  professor: 'Professor',
};

const rankTypeLabel = (rt?: string | null) => (rt ? (RANK_TYPE_LABEL[rt.toLowerCase()] ?? rt) : '—');

const CATEGORY_LABEL: Record<RankApplication['category'], string> = {
  rank: 'Ilmiy unvon',
  position: 'Lavozim',
};

const OFFICIAL_DOC_FIELDS: { key: keyof OfficialDocs; label: string }[] = [
  { key: 'organizationLetter', label: 'Tashkilot xati' },
  { key: 'guaranteeLetter', label: 'Kafolat xati' },
  { key: 'councilApproval', label: 'Institut ilmiy kengashi tasdiqnomasi' },
];

interface Props {
  open: boolean;
  application: RankApplication | null;
  role: CouncilRole;
  onClose: () => void;
  onAccept?: (application: RankApplication) => void;
  onReturn?: (application: RankApplication) => void;
  onDeleteDoc?: (docName: string) => void;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Flex justify="space-between" align="center" gap={12}>
      <Text type="secondary">{label}</Text>
      <span style={{ textAlign: 'right', color: 'var(--color-text)' }}>{children}</span>
    </Flex>
  );
}

function FileLink({ url }: { url?: string | null }) {
  if (!url) return <Text type="secondary">Fayl yo'q</Text>;
  return (
    <Typography.Link href={url} target="_blank" rel="noreferrer">
      <DownloadOutlined /> Yuklab olish
    </Typography.Link>
  );
}

export function RankDrawer({ open, application, role, onClose, onAccept, onReturn, onDeleteDoc }: Props) {
  const isKotib = role === 'ilmiy_kengash_kotibi';
  const isTeacher = role === 'oqituvchi';
  const canDeleteDoc = Boolean(isTeacher && application?.status === 'new' && onDeleteDoc);

  const docSetting = useDocSetting();
  const sortedDocs = useMemo(() => {
    const docs = application?.submittedDocs ?? [];
    const checklist = application ? (docSetting.data?.categories[application.category] ?? []) : [];
    const pos = new Map(
      [...checklist].sort((a, b) => a.order - b.order).map((d, i) => [normName(d.name), i]),
    );
    const rank = (name: string) => pos.get(normName(name)) ?? Number.MAX_SAFE_INTEGER;
    return [...docs].sort((a, b) => rank(a.name) - rank(b.name));
  }, [application, docSetting.data]);

  const footer =
    application && isKotib && application.status === 'new' && (onAccept || onReturn) ? (
      <Flex justify="flex-end" gap={12}>
        {onReturn && (
          <Button danger onClick={() => onReturn(application)}>
            Izoh bilan qaytarish
          </Button>
        )}
        {onAccept && (
          <Button type="primary" onClick={() => onAccept(application)}>
            Qabul qilish
          </Button>
        )}
      </Flex>
    ) : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title="Unvon arizasi"
      footer={footer}
      destroyOnHidden
    >
      {application && (
        <Flex vertical gap={20}>
          <Flex vertical gap={6}>
            <Text strong style={{ fontSize: 16 }}>
              {application.applicant.fullName || '—'}
            </Text>
            <Flex gap={8} align="center" wrap>
              <Tag style={{ borderRadius: 6, margin: 0 }}>{rankTypeLabel(application.rankType)}</Tag>
              <StatusTag status={application.status} kind="rank" />
            </Flex>
          </Flex>

          <Flex vertical gap={10}>
            <InfoRow label="Kategoriya">{CATEGORY_LABEL[application.category]}</InfoRow>
            <InfoRow label="Kafedra">{application.department?.title ?? '—'}</InfoRow>
            <InfoRow label="Lavozim">{application.applicantPosition ?? '—'}</InfoRow>
            <InfoRow label="Hozirgi unvon">{application.applicantAcademicTitle ?? '—'}</InfoRow>
            <InfoRow label="Telefon">{application.applicantPhone ?? '—'}</InfoRow>
            <InfoRow label="E-mail">{application.applicantEmail ?? '—'}</InfoRow>
            <InfoRow label="Topshirilgan sana">{fmt(application.submittedAt)}</InfoRow>
          </Flex>

          {application.status === 'returned' && application.returnReason && (
            <Alert
              type="error"
              showIcon
              message="Qaytarish sababi"
              description={application.returnReason}
            />
          )}

          <Flex vertical gap={8}>
            <Text strong>Topshirilgan hujjatlar ({application.submittedDocs.length})</Text>
            {application.submittedDocs.length === 0 && (
              <Text type="secondary">Hujjat biriktirilmagan.</Text>
            )}
            {sortedDocs.map((doc) => (
              <Flex
                key={doc.name}
                justify="space-between"
                align="center"
                gap={12}
                style={{
                  border: '1px solid var(--color-border, #e3e8ef)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '8px 12px',
                }}
              >
                <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                  <PaperClipOutlined style={{ color: 'var(--color-text-soft, #697586)' }} />
                  <Text ellipsis={{ tooltip: doc.name }} style={{ maxWidth: 240 }}>
                    {doc.name}
                  </Text>
                </Flex>
                <Flex align="center" gap={8}>
                  <FileLink url={doc.fileUrl} />
                  {canDeleteDoc && (
                    <Tooltip title="Hujjatni o'chirish">
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => onDeleteDoc?.(doc.name)}
                      />
                    </Tooltip>
                  )}
                </Flex>
              </Flex>
            ))}
          </Flex>

          {application.status === 'accepted' && (
            <Flex vertical gap={8}>
              <Text strong>Rasmiy hujjatlar</Text>
              {OFFICIAL_DOC_FIELDS.map(({ key, label }) => (
                <InfoRow key={key} label={label}>
                  <FileLink url={application.officialDocs?.[key]} />
                </InfoRow>
              ))}
            </Flex>
          )}
        </Flex>
      )}
    </Drawer>
  );
}
