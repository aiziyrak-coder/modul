import { useMemo, useState } from 'react';
import { Button, Select, Space, Table, Tooltip } from 'antd';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExperimentOutlined,
  EyeOutlined,
  FileTextOutlined,
  SyncOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { usePermission, useSessionStore } from '@/app/session';
import {
  useAllWorks,
  useCouncilNumbers,
  useSpecialties,
} from '../api/science-council-api';
import { ExportButton } from '../components/export-button';
import { downloadExcelSheets, datedFileName, type ExcelRow } from '../lib/excel';
import { workStep } from '../lib/work-step';
import { StatusTag } from '../components/status-tag';
import type { ScientificWork } from '../model/types';

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;

  .spacer {
    margin-left: auto;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4, 16px);
  margin-bottom: var(--space-6, 24px);

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StatCardWrap = styled.div`
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-6, 24px) var(--space-5, 20px);
  min-height: 108px;
  border: 1px solid var(--border-secondary, #e5e7eb);
  display: flex;
  align-items: center;
  gap: var(--space-4, 16px);
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    box-shadow: 0 4px 16px rgb(0 0 0 / 8%);
    transform: translateY(-2px);
  }
`;

const StatIcon = styled.div<{ $bg: string }>`
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg, 14px);
  background: ${({ $bg }) => $bg};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  flex-shrink: 0;
`;

const StatMeta = styled.div`
  min-width: 0;

  .value {
    font-size: 34px;
    font-weight: 800;
    color: var(--color-text, #111827);
    line-height: 1;
    margin-bottom: var(--space-1, 4px);
  }
  .label {
    font-size: 13px;
    color: var(--color-text-tertiary, #6b7280);
    font-weight: 500;
  }
`;

const Section = styled.div`
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-secondary, #e5e7eb);
  overflow: hidden;
  margin-bottom: 16px;
`;

const SectionHead = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-secondary, #e5e7eb);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SectionTitle = styled.h2`
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text, #111827);
  margin: 0;
