import { useParams } from 'react-router-dom';
import { Alert, App, Button, Spin, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  BookOutlined,
  GlobalOutlined,
  LinkOutlined,
  RiseOutlined,
  SyncOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useBackTo } from '../../lib/use-back-to';
import { useHIndexProfile, useRefreshScopus } from '../../api/hindex-api';
import { getApiErrorMessage } from '@/shared/api';
import CompactButtons from '../../components/compact-buttons';

export default function HIndexDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const goBack = useBackTo('/scientific-department/hindex');
  const { message } = App.useApp();
  const { data: profile, isLoading } = useHIndexProfile(id);
  const refreshScopus = useRefreshScopus();

  const handleRefresh = async () => {
    if (!id) return;
    try {
      await refreshScopus.mutateAsync(id);
      message.success(t('scientificDepartment.hindex.refreshed'));
    } catch (err) {
      message.error(getApiErrorMessage(err));
    }
  };

  if (isLoading || !profile) {
    return (
      <PageContainer title={t('scientificDepartment.hindex.detailTitle')}>
        <Flex align="center" justify="center" style={{ minHeight: 240 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  const lastSynced =
    [profile.scopusSyncedDate, profile.scholarSyncedDate].filter(Boolean).sort().pop() ||
    profile.updatedDate;

  const syncErrors = [
    profile.scopusSyncError ? `Scopus: ${profile.scopusSyncError}` : '',
    profile.scholarSyncError ? `Google Scholar: ${profile.scholarSyncError}` : '',
  ].filter(Boolean);

  const bestH = Math.max(profile.scopusHIndex, profile.scholarHIndex);
  const totalCitations = profile.scopusCitations + profile.scholarCitations;
  const connectedCount = (profile.scopusUrl ? 1 : 0) + (profile.scholarUrl ? 1 : 0);

  return (
    <CompactButtons>
    <PageContainer title={t('scientificDepartment.hindex.detailTitle')}>
      <Card size="small">
        <Flex align="center" gap={12} wrap style={{ marginBottom: 20 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={goBack}
          >
            {t('scientificDepartment.back')}
          </Button>
          <Flex align="center" gap={10}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--brand-primary-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserOutlined style={{ fontSize: 18, color: 'var(--brand-primary)' }} />
            </div>
            <div style={{ lineHeight: 1.4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
                {profile.teacherName || '—'}
              </div>
              {profile.facultyName || profile.departmentName ? (
                <div style={{ fontSize: 12.5, color: 'var(--color-text-mute)' }}>
                  {[profile.facultyName, profile.departmentName].filter(Boolean).join(' · ')}
                </div>
              ) : null}
            </div>
          </Flex>
          <div style={{ flex: 1 }} />
          {lastSynced ? (
            <Tag icon={<SyncOutlined />} color="default">
              {t('scientificDepartment.hindex.lastUpdate')}: {lastSynced}
            </Tag>
          ) : null}
          {profile.scopusUrl || profile.scholarUrl ? (
            <Button
              icon={<SyncOutlined />}
              loading={refreshScopus.isPending}
              onClick={handleRefresh}
            >
              {t('scientificDepartment.hindex.refreshMetrics')}
            </Button>
          ) : null}
        </Flex>

        {syncErrors.length ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={t('scientificDepartment.hindex.syncFailed')}
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {syncErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            }
          />
        ) : null}

        <Flex gap={16} wrap style={{ marginBottom: 20 }}>
          <StatCard
            icon={<TrophyOutlined />}
            color="var(--brand-primary)"
            label={t('scientificDepartment.hindex.bestHIndex')}
            value={bestH}
          />
          <StatCard
            icon={<RiseOutlined />}
            color="#2563eb"
            label={t('scientificDepartment.hindex.totalCitations')}
            value={totalCitations}
          />
          <StatCard
            icon={<LinkOutlined />}
            color="#7c3aed"
            label={t('scientificDepartment.hindex.connectedProfiles')}
            value={`${connectedCount}/2`}
          />
        </Flex>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          <PlatformBlock
            t={t}
            name="Scopus"
            icon={<GlobalOutlined />}
            bg="#eff6ff"
            border="#bfdbfe"
            accent="#2563eb"
            url={profile.scopusUrl}
            hIndex={profile.scopusHIndex}
            citations={profile.scopusCitations}
            documents={profile.scopusDocuments}
          />
          <PlatformBlock
            t={t}
            name="Google Scholar"
            icon={<BookOutlined />}
            bg="var(--brand-primary-soft)"
            border="color-mix(in srgb, var(--brand-primary) 30%, #fff)"
            accent="var(--brand-primary)"
            url={profile.scholarUrl}
            hIndex={profile.scholarHIndex}
            citations={profile.scholarCitations}
            i10Index={profile.scholarI10Index}
          />
        </div>
      </Card>
      <div aria-hidden style={{ flexShrink: 0, height: 'var(--space-6)' }} />
    </PageContainer>
    </CompactButtons>
  );
}

function StatCard({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number | string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 200,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-md)',
          background: `color-mix(in srgb, ${color} 14%, #fff)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color,
        }}
      >
        {icon}
      </div>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)' }}>
          {value}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-text-mute)' }}>{label}</div>
      </div>
    </div>
  );
}

function PlatformBlock({
  t,
  name,
  icon,
  bg,
  border,
  accent,
  url,
  hIndex,
  citations,
  documents,
  i10Index,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  name: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
  accent: string;
  url: string;
  hIndex: number;
  citations: number;
  documents?: number;
  i10Index?: number;
}) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-lg)',
        padding: 20,
      }}
    >
      <Flex align="center" gap={10} style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 20, color: accent }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
          {name}
        </span>
      </Flex>

      {url ? (
        <>
          <Flex gap={24} style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 700, color: accent }}>{hIndex}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
                h-index
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-text)' }}>
                {citations}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
                {t('scientificDepartment.hindex.citations')}
              </div>
            </div>
            {documents !== undefined ? (
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-text)' }}>
                  {documents}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
                  {t('scientificDepartment.hindex.documents')}
                </div>
              </div>
            ) : null}
            {i10Index !== undefined ? (
              <div>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-text)' }}>
                  {i10Index}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>i10-index</div>
              </div>
            ) : null}
          </Flex>
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              fontSize: 12,
              wordBreak: 'break-all',
              marginBottom: 12,
              color: 'var(--color-text-soft)',
            }}
          >
            {url}
          </div>
          <Button
            type="primary"
            icon={<LinkOutlined />}
            block
            style={{ background: accent, borderColor: accent }}
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            {name === 'Scopus'
              ? t('scientificDepartment.hindex.openScopus')
              : t('scientificDepartment.hindex.openScholar')}
          </Button>
        </>
      ) : (
        <Flex
          vertical
          align="center"
          justify="center"
          gap={8}
          style={{ padding: '24px 0', color: 'var(--color-text-mute)' }}
        >
          <span style={{ fontSize: 28, opacity: 0.4 }}>{icon}</span>
          <span style={{ fontSize: 13 }}>
            {name === 'Scopus'
              ? t('scientificDepartment.hindex.scopusNotConnected')
              : t('scientificDepartment.hindex.scholarNotConnected')}
          </span>
        </Flex>
      )}
    </div>
  );
}
