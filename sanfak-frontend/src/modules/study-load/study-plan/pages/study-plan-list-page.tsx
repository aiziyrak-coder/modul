import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type ColumnDef } from '@tanstack/react-table';
import { App, Button, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { PageContainer, DataTable, ActionButtons, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission } from '@/app/session';
import StatusBadge from '../../components/status-badge';
import { openPdf } from '../../lib/open-pdf';
import {
  useStudyPlans,
  useDeleteStudyPlan,
  useDirections,
  getApiErrorMessage,
  STUDY_PLAN_KEY,
  type StudyPlansFilter,
} from '../api/study-plan-api';
import type { StudyPlan } from '../model/types';
import UploadForm from '../components/upload-modal';
import GenerateModal from '../../working-schedule/components/generate-modal';
import CreateWorkingPlanConfirm from '../components/create-working-plan-confirm';
import { WORKING_SCHEDULE_KEY } from '../../working-schedule/api/working-schedule-api';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

const StudyPlanListPage = () => {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const can = usePermission();
  const qc = useQueryClient();
  const showModal = useModalStore((s) => s.showModal);
  const navigate = useNavigate();

  const [generateLpId, setGenerateLpId] = useState<string | null>(null);
  const [approval, setApproval] = useState<string>('');
  const [generateCourses, setGenerateCourses] = useState<number[] | undefined>(undefined);
  const [confirmLpId, setConfirmLpId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState<string>('');
  const [directionId, setDirectionId] = useState<string | undefined>(undefined);
  const [academicYear, setAcademicYear] = useState<string | undefined>(undefined);

  const filter: StudyPlansFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      direction: directionId,
      academicYear,
    }),
    [page, pageSize, search, directionId, academicYear],
  );

  const { data, isLoading } = useStudyPlans(filter);

  useEffect(() => {
    const totalPages = data?.meta.totalPages;
    if (totalPages !== undefined && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.meta.totalPages, page]);

  const { data: directions = [] } = useDirections();
  const deletePlan = useDeleteStudyPlan();

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    (data?.items ?? []).forEach((p) => {
      if (p.academicYear) years.add(p.academicYear);
    });
    return [...years].map((y) => ({ label: y, value: y }));
  }, [data]);

  const directionOptions = useMemo(
    () => directions.map((d) => ({ label: d.title, value: d.id })),
    [directions],
  );

  const handleDelete = (plan: StudyPlan) => {
    modal.confirm({
      title: t('studyLoad.studyPlan.deleteTitle'),
      content: t('studyLoad.studyPlan.deleteContent', {
        title: plan.title ?? t('studyLoad.nav.studyPlan'),
      }),
      okText: t('studyLoad.common.delete'),
      okType: 'danger',
      cancelText: t('studyLoad.common.cancel'),
      centered: true,
      onOk: async () => {
        try {
          await deletePlan.mutateAsync(plan.id);
          message.success(t('studyLoad.studyPlan.deleted'));
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  const handleViewDetail = (plan: StudyPlan) => {
    void openPdf(`/study-plans/${plan.id}/pdf`, message, t);
  };

  const columns: ColumnDef<StudyPlan>[] = [
    {
      header: '#',
      id: 'index',
      size: 48,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.distribution.column.title'),
      id: 'title',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>
          {row.original.title ?? '—'}
        </strong>
      ),
    },
    {
      header: t('studyLoad.progress.step.direction'),
      id: 'direction',
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.directionTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.studyPlan.column.academicYear'),
      id: 'academicYear',
      size: 160,
      cell: ({ row }) => row.original.academicYear ?? '—',
    },
    {
      header: t('studyLoad.workingSchedule.column.uploadedDate'),
      id: 'createdAt',
      size: 150,
      cell: ({ row }) =>
        row.original.createdAt
          ? dayjs(row.original.createdAt).format('DD/MM/YYYY HH:mm')
          : '—',
    },
    {
      header: t('studyLoad.distribution.column.status'),
      id: 'status',
      size: 130,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 180,
      meta: { align: 'right' as const },
      cell: ({ row }) => {
        const plan = row.original;
        const isNew = plan.status === 'new';

        return (
          <ActionButtons
            onView={
              can('studyPlan:export') ? () => handleViewDetail(plan) : undefined
            }
            viewLabel={t('studyLoad.common.view')}
            onEdit={
              isNew && can('studyPlan:update')
                ? () => navigate(`/study-load/study-plans/${plan.learningProcessId ?? plan.id}`)
                : undefined
            }
            onAccept={
              isNew && can('workingSchedule:update') && plan.learningProcessId
                ? () => setConfirmLpId(plan.learningProcessId!)
                : undefined
            }
            acceptLabel={t('studyLoad.common.create')}
            onDelete={
              isNew && can('studyPlan:delete')
                ? () => handleDelete(plan)
                : undefined
            }
            hideEdit={!isNew || !can('studyPlan:update')}
            hideDelete={!isNew || !can('studyPlan:delete')}
            hideToggle
          />
        );
      },
    },
  ];

  return (
    <PageContainer title={t('studyLoad.nav.studyPlan')}>
      <Filters
        searchPlaceholder={t('studyLoad.studyPlan.searchPlaceholder')}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'direction',
            placeholder: t('studyLoad.workingSchedule.filter.allDirections'),
            value: directionId,
            options: directionOptions,
            onChange: (v) => {
              setDirectionId(v);
              setPage(1);
            },
          },
          {
            key: 'academicYear',
            placeholder: t('studyLoad.studyPlan.filter.allYears'),
            value: academicYear,
            options: yearOptions,
            onChange: (v) => {
              setAcademicYear(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <Can perform="learningProcess:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() =>
                showModal({
                  title: t('studyLoad.studyPlan.upload'),
                  body: UploadForm,
                  right: true,
                  maxWidth: '756px',
                  bodyPadding: '0',
                  overflow: true,
                })
              }
              style={{ height: 38 }}
            >
              {t('studyLoad.studyPlan.upload')}
            </Button>
          </Can>
        }
      />

      <DataTable<StudyPlan>
        data={data?.items ?? []}
        columns={columns}
        loading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.meta.total}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />

      {confirmLpId ? (
        <CreateWorkingPlanConfirm
          open={!!confirmLpId}
          learningProcessId={confirmLpId}
          onConfirm={(approval, courses) => {
            setApproval(approval);
            setGenerateCourses(courses);
            setGenerateLpId(confirmLpId);
            setConfirmLpId(null);
          }}
          onCancel={() => setConfirmLpId(null)}
        />
      ) : null}

      {generateLpId ? (
        <GenerateModal
          open={!!generateLpId}
          learningProcessId={generateLpId}
          approval={approval}
          courses={generateCourses}
          onDone={(result) => {
            void qc.invalidateQueries({ queryKey: [STUDY_PLAN_KEY] });
            void qc.invalidateQueries({ queryKey: [WORKING_SCHEDULE_KEY] });

            const backendMessage = result.message.trim();
            if (result.totalCreated > 0) {
              message.success(
                backendMessage !== ''
                  ? backendMessage
                  : t('studyLoad.studyPlan.workingScheduleCreated'),
              );
            } else {
              message.warning(
                backendMessage !== ''
                  ? backendMessage
                  : t('studyLoad.workingSchedule.generate.noResult'),
              );
            }
          }}
          onClose={() => setGenerateLpId(null)}
        />
      ) : null}
    </PageContainer>
  );
};

export default StudyPlanListPage;
