import type { ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Button, Descriptions, Result, Spin, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { achievementApiByKey, degreeApi } from '../../api/achievement-api';
import {
  ACHIEVEMENT_PAGE_PATH,
  ACHIEVEMENT_SLUG_KEY,
  categoryByKey,
  hasAutoAbstract,
} from '../../model/achievement-config';
import { rejecterRoleLabel } from '../../model/rejecter-role';
import type { AchievementCategory, AchievementField } from '../../model/types';
import StatusBadge from '../../components/status-badge';
import CompactButtons from '../../components/compact-buttons';
import FileChip from '../../components/file-chip';

const ICON_BY_KEY: Record<AchievementCategory['icon'], typeof TrophyOutlined> = {
  trophy: TrophyOutlined,
  book: BookOutlined,
  safety: SafetyCertificateOutlined,
  file: FileTextOutlined,
};

export default function AchievementDetailPage() {
  const { t } = useTranslation();
  const { category: categoryParam, id } = useParams<{ category?: string; id: string }>();
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const slug = segments[segments.length - 2] ?? '';
  const category = categoryParam ?? ACHIEVEMENT_SLUG_KEY[slug];

  const listPath = categoryParam
    ? ACHIEVEMENT_PAGE_PATH[categoryParam]
    : `/${segments.slice(0, -1).join('/')}`;
  const goBack = useBackTo(listPath || '/scientific-department/statistics');

  const config = category ? categoryByKey(category) : undefined;
  const api = category ? achievementApiByKey[category] : undefined;

  const { data, isLoading } = (api ?? degreeApi).useOne(config ? id : undefined);

  if (!config || !api) {
    return (
      <PageContainer title={t('scientificDepartment.achievementDetail.title')}>
        <Result
          status="404"
          title={t('scientificDepartment.achievementDetail.notFound')}
          extra={
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={goBack}
            >
              {t('scientificDepartment.back')}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  if (isLoading || !data) {
    return (
      <PageContainer title={t('scientificDepartment.achievementDetail.title')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  const Icon = ICON_BY_KEY[config.icon];

  const tr = (key: string) => t(`scientificDepartment.${key}`);

  const renderValue = (field: AchievementField): ReactNode => {
    const value = data[field.name];
    if (field.kind === 'select') {
      const opt = field.options?.find((o) => o.value === value);
      if (!opt) return '—';
      return field.tag && opt.tagColor ? (
        <Tag color={opt.tagColor} style={{ margin: 0 }}>
          {tr(opt.labelKey)}
        </Tag>
      ) : (
        tr(opt.labelKey)
      );
    }
    if (field.kind === 'date') {
      return value && dayjs(String(value)).isValid()
        ? dayjs(String(value)).format('DD.MM.YYYY')
        : '—';
    }
    return value == null || value === '' ? '—' : String(value);
  };

  const submitted =
    data.submittedDate && dayjs(data.submittedDate).isValid()
      ? dayjs(data.submittedDate).format('DD.MM.YYYY')
      : '—';

  return (
    <CompactButtons>
    <PageContainer title={t('scientificDepartment.achievementDetail.title')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          <Icon style={{ fontSize: 22, color: config.color }} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>{tr(config.labelKey)}</span>
          <StatusBadge
            status={data.status}
            reason={data.rejectionReason}
            rejectedBy={data.rejectedByName}
          />
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
          <Descriptions.Item label={t('scientificDepartment.achievementDetail.author')}>
            {data.authorName || '—'}
          </Descriptions.Item>
          {config.fields.map((field) => (
            <Descriptions.Item key={field.name} label={tr(field.labelKey)}>
              {renderValue(field)}
            </Descriptions.Item>
          ))}
          <Descriptions.Item label={t('scientificDepartment.achievementDetail.faculty')}>
            {data.facultyName || '—'}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.achievementDetail.department')}>
            {data.departmentName || '—'}
          </Descriptions.Item>
          <Descriptions.Item
            label={t('scientificDepartment.achievementDetail.submittedDate')}
          >
            {submitted}
          </Descriptions.Item>
          <Descriptions.Item label={t('scientificDepartment.achievementDetail.uploadedFile')}>
            <FileChip url={data.fileUrl ?? null} />
          </Descriptions.Item>
          {hasAutoAbstract(category) ? (
            <Descriptions.Item label={t('scientificDepartment.ach.f.autoAbstract')}>
              <FileChip url={(data.autoAbstractUrl as string | undefined) ?? null} />
            </Descriptions.Item>
          ) : null}
        </Descriptions>

        {data.status === 'rejected' && data.rejectionReason ? (
          <div
            style={{
              marginTop: 16,
              background: 'color-mix(in srgb, var(--brand-error) 8%, #fff)',
              border: '1px solid color-mix(in srgb, var(--brand-error) 25%, #fff)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
            }}
          >
            <div
              style={{
                color: 'var(--brand-error)',
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {t('scientificDepartment.rejectReason')}:
            </div>
            <div style={{ fontSize: 13 }}>
              {rejecterRoleLabel(data.rejectedByRole, t) ? (
                <strong>{rejecterRoleLabel(data.rejectedByRole, t)}: </strong>
              ) : null}
              {data.rejectionReason}
            </div>
            {data.rejectedByName ? (
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 6 }}>
                {t('scientificDepartment.status.rejectedBy')}: {data.rejectedByName}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
      <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
    </PageContainer>
    </CompactButtons>
  );
}
