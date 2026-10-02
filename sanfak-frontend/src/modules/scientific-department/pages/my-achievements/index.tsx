import { useMemo, useState, type ReactNode } from 'react';
import { App, Button, DatePicker, Descriptions, Form, Input, Select, Space, Tabs, Tag, Tooltip, Upload } from 'antd';
import Modal from '../../components/scroll-modal';
import type { UploadFile } from 'antd';
import {
  BookOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { type ColumnDef } from '@tanstack/react-table';
import dayjs, { type Dayjs } from 'dayjs';
import { PageContainer, DataTable, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { usePermission, useSessionStore } from '@/app/session';
import {
  certificateApi,
  defenseApi,
  degreeApi,
  patentApi,
  titleApi,
  type AchievementApi,
  type AchievementPayload,
} from '../../api/achievement-api';
import {
  ACHIEVEMENT_CATEGORIES,
  categoryByKey,
  hasAutoAbstract,
  midSentence,
} from '../../model/achievement-config';
import {
  type Achievement,
  type AchievementCategory,
  type AchievementCategoryKey,
  type AchievementField,
} from '../../model/types';
import {
  useAcademicLevels,
  useAcademicTitles,
  useAcademicYears,
  useScienceBranches,
  useSpecialties,
  type RefChoice,
} from '../../api/reference-api';
import StatusBadge from '../../components/status-badge';
import TableGap from '../../components/table-gap';

const CATEGORY_ICON = {
  trophy: TrophyOutlined,
  book: BookOutlined,
  safety: SafetyCertificateOutlined,
  file: FileTextOutlined,
} as const;

const normFile = (e: UploadFile[] | { fileList: UploadFile[] }): UploadFile[] =>
  Array.isArray(e) ? e : e?.fileList;

type FormValues = Record<string, string | Dayjs | UploadFile[] | undefined>;

const apiByKey: Record<AchievementCategoryKey, AchievementApi> = {
  degrees: degreeApi,
  defense: defenseApi,
  titles: titleApi,
  patents: patentApi,
  certificates: certificateApi,
};

function renderFieldValue(
  field: AchievementField,
  value: unknown,
  t: (k: string) => string,
) {
  if (field.kind === 'select') {
    const opt = field.options?.find((o) => o.value === value);
    if (!opt) return '—';
    return field.tag ? (
      <Tag color={opt.tagColor}>{t(`scientificDepartment.${opt.labelKey}`)}</Tag>
    ) : (
      t(`scientificDepartment.${opt.labelKey}`)
    );
  }
  if (field.kind === 'date') {
    const d = dayjs(value as string);
    return d.isValid() ? d.format('DD.MM.YYYY') : '—';
  }
  const s = value == null || value === '' ? '—' : String(value);
  return s;
}

export default function MyAchievementsPage({
  only,
}: {
  only?: AchievementCategoryKey;
}) {
  const { data: academicLevels = [], isLoading: levelsLoading } = useAcademicLevels();
  const { data: academicTitles = [], isLoading: titlesLoading } = useAcademicTitles();
  const { data: scienceBranches = [], isLoading: branchesLoading } = useScienceBranches();
  const { data: specialties = [], isLoading: specialtiesLoading } = useSpecialties();

  const REF_SOURCES: Record<string, { options: RefChoice[]; loading: boolean }> = {
    academicLevels: { options: academicLevels, loading: levelsLoading },
    academicTitles: { options: academicTitles, loading: titlesLoading },
    scienceBranches: { options: scienceBranches, loading: branchesLoading },
    specialties: { options: specialties, loading: specialtiesLoading },
  };
  const { t } = useTranslation();
  const { data: academicYears = [] } = useAcademicYears();
  const { message } = App.useApp();
  const can = usePermission();
  const userId = useSessionStore((s) => s.user?.id);

  const [activeTab, setActiveTab] = useState<AchievementCategoryKey>(only ?? 'degrees');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const activeCat = categoryByKey(activeTab) as AchievementCategory;
  const canCreate = can(`${activeCat.section}:create`);

  const mineOf = userId ?? null;
  const listQuery = apiByKey[activeTab].usePaginate(page, pageSize, {}, !!mineOf, mineOf);
  const { data, isFetching } = listQuery;
  const rows = data?.docs ?? [];

  const countByKey: Record<AchievementCategoryKey, number | undefined> = {
    degrees: degreeApi.usePaginate(1, 1, {}).data?.totalDocs,
    titles: titleApi.usePaginate(1, 1, {}).data?.totalDocs,
    defense: defenseApi.usePaginate(1, 1, {}).data?.totalDocs,
    patents: patentApi.usePaginate(1, 1, {}).data?.totalDocs,
    certificates: certificateApi.usePaginate(1, 1, {}).data?.totalDocs,
  };

  const createByKey: Record<AchievementCategoryKey, ReturnType<typeof degreeApi.useCreate>> = {
    degrees: degreeApi.useCreate(),
    titles: titleApi.useCreate(),
    defense: defenseApi.useCreate(),
    patents: patentApi.useCreate(),
    certificates: certificateApi.useCreate(),
  };
  const updateByKey: Record<AchievementCategoryKey, ReturnType<typeof degreeApi.useUpdate>> = {
    degrees: degreeApi.useUpdate(),
    titles: titleApi.useUpdate(),
    defense: defenseApi.useUpdate(),
    patents: patentApi.useUpdate(),
    certificates: certificateApi.useUpdate(),
  };

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [formCat, setFormCat] = useState<AchievementCategoryKey | null>(null);
  const [viewing, setViewing] = useState<Achievement | null>(null);
  const [form] = Form.useForm<FormValues>();

  const openAdd = () => {
    setEditing(null);
    setFormCat(activeTab);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (record: Achievement) => {
    setEditing(record);
    setFormCat(activeTab);
    setFormOpen(true);
    const values: FormValues = {};
    activeCat.fields.forEach((f) => {
      const v = record[f.name];
      values[f.name] =
        f.kind === 'date'
          ? v
            ? dayjs(v as string)
            : undefined
          : (v as string | undefined);
    });
    values.upload = record.fileUrl
      ? [
          {
            uid: 'existing',
            name: t('scientificDepartment.myAchievements.file'),
            status: 'done' as const,
          },
        ]
      : undefined;
    form.setFieldsValue(values);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormCat(null);
    form.resetFields();
  };

  const changeCategory = (key: AchievementCategoryKey) => {
    setFormCat(key);
    form.resetFields();
  };

  const handleSubmit = async () => {
    if (!formCat) {
      message.error(t('scientificDepartment.myAchievements.categoryPlaceholder'));
      return;
    }
    const cat = categoryByKey(formCat) as AchievementCategory;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const payload: AchievementPayload = {};
    cat.fields.forEach((f) => {
      const raw = values[f.name];
      if (f.kind === 'date') {
        payload[f.name] = raw ? (raw as Dayjs).format('YYYY-MM-DD') : undefined;
      } else {
        payload[f.name] = (raw as string | undefined) ?? undefined;
      }
    });
    const rawFile = (values.upload as UploadFile[] | undefined)?.[0]
      ?.originFileObj as File | undefined;
    payload.file = rawFile ?? null;
    const rawAbstract = (values.autoAbstract as UploadFile[] | undefined)?.[0]
      ?.originFileObj as File | undefined;
    payload.autoAbstract = rawAbstract ?? null;

    try {
      if (editing) {
        const updatePayload = { ...payload, id: editing.id } as {
          id: string;
        } & AchievementPayload;
        await updateByKey[formCat].mutateAsync(updatePayload);
        message.success(
          editing.status === 'rejected'
            ? t('scientificDepartment.myAchievements.resubmitted')
            : t('scientificDepartment.myAchievements.updated'),
        );
      } else {
        await createByKey[formCat].mutateAsync(payload);
        message.success(t('scientificDepartment.myAchievements.created'));
      }
      closeForm();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const columns = useMemo<ColumnDef<Achievement, unknown>[]>(() => {
    const fieldCols: ColumnDef<Achievement, unknown>[] = activeCat.fields.flatMap((field) => {
      const col: ColumnDef<Achievement, unknown> = {
        id: field.name,
        header: t(`scientificDepartment.${field.labelKey}`),
        cell: ({ row }) => renderFieldValue(field, row.original[field.name], t),
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
    return [
      {
        id: 'idx',
        header: '№',
        size: 50,
        meta: { align: 'center' as const },
        cell: ({ row }) => (page - 1) * pageSize + row.index + 1,
      },
      ...fieldCols,
      {
        id: 'status',
        header: t('scientificDepartment.myAchievements.status'),
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
        size: 170,
        meta: { align: 'center' as const },
        cell: ({ row }) => (
          <Space size={4}>
            {canCreate && row.original.status === 'new' ? (
              <Tooltip title={t('scientificDepartment.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: 18, color: 'var(--brand-info)' }} />}
                  onClick={() => openEdit(row.original)}
                />
              </Tooltip>
            ) : null}
            {canCreate && row.original.status === 'rejected' ? (
              <Tooltip title={t('scientificDepartment.myAchievements.resubmit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<ReloadOutlined style={{ fontSize: 18, color: 'var(--brand-warning)' }} />}
                  onClick={() => openEdit(row.original)}
                />
              </Tooltip>
            ) : null}
            <Tooltip title={t('scientificDepartment.view')}>
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined style={{ fontSize: 18, color: 'var(--color-text-mute)' }} />}
                onClick={() => setViewing(row.original)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat, page, pageSize, canCreate, t]);

  const table = (
    <TableGap>
      <DataTable<Achievement>
        data={rows}
        columns={columns}
        loading={isFetching}
        page={page}
        pageSize={pageSize}
        total={data?.totalDocs ?? 0}
        pageSizeOptions={[12, 24, 36, 48]}
        onPageChange={(p, ps) => {
          setPage(p);
          setPageSize(ps);
        }}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
      />
    </TableGap>
  );

  const tabItems = ACHIEVEMENT_CATEGORIES.map((cat) => {
    const Icon = CATEGORY_ICON[cat.icon];
    const count = countByKey[cat.key];
    return {
      key: cat.key,
      label: (
        <span>
          <Icon style={{ marginRight: 6 }} />
          {t(`scientificDepartment.${cat.tabKey}`)}
          {count === undefined ? null : ` (${count})`}
        </span>
      ),
    };
  });

  const renderFormField = (field: AchievementField) => {
    let control: ReactNode;
    if (field.kind === 'select') {
      control = (
        <Select
          placeholder={t(`scientificDepartment.${field.labelKey}`)}
          options={(field.options ?? []).map((o) => ({
            value: o.value,
            label: t(`scientificDepartment.${o.labelKey}`),
          }))}
        />
      );
    } else if (field.kind === 'ref') {
      const ref = REF_SOURCES[field.refSource ?? 'academicLevels'] ?? {
        options: [],
        loading: false,
      };
      control = (
        <Select
          showSearch
          optionFilterProp="label"
          loading={ref.loading}
          placeholder={t(`scientificDepartment.${field.labelKey}`)}
          options={ref.options}
        />
      );
    } else if (field.kind === 'year') {
      control = (
        <Select
          placeholder={t(`scientificDepartment.${field.labelKey}`)}
          options={academicYears.map((y) => ({ value: y.value, label: y.label }))}
        />
      );
    } else if (field.kind === 'date') {
      control = <DatePicker placeholder={t('scientificDepartment.myAchievements.datePlaceholder')} style={{ width: '100%' }} format="DD.MM.YYYY" />;
    } else {
      control = <Input placeholder={field.placeholder ?? t(`scientificDepartment.${field.labelKey}`)} />;
    }
    return (
      <Form.Item
        key={field.name}
        name={field.name}
        label={t(`scientificDepartment.${field.labelKey}`)}
        rules={[{ required: true, message: t('scientificDepartment.required') }]}
      >
        {control}
      </Form.Item>
    );
  };

  const formCatConfig = formCat ? categoryByKey(formCat) : undefined;
  const submitting =
    formCat != null &&
    (createByKey[formCat].isPending || updateByKey[formCat].isPending);

  return (
    <PageContainer
      title={
        only
          ? t(`scientificDepartment.${activeCat.labelKey}`)
          : t('scientificDepartment.myAchievements.title')
      }
    >
      <Flex align="center" gap={12} wrap style={{ marginBottom: 16 }}>
        <div
          style={{
            flex: 1,
            minWidth: 240,
            background: 'var(--brand-primary-soft)',
            border:
              '1px solid color-mix(in srgb, var(--brand-primary) 30%, #fff)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            fontSize: 13,
            color: 'var(--brand-primary)',
          }}
        >
          {only
            ? t('scientificDepartment.myAchievements.hintOne', {
                name: midSentence(t(`scientificDepartment.${activeCat.labelKey}`)),
              })
            : t('scientificDepartment.myAchievements.hint')}
        </div>
        {canCreate ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openAdd}
            style={{ height: 40 }}
          >
            {t('scientificDepartment.myAchievements.add')}
          </Button>
        ) : null}
      </Flex>

      {!only ? (
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k as AchievementCategoryKey);
          setPage(1);
        }}
        style={{ flexShrink: 0 }}
        items={tabItems}
      />
      ) : null}
      {table}

      <Modal centered
        title={
          only
            ? t(
                editing
                  ? editing.status === 'rejected'
                    ? 'scientificDepartment.myAchievements.resubmitTitleOne'
                    : 'scientificDepartment.myAchievements.editTitleOne'
                  : 'scientificDepartment.myAchievements.addTitleOne',
                { name: t(`scientificDepartment.${activeCat.labelKey}`) },
              )
            : editing
              ? editing.status === 'rejected'
                ? t('scientificDepartment.myAchievements.resubmitTitle')
                : t('scientificDepartment.myAchievements.editTitle')
              : t('scientificDepartment.myAchievements.addTitle')
        }
        open={formOpen}
        onCancel={closeForm}
        onOk={handleSubmit}
        okText={
          editing
            ? t('scientificDepartment.myAchievements.saveAndSend')
            : t('scientificDepartment.myAchievements.save')
        }
        cancelText={t('scientificDepartment.cancel')}
        confirmLoading={submitting}
        width={560}
      >
        {editing && editing.status === 'rejected' ? (
          <div
            style={{
              background: 'color-mix(in srgb, var(--brand-error) 8%, #fff)',
              border: '1px solid color-mix(in srgb, var(--brand-error) 30%, #fff)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--brand-error)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {t('scientificDepartment.myAchievements.rejectedReason')}
            </div>
            <div>{editing.rejectionReason || '—'}</div>
          </div>
        ) : null}

        {only ? null : editing ? (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-mute)',
                marginBottom: 6,
              }}
            >
              {t('scientificDepartment.myAchievements.category')}
            </div>
            <Tag color="var(--brand-primary)">
              {formCatConfig ? t(`scientificDepartment.${formCatConfig.labelKey}`) : ''}
            </Tag>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-mute)',
                marginBottom: 6,
              }}
            >
              {t('scientificDepartment.myAchievements.category')}
            </div>
            <Select
              style={{ width: '100%' }}
              value={formCat ?? undefined}
              placeholder={t('scientificDepartment.myAchievements.categoryPlaceholder')}
              onChange={(v) => changeCategory(v as AchievementCategoryKey)}
              options={ACHIEVEMENT_CATEGORIES.map((c) => ({
                value: c.key,
                label: t(`scientificDepartment.${c.labelKey}`),
              }))}
            />
          </div>
        )}

        {formCatConfig ? (
          <Form form={form} layout="vertical">
            <style>{`
              .sci-upload-block,
              .sci-upload-block .ant-upload,
              .sci-upload-block .ant-upload-select { width: 100%; display: block; }
            `}</style>
            {formCatConfig.fields.map((field) => renderFormField(field))}
            <Form.Item
              name="upload"
              label={t('scientificDepartment.myAchievements.file')}
              valuePropName="fileList"
              getValueFromEvent={normFile}
            >
              <Upload
                beforeUpload={() => false}
                maxCount={1}
                accept=".pdf"
                style={{ width: '100%' }}
                className="sci-upload-block"
              >
                <Button icon={<UploadOutlined />} block>
                  {t('scientificDepartment.myAchievements.file')}
                </Button>
              </Upload>
            </Form.Item>
            {hasAutoAbstract(formCat ?? undefined) ? (
              <Form.Item
                name="autoAbstract"
                label={t('scientificDepartment.ach.f.autoAbstract')}
                valuePropName="fileList"
                getValueFromEvent={normFile}
              >
                <Upload
                  beforeUpload={() => false}
                  maxCount={1}
                  accept=".pdf"
                  style={{ width: '100%' }}
                  className="sci-upload-block"
                >
                  <Button icon={<UploadOutlined />} block>
                    {t('scientificDepartment.ach.f.autoAbstract')}
                  </Button>
                </Upload>
              </Form.Item>
            ) : null}
          </Form>
        ) : null}
      </Modal>

      <Modal centered
        title={t('scientificDepartment.myAchievements.viewTitle')}
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={null}
        width={560}
      >
        {viewing ? (
          <Descriptions
            column={1}
            bordered
            size="small"
            items={[
              ...activeCat.fields.map((field) => ({
                key: field.name,
                label: t(`scientificDepartment.${field.labelKey}`),
                children: renderFieldValue(field, viewing[field.name], t),
              })),
              {
                key: 'status',
                label: t('scientificDepartment.myAchievements.status'),
                children: (
                  <StatusBadge
                    status={viewing.status}
                    reason={viewing.rejectionReason}
                    rejectedBy={viewing.rejectedByName}
                  />
                ),
              },
              ...(viewing.status === 'rejected'
                ? [
                    {
                      key: 'rejectedReason',
                      label: t('scientificDepartment.myAchievements.rejectedReason'),
                      children: viewing.rejectionReason || '—',
                    },
                  ]
                : []),
              {
                key: 'file',
                label: t('scientificDepartment.myAchievements.file'),
                children: viewing.fileUrl ? (
                  <a href={viewing.fileUrl} target="_blank" rel="noreferrer">
                    {t('scientificDepartment.view')}
                  </a>
                ) : (
                  t('scientificDepartment.myAchievements.empty')
                ),
              },
              ...(hasAutoAbstract(activeCat.key)
                ? [
                    {
                      key: 'autoAbstract',
                      label: t('scientificDepartment.ach.f.autoAbstract'),
                      children: viewing.autoAbstractUrl ? (
                        <a
                          href={String(viewing.autoAbstractUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('scientificDepartment.view')}
                        </a>
                      ) : (
                        t('scientificDepartment.myAchievements.empty')
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : null}
      </Modal>
    </PageContainer>
  );
}
