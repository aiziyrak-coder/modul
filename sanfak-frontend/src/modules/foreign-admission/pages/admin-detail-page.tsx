import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, Flex, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { useTranslation } from '@/shared/lib/i18n';
import { useApplicant } from '../api/foreign-admission-api';
import { REF_ROOTS, useAllLangRecords } from '../api/reference-api';
import { recordName, refName } from '../model/content-lang';
import { StatusTag } from '../components/status-tag';
import { DocumentList } from '../components/document-list';
import { StatusActions } from '../widgets/status-actions';
import { PageBottomGap } from '../components/page-bottom-gap';

const fmt = (d?: string) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const HEADER_BTN_RADIUS = 'var(--radius-md)';

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Flex
      justify="space-between"
      gap={12}
      style={{
        padding: '7px 0',
        borderBottom: '1px dashed var(--color-border, #e3e8ef)',
        fontSize: 13,
      }}
    >
      <span style={{ color: 'var(--color-text-mute, #697586)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </Flex>
  );
}

const CARD_STYLE = { borderRadius: 'var(--radius-lg)' } as const;
const CARD_BODY = { body: { padding: '8px 14px 12px' }, header: { minHeight: 44 } };

export default function AdminDetailPage() {
  const { t, lang } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: app, isLoading } = useApplicant(id);

  const printedRef = useRef(false);
  const shouldPrint = searchParams.get('print') === '1';
  useEffect(() => {
    if (!shouldPrint || !app || printedRef.current) return;
    const timer = setTimeout(() => {
      printedRef.current = true;
      window.print();
    }, 300);
    return () => clearTimeout(timer);
  }, [shouldPrint, app]);
  const countries = useAllLangRecords(REF_ROOTS.countries);

  usePageTitle(app?.applicationNumber ?? t('foreignAdmission.nav.applications'));

  if (isLoading) {
    return (
      <PageContainer title="">
        <Flex justify="center" style={{ padding: 64 }}>
          <Spin size="large" />
        </Flex>
      </PageContainer>
    );
  }

  if (!app) {
    return (
      <PageContainer title="">
        <Empty description={t('foreignAdmission.detail.not_found')} style={{ marginTop: 80 }} />
      </PageContainer>
    );
  }

  const countryRecord = (countries.data ?? []).find(
    (c) => c.titleUz === app.country || c.titleRu === app.country || c.titleEn === app.country,
  );
  const flagUrl = countryRecord?.flagUrl;
  const countryName = countryRecord ? recordName(countryRecord, 'title', lang) : app.country;

  const countryValue = flagUrl ? (
    <Flex align="center" gap={6} justify="flex-end">
      <img
        src={flagUrl}
        alt=""
        style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2 }}
      />
      {countryName}
    </Flex>
  ) : (
    countryName
  );

  return (
    <PageContainer title={app.applicationNumber ?? ''}>
      <style>{`
        @media print {
          aside, header, .fa-no-print { display: none !important; }
          main { overflow: visible !important; height: auto !important; }
          .ant-card { break-inside: avoid; box-shadow: none !important; }
        }
        @media (max-width: 950px) {
          .fa-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Flex justify="space-between" align="center" gap={12} wrap style={{ marginBottom: 8 }}>
        <Flex align="center" gap={8}>
          <Button
            className="fa-no-print"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/foreign-admission/applications')}
            style={{ borderRadius: HEADER_BTN_RADIUS }}
          >
            {t('foreignAdmission.detail.back')}
          </Button>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {t('foreignAdmission.detail.title')} - {app.applicationNumber ?? '—'}
          </Typography.Text>
        </Flex>
        <Button
          className="fa-no-print"
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => window.print()}
          style={{ borderRadius: HEADER_BTN_RADIUS }}
        >
          {t('foreignAdmission.detail.print')}
        </Button>
      </Flex>

      <Flex align="center" gap={10} style={{ marginBottom: 10 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {app.fullName}
        </Typography.Title>
        <StatusTag status={app.status} rejectionReason={app.rejectionReason} />
      </Flex>

      {app.status === 'radEtilgan' && app.rejectionReason ? (
        <Alert
          type="error"
          showIcon
          message={t('foreignAdmission.reject.reason')}
          description={app.rejectionReason}
          style={{ marginBottom: 10 }}
        />
      ) : null}

      <div
        className="fa-detail-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: 10,
          alignItems: 'start',
        }}
      >
        <Flex vertical gap={10}>
          <Card title={t('foreignAdmission.section.profile')} style={CARD_STYLE} styles={CARD_BODY}>
            <InfoRow label={t('foreignAdmission.field.full_name')} value={app.fullName} />
            <InfoRow label={t('foreignAdmission.field.birth_date')} value={fmt(app.birthDate)} />
            <InfoRow label={t('foreignAdmission.field.country')} value={countryValue} />
            <InfoRow label={t('foreignAdmission.field.phone')} value={app.phone ?? '—'} />
            <InfoRow
              label={t('foreignAdmission.field.parent_phone')}
              value={app.parentPhone ?? '—'}
            />
            <InfoRow
              label={t('foreignAdmission.field.passport_number')}
              value={app.passportNumber ?? '—'}
            />
            <InfoRow
              label={t('foreignAdmission.field.passport_expiry')}
              value={
                app.passportExpiry
                  ? `${fmt(app.passportExpiry)} ${t('foreignAdmission.detail.until')}`
                  : '—'
              }
            />
            <InfoRow label={t('foreignAdmission.field.email')} value={app.email ?? '—'} />
            <InfoRow label={t('foreignAdmission.detail.submitted_at')} value={fmt(app.createdAt)} />
          </Card>

          <Card
            title={t('foreignAdmission.section.education')}
            style={CARD_STYLE}
            styles={CARD_BODY}
          >
            <InfoRow
              label={t('foreignAdmission.field.direction')}
              value={refName(app.direction, lang)}
            />
            <InfoRow
              label={t('foreignAdmission.nav.educationForms')}
              value={refName(app.educationForm, lang)}
            />
            <InfoRow
              label={t('foreignAdmission.nav.educationLanguages')}
              value={refName(app.educationLanguage, lang)}
            />
            <InfoRow
              label={t('foreignAdmission.field.academic_year')}
              value={app.academicYear ?? '—'}
            />
            <InfoRow
              label={t('foreignAdmission.seasons.season')}
              value={refName(app.season, lang)}
            />
          </Card>
        </Flex>

        <Card title={t('foreignAdmission.section.documents')} style={CARD_STYLE} styles={CARD_BODY}>
          <DocumentList documents={app.documents} />
        </Card>
      </div>

      <div className="fa-no-print" style={{ marginTop: 12 }}>
        <StatusActions applicant={app} layout="split" />
      </div>

      <PageBottomGap />
    </PageContainer>
  );
}
