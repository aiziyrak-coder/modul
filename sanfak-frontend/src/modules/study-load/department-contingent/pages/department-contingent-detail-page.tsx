import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, App, Button, Empty, Skeleton, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, MinusCircleOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { Can, usePermission } from '@/app/session';
import DeleteConfirm from '../../components/delete-confirm';
import {
  httpStatus,
  useDeleteDeptContingent,
  useDeptContingentDetail,
  useUpdateDeptContingent,
} from '../api/department-contingent-api';
import { languageTitlesOf, rowToInput } from '../api/mapper';
import type { DeptContingentDetail, DeptContingentRow, SaveResult } from '../model/types';
import RowEditorModal from '../components/row-editor-modal';

const { Title, Text } = Typography;
const BASE = '/study-load/department-contingents';

const RemoveRowBody = ({
  detail,
  row,
  onSaved,
}: {
  detail: DeptContingentDetail;
  row: DeptContingentRow;
  onSaved: (res: SaveResult) => void;
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const update = useUpdateDeptContingent();
  const handleConfirm = async () => {
    try {
      const res = await update.mutateAsync({
        id: detail.id,
        rows: detail.rows.filter((r) => r.key !== row.key).map(rowToInput),
      });
      hideModal();
      onSaved(res);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };
  return (
    <DeleteConfirm
      title={t('studyLoad.deptContingent.removeRowTitle')}
      subtitle={t('studyLoad.deptContingent.removeRowSubtitle', {
        direction: row.directionTitle,
        course: row.courseNum,
      })}
      loading={update.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
};

const DeleteDocBody = ({ detail, onDone }: { detail: DeptContingentDetail; onDone: () => void }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const del = useDeleteDeptContingent();
  const handleConfirm = async () => {
    try {
      const res = await del.mutateAsync(detail.id);
      message.success(t('studyLoad.deptContingent.deleted'));
      if (res.flaggedWorkloads > 0) {
        message.warning(t('studyLoad.deptContingent.flagged', { count: res.flaggedWorkloads }));
      }
      hideModal();
      onDone();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };
  return (
    <DeleteConfirm
      title={t('studyLoad.deptContingent.deleteTitle')}
      subtitle={t('studyLoad.deptContingent.deleteSubtitle', { year: detail.academicYearTitle })}
      loading={del.isPending}
      onConfirm={() => void handleConfirm()}
    />
  );
};

const DepartmentContingentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();
  const { message } = App.useApp();
  const can = usePermission();
  const showModal = useModalStore((s) => s.showModal);

  const { data, isLoading, isError, error, refetch } = useDeptContingentDetail(id);
  const languageTitles = useMemo(
    () => languageTitlesOf((data?.rows ?? []).flatMap((r) => r.streams.flatMap((s) => s.groups))),
    [data],
  );

  const canEdit = can('departmentContingent:update');

  const handleSaved = (res: SaveResult) => {
    message.success(res.message || t('studyLoad.deptContingent.saved'));
    if (res.flaggedWorkloads > 0) {
      message.warning(t('studyLoad.deptContingent.flagged', { count: res.flaggedWorkloads }));
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }
  if (isError || !data) {
    const status = httpStatus(error);
    const retryable = status !== 404 && status !== 403;
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Empty
          description={
            status === 403
              ? t('studyLoad.deptContingent.forbidden')
              : retryable
                ? t('studyLoad.deptContingent.loadError')
                : t('studyLoad.deptContingent.notFound')
          }
        />
        <Space style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(BASE)}>
            {t('studyLoad.common.back')}
          </Button>
          {retryable ? (
            <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
              {t('studyLoad.deptContingent.retry')}
            </Button>
          ) : null}
        </Space>
      </div>
    );
  }

  const openEditor = (editKey?: string) =>
    showModal({
      title: t(editKey ? 'studyLoad.deptContingent.editor.editTitle' : 'studyLoad.deptContingent.editor.addTitle'),
      maxWidth: '720px',
      bodyPadding: '0',
      body: () => (
        <RowEditorModal
          contingentId={data.id}
          academicYearId={data.academicYearId}
          rows={data.rows}
          editKey={editKey}
          onSaved={handleSaved}
        />
      ),
    });

  const openRemoveRow = (row: DeptContingentRow) =>
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <RemoveRowBody detail={data} row={row} onSaved={handleSaved} />,
    });

  const openDeleteDoc = () =>
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => <DeleteDocBody detail={data} onDone={() => navigate(BASE)} />,
    });

  const staleRows = data.rows.filter((r) => r.problems.length > 0);
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const langNames = (ids: string[]) =>
    ids.map((x) => languageTitles.get(x)).filter((x): x is string => Boolean(x));

  const columns: ColumnsType<DeptContingentRow> = [
    {
      title: t('studyLoad.deptContingent.col.direction'),
      key: 'direction',
      width: 240,
      render: (_: unknown, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.directionTitle || '—'}</Text>
          {r.directionCode ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.directionCode}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: t('studyLoad.deptContingent.col.course'),
      key: 'course',
      width: 80,
      align: 'center',
      render: (_: unknown, r) => r.courseNum,
    },
    {
      title: t('studyLoad.deptContingent.col.streams'),
      key: 'streams',
      render: (_: unknown, r) => (
        <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
          {r.streams.map((s) => {
            const names = langNames(s.languageIds);
            return (
              <div key={s.number} style={{ fontSize: 13 }}>
                <Text strong>{t('studyLoad.deptContingent.streamLabel', { n: s.number })}:</Text>{' '}
                {s.groups.map((g) => g.title || g.id).join(', ') || '—'}
                {names.length ? <Text type="secondary"> · {names.join(', ')}</Text> : null}
                {s.languageIds.length > 1 ? (
                  <Tag color="warning" style={{ marginInlineStart: 'var(--space-1)' }}>
                    {t('studyLoad.deptContingent.stream.mixedLanguages')}
                  </Tag>
                ) : null}
              </div>
            );
          })}
          {r.note ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {r.note}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      title: t('studyLoad.deptContingent.col.groupCount'),
      key: 'groupCount',
      width: 90,
      align: 'center',
      render: (_: unknown, r) => r.derived.groupCount,
    },
    {
      title: t('studyLoad.deptContingent.col.studentCount'),
      key: 'studentCount',
      width: 90,
      align: 'center',
      render: (_: unknown, r) => r.derived.studentCount,
    },
    {
      title: t('studyLoad.deptContingent.col.streamCount'),
      key: 'streamCount',
      width: 90,
      align: 'center',
      render: (_: unknown, r) => <Text strong>{r.derived.streamCount}</Text>,
    },
    {
      title: t('studyLoad.deptContingent.col.state'),
      key: 'state',
      width: 130,
      render: (_: unknown, r) =>
        r.problems.length ? (
          <Tooltip title={r.problems.join('; ')}>
            <Tag color="warning">{t('studyLoad.deptContingent.stale')}</Tag>
          </Tooltip>
        ) : (
          <Tag color="success">{t('studyLoad.deptContingent.actual')}</Tag>
        ),
    },
    ...(canEdit
      ? [
          {
            title: t('studyLoad.deptContingent.column.actions'),
            key: 'actions',
            width: 100,
            align: 'right' as const,
            render: (_: unknown, r: DeptContingentRow) => (
              <Space size={4}>
                <Tooltip title={t('studyLoad.common.edit')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditor(r.key)}
                    aria-label={t('studyLoad.common.edit')}
                  />
                </Tooltip>
                <Tooltip title={t('studyLoad.deptContingent.removeRow')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => openRemoveRow(r)}
                    aria-label={t('studyLoad.deptContingent.removeRow')}
                  />
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <Space size={12} align="start">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate(BASE)}
            aria-label={t('studyLoad.common.back')}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: 'var(--color-text)' }}>
              {t('studyLoad.deptContingent.detailTitle', {
                department: data.departmentTitle || '—',
                year: data.academicYearTitle || '—',
              })}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('studyLoad.deptContingent.detailSubtitle', {
                count: data.rows.length,
                date: fmtDate(data.updatedAt),
              })}
            </Text>
          </div>
        </Space>
        <Space size={8} wrap>
          {canEdit ? (
            <Button type="primary" icon={<PlusOutlined />} style={{ height: 38 }} onClick={() => openEditor()}>
              {t('studyLoad.deptContingent.addRow')}
            </Button>
          ) : null}
          <Can perform="departmentContingent:delete">
            <Button danger icon={<DeleteOutlined />} style={{ height: 38 }} onClick={openDeleteDoc}>
              {t('studyLoad.common.delete')}
            </Button>
          </Can>
        </Space>
      </div>

      {staleRows.length ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('studyLoad.deptContingent.staleTitle', { count: staleRows.length })}
          description={
            <ul style={{ margin: 0, paddingInlineStart: 'var(--space-5)' }}>
              {staleRows.map((r) => (
                <li key={r.key}>
                  {t('studyLoad.deptContingent.staleRow', { direction: r.directionTitle, course: r.courseNum })}{' '}
                  {r.problems.join('; ')}
                </li>
              ))}
            </ul>
          }
        />
      ) : null}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 'var(--space-4)' }}
        message={t('studyLoad.deptContingent.hint')}
      />

      {data.rows.length ? (
        <Table<DeptContingentRow>
          rowKey="key"
          size="small"
          bordered
          columns={columns}
          dataSource={data.rows}
          pagination={false}
          scroll={{ x: 960 }}
        />
      ) : (
        <Empty
          description={t(canEdit ? 'studyLoad.deptContingent.emptyRowsEditable' : 'studyLoad.deptContingent.emptyRows')}
        >
          {canEdit ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>
              {t('studyLoad.deptContingent.addRow')}
            </Button>
          ) : null}
        </Empty>
      )}
    </div>
  );
};

export default DepartmentContingentDetailPage;
