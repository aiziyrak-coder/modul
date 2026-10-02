import { LinkOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { usePermission } from '@/app/session';
import { ACCENT, SITE_CARD, chartsPermission, type ModuleCard } from '../../model/registry';
import { moduleAnim, moduleIcon } from '../module-icon';
import { ModuleAnim } from '../module-anim';
import { SiteVisual } from '../site-visual';
import type { CardStats } from '../../api/dashboard-api';
import { formatStat } from '../../lib/format-stat';
import { AdmissionCharts } from '../admission-charts';
import { TaskCharts } from '../task-charts';
import { GiftedCharts } from '../gifted-charts';
import { ResidencyCharts } from '../residency-charts';
import { QualityCharts } from '../quality-charts';
import { CouncilCharts } from '../council-charts';
import { PracticeCharts } from '../practice-charts';
import { StudyLoadCharts } from '../studyload-charts';
import { TeacherCharts } from '../teacher-charts';

const { Text, Title } = Typography;

export function ModuleDetail({
  card,
  stats,
  isSite,
  onOpen,
}: {
  card: ModuleCard | null;
  stats?: CardStats;
  isSite: boolean;
  onOpen: () => void;
}) {
  const can = usePermission();
  const chartsAllowed = !!card && can(chartsPermission(card));
  if (isSite) {
    return (
      <aside style={panel}>
        <SiteVisual height={260} />

        <Title level={5} style={{ margin: 'var(--space-4, 16px) 0 2px', fontSize: 17 }}>
          {SITE_CARD.title}
        </Title>
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          {SITE_CARD.subtitle}
        </Text>

        <p style={{ marginTop: 'var(--space-3, 12px)', fontSize: 13.5, lineHeight: 1.65, color: 'var(--color-text)' }}>
          {SITE_CARD.about}
        </p>

        <ul style={list}>
          {SITE_CARD.links.map((l) => (
            <li key={l.label} style={listItem}>
              <span style={{ ...dot, background: '#34c18c' }} />
              <span>{l.label}</span>
            </li>
          ))}
        </ul>

        <Button type="primary" block size="large" style={{ marginTop: 'var(--space-5, 20px)', fontWeight: 600 }} onClick={onOpen}>
          Saytga o'tish <LinkOutlined />
        </Button>
        <Text type="secondary" style={{ fontSize: 11.5, display: 'block', marginTop: 8, textAlign: 'center' }}>
          {SITE_CARD.url}
        </Text>
      </aside>
    );
  }

  if (!card) {
    return (
      <aside style={{ ...panel, display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <Text type="secondary">Tafsilotni ko'rish uchun kartani tanlang</Text>
      </aside>
    );
  }

  const a = ACCENT[card.accent];
  const shown = stats?.loading ? (stats?.stats ?? []) : (stats?.stats ?? []).filter((s) => s.value !== null);

  return (
    <aside style={panel}>
      <div style={{ borderRadius: 'var(--radius-lg, 12px)', overflow: 'hidden', border: '1px solid var(--color-border-soft, #eef2f6)' }}>
        <ModuleAnim kind={moduleAnim(card.key)} accent={card.accent} height={260} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'var(--space-4, 16px)' }}>
        <span
          style={{
            width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center',
            background: `linear-gradient(135deg, ${a.solid}, color-mix(in srgb, ${a.solid} 72%, #121926))`,
            color: '#fff', fontSize: 17,
            boxShadow: `0 6px 14px ${a.solid}40`,
          }}
        >
          {moduleIcon(card.key)}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: 15.5, color: 'var(--color-text)' }}>{card.title}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {card.subtitle} · {card.ttRef}
          </Text>
        </div>
      </div>

      <p style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--color-text)' }}>
        {card.about}
      </p>

      <ul style={list}>
        {card.role.map((r) => (
          <li key={r} style={listItem}>
            <span style={{ ...dot, background: a.solid }} />
            <span>{r}</span>
          </li>
        ))}
      </ul>

      {shown.length > 0 && (
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 6, marginTop: 'var(--space-3, 12px)',
          }}
        >
          {shown.map((s) => (
            <div
              key={s.label}
              style={{
                padding: '8px 11px', borderRadius: 'var(--radius-md, 8px)',
                background: 'var(--color-bg-elevate, #f5f7fb)',
                borderLeft: `3px solid ${toneColor(s.tone) ?? a.solid}`,
              }}
            >
              <div style={{ fontSize: s.format === 'money' ? 15 : 19, fontWeight: 700, color: toneColor(s.tone) ?? 'var(--color-text)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                {stats?.loading ? '···' : formatStat(s)}
              </div>
              <Text type="secondary" style={{ fontSize: 10.5, lineHeight: 1.3 }}>
                {s.label}
              </Text>
            </div>
          ))}
        </div>
      )}

      {chartsAllowed && card.charts === 'admission' && <AdmissionCharts />}
      {chartsAllowed && card.charts === 'task' && <TaskCharts />}
      {chartsAllowed && card.charts === 'gifted' && <GiftedCharts />}
      {chartsAllowed && card.charts === 'residency' && <ResidencyCharts />}
      {chartsAllowed && card.charts === 'quality' && <QualityCharts />}
      {chartsAllowed && card.charts === 'council' && <CouncilCharts />}
      {chartsAllowed && card.charts === 'practice' && <PracticeCharts />}
      {chartsAllowed && card.charts === 'studyload' && <StudyLoadCharts />}
      {chartsAllowed && card.charts === 'teacher' && <TeacherCharts />}

      <Button
        type="primary"
        block
        size="large"
        style={{ marginTop: 'var(--space-5, 20px)', background: a.solid, borderColor: a.solid, fontWeight: 600 }}
        onClick={onOpen}
      >
        Batafsil <RightOutlined />
      </Button>
    </aside>
  );
}

function toneColor(tone?: 'good' | 'critical'): string | null {
  if (tone === 'good') return 'var(--brand-primary, #34c18c)';
  if (tone === 'critical') return 'var(--brand-error, #F04438)';
  return null;
}

const panel: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  padding: 'var(--space-6, 24px)',
  borderRadius: 'var(--radius-xl, 16px)',
  border: '1px solid var(--color-border, #e3e8ef)',
  background: 'var(--color-bg, #fff)',
  boxShadow: '0 1px 3px rgba(16,24,40,.05)',
};

const list: React.CSSProperties = {
  listStyle: 'none', padding: 0,
  margin: 'var(--space-2, 8px) 0 0',
  display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)',
};

const listItem: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 9,
  fontSize: 13, lineHeight: 1.55, color: 'var(--color-text)',
};

const dot: React.CSSProperties = {
  flex: '0 0 auto', width: 7, height: 7, borderRadius: '50%', marginTop: 6,
};
