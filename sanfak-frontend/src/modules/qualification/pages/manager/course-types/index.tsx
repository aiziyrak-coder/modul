import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusOutlined } from '@ant-design/icons';
import { App, Button } from 'antd';
import { PageContainer, DataTable, Filters, ActionButtons, useModalStore } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { getApiErrorMessage } from '@/shared/api';
import { Can } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { useConfirm } from '../../../lib/use-confirm';
import { useCourseTypesPaginated, useDeleteCourseType } from '../../../api/course-type-api';
import { DOC_TO_KIND } from '../../../model/course-type.types';
import type { CourseType, DocKind } from '../../../model/course-type.types';
import DocKindTag from '../../../components/doc-kind-tag';
import CourseTypeForm from '../../../components/course-type-form-modal';
import CertTemplatePreview from '../../../components/cert-template-preview';
import malumotnomaPreview from '../../../assets/malumotnoma-preview.jpg';

const LIMIT = 12;

export default function CourseTypesPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { confirmDelete } = useConfirm();
  const showModal = useModalStore((s) => s.showModal);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [docKind, setDocKind] = useState<DocKind | undefined>(undefined);

  const { data, isFetching, refetch } = useCourseTypesPaginated({
    page,
    limit: pageSize,
    kind: docKind ? DOC_TO_KIND[docKind] : undefined,
  });
  const remove = useDeleteCourseType();

  const handleDelete = (row: CourseType) => {
    confirmDelete(
      async () => {
        try {
          await remove.mutateAsync(row.id);
          message.success(t('qualification.courseTypes.deleted'));
          void refetch();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
      {
        title: 'qualification.courseTypes.deleteTitle',
        content: 'qualification.courseTypes.deleteConfirm',
      },
    );
  };

  const previewTemplate = (row: CourseType) => {
    if (row.docKind === 'malumotnoma') {
      showModal({
        title: t('qualification.docKind.malumotnoma'),
        maxWidth: '880px',
        body: () => (
          <img
            src={malumotnomaPreview}
            alt={t('qualification.docKind.malumotnoma')}
            style={{
              width: '100%',
              display: 'block',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-soft, #eef1f5)',
            }}
          />
        ),
      });
      return;
    }
    showModal({
      title: t(`qualification.courseTypes.templateName${row.template}`),
      maxWidth: '640px',
      body: () => <CertTemplatePreview template={row.template} radius={8} />,
    });
  };

  const columns: ColumnDef<CourseType, unknown>[] = [
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
      header: t('qualification.courseTypes.colName'),
      accessorKey: 'title',
      cell: ({ row }) => <strong>{row.original.title}</strong>,
    },
    {
      header: t('qualification.courseTypes.colDocType'),
      id: 'docKind',
      size: 200,
      cell: ({ row }) => <DocKindTag kind={row.original.docKind} />,
    },
    {
      header: t('qualification.courseTypes.colTemplate'),
      id: 'template',
      size: 140,
      cell: ({ row }) =>
        row.original.docKind === 'sertifikat' ? (
          <span>{t(`qualification.courseTypes.templateName${row.original.template}`)}</span>
        ) : (
          <span style={{ color: 'var(--color-text-soft)' }}>—</span>
        ),
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 120,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <ActionButtons
          onView={() => previewTemplate(row.original)}
          onDelete={() => handleDelete(row.original)}
        />
      ),
    },
  ];

  return (
    <PageContainer title={t('qualification.courseTypes.nav')}>
      <Filters
        hideSearch
        onSearch={() => undefined}
        selects={[
          {
            key: 'docKind',
            placeholder: 'qualification.courseTypes.filterDocType',
            value: docKind,
            options: [
              { value: 'sertifikat', label: t('qualification.docKind.sertifikat') },
              { value: 'malumotnoma', label: t('qualification.docKind.malumotnoma') },
            ],
            onChange: (v) => {
              setDocKind(v as DocKind | undefined);
              setPage(1);
            },
          },
        ]}
        extra={
          <Can perform="qualCourseType:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() =>
                showModal({
                  title: t('qualification.courseTypes.formTitle'),
                  body: CourseTypeForm,
                  maxWidth: '545px',
                })
              }
              style={{ height: 40 }}
            >
              {t('qualification.courseTypes.add')}
            </Button>
          </Can>
        }
      />

      <TableGap>
        <DataTable<CourseType>
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