`;

interface StatItem {
  value: number;
  label: string;
  bg: string;
  icon: React.ReactNode;
}

export default function DashboardPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const userId = useSessionStore((s) => s.user?.id ?? '');
  const isSecretary = can('scienceCouncil:manageMembers');
  const isMember = !isSecretary;
  const { data: works, isLoading } = useAllWorks();

  const allWorks = useMemo(() => {
    const list = works ?? [];
    if (isMember) return list.filter((w) => w.councilMembers.some((cm) => cm.id === userId));
    return list;
  }, [works, isMember, userId]);

  const yearOptions = useMemo(() => {
    const years = [...new Set(allWorks.map((w) => w.year))].sort().reverse();
    return years.map((y) => ({ label: y, value: y }));
  }, [allWorks]);

  const [selectedYear, setSelectedYear] = useState<string | undefined>(undefined);
  const [selectedCouncil, setSelectedCouncil] = useState<string | undefined>(undefined);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | undefined>(undefined);

  const { data: councilNumbers = [] } = useCouncilNumbers();
  const { data: specialties = [] } = useSpecialties();

  const councilSpecialtyIds = useMemo(() => {
    if (!selectedCouncil) return null;
    const cn = councilNumbers.find((c) => c.id === selectedCouncil);
    return new Set((cn?.specialties ?? []).map((sp) => sp.id));
  }, [selectedCouncil, councilNumbers]);

  const filtered = useMemo(() => {
    let list = allWorks;
    if (selectedYear) list = list.filter((w) => w.year === selectedYear);
    if (selectedSpecialty) list = list.filter((w) => w.specialty?.id === selectedSpecialty);
    if (councilSpecialtyIds) {
      list = list.filter((w) => !!w.specialty && councilSpecialtyIds.has(w.specialty.id));
    }
    return list;
  }, [allWorks, selectedYear, selectedSpecialty, councilSpecialtyIds]);

  const recentWorks = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [filtered],
  );

  const statCards = useMemo<StatItem[]>(() => {
    const counts = { total: 0, new: 0, pending: 0, approved: 0, rejected: 0, revision: 0 };
    let seminars = 0;
    let defenses = 0;
    for (const w of filtered) {
      counts.total++;
      if (w.status in counts) counts[w.status as keyof typeof counts]++;
      const step = workStep(w);
      if (step === 'seminars') seminars++;
      else if (step === 'defenses') defenses++;
    }
    return [
      { value: counts.total, label: t('scienceCouncil.stats.total'), bg: '#f0fdf4', icon: <ExperimentOutlined style={{ color: '#16a34a' }} /> },
      { value: counts.new, label: t('scienceCouncil.stats.new'), bg: '#eff6ff', icon: <FileTextOutlined style={{ color: '#2563eb' }} /> },
      { value: counts.pending, label: t('scienceCouncil.stats.pending'), bg: '#fffbeb', icon: <ClockCircleOutlined style={{ color: '#d97706' }} /> },
      { value: seminars, label: t('scienceCouncil.nav.seminars'), bg: '#f0f9ff', icon: <CalendarOutlined style={{ color: '#0284c7' }} /> },
      { value: defenses, label: t('scienceCouncil.nav.defenses'), bg: '#fdf4ff', icon: <TrophyOutlined style={{ color: '#c026d3' }} /> },
      { value: counts.approved, label: t('scienceCouncil.stats.approved'), bg: '#f0fdf4', icon: <CheckCircleOutlined style={{ color: '#16a34a' }} /> },
      { value: counts.rejected, label: t('scienceCouncil.stats.rejected'), bg: '#fef2f2', icon: <CloseCircleOutlined style={{ color: '#dc2626' }} /> },
      { value: counts.revision, label: t('scienceCouncil.stats.revision'), bg: '#faf5ff', icon: <SyncOutlined style={{ color: '#9333ea' }} /> },
    ];
  }, [filtered, t]);

  const exportStats = () => {
    const councilLabel = councilNumbers.find((c) => c.id === selectedCouncil)?.number;
    const specialtyLabel = specialties.find((sp) => sp.id === selectedSpecialty);

    const statRows: ExcelRow[] = [
      { "Ko'rsatkich": t('scienceCouncil.work.year'), Qiymat: selectedYear || t('scienceCouncil.export.all') },
      { "Ko'rsatkich": t('scienceCouncil.settings.councilNumber'), Qiymat: councilLabel || t('scienceCouncil.export.all') },
      {
        "Ko'rsatkich": t('scienceCouncil.form.specialtyCode'),
        Qiymat: specialtyLabel ? `${specialtyLabel.code} — ${specialtyLabel.title}` : t('scienceCouncil.export.all'),
      },
      { "Ko'rsatkich": '', Qiymat: '' },
      ...statCards.map((c) => ({ "Ko'rsatkich": c.label, Qiymat: c.value })),
    ];

    const workRows: ExcelRow[] = filtered.map((w, i) => ({
      '#': i + 1,
      [t('scienceCouncil.work.title')]: w.title,
      [t('scienceCouncil.work.author')]: w.researcher?.name ?? w.externalAuthor?.name ?? '—',
      [t('scienceCouncil.work.authorType')]:
        w.authorType === 'internal' ? t('scienceCouncil.work.internal') : t('scienceCouncil.work.external'),
      [t('scienceCouncil.form.specialtyCode')]: w.specialty?.code ?? '—',
      [t('scienceCouncil.detail.specialty')]: w.specialty?.title ?? '—',
      [t('scienceCouncil.work.year')]: w.year ?? '—',
      [t('scienceCouncil.work.status')]: t(`scienceCouncil.status.${w.status}`),
      [t('scienceCouncil.work.date')]: w.createdAt?.slice(0, 10) ?? '—',
    }));

    downloadExcelSheets(
      [
        { name: t('scienceCouncil.export.statsSheet'), rows: statRows, colWidths: [34, 30] },
        { name: t('scienceCouncil.nav.works'), rows: workRows, colWidths: [5, 55, 28, 14, 14, 30, 13, 18, 13] },
      ],
      datedFileName('Ilmiy_kengash_statistika'),
    );
  };

  const columns: ColumnsType<ScientificWork> = [
    {
      title: t('scienceCouncil.work.title'),
      dataIndex: lang === 'uz' ? 'title' : 'titleRu',
      key: 'title',
      ellipsis: true,
      render: (text: string, record) => (
        <span
          style={{ cursor: 'pointer', color: 'var(--color-text, #111827)', fontWeight: 500 }}
          onClick={() => navigate(`/science-council/works/${record.id}`)}
        >
          {text || record.title}
        </span>
      ),
    },
    {
      title: t('scienceCouncil.work.author'),
      key: 'author',
      width: 200,
      render: (_v, r) => (
        <span style={{ fontSize: 13 }}>{r.researcher?.name ?? r.externalAuthor?.name ?? '—'}</span>
      ),
    },
    {
      title: t('scienceCouncil.work.status'),
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (_v, r) => <StatusTag status={r.status} reason={r.rejectionReason} />,
    },
    {
      title: t('scienceCouncil.work.date'),
      dataIndex: 'createdAt',
      key: 'date',
      width: 120,
      render: (d: string) => (
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary, #6b7280)' }}>{d?.slice(0, 10)}</span>
      ),
    },
    {
      title: t('scienceCouncil.actions'),
      key: 'actions',
      width: 100,
      render: (_v, record) => (
        <Space size={4} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Tooltip title={t('scienceCouncil.actions.view')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/science-council/works/${record.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title={t('scienceCouncil.nav.dashboard')}>
      <FilterBar>
        <Select
          value={selectedYear}
          onChange={setSelectedYear}
          allowClear
          placeholder={t('scienceCouncil.work.year')}
          style={{ width: 180 }}
          options={yearOptions}
        />

        <Select
          value={selectedCouncil}
          onChange={setSelectedCouncil}
          allowClear
          placeholder={t('scienceCouncil.settings.councilNumber')}
          style={{ width: 240 }}
          options={councilNumbers.map((c) => ({ value: c.id, label: c.number }))}
        />

        <Select
          value={selectedSpecialty}
          onChange={setSelectedSpecialty}
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('scienceCouncil.form.specialtyCode')}
          style={{ width: 260 }}
          options={specialties.map((sp) => ({ value: sp.id, label: `${sp.code} — ${sp.title}` }))}
        />

        <span className="spacer" />
        <ExportButton
          onExport={exportStats}
          disabled={filtered.length === 0}
          disabledReason={t('scienceCouncil.export.empty')}
        />
      </FilterBar>

      <Grid>
        {statCards.map((card, i) => (
          <StatCardWrap key={i}>
            <StatIcon $bg={card.bg}>{card.icon}</StatIcon>
            <StatMeta>
              <div className="value">{card.value}</div>
              <div className="label">{card.label}</div>
            </StatMeta>
          </StatCardWrap>
        ))}
      </Grid>

      <Section>
        <SectionHead>
          <SectionTitle>
            {isMember
              ? (lang === 'uz' ? "Menga biriktirilgan so'nggi ishlar" : 'Последние назначенные мне работы')
              : (lang === 'uz' ? "So'nggi ilmiy ishlar" : 'Последние научные работы')}
          </SectionTitle>
        </SectionHead>
        <Table<ScientificWork>
          dataSource={recentWorks}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
        />
      </Section>
    </PageContainer>
  );
}
