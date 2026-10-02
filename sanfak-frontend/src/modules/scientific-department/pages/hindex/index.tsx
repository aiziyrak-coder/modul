import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Form, Input, Space, Tag, Tooltip } from 'antd';
import Modal from '../../components/scroll-modal';
import {
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  LinkOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { type ColumnDef } from '@tanstack/react-table';
import { PageContainer, Card, DataTable, Filters, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useSessionStore } from '@/app/session';
import {
  downloadHIndexExcel,
  useHIndexProfilesPaginate,
  useMyHIndex,
  useRefreshMyScopus,
  useUpsertMyHIndex,
  type HIndexUpsertPayload,
} from '../../api/hindex-api';
import { useFaculties } from '../../api/reference-api';
import { useSciRole } from '../../model/role-status';
import TableGap from '../../components/table-gap';
import type { HIndexProfile } from '../../model/types';

interface UrlFormValues {
  scopusUrl?: string;
  scholarUrl?: string;
}

const bestHColor = (h: number): string =>
  h >= 15 ? 'gold' : h >= 8 ? 'green' : 'blue';

export default function HIndexPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useSciRole();
  const isTeacher = role === 'teacher';

  if (isTeacher) return <TeacherProfile />;

  return <ProfilesTable t={t} navigate={navigate} />;
}

function TeacherProfile() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const user = useSessionStore((s) => s.user);
  const { data: profile } = useMyHIndex();
  const upsert = useUpsertMyHIndex();
  const refreshScopus = useRefreshMyScopus();

  const handleRefresh = async () => {
    try {
      await refreshScopus.mutateAsync();
      message.success(t('scientificDepartment.hindex.refreshed'));
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<UrlFormValues>();

  const hasScopus = !!profile?.scopusUrl;
  const hasScholar = !!profile?.scholarUrl;
  const hasAny = hasScopus || hasScholar;

  const openModal = () => {
    form.setFieldsValue({
      scopusUrl: profile?.scopusUrl || undefined,
      scholarUrl: profile?.scholarUrl || undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const payload: HIndexUpsertPayload = {
      scopusUrl: values.scopusUrl?.trim() || '',
      scholarUrl: values.scholarUrl?.trim() || '',
    };
    try {
      await upsert.mutateAsync(payload);
      message.success(t('scientificDepartment.hindex.saved'));
      setModalOpen(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <PageContainer title={t('scientificDepartment.hindex.title')}>
      <Card size="small">
        <div
          style={{
            background: 'linear-gradient(135deg, var(--brand-primary-soft), #fff)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, #fff)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px',
          }}
        >
          <Flex align="flex-start" justify="space-between" gap={16} wrap>
            <div>
              <Tag color="green" style={{ marginBottom: 10 }}>
                {t('scientificDepartment.hindex.personalCabinet')}
              </Tag>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>
                {user?.fullName || '—'}
              </div>
              {profile && (profile.facultyName || profile.departmentName) ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-mute)', marginTop: 4 }}>
                  {[profile.facultyName, profile.departmentName].filter(Boolean).join(' · ')}
                </div>
              ) : null}
              <div style={{ marginTop: 12 }}>
                {hasAny ? (
                  <Flex gap={8} wrap>
                    {hasScopus ? (
                      <Tag color="green" icon={<LinkOutlined />}>
                        {t('scientificDepartment.hindex.scopusConnected')}
                      </Tag>
                    ) : null}
                    {hasScholar ? (
                      <Tag color="green" icon={<LinkOutlined />}>
                        {t('scientificDepartment.hindex.scholarConnected')}
                      </Tag>
                    ) : null}
                  </Flex>
                ) : (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'color-mix(in srgb, var(--brand-warning) 12%, #fff)',
                      border: '1px solid color-mix(in srgb, var(--brand-warning) 40%, #fff)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                      fontSize: 12.5,
                      color: 'var(--color-text-soft)',
                    }}
                  >
                    <WarningOutlined style={{ color: 'var(--brand-warning)' }} />
                    {t('scientificDepartment.hindex.noProfileWarning')}
                  </div>
                )}
              </div>
            </div>
            <Flex gap={8} wrap>
              {hasAny ? (
                <Button
                  icon={<SyncOutlined />}
                  loading={refreshScopus.isPending}
                  onClick={handleRefresh}
                >
                  {t('scientificDepartment.hindex.refreshMetrics')}
                </Button>
              ) : null}
              <Button type="primary" icon={<LinkOutlined />} onClick={openModal}>
                {hasAny
                  ? t('scientificDepartment.hindex.editUrl')
                  : t('scientificDepartment.hindex.attachUrl')}
              </Button>
            </Flex>
          </Flex>
        </div>

        {hasAny ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              {t('scientificDepartment.hindex.myProfile')}
            </div>
            <Flex vertical gap={10}>
              {hasScopus ? (
                <ProfileLinkRow
                  label="Scopus"
                  color="blue"
                  url={profile?.scopusUrl ?? ''}
                />
              ) : null}
              {hasScholar ? (
                <ProfileLinkRow
                  label="Google Scholar"
                  color="green"
                  url={profile?.scholarUrl ?? ''}
                />
              ) : null}
            </Flex>
          </div>
        ) : null}
      </Card>

      <Modal centered
        title={
          <Space size={8}>
            <EditOutlined />
            {t('scientificDepartment.hindex.urlModalTitle')}
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={t('scientificDepartment.save')}
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={upsert.isPending}
        width={520}
      >
        <div
          style={{
            background: 'var(--brand-primary-soft)',
            border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, #fff)',
            borderRadius: 'var(--radius-md)',
            padding: '10px 14px',
            fontSize: 12.5,
            color: 'var(--color-text-soft)',
            marginBottom: 16,
          }}
        >
          {t('scientificDepartment.hindex.modalHint')}
        </div>
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('scientificDepartment.hindex.scopusUrl')}
            name="scopusUrl"
            rules={[{ type: 'url', message: t('scientificDepartment.hindex.urlInvalid') }]}
            extra={t('scientificDepartment.hindex.scopusExample')}
          >
            <Input
              type="url"
              prefix={<LinkOutlined style={{ color: 'var(--color-text-mute)' }} />}
              placeholder="https://www.scopus.com/authid/..."
            />
          </Form.Item>
          <Form.Item
            label={t('scientificDepartment.hindex.scholarUrl')}
            name="scholarUrl"
            rules={[{ type: 'url', message: t('scientificDepartment.hindex.urlInvalid') }]}
            extra={t('scientificDepartment.hindex.scholarExample')}
          >
            <Input
              type="url"
              prefix={<LinkOutlined style={{ color: 'var(--color-text-mute)' }} />}
              placeholder="https://scholar.google.com/citations?user=..."
            />
          </Form.Item>

        </Form>
      </Modal>
    </PageContainer>
  );
}

