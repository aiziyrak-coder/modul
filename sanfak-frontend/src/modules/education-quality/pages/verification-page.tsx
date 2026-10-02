import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from '@/shared/lib/i18n';
import {
  Table, Button, Select, Tooltip, Modal, Input,
  Tag, App as AntApp,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined, CheckOutlined, CloseOutlined,
  ExclamationCircleFilled, SearchOutlined, } from '@ant-design/icons';
import type { Semester, Submission, SubmissionStatus } from '../model/types';
import {
  useAcademicYears,
  useDepartments,
  useFaculties,
  useSubmissionList,
  useReviewSubmission,
  useIndicatorList,
} from '../api/education-quality-api';
import SubmissionDrawer from '../components/submission-drawer';
import { useDebouncedSearch } from '../lib/use-debounced';
import { TablePagination } from '../components/table-pagination';
import { Page, TableCard } from '../components/table-pagination/style';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fullName(teacher: Submission['teacher']): string {
  return `${teacher.lastName} ${teacher.firstName}`;
}

const STATUS_VALUES: SubmissionStatus[] = ['pending', 'approved', 'rejected'];
const SEMESTER_VALUES: Semester[] = [1, 2];

const SEMESTER_LABEL_KEY: Record<Semester, string> = {
  1: 'educationQuality.semester.s1',
  2: 'educationQuality.semester.s2',
};

const STATUS_TAG: Record<SubmissionStatus, { color: string; labelKey: string }> = {
  pending: { color: 'processing', labelKey: 'educationQuality.status.new' },
  approved: { color: 'success', labelKey: 'educationQuality.status.approved' },
  rejected: { color: 'error', labelKey: 'educationQuality.status.rejected' },
};

