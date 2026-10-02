import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import dayjs from 'dayjs';
import { EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { App, Button, Flex, Tag, Tooltip, Typography } from 'antd';
import { PageContainer, DataTable, Filters, useModalStore } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../../lib/use-confirm';
import {
  fetchPetitionsExport,
  usePetitionsPaginated,
  useAcceptPetition,
  useRejectPetition,
} from '../../../api/petition-api';
import { useCourseOptions } from '../../../api/course-api';
import { PETITION_STATUS } from '../../../model/petition.types';
import type { Petition, PetitionStatus } from '../../../model/petition.types';
import { EDU_FORM } from '../../../model/course.types';
import type { EduForm } from '../../../model/course.types';
import PetitionStatusTag from '../../../components/petition-status-tag';
import PetitionDetailModal from '../../../components/petition-detail-modal';
import ExcelExportButton from '../../../components/excel-export-button';
import { downloadExcel } from '../../../lib/excel';

const { Text } = Typography;
const LIMIT = 12;

const STATUS_LABEL: Record<PetitionStatus, string> = {
  [PETITION_STATUS.PENDING]: 'qualification.enrollment.status.pending',
  [PETITION_STATUS.APPROVED]: 'qualification.enrollment.status.approved',
  [PETITION_STATUS.REJECTED]: 'qualification.enrollment.status.rejected',
};

export default function EnrollmentPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirm } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [course, setCourse] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);

  const { data, isFetching } = usePetitionsPaginated({
    page,
    limit: pageSize,
    search: search || undefined,
    status: status ? Number(status) : undefined,
    course: course || undefined,
  });
  const { data: courseOptions = [] } = useCourseOptions();
  const accept = useAcceptPetition();
  const reject = useRejectPetition();

  const total = data?.meta.total ?? 0;

  const onExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchPetitionsExport({
        search: search || undefined,
        status: status ? Number(status) : undefined,
        course: course || undefined,
      });
      const excel = rows.map((r, i) => ({
        '#': i + 1,
        [t('qualification.enrollment.col.name')]: r.fullName,
        [t('qualification.enrollment.col.passport')]: r.passport,
        [t('qualification.enrollment.col.course')]: r.courseTitle ?? '',
        [t('qualification.enrollment.col.form')]:
          r.form === EDU_FORM.ONLINE
            ? t('qualification.courses.form.online')
            : r.form === EDU_FORM.OFFLINE
              ? t('qualification.courses.form.offline')
              : '',
        [t('qualification.enrollment.col.acceptedAt')]: r.acceptedAt
          ? dayjs(r.acceptedAt).format('DD.MM.YYYY')
          : '',
        [t('qualification.enrollment.col.status')]: t(STATUS_LABEL[r.status]),
      }));
      downloadExcel(excel, 'qabul-arizalari', 'Qabul', [6, 28, 18, 30, 14, 16, 16]);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const openDetail = (id: string) =>
    showModal({
      title: t('qualification.enrollment.detailTitle'),
      body: () => <PetitionDetailModal id={id} />,
      maxWidth: '560px',
    });

  const onAccept = (row: Petition) =>
    confirm(
      async () => {
        try {
          await accept.mutateAsync(row.id);
          message.success(t('qualification.enrollment.accepted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.enrollment.acceptTitle',
        content: 'qualification.enrollment.acceptConfirm',
        okText: 'qualification.enrollment.accept',
      },
    );

  const onReject = (row: Petition) =>
    confirm(
      async () => {
        try {
          await reject.mutateAsync(row.id);
          message.success(t('qualification.enrollment.rejected'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.enrollment.rejectTitle',
        content: 'qualification.enrollment.rejectConfirm',
        okText: 'qualification.enrollment.reject',
        danger: true,
      },
    );

  const formTag = (form?: EduForm) =>
    form === EDU_FORM.ONLINE ? (
      <Tag color="blue">{t('qualification.courses.form.online')}</Tag>
    ) : form === EDU_FORM.OFFLINE ? (
      <Tag color="gold">{t('qualification.courses.form.offline')}</Tag>
    ) : (
      <span style={{ color: 'var(--color-text-mute, #9aa3b2)' }}>—</span>
    );

  const columns: ColumnDef<Petition, unknown>[] = [
    {
      header: '#',
      id: 'idx',
      size: 56,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: t('qualification.enrollment.col.name'),
      accessorKey: 'fullName',
      cell: ({ row }) => <strong>{row.original.fullName}</strong>,
    },
    {
      header: t('qualification.enrollment.col.passport'),
      id: 'passport',
      size: 150,
      cell: ({ row }) => row.original.passport || '—',
    },
    {
      header: t('qualification.enrollment.col.course'),
      id: 'course',
      cell: ({ row }) => row.original.courseTitle ?? '—',
    },
    {
      header: t('qualification.enrollment.col.form'),
      id: 'form',
      size: 120,
      cell: ({ row }) => formTag(row.original.form),
    },
    {
      header: t('qualification.enrollment.col.acceptedAt'),
      id: 'acceptedAt',
      size: 140,
      cell: ({ row }) =>
        row.original.acceptedAt ? (
          dayjs(row.original.acceptedAt).format('DD.MM.YYYY')
        ) : (
          <span style={{ color: 'var(--color-text-mute)' }}>—</span>
        ),
    },
    {
      header: t('qualification.enrollment.col.status'),
      id: 'status',
      size: 140,
      cell: ({ row }) => <PetitionStatusTag status={row.original.status} />,
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 130,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Flex gap={2} justify="center">
          <Tooltip title={t('qualification.enrollment.view')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(row.original.id)}
            />
          </Tooltip>
          {row.original.status === PETITION_STATUS.PENDING && (
            <Can perform="qualPetition:approve">
              <Tooltip
                title={
                  row.original.courseFull
                    ? t('qualification.enrollment.courseFull')
                    : t('qualification.enrollment.accept')
                }
              >
                <span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    disabled={row.original.courseFull}
                    style={{
                      color: row.original.courseFull ? undefined : 'var(--brand-primary)',
                    }}
                    onClick={() => onAccept(row.original)}
                  />
                </span>
              </Tooltip>
            </Can>
          )}
          {row.original.status !== PETITION_STATUS.REJECTED && (
            <Can perform="qualPetition:reject">
              <Tooltip title={t('qualification.enrollment.reject')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  style={{ color: 'var(--brand-error)' }}
                  onClick={() => onReject(row.original)}
                />
              </Tooltip>
            </Can>
          )}
        </Flex>
      ),
    },
  ];

  const statusOptions = [
    { value: String(PETITION_STATUS.PENDING), label: t('qualification.enrollment.status.pending') },
    { value: String(PETITION_STATUS.APPROVED), label: t('qualification.enrollment.status.approved') },
    { value: String(PETITION_STATUS.REJECTED), label: t('qualification.enrollment.status.rejected') },
  ];

  return (
    <PageContainer title={t('qualification.enrollment.nav')}>
      <Filters
        searchValue={search}
        searchPlaceholder="qualification.enrollment.searchPh"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'status',
            placeholder: 'qualification.enrollment.filterStatus',
            value: status,
            options: statusOptions,
            onChange: (v) => {
              setStatus(v);
              setPage(1);
            },
          },
          {
            key: 'course',
            placeholder: 'qualification.enrollment.filterCourse',
            value: course,
            options: courseOptions,
            onChange: (v) => {
              setCourse(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <Flex align="center" gap={12}>
            <Text type="secondary">{t('qualification.enrollment.count', { count: total })}</Text>
            <ExcelExportButton loading={exporting} disabled={total === 0} onClick={onExport} />
          </Flex>
        }
      />

      <TableGap>
        <DataTable<Petition>
          data={data?.items ?? []}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={data?.meta.total}
          onPageChange={(p) => setPage(p)}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </TableGap>
    </PageContainer>
  );
}
