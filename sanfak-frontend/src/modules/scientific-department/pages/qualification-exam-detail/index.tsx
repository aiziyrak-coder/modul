import { useParams } from 'react-router-dom';
import { Button, Descriptions, Divider, Spin, Empty, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { useApplicant } from '../../api/qualifying-applicant-api';
import { useAllSpecialties } from '../../api/exam-specialty-api';
import ApplicantStatusTag from '../../components/applicant-status-tag';
import {
  APPLICANT_DOC_SLOTS,
  LEGACY_APPLICANT_DOC_SLOTS,
  type ApplicantDocSlot,
  type LegacyApplicantDocSlot,
} from '../../model/types';
import CompactButtons from '../../components/compact-buttons';
import { FileName, FileRow } from './style';

export default function QualificationExamDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const goBack = useBackTo('/scientific-department/qualification-exam');
  const { data: a, isLoading } = useApplicant(id);
  const { data: allSpecialties = [] } = useAllSpecialties();

  if (isLoading) {
    return (
      <PageContainer title={t('scientificDepartment.exam.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 200 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  if (!a) {
    return (
      <PageContainer title={t('scientificDepartment.exam.detailTitle')}>
        <Empty description={t('scientificDepartment.exam.notFound')} />
      </PageContainer>
    );
  }

  const specName = allSpecialties.find((s) => s.code === a.specialization)?.name || a.specialization;

  const files: Array<{ key: string; label: string; url?: string }> = [
    ...APPLICANT_DOC_SLOTS.map((slot: ApplicantDocSlot) => ({
      key: slot,
      label: t(`scientificDepartment.exam.doc.${slot}`),
      url: a.documents[slot],
    })),
    ...LEGACY_APPLICANT_DOC_SLOTS.filter((slot) => !!a.documents[slot]).map(
      (slot: LegacyApplicantDocSlot) => ({
        key: slot,
        label: t(`scientificDepartment.exam.doc.${slot}`),
        url: a.documents[slot],
      }),
    ),
    ...(a.status === 'passed'
      ? [
          {
            key: 'certificate',
            label: t('scientificDepartment.exam.certificate'),
            url: a.certificateFileUrl || undefined,
          },
        ]
      : []),
  ];

  return (
    <CompactButtons>
      <PageContainer title={t('scientificDepartment.exam.detailTitle')}>
        <Card size="small">
          <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={goBack}
            >
              {t('scientificDepartment.back')}
            </Button>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{a.name}</span>
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
            <Descriptions.Item label={t('scientificDepartment.exam.colName')}>
              <strong>{a.name}</strong>
              {a.source === 'public' ? (
                <Tag
                  color="processing"
                  icon={<GlobalOutlined />}
                  style={{ marginLeft: 8, borderRadius: 6 }}
                >
                  {t('scientificDepartment.exam.fromSite')}
                </Tag>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.exam.colSpecialty')}>
              {specName}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.exam.colCode')}>
              {a.specialization}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.exam.colCourse')}>
              {a.course ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.exam.colUniversity')}>
              {a.university}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.exam.colPhone')}>
              {a.phone}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.exam.colExamDate')}>
              {a.examDate || t('scientificDepartment.exam.notAssigned')}
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.articles.colStatus')}>
              <ApplicantStatusTag status={a.status} reason={a.rejectionReason} />
            </Descriptions.Item>
            <Descriptions.Item label={t('scientificDepartment.articles.colDate')}>
              {a.date || '—'}
            </Descriptions.Item>
          </Descriptions>

          <Divider style={{ margin: '20px 0 12px' }}>
            {t('scientificDepartment.exam.attachedFiles')}
          </Divider>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {files.map((f) => (
              <FileRow
                key={f.key}
                $empty={!f.url}
                onClick={() => f.url && window.open(f.url, '_blank', 'noopener,noreferrer')}
              >
                <FileOutlined style={{ color: 'var(--brand-primary)' }} />
                <FileName>{f.label}</FileName>
                {f.url ? (
                  <DownloadOutlined style={{ color: 'var(--brand-primary)', fontSize: 14 }} />
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>—</span>
                )}
              </FileRow>
            ))}
          </div>
        </Card>
        <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
      </PageContainer>
    </CompactButtons>
  );
}