export default function VerificationPage() {
  const { message } = AntApp.useApp();
  const { t } = useTranslation();

  const [statusTab, setStatusTab] = useState<SubmissionStatus | undefined>(undefined);
  const [yearFilter, setYearFilter] = useState<string | undefined>(undefined);
  const [semesterFilter, setSemesterFilter] = useState<Semester | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [indicatorFilter, setIndicatorFilter] = useState<string | undefined>();
  const [facultyFilter, setFacultyFilter] = useState<string | undefined>();
  const [deptFilter, setDeptFilter] = useState<string | undefined>();

  const [selected, setSelected] = useState<Submission | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Submission | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Submission | null>(null);
  const [reason, setReason] = useState('');

  const debouncedSearch = useDebouncedSearch(search);

  const { data: subData, isLoading } = useSubmissionList({
    status: statusTab ?? undefined,
    search: debouncedSearch || undefined,
    indicator: indicatorFilter,
    faculty: facultyFilter,
    department: deptFilter,
    academicYear: yearFilter,
    semester: semesterFilter,
  });

  const { data: indData } = useIndicatorList({});
  const reviewMut = useReviewSubmission();

  const statusOptions = useMemo(
    () => STATUS_VALUES.map((v) => ({ label: t(STATUS_TAG[v].labelKey), value: v })),
    [t],
  );
  const semesterOptions = useMemo(
    () => SEMESTER_VALUES.map((v) => ({ label: t(SEMESTER_LABEL_KEY[v]), value: v })),
    [t],
  );

  const { data: academicYears } = useAcademicYears();
  const { data: faculties } = useFaculties();
  const { data: departments } = useDepartments(facultyFilter);

  const showActions = !statusTab || statusTab === 'pending';

  const rows = useMemo(() => subData?.docs ?? [], [subData]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  useEffect(() => {
    setPage(1);
  }, [statusTab, debouncedSearch, indicatorFilter, facultyFilter, deptFilter, yearFilter, semesterFilter]);
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize],
  );

  const onFacultyChange = useCallback((v: string) => {
    setFacultyFilter(v);
    setDeptFilter(undefined);
  }, []);

  const view = useCallback((record: Submission) => {
    setSelected(record);
    setDrawerOpen(true);
  }, []);

  const doConfirmApprove = useCallback(() => {
    if (!confirmTarget) return;
    const authorShare = confirmTarget.authorShare;
    const coefficient = authorShare / 100;
    const score = Math.round(confirmTarget.indicator.coefficient * coefficient * 100) / 100;
    reviewMut.mutate(
      { id: confirmTarget._id, review: { status: 'approved', score } },
      {
        onSuccess: () => {
          message.success(t('educationQuality.verification.approveSuccess'));
          setConfirmTarget(null);
        },
      },
    );
  }, [confirmTarget, reviewMut, message, t]);

  const doReject = useCallback(() => {
    if (!rejectTarget || !reason.trim()) return;
    reviewMut.mutate(
      { id: rejectTarget._id, review: { status: 'rejected', comment: reason.trim() } },
      {
        onSuccess: () => {
          message.warning(t('educationQuality.verification.rejectSuccess'));
          setRejectTarget(null);
          setReason('');
        },
      },
    );
  }, [rejectTarget, reason, reviewMut, message, t]);

  const columns: ColumnsType<Submission> = [
    {
      title: t('educationQuality.common.teacher'),
      render: (_v, r) => <span style={{ fontWeight: 600 }}>{fullName(r.teacher)}</span>,
    },
    {
      title: t('educationQuality.common.department'),
      width: 200,
      render: (_v, r) => (
        <span style={{ color: 'var(--color-text-secondary, #475467)' }}>
          {r.teacher.department?.title ?? '—'}
        </span>
      ),
    },
    {
      title: t('educationQuality.common.faculty'),
      width: 180,
      render: (_v, r) => (
        <span style={{ color: 'var(--color-text-secondary, #475467)' }}>
          {r.teacher.faculty?.title ?? '—'}
        </span>
      ),
    },
    {
      title: t('educationQuality.common.indicator'),
      render: (_v, r) => (
        <span style={{ maxWidth: 320, display: 'inline-block' }}>
          {r.indicator.title}
        </span>
      ),
    },
    {
      title: t('educationQuality.common.authors'),
      width: 100,
      align: 'center',
      render: (_v, r) => Math.max(1, Math.round(100 / r.authorShare)),
    },
    {
      title: t('educationQuality.common.date'),
      width: 160,
      render: (_v, r) => formatDateTime(r.createdAt),
    },
    {
      title: t('educationQuality.common.status'),
      width: 130,
      render: (_v, r) => {
        const tag = STATUS_TAG[r.status];
        return <Tag color={tag.color}>{t(tag.labelKey)}</Tag>;
      },
    },
    ...(statusTab === 'approved'
      ? [{
          title: t('educationQuality.common.score'),
          width: 90,
          align: 'center' as const,
          render: (_v: unknown, r: Submission) => (
            <strong style={{ color: 'var(--brand-primary, #0B843F)', fontSize: 15 }}>
              {r.score}
            </strong>
          ),
        }]
      : []),
    {
      title: showActions ? t('educationQuality.common.actions') : '',
      width: showActions ? 140 : 60,
      align: 'right',
      render: (_v, r) => {
        if (r.status === 'pending') {
          return (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Tooltip title={t('educationQuality.common.view')}>
                <Button icon={<EyeOutlined />} onClick={() => view(r)} />
              </Tooltip>
              <Tooltip title={t('educationQuality.verification.approve')}>
                <Button type="primary" icon={<CheckOutlined />} onClick={() => setConfirmTarget(r)} />
              </Tooltip>
              <Tooltip title={t('educationQuality.verification.reject')}>
                <Button danger icon={<CloseOutlined />} onClick={() => { setReason(''); setRejectTarget(r); }} />
              </Tooltip>
            </div>
          );
        }
        return (
          <Tooltip title={t('educationQuality.common.view')}>
            <Button type="text" icon={<EyeOutlined />} onClick={() => view(r)} />
          </Tooltip>
        );
      },
    },
  ];

  const exportRows = () => {
    const head = {
      teacher: t('educationQuality.common.teacher'),
      department: t('educationQuality.common.department'),
      faculty: t('educationQuality.common.faculty'),
      indicator: t('educationQuality.common.indicator'),
      authors: t('educationQuality.common.authors'),
      date: t('educationQuality.common.date'),
      status: t('educationQuality.common.status'),
      score: t('educationQuality.common.score'),
    };
    const sheet = t('educationQuality.verification.title');
    const excelRows: ExcelRow[] = rows.map((r, i) => ({
      '#': i + 1,
      [head.teacher]: fullName(r.teacher),
      [head.department]: r.teacher.department?.title ?? '—',
      [head.faculty]: r.teacher.faculty?.title ?? '—',
      [head.indicator]: r.indicator.title,
      [head.authors]: Math.max(1, Math.round(100 / r.authorShare)),
      [head.date]: formatDateTime(r.createdAt),
      [head.status]: t(STATUS_TAG[r.status].labelKey),
      [head.score]: r.score,
    }));
    downloadExcel(excelRows, datedFileName(sheet), sheet, [5, 26, 24, 22, 42, 11, 18, 14, 8]);
  };

  return (
    <Page>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{t('educationQuality.verification.title')}</h2>
        <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
          {t('educationQuality.verification.subtitle')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <Input
          placeholder={t('educationQuality.verification.searchPlaceholder')}
          prefix={<SearchOutlined />}
          style={{ flex: '1.4 1 0', minWidth: 220 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
        <Select
          value={statusTab}
          onChange={setStatusTab}
          style={{ flex: '1 1 0', minWidth: 160 }}
          options={statusOptions}
          allowClear
          placeholder={t('educationQuality.common.allStatuses')}
        />
        <Select
          value={yearFilter}
          onChange={setYearFilter}
          style={{ flex: '1 1 0', minWidth: 140 }}
          options={(academicYears ?? []).map((a) => ({ label: a.title, value: a._id }))}
          allowClear
          placeholder={t('educationQuality.common.allYears')}
        />
        <Select
          value={semesterFilter}
          onChange={setSemesterFilter}
          style={{ flex: '0.8 1 0', minWidth: 120 }}
          options={semesterOptions}
          allowClear
          placeholder={t('educationQuality.common.allSemesters')}
        />
        <Select
          value={indicatorFilter}
          onChange={setIndicatorFilter}
          style={{ flex: '1.6 1 0', minWidth: 200 }}
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder={t('educationQuality.common.allIndicators')}
          options={(indData?.docs ?? []).map((i) => ({ label: i.title, value: i._id }))}
        />
        <Select
          value={facultyFilter}
          onChange={onFacultyChange}
          style={{ flex: '1.2 1 0', minWidth: 170 }}
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder={t('educationQuality.common.allFaculties')}
          options={(faculties ?? []).map((f) => ({ label: f.title, value: f._id }))}
        />
        <Select
          value={deptFilter}
          onChange={setDeptFilter}
          style={{ flex: '1.2 1 0', minWidth: 170 }}
          showSearch
          optionFilterProp="label"
          allowClear
          placeholder={t('educationQuality.common.allDepartments')}
          options={(departments ?? []).map((d) => ({ label: d.title, value: d._id }))}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'flex-end' }}>
        <ExportButton
          onExport={exportRows}
          disabled={rows.length === 0}
          disabledReason={t('educationQuality.verification.exportEmpty')}
        />
      </div>

      <TableCard>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={pageRows}
          loading={isLoading}
          pagination={false}
          locale={{
            emptyText: statusTab === 'pending' || !statusTab
              ? t('educationQuality.verification.emptyPending')
              : t('educationQuality.verification.empty'),
          }}
        />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={rows.length}
          totalText={t('educationQuality.common.total')}
          onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
      </TableCard>

      <SubmissionDrawer
        open={drawerOpen}
        submission={selected}
        onClose={() => setDrawerOpen(false)}
        readOnly={statusTab !== 'pending' && statusTab !== undefined}
      />

      <Modal
        open={!!confirmTarget}
        title={t('educationQuality.verification.approveTitle')}
        onOk={doConfirmApprove}
        onCancel={() => setConfirmTarget(null)}
        okText={t('educationQuality.verification.approve')}
        cancelText={t('educationQuality.common.cancel')}
        confirmLoading={reviewMut.isPending}
        centered
      >
        {confirmTarget && (() => {
          const coeff = Math.round((confirmTarget.authorShare / 100) * 100) / 100;
          const points = Math.round(confirmTarget.indicator.coefficient * coeff * 100) / 100;
          return (
            <div style={{ display: 'flex', gap: 14, fontSize: 14, lineHeight: 1.7 }}>
              <ExclamationCircleFilled style={{ color: 'var(--brand-primary, #16B364)', fontSize: 22, marginTop: 2 }} />
              <div>
                <div>
                  {t('educationQuality.verification.submittedByLabel')}{' '}
                  <b>{fullName(confirmTarget.teacher)}</b>
                </div>
                <div style={{ color: 'var(--color-text-tertiary, #667085)' }}>{confirmTarget.indicator.title}</div>
                <div style={{ marginTop: 8 }}>
                  {t('educationQuality.verification.approveScoreLabel')}{' '}
                  <b style={{ color: 'var(--brand-primary, #0B843F)' }}>{points}</b>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={!!rejectTarget}
        title={
          <span>
            <ExclamationCircleFilled style={{ color: 'var(--brand-error, #F04438)', marginRight: 8 }} />
            {t('educationQuality.verification.rejectTitle')}
          </span>
        }
        onOk={doReject}
        onCancel={() => setRejectTarget(null)}
        okText={t('educationQuality.verification.reject')}
        cancelText={t('educationQuality.common.cancel')}
        okButtonProps={{ danger: true, disabled: !reason.trim() }}
        confirmLoading={reviewMut.isPending}
        centered
      >
        {rejectTarget && (
          <>
            <div style={{ marginBottom: 12, fontSize: 14 }}>
              <b>{fullName(rejectTarget.teacher)}</b> ·{' '}
              <span style={{ color: 'var(--color-text-tertiary, #667085)' }}>{rejectTarget.indicator.title}</span>
            </div>
            <p style={{ color: 'var(--color-text-secondary, #475467)', marginTop: 0 }}>
              {t('educationQuality.verification.rejectHint')}
            </p>
            <Input.TextArea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('educationQuality.verification.reasonPlaceholder')}
            />
          </>
        )}
      </Modal>
    </Page>
  );
}