function ProfileLinkRow({
  label,
  color,
  url,
}: {
  label: string;
  color: string;
  url: string;
}) {
  return (
    <Flex
      align="center"
      gap={10}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
      }}
    >
      <Tag color={color} style={{ margin: 0 }}>
        {label}
      </Tag>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 13, wordBreak: 'break-all' }}
      >
        <LinkOutlined /> {url}
      </a>
    </Flex>
  );
}

function ProfilesTable({
  t,
  navigate,
}: {
  t: ReturnType<typeof useTranslation>['t'];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { data: faculties = [] } = useFaculties();
  const [faculty, setFaculty] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const filters = useMemo(
    () => ({
      faculty,
      search: search || undefined,
    }),
    [faculty, search],
  );

  const { data, isFetching } = useHIndexProfilesPaginate(page, pageSize, filters);
  const profiles = data?.docs ?? [];
  const total = data?.totalDocs ?? 0;

  const { message } = App.useApp();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadHIndexExcel(filters);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnDef<HIndexProfile, unknown>[] = [
    {
      id: 'idx',
      header: '№',
      size: 50,
      cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
    },
    {
      id: 'teacher',
      header: t('scientificDepartment.hindex.colTeacher'),
      cell: ({ row }) => <strong>{row.original.teacherName || '—'}</strong>,
    },
    {
      id: 'faculty',
      header: t('scientificDepartment.hindex.colFaculty'),
      size: 200,
      cell: ({ row }) => row.original.facultyName || '—',
    },
    {
      id: 'scopus',
      header: 'Scopus',
      size: 120,
      meta: { align: 'center' as const },
      cell: ({ row }) => <ProfileLink url={row.original.scopusUrl} color="#2563eb" t={t} />,
    },
    {
      id: 'scopusH',
      header: t('scientificDepartment.hindex.colScopusH'),
      size: 120,
      meta: { align: 'center' as const },
      cell: ({ row }) => <HTag value={row.original.scopusHIndex} />,
    },
    {
      id: 'scholar',
      header: 'Google Scholar',
      size: 140,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <ProfileLink url={row.original.scholarUrl} color="var(--brand-primary)" t={t} />
      ),
    },
    {
      id: 'scholarH',
      header: t('scientificDepartment.hindex.colScholarH'),
      size: 120,
      meta: { align: 'center' as const },
      cell: ({ row }) => <HTag value={row.original.scholarHIndex} />,
    },
    {
      id: 'actions',
      header: t('scientificDepartment.actions'),
      size: 90,
      meta: { align: 'center' as const },
      cell: ({ row }) => (
        <Flex align="center" justify="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('scientificDepartment.view')}>
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
              onClick={() => navigate(`/scientific-department/hindex/${row.original.id}`)}
            />
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <PageContainer title={t('scientificDepartment.hindex.title')}>
      <Filters
        searchPlaceholder="scientificDepartment.hindex.searchPlaceholder"
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        selects={[
          {
            key: 'faculty',
            placeholder: 'scientificDepartment.hindex.allFaculties',
            value: faculty,
            options: faculties.map((f) => ({ value: f.id, label: f.name })),
            onChange: (v) => {
              setFaculty(v as string | undefined);
              setPage(1);
            },
          },
        ]}
        extra={
          <Flex align="center" gap={12}>
            <span style={{ color: 'var(--color-text-mute)', fontSize: 13 }}>
              {t('scientificDepartment.hindex.total', { n: total })}
            </span>
            <Button
              icon={<FileExcelOutlined />}
              loading={exporting}
              onClick={handleExport}
              style={{
                background: 'var(--brand-primary)',
                borderColor: 'var(--brand-primary)',
                color: '#fff',
              }}
            >
              {t('scientificDepartment.hindex.exportExcel')}
            </Button>
          </Flex>
        }
      />

      <TableGap>
        <DataTable<HIndexProfile>
          data={profiles}
          columns={columns}
          loading={isFetching}
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p, ps) => {
            setPage(p);
            setPageSize(ps);
          }}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          onRowClick={(row) => navigate(`/scientific-department/hindex/${row.id}`)}
        />
      </TableGap>
    </PageContainer>
  );
}


function ProfileLink({
  url,
  color,
  t,
}: {
  url: string;
  color: string;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  if (!url) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ color, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}
    >
      <LinkOutlined />
      {t('scientificDepartment.hindex.openProfile')}
    </a>
  );
}

function HTag({ value }: { value: number }) {
  if (!value) return <span style={{ color: 'var(--color-text-mute)' }}>—</span>;
  return (
    <Tag color={bestHColor(value)} style={{ margin: 0, fontWeight: 600 }}>
      {value}
    </Tag>
  );
}
