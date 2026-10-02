import type { ReactNode } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { Avatar, Card, PageContainer, Typography } from '@/shared/ui';
import { useSessionStore } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';

const { Title, Text } = Typography;

function initials(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function InfoItem({ label, value }: { label: string; value?: string | null }): ReactNode {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--color-text-soft, #697586)', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          color: value ? 'var(--color-text, #121926)' : 'var(--color-text-mute, #9aa3b2)',
          wordBreak: 'break-word',
        }}
      >
        {value || '—'}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);

  const passport = [user?.passportSeria, user?.passportNumber].filter(Boolean).join(' ');

  return (
    <PageContainer title={t('qualification.profile.title')}>
      <div
        style={{
          background: 'var(--color-bg, #fff)',
          borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px rgba(0,0,0,.05))',
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            height: 112,
            borderRadius: 'var(--radius-md, 8px)',
            background:
              'linear-gradient(100deg, color-mix(in srgb, var(--brand-warning, #f0c000) 38%, #fff) 0%, color-mix(in srgb, var(--brand-primary, #34c18c) 30%, #fff) 100%)',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 20,
            padding: '0 12px',
            marginTop: -64,
          }}
        >
          <Avatar
            size={160}
            style={{
              background: 'var(--brand-primary, #34c18c)',
              color: '#fff',
              fontSize: 52,
              fontWeight: 600,
              border: '4px solid var(--color-bg, #fff)',
              flexShrink: 0,
            }}
          >
            {initials(user?.fullName) || <UserOutlined />}
          </Avatar>
          <div style={{ paddingTop: 88 }}>
            <Title level={5} style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>
              {user?.fullName || '—'}
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {t('qualification.profile.subtitle')}
            </Text>
          </div>
        </div>
      </div>

      <Card title={t('qualification.profile.personal')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '22px 32px',
          }}
        >
          <InfoItem label={t('qualification.profile.firstName')} value={user?.firstName} />
          <InfoItem label={t('qualification.profile.lastName')} value={user?.lastName} />
          <InfoItem label={t('qualification.profile.middleName')} value={user?.middleName} />
          <InfoItem label={t('qualification.profile.jshshr')} value={user?.passport} />
          <InfoItem label={t('qualification.profile.passport')} value={passport} />
          <InfoItem label={t('qualification.profile.email')} value={user?.email} />
          <InfoItem label={t('qualification.profile.phone')} value={user?.phone} />
        </div>
      </Card>
    </PageContainer>
  );
}
