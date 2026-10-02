import {
  CalendarOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  FormOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Button, Spin, Tooltip, Typography } from 'antd';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useMyCertificates } from '../../../api/student-certificate-api';
import type { EarnedDocument } from '../../../model/certificate.types';
import { CERT_STATUS } from '../../../model/certificate.types';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

function Badge({
  tone,
  children,
  size = 'sm',
}: {
  tone: 'info' | 'warn' | 'ok' | 'err';
  children: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  const map = {
    info: { bg: 'color-mix(in srgb, var(--brand-info) 12%, #fff)', fg: 'var(--brand-info)' },
    warn: { bg: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', fg: '#a16207' },
    ok: { bg: 'var(--brand-primary-soft)', fg: 'var(--brand-primary)' },
    err: { bg: 'color-mix(in srgb, var(--brand-error) 12%, #fff)', fg: 'var(--brand-error)' },
  }[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'md' ? 6 : 4,
        padding: size === 'md' ? '7px 14px' : '2px 10px',
        borderRadius: 'var(--radius-pill)',
        fontSize: size === 'md' ? 13 : 12,
        fontWeight: 500,
        background: map.bg,
        color: map.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
function Meta({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text-mute)' }}>
      {icon}
      {children}
    </span>
  );
}

export default function StudentCertificatePage() {
  const { t } = useTranslation();
  const { data: docs = [], isLoading } = useMyCertificates();
  const navigate = useNavigate();

  return (
    <PageContainer title={t('qualification.certificate.nav')}>
      {isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      ) : docs.length === 0 ? (
        <Card size="small">
          <Flex vertical align="center" justify="center" gap={12} style={{ padding: '56px 16px' }}>
            <SafetyCertificateOutlined style={{ fontSize: 44, color: 'var(--color-text-mute)' }} />
            <Text type="secondary">{t('qualification.certificate.empty')}</Text>
          </Flex>
        </Card>
      ) : (
        <Card size="small" styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-soft)' }}>
            <Text strong style={{ fontSize: 13 }}>{t('qualification.certificate.title')}</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>({docs.length})</Text>
          </div>
          <div>
            {docs.map((d, i) => (
              <DocumentRow
                key={d.id}
                d={d}
                last={i === docs.length - 1}
                onSurvey={() => navigate(`/survey/${d.courseId}`)}
              />
            ))}
          </div>
        </Card>
      )}
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}

function DocumentRow({
  d,
  last,
  onSurvey,
}: {
  d: EarnedDocument;
  last: boolean;
  onSurvey: () => void;
}) {
  const { t } = useTranslation();
  const isCert = d.kind === 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '14px 16px',
        borderBottom: last ? 'none' : '1px solid var(--color-border-soft)',
      }}
    >
      <span
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 'var(--radius-lg)',
          background: isCert ? 'var(--brand-primary-soft)' : 'color-mix(in srgb, var(--brand-warning) 16%, #fff)',
          color: isCert ? 'var(--brand-primary)' : '#a16207',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}
      >
        {isCert ? <SafetyCertificateOutlined /> : <FileTextOutlined />}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <Flex align="center" gap={8} wrap>
          <Text strong style={{ fontSize: 14 }} ellipsis={{ tooltip: d.courseName }}>
            {d.courseName}
          </Text>
          {isCert ? (
            <Badge tone="ok">{t('qualification.certificate.sertifikat')}</Badge>
          ) : (
            <Badge tone="warn">{t('qualification.certificate.malumotnoma')}</Badge>
          )}
        </Flex>
        <Flex wrap gap={12} align="center" style={{ marginTop: 6 }}>
          {d.courseType ? <Meta>{d.courseType}</Meta> : null}
          {d.form === 1 ? (
            <Badge tone="info">{t('qualification.certificate.online')}</Badge>
          ) : d.form === 2 ? (
            <Badge tone="warn">{t('qualification.certificate.offline')}</Badge>
          ) : null}
          <Meta icon={<ClockCircleOutlined />}>{t('qualification.certificate.hours', { h: d.creditHours })}</Meta>
          <Meta icon={<CalendarOutlined />}>
            {fmtDate(d.startDate)} — {fmtDate(d.endDate)}
          </Meta>
          {d.issuedDate ? (
            <Meta>{t('qualification.certificate.issued', { date: fmtDate(d.issuedDate) })}</Meta>
          ) : null}
        </Flex>
      </div>

      <div style={{ flexShrink: 0 }}>
        {d.certStatus === CERT_STATUS.REJECTED ? (
          <Tooltip
            color="var(--brand-error)"
            title={d.rejectReason || t('qualification.certificate.rejectedHint')}
          >
            <span style={{ cursor: 'help' }}>
              <Badge tone="err" size="md">
                <CloseCircleOutlined />
                {t('qualification.certificate.rejected')}
              </Badge>
            </span>
          </Tooltip>
        ) : d.surveyRequired && !d.surveyDone ? (
          <Tooltip title={t('qualification.certificate.surveyLockHint')}>
            <Button type="primary" icon={<FormOutlined />} onClick={onSurvey}>
              {t('qualification.certificate.surveyAction')}
            </Button>
          </Tooltip>
        ) : d.certStatus === CERT_STATUS.PENDING ? (
          <Tooltip title={t('qualification.certificate.pendingHint')}>
            <span style={{ cursor: 'help' }}>
              <Badge tone="warn" size="md">
                <ClockCircleOutlined />
                {t('qualification.certificate.pending')}
              </Badge>
            </span>
          </Tooltip>
        ) : d.fileUrl ? (
          <Button type="primary" icon={<DownloadOutlined />} href={d.fileUrl} target="_blank">
            {t('qualification.certificate.download')}
          </Button>
        ) : (
          <Tooltip title={t('qualification.certificate.comingSoon')}>
            <span style={{ cursor: 'help' }}>
              <Badge tone="info" size="md">
                <ClockCircleOutlined />
                {t('qualification.certificate.preparing')}
              </Badge>
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
