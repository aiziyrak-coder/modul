import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Space, Statistic, Tabs, Tag, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  BookOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import type { ComponentType } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { PageContainer, Card, DataTable, Filters, Flex, RangePicker } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission } from '@/app/session';
import {
  achievementApiByKey,
  certificateApi,
  defenseApi,
  degreeApi,
  patentApi,
  titleApi,
  type AchievementApi,
} from '../../api/achievement-api';
import { departmentsOfFaculty, useDepartments, useFaculties, useAcademicYears } from '../../api/reference-api';
import { exportToExcel } from '../../lib/excel';
import { ACHIEVEMENT_CATEGORIES, midSentence } from '../../model/achievement-config';
import StatusBadge from '../../components/status-badge';
import DecisionWarning from '../../components/decision-warning';
import TableGap from '../../components/table-gap';
import {
  type Achievement,
  type AchievementCategory,
  type AchievementCategoryKey,
  type AchievementField,
  type AchievementFilters,
  type ArticleStatus,
} from '../../model/types';

const ICON_MAP: Record<AchievementCategory['icon'], ComponentType<{ style?: React.CSSProperties }>> = {
  trophy: TrophyOutlined,
  book: BookOutlined,
  safety: SafetyCertificateOutlined,
  file: FileTextOutlined,
};

type ApproveTarget = { record: Achievement; catKey: AchievementCategoryKey };

