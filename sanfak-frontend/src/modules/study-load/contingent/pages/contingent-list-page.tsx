import { useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Alert, App, Button, Tag, Typography } from 'antd';
import { PlusOutlined, FileExcelOutlined } from '@ant-design/icons';
import { PageContainer, DataTable, ActionButtons, Filters, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission } from '@/app/session';
import {
  useContingents,
  useDeleteContingent,
  useDirectionsRef,
  useCoursesRef,
  useAcademicYearsForSelect,
  getApiErrorMessage,
  fetchAllContingents,
  type Contingent,
  type ContingentsFilter,
} from '../api/contingent-api';
import ContingentForm from '../components/contingent-modal';
import DeleteConfirm from '../../components/delete-confirm';
import { exportContingentsToExcel } from '../../lib/excel';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const LIMIT = 10;

const LANG_TAG_COLORS: Record<string, string> = {
  uz: '#34C18C',
  ru: '#2E90FA',
  en: '#EF6820',
};

function getLangTagColor(langTitle: string | null): string | undefined {
  if (!langTitle) return undefined;
  const lower = langTitle.toLowerCase();
  if (lower.includes("o'zb") || lower.includes('uzb') || lower.includes('ўзб')) {
    return LANG_TAG_COLORS['uz'];
  }
  if (lower.includes('rus') || lower.includes('рус')) {
    return LANG_TAG_COLORS['ru'];
  }
  if (lower.includes('ing') || lower.includes('eng') || lower.includes('инг')) {
    return LANG_TAG_COLORS['en'];
  }
  return undefined;
}

const StudentNumberCell = ({ value }: { value: number }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 10px',
      border: '1px solid var(--color-border, #E3E8EF)',
      borderRadius: 'var(--radius-sm, 4px)',
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--color-text, #121926)',
      background: 'transparent',
    }}
  >
    {value}
  </span>
);

interface IDeleteBodyProps {
  itemId: string;
}

const ContingentDeleteBody = ({ itemId }: IDeleteBodyProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const deleteContingent = useDeleteContingent();

  const handleConfirm = async () => {
    try {
      await deleteContingent.mutateAsync(itemId);
      message.success(t('studyLoad.contingent.deleted'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <DeleteConfirm
      loading={deleteContingent.isPending}
      onConfirm={handleConfirm}
    />
  );
};

const ContingentListPage = () => {
  const { t } = useTranslation();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');
  const [directionId, setDirectionId] = useState<string | undefined>(undefined);
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [academicYearId, setAcademicYearId] = useState<string | undefined>(undefined);

  const filter: ContingentsFilter = useMemo(
    () => ({
      page,
      limit: pageSize,
      search: search || undefined,
      direction: directionId,
      course: courseId,
      academicYear: academicYearId,
    }),
    [page, pageSize, search, directionId, courseId, academicYearId],
  );

  const { data, isLoading, isError, error } = useContingents(filter);
  const { message } = App.useApp();
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const totalPages = data?.meta.totalPages;
    if (totalPages !== undefined && totalPages >= 1 && page > totalPages) {
      setPage(totalPages);
    }
  }, [data?.meta.totalPages, page]);

  const { data: directions = [] } = useDirectionsRef();
  const { data: courses = [] } = useCoursesRef();
  const { data: academicYears = [] } = useAcademicYearsForSelect();

  const directionOptions = useMemo(
    () => directions.map((d) => ({ label: d.title, value: d.id })),
    [directions],
  );

  const courseOptions = useMemo(
    () => courses.map((c) => ({ label: c.title, value: c.id })),
    [courses],
  );

  const academicYearOptions = useMemo(
    () => academicYears.map((ay) => ({ label: ay.title, value: ay.id })),
    [academicYears],
  );

  const handleOpenCreate = () => {
    showModal({
      title: t('studyLoad.contingent.create'),
      body: ContingentForm,
      maxWidth: '545px',
      maxHeight: '70vh',
      bodyPadding: '0',
    });
  };

  const handleOpenEdit = (item: Contingent) => {
    showModal({
      title: t('studyLoad.contingent.edit'),
      body: () => <ContingentForm item={item} />,
      maxWidth: '545px',
      maxHeight: '70vh',
      bodyPadding: '0',
    });
  };

  const handleDelete = (item: Contingent) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <ContingentDeleteBody itemId={item.id} />,
    });
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      const all = await fetchAllContingents({
        search: filter.search,
        direction: filter.direction,
        course: filter.course,
        academicYear: filter.academicYear,
      });
      exportContingentsToExcel(all, 'Kontingent.xlsx');
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<Contingent>[] = [
    {
      header: t('studyLoad.contingent.column.title'),
      id: 'title',
      cell: ({ row }) => (
        <strong style={{ color: 'var(--color-text)' }}>{row.original.title}</strong>
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
      header: t('studyLoad.distribution.column.course'),
      id: 'course',
      size: 100,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.courseTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.contingent.column.academicYear'),
      id: 'academicYear',
      size: 140,
      cell: ({ row }) => (
        <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {row.original.academicYearTitle ?? '—'}
        </Typography.Text>
      ),
    },
    {
      header: t('studyLoad.contingent.column.studentNumber'),
      id: 'studentNumber',
      size: 160,
      cell: ({ row }) => <StudentNumberCell value={row.original.studentNumber} />,
    },
    {
      header: t('studyLoad.contingent.column.lang'),
      id: 'lang',
      size: 140,
      cell: ({ row }) => {
        const title = row.original.langTitle;
        const color = getLangTagColor(title);
        return title ? (
          <Tag
            color={color}
            style={{
              borderRadius: 'var(--radius-pill)',
              color: color !== undefined ? '#fff' : undefined,
              borderColor: color ?? undefined,
            }}
          >
            {title}
          </Tag>
        ) : (
          <Typography.Text style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
            —
          </Typography.Text>
        );
      },
    },
    {
      header: t('studyLoad.distribution.column.actions'),
      id: 'actions',
      size: 80,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <ActionButtons
            onEdit={can('group:update') ? () => handleOpenEdit(item) : undefined}
            onDelete={can('group:delete') ? () => handleDelete(item) : undefined}
            hideEdit={!can('group:update')}
            hideDelete={!can('group:delete')}
            hideToggle
          />
        );
      },
    },
  ];

  return (
    <PageContainer title={t('studyLoad.nav.contingent')}>
      <Filters
        searchPlaceholder={t('studyLoad.contingent.searchPlaceholder')}
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
            key: 'course',
            placeholder: t('studyLoad.workingSchedule.filter.allCourses'),
            value: courseId,
            options: courseOptions,
            onChange: (v) => {
              setCourseId(v);
              setPage(1);
            },
          },
          {
            key: 'academicYear',
            placeholder: t('studyLoad.contingent.filter.allYears'),
            value: academicYearId,
            options: academicYearOptions,
            onChange: (v) => {
              setAcademicYearId(v);
              setPage(1);
            },
          },
        ]}
        extra={
          <>
            <Can perform="group:readAll">
              <Button
                icon={<FileExcelOutlined />}
                loading={exporting}
                onClick={() => void handleExcel()}
                style={{ color: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' }}
              >
                {t('studyLoad.workingSchedule.excel')}
              </Button>
            </Can>
            <Can perform="group:create">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreate}
                style={{ height: 38 }}
              >
                {t('studyLoad.contingent.create')}
              </Button>
            </Can>
          </>
        }
      />

      {isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('studyLoad.contingent.loadError')}
          description={getApiErrorMessage(error)}
        />
      )}

      <DataTable<Contingent>
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
    </PageContainer>
  );
};

export default ContingentListPage;