export default function ReportsPage({ only }: { only?: AchievementCategoryKey }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const can = usePermission();

  const [facultyFilter, setFacultyFilter] = useState<string | undefined>();
  const [deptFilter, setDeptFilter] = useState<string | undefined>();
  const [yearFilter, setYearFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | undefined>();
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo<AchievementFilters>(
    () => ({
      faculty: facultyFilter,
      department: deptFilter,
      academicYear: yearFilter,
      status: statusFilter,
      dateFrom: dateRange?.[0],
      dateTo: dateRange?.[1],
    }),
    [facultyFilter, deptFilter, yearFilter, statusFilter, dateRange],
  );

  const { data: faculties = [] } = useFaculties();
  const { data: departments = [] } = useDepartments();
  const { data: academicYears = [] } = useAcademicYears();

  const queries: Record<AchievementCategoryKey, ReturnType<AchievementApi['usePaginate']>> = {
    degrees: degreeApi.usePaginate(page, pageSize, filters, can('scientificDegree:readAll')),
    titles: titleApi.usePaginate(page, pageSize, filters, can('scientificTitle:readAll')),
    defense: defenseApi.usePaginate(page, pageSize, filters, can('defense:readAll')),
    patents: patentApi.usePaginate(page, pageSize, filters, can('patent:readAll')),
    certificates: certificateApi.usePaginate(page, pageSize, filters, can('copyright:readAll')),
  };
  const approveHooks: Record<AchievementCategoryKey, ReturnType<AchievementApi['useApprove']>> = {
    degrees: degreeApi.useApprove(),
    titles: titleApi.useApprove(),
    defense: defenseApi.useApprove(),
    patents: patentApi.useApprove(),
    certificates: certificateApi.useApprove(),
  };
  const rejectHooks: Record<AchievementCategoryKey, ReturnType<AchievementApi['useReject']>> = {
    degrees: degreeApi.useReject(),
    titles: titleApi.useReject(),
    defense: defenseApi.useReject(),
    patents: patentApi.useReject(),
    certificates: certificateApi.useReject(),
  };

  const visibleCats = ACHIEVEMENT_CATEGORIES.filter(
    (c) => can(`${c.section}:readAll`) && (!only || c.key === only),
  );

  const [activeKey, setActiveKey] = useState<AchievementCategoryKey>(
    visibleCats[0]?.key ?? 'degrees',
  );
  const activeCat =
    visibleCats.find((c) => c.key === activeKey) ?? visibleCats[0];

  const [approveTarget, setApproveTarget] = useState<ApproveTarget | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApproveTarget | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const changeTab = (key: string) => {
    setActiveKey(key as AchievementCategoryKey);
    setPage(1);
  };

  const targetCatName = (target: ApproveTarget | null) => {
    const cat = target
      ? ACHIEVEMENT_CATEGORIES.find((c) => c.key === target.catKey)
      : undefined;
    return cat ? t(`scientificDepartment.${cat.labelKey}`) : '';
  };

  const renderFieldValue = (field: AchievementField, value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') return '—';
    if (field.kind === 'select') {
      const opt = field.options?.find((o) => o.value === value);
      if (!opt) return String(value);
      const label = t(`scientificDepartment.${opt.labelKey}`);
      return field.tag && opt.tagColor ? <Tag color={opt.tagColor}>{label}</Tag> : label;
    }
    if (field.kind === 'date') {
      const d = dayjs(value as string);
      return d.isValid() ? d.format('DD.MM.YYYY') : '—';
    }
    return String(value);
  };

  const buildColumns = (cat: AchievementCategory): ColumnDef<Achievement, unknown>[] => {
    const canModerate = can(`${cat.section}:approve`);
    const authorCol: ColumnDef<Achievement, unknown> = {
      id: 'authorName',
      header: t('scientificDepartment.reports.colAuthor'),
      size: 200,
      cell: ({ row }) => <strong>{row.original.authorName || '—'}</strong>,
    };
    const fieldCols = cat.fields.flatMap<ColumnDef<Achievement, unknown>>((field) => {
      const col: ColumnDef<Achievement, unknown> = {
        id: field.name,
        header: t(`scientificDepartment.${field.labelKey}`),
        size: 150,
        cell: ({ row }) => renderFieldValue(field, row.original[field.name]),
      };
      if (field.name !== 'specialty') return [col];
      return [
        {
          id: 'specialtyCode',
          header: t('scientificDepartment.ach.f.specialtyCode'),
          size: 110,
          cell: ({ row }) => (row.original.specialtyCode as string) || '—',
        },
        col,
      ];
    });
    const nameFirst = cat.key === 'patents' || cat.key === 'certificates';
    const mainCols =
      nameFirst && fieldCols.length > 0
        ? [fieldCols[0]!, authorCol, ...fieldCols.slice(1)]
        : [authorCol, ...fieldCols];
    return [
      {
        id: 'idx',
        header: '№',
        size: 50,
        meta: { align: 'center' as const },
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      ...mainCols,
      ...(nameFirst
        ? []
        : [
            {
              id: 'facultyName',
              header: t('scientificDepartment.articles.colFaculty'),
              size: 150,
              accessorKey: 'facultyName',
            } as ColumnDef<Achievement, unknown>,
          ]),
      {
        id: 'status',
        header: t('scientificDepartment.articles.colStatus'),
        size: 150,
        cell: ({ row }) => (
          <StatusBadge
            status={row.original.status}
            reason={row.original.rejectionReason}
            rejectedBy={row.original.rejectedByName}
          />
        ),
      },
      {
        id: 'actions',
        header: t('scientificDepartment.actions'),
        size: 150,
        meta: { align: 'center' as const },
        cell: ({ row }) => (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            {canModerate && row.original.status === 'new' ? (
              <>
                <Tooltip title={t('scientificDepartment.approve')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CheckCircleOutlined style={{ fontSize: 18, color: 'var(--brand-primary)' }} />
                    }
                    onClick={() => setApproveTarget({ record: row.original, catKey: cat.key })}
                  />
                </Tooltip>
                <Tooltip title={t('scientificDepartment.reject')}>
                  <Button
                    type="text"
                    size="small"
                    icon={
                      <CloseCircleOutlined style={{ fontSize: 18, color: 'var(--brand-error)' }} />
                    }
                    onClick={() => setRejectTarget({ record: row.original, catKey: cat.key })}
                  />
                </Tooltip>
              </>
            ) : null}
            <Tooltip title={t('scientificDepartment.view')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
                onClick={() =>
                  navigate(`${pathname}/${row.original.id}`)
                }
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveHooks[approveTarget.catKey].mutateAsync(approveTarget.record.id);
      message.success(t('scientificDepartment.reports.approved'));
      setApproveTarget(null);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      message.error(t('scientificDepartment.reports.reasonRequired'));
      return;
    }
    try {
      await rejectHooks[rejectTarget.catKey].mutateAsync({
        id: rejectTarget.record.id,
        reason: rejectReason.trim(),
      });
      message.success(t('scientificDepartment.reports.rejected'));
      setRejectTarget(null);
      setRejectReason('');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const targetLabel = (target: ApproveTarget): string => {
    const cat = ACHIEVEMENT_CATEGORIES.find((c) => c.key === target.catKey);
    const firstText = cat?.fields.find((f) => f.kind === 'text');
    const author = target.record.authorName || '';
    const extra = firstText ? String(target.record[firstText.name] ?? '') : '';
    return [author, extra].filter(Boolean).join(' — ') || '—';
  };

  const fieldText = (field: AchievementField, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '';
    if (field.kind === 'select') {
      const opt = field.options?.find((o) => o.value === value);
      return opt ? t(`scientificDepartment.${opt.labelKey}`) : String(value);
    }
    if (field.kind === 'date') {
      const d = dayjs(value as string);
      return d.isValid() ? d.format('DD.MM.YYYY') : '';
    }
    return String(value);
  };

  const handleExport = async (cat: AchievementCategory) => {
    const api = achievementApiByKey[cat.key];
    if (!api) return;
    setExporting(true);
    try {
      const rows = await api.fetchAll(filters);
      const hAuthor = t('scientificDepartment.reports.colAuthor');
      const hFaculty = t('scientificDepartment.articles.colFaculty');
      const hStatus = t('scientificDepartment.articles.colStatus');
      const hDate = t('scientificDepartment.articles.colDate');
      const data = rows.map((a) => {
        const row: Record<string, unknown> = { [hAuthor]: a.authorName || '' };
        cat.fields.forEach((f) => {
          if (f.name === 'specialty') {
            row[t('scientificDepartment.ach.f.specialtyCode')] =
              (a.specialtyCode as string) || '';
          }
          row[t(`scientificDepartment.${f.labelKey}`)] = fieldText(f, a[f.name]);
        });
        row[hFaculty] = a.facultyName || '';
        row[hStatus] = t(`scientificDepartment.status.${a.status}`);
        row[hDate] = a.submittedDate || '';
        return row;
      });
      if (!data.length) {
        message.info(t('scientificDepartment.reports.exportEmpty'));
        return;
      }
      const label = t(`scientificDepartment.${cat.labelKey}`);
      exportToExcel(data, `${label}-${dayjs().format('YYYY-MM-DD')}`, label);
      message.success(t('scientificDepartment.reports.exportDone', { n: data.length }));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const renderTabBody = (cat: AchievementCategory) => {
    const query = queries[cat.key];
    const total = query.data?.totalDocs ?? 0;
    return (
      <>
        <Flex align="center" gap={12} wrap style={{ marginBottom: 12 }} className="sci-toolbar-actions">
          <style>{`.sci-toolbar-actions .ant-btn { height: 38px; }`}</style>
          <span style={{ color: 'var(--color-text-mute)', fontSize: 13 }}>
            {t('scientificDepartment.reports.total', { n: total })}
          </span>
          <div style={{ flex: 1 }} />
          <Button
            icon={<FileExcelOutlined />}
            loading={exporting}
            onClick={() => handleExport(cat)}
            style={{
              background: 'var(--brand-primary)',
              borderColor: 'var(--brand-primary)',
              color: '#fff',
            }}
          >
            {t('scientificDepartment.reports.exportExcel')}
          </Button>
        </Flex>
        <TableGap>
          <DataTable<Achievement>
            data={query.data?.docs ?? []}
            columns={buildColumns(cat)}
            loading={query.isFetching}
            page={page}
            pageSize={pageSize}
            total={total}
            pageSizeOptions={[12, 24, 36, 48]}
            onPageChange={(p, ps) => {
              setPage(p);
              setPageSize(ps);
            }}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            onRowClick={(row) =>
              navigate(`${pathname}/${row.id}`)
            }
          />
        </TableGap>
      </>
    );
  };

  return (
    <PageContainer
      title={
        only && visibleCats[0]
          ? t(`scientificDepartment.${visibleCats[0].labelKey}`)
          : t('scientificDepartment.reports.title')
      }
    >
      {!only ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          {visibleCats.map((cat) => {
            const Icon = ICON_MAP[cat.icon];
            return (
              <Card key={cat.key} size="small">
                <Flex align="center" gap={14}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      background: `color-mix(in srgb, ${cat.color} 12%, #fff)`,
                      color: cat.color,
                      flexShrink: 0,
                    }}
                  >
                    <Icon style={{ fontSize: 22 }} />
                  </span>
                  <Statistic
                    title={t(`scientificDepartment.${cat.tabKey}`)}
                    value={queries[cat.key].data?.totalDocs ?? 0}
                    valueStyle={{ color: cat.color, fontWeight: 700 }}
                  />
                </Flex>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'faculty',
            placeholder: 'scientificDepartment.reports.allFaculties',
            value: facultyFilter,
            options: faculties.map((f) => ({ value: f.id, label: f.name })),
            onChange: (v) => {
              setFacultyFilter(v);
              setDeptFilter(undefined);
              setPage(1);
            },
          },
          {
            key: 'department',
            placeholder: 'scientificDepartment.reports.allDepartments',
            value: deptFilter,
            options: departmentsOfFaculty(departments, facultyFilter).map((d) => ({ value: d.id, label: d.name })),
            onChange: (v) => {
              setDeptFilter(v);
              setPage(1);
            },
          },
          {
            key: 'academicYear',
            placeholder: 'scientificDepartment.reports.allYears',
            value: yearFilter,
            options: academicYears.map((y) => ({ value: y.value, label: y.label })),
            onChange: (v) => {
              setYearFilter(v);
              setPage(1);
            },
          },
          {
            key: 'status',
            placeholder: 'scientificDepartment.reports.allStatuses',
            value: statusFilter,
            options: (['new', 'approved', 'rejected'] as ArticleStatus[]).map((s) => ({
              value: s,
              label: t(`scientificDepartment.status.${s}`),
            })),
            onChange: (v) => {
              setStatusFilter(v as ArticleStatus | undefined);
              setPage(1);
            },
          },
        ]}
        extra={
          <RangePicker
            maxWidth={260}
            size="middle"
            placeholder={[t('scientificDepartment.rangeFrom'), t('scientificDepartment.rangeTo')]}
            style={{ height: 38, width: '100%' }}
            value={dateRange}
            onChange={(r) => {
              setDateRange(r);
              setPage(1);
            }}
          />
        }
      />

      {visibleCats.length > 0 && activeCat ? (
        <>
          {!only ? (
          <Tabs
            activeKey={activeCat.key}
            onChange={changeTab}
            style={{ flexShrink: 0 }}
            items={visibleCats.map((cat) => {
              const Icon = ICON_MAP[cat.icon];
              const total = queries[cat.key].data?.totalDocs ?? 0;
              return {
                key: cat.key,
                label: (
                  <span>
                    <Icon style={{ marginRight: 6 }} />
                    {t(`scientificDepartment.${cat.tabKey}`)} ({total})
                  </span>
                ),
              };
            })}
          />
          ) : null}
          {renderTabBody(activeCat)}
        </>
      ) : null}

      <Modal centered
        title={t('scientificDepartment.reports.approveTitle', {
          name: targetCatName(approveTarget),
        })}
        open={!!approveTarget}
        onCancel={() => setApproveTarget(null)}
        onOk={handleApprove}
        okText={t('scientificDepartment.confirm')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={approveTarget ? approveHooks[approveTarget.catKey].isPending : false}
      >
        {approveTarget ? (
          <>
            <div
              style={{
                background: 'var(--brand-primary-soft)',
                border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, #fff)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 8,
              }}
            >
              <div style={{ color: 'var(--brand-primary)', fontSize: 12 }}>
                {t('scientificDepartment.reports.colAuthor')}:
              </div>
              <div style={{ fontWeight: 600, marginTop: 4, color: 'var(--color-text)' }}>
                {targetLabel(approveTarget)}
              </div>
            </div>
            <div style={{ color: 'var(--color-text-soft)', fontSize: 13, padding: '8px 4px' }}>
              {t('scientificDepartment.reports.approveBody', {
                name: midSentence(targetCatName(approveTarget)),
              })}
            </div>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.reports.rejectTitle', {
          name: targetCatName(rejectTarget),
        })}
        open={!!rejectTarget}
        onCancel={() => {
          setRejectTarget(null);
          setRejectReason('');
        }}
        onOk={handleReject}
        okText={t('scientificDepartment.send')}
        cancelText={t('scientificDepartment.cancel')}
        okButtonProps={{ danger: true }}
        confirmLoading={rejectTarget ? rejectHooks[rejectTarget.catKey].isPending : false}
      >
        {rejectTarget ? (
          <>
            <div
              style={{
                background: 'var(--color-bg-elevate)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div style={{ color: 'var(--color-text-mute)', fontSize: 12 }}>
                {t('scientificDepartment.reports.colAuthor')}:
              </div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{targetLabel(rejectTarget)}</div>
            </div>
            <Form layout="vertical">
              <Form.Item label={t('scientificDepartment.rejectReason')} required>
                <Input.TextArea
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('scientificDepartment.rejectReasonPlaceholder')}
                />
              </Form.Item>
            </Form>
            <DecisionWarning />
          </>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
