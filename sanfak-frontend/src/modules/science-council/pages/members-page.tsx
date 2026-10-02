import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Empty, Input, Modal, Select, Space, Table, Tag, Tooltip, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { ExportButton } from '../components/export-button';
import { downloadExcel, datedFileName, type ExcelRow } from '../lib/excel';
import { usePermission } from '@/app/session';
import {
  useAllWorks,
  useCouncilMembers,
  useSpecialties,
  useCouncilNumbers,
  useCreateMember,
  useDeleteMember,
  useUpdateMember,
} from '../api/science-council-api';
import { MemberFormModal } from '../components/member-form-modal';
import { apiMessage } from '../lib/api-error';
import type { CouncilMember, MemberFormInput, ScientificWork } from '../model/types';
import { TablePagination } from '../components/table-pagination';
import { stickyFooterCard } from '../components/table-pagination/style';

const ToolBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const Card = styled.div`
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--border-secondary, #eaecf0);
  ${stickyFooterCard}
`;

const AvatarCircle = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #16a34a, #22c55e);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
`;

const AddBtn = styled(Button)`
  background: #16a34a !important;
  border-color: #16a34a !important;
  border-radius: var(--radius-md, 8px) !important;
  font-weight: 600 !important;
  height: 38px !important;
`;

const WorkItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border-secondary, #e5e7eb);
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.15s;
  &:hover {
    border-color: #16a34a;
  }
`;

const MemberInfoBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
`;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
}

function getWorksForMember(allWorks: ScientificWork[], memberUserId: string): ScientificWork[] {
  return allWorks.filter((w) => w.councilMembers.some((m) => m.id === memberUserId));
}

export default function MembersPage() {
  const { t, lang } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const isSecretary = can('scienceCouncil:manageMembers');

  const [councilFilter, setCouncilFilter] = useState<string>();
  const [specialtyFilter, setSpecialtyFilter] = useState<string>();

  const { data: members = [], isLoading } = useCouncilMembers(true, {
    specialty: specialtyFilter,
    councilNumber: councilFilter,
  });
  const { data: specialties = [] } = useSpecialties();
  const { data: councilNumbers = [] } = useCouncilNumbers();
  const { data: allWorks = [] } = useAllWorks();
  const createMut = useCreateMember();
  const updateMut = useUpdateMember();
  const deleteMut = useDeleteMember();

  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [formOpen, setFormOpen] = useState(false);
  const [formEditData, setFormEditData] = useState<CouncilMember | null>(null);
  const [deleteMemberState, setDeleteMemberState] = useState<CouncilMember | null>(null);
  const [viewMember, setViewMember] = useState<CouncilMember | null>(null);

  const yearOptions = useMemo(() => {
    const years = [...new Set(allWorks.map((w) => w.year))].sort().reverse();
    return years.map((y) => ({ label: y, value: y }));
  }, [allWorks]);

  const filteredWorks = useMemo(
    () => (yearFilter ? allWorks.filter((w) => w.year === yearFilter) : allWorks),
    [allWorks, yearFilter],
  );

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.organization.toLowerCase().includes(search.toLowerCase()),
  );

  const exportRows = () => {
    const excelRows: ExcelRow[] = filtered.map((m, i) => ({
      '#': i + 1,
      [t('scienceCouncil.member.name')]: m.name,
      [t('scienceCouncil.member.position')]: m.position || '—',
      [t('scienceCouncil.member.organization')]: m.organization || '—',
      [t('scienceCouncil.form.scientificTitle')]: m.academicTitle || '—',
      [t('scienceCouncil.form.degree')]: m.degree || '—',
      [t('scienceCouncil.form.specialtyCode')]:
        m.specialties.map((sp) => sp.code).join(', ') || '—',
      [t('scienceCouncil.form.email')]: m.email || '—',
      [t('scienceCouncil.form.phone')]: m.phone || '—',
      [t('scienceCouncil.member.assigned')]: m.assignedCount,
      [t('scienceCouncil.member.status')]: m.active
        ? t('scienceCouncil.settings.active')
        : t('scienceCouncil.settings.inactive'),
    }));
    downloadExcel(excelRows, datedFileName('Kengash_azolari'), t('scienceCouncil.nav.members'),
      [5, 30, 24, 30, 18, 18, 22, 26, 18, 14, 12]);
  };

  const openAdd = () => {
    setFormEditData(null);
    setFormOpen(true);
  };

  const openEdit = (member: CouncilMember) => {
    setFormEditData(member);
    setFormOpen(true);
  };

  const handleFormSubmit = (values: MemberFormInput) => {
    if (formEditData) {
      updateMut.mutate(
        { id: formEditData.id, data: values },
        {
          onSuccess: () => {
            message.success(t('scienceCouncil.member.updated'));
            setFormOpen(false);
            setFormEditData(null);
          },
          onError: (err) => message.error(apiMessage(err, t('scienceCouncil.member.saveFailed'))),
        },
      );
    } else {
      createMut.mutate(values, {
        onSuccess: () => {
          message.success(t('scienceCouncil.member.added'));
          setFormOpen(false);
        },
        onError: (err) => message.error(apiMessage(err, t('scienceCouncil.member.saveFailed'))),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteMemberState) return;
    deleteMut.mutate(deleteMemberState.id, {
      onSuccess: () => {
        message.success(t('scienceCouncil.member.deleted'));
        setDeleteMemberState(null);
      },
      onError: (err) => message.error(apiMessage(err, t('scienceCouncil.member.deleteFailed'))),
    });
  };

  const statusColorMap: Record<string, string> = {
    new: 'default',
    pending: 'orange',
    approved: 'green',
    rejected: 'red',
    revision: 'purple',
  };


  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  const columns: ColumnsType<CouncilMember> = [
    {
      title: '№',
      key: 'idx',
      width: 50,
      render: (_v, _r, i) => <span style={{ color: 'var(--color-text-tertiary, #9ca3af)' }}>{(page - 1) * pageSize + i + 1}</span>,
    },
    {
      title: t('scienceCouncil.member.name'),
      key: 'name',
      render: (_v, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text, #111827)' }}>{record.name}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #6b7280)' }}>{record.degree}</div>
          </div>
        </div>
      ),
    },
    {
      title: t('scienceCouncil.member.position'),
      dataIndex: 'position',
      key: 'position',
      render: (p: string) => <span style={{ fontSize: 13 }}>{p}</span>,
    },
    {
      title: t('scienceCouncil.member.organization'),
      dataIndex: 'organization',
      key: 'org',
      ellipsis: true,
      render: (o: string) => <span style={{ fontSize: 13, color: 'var(--color-text-tertiary, #6b7280)' }}>{o}</span>,
    },
    {
      title: t('scienceCouncil.member.assigned'),
      key: 'assigned',
      width: 130,
      render: (_v, record) => {
        const cnt = getWorksForMember(filteredWorks, record.userId).length;
        return (
          <Tag color={cnt ? 'blue' : 'default'}>
            {cnt} {t('scienceCouncil.member.works')}
          </Tag>
        );
      },
    },
    {
      title: t('scienceCouncil.member.status'),
      dataIndex: 'active',
      key: 'active',
      width: 100,
      render: (active: boolean) => (
        <Badge
          status={active ? 'success' : 'default'}
          text={
            <span style={{ fontSize: 12 }}>
              {active ? t('scienceCouncil.member.active') : t('scienceCouncil.member.inactive')}
            </span>
          }
        />
      ),
    },
    ...(isSecretary
      ? [
          {
            title: t('scienceCouncil.actions'),
            key: 'actions',
            width: 100,
            render: (_v: unknown, record: CouncilMember) => (
              <Space size={2} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <Tooltip title={t('scienceCouncil.actions.edit')}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
                </Tooltip>
                <Tooltip title={t('scienceCouncil.member.deleteMember')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => setDeleteMemberState(record)}
                  />
                </Tooltip>
              </Space>
            ),
          } as ColumnsType<CouncilMember>[number],
        ]
      : []),
  ];

  const memberWorksModal = () => {
    if (!viewMember) return null;
    const list = getWorksForMember(filteredWorks, viewMember.userId);
    return (
      <div style={{ marginTop: 12 }}>
        <MemberInfoBar>
          <AvatarCircle>{getInitials(viewMember.name)}</AvatarCircle>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text, #111827)' }}>
              {viewMember.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #6b7280)' }}>
              {viewMember.position} · {viewMember.organization}
            </div>
          </div>
          <Tag color="blue">
            {list.length} {t('scienceCouncil.member.works')}
          </Tag>
        </MemberInfoBar>

        {list.length === 0 ? (
          <Empty description={t('scienceCouncil.member.noAssigned')} />
        ) : (
          list.map((w) => {
            const assignedDocKeys = Object.entries(w.docAssignments)
              .filter(([, arr]) => arr.includes(viewMember.userId))
              .map(([k]) => k);
            const writtenReviews = w.reviews.filter(
              (r) => r.memberId === viewMember.userId && assignedDocKeys.includes(r.docKey),
            ).length;
            const allDone = assignedDocKeys.length > 0 && writtenReviews >= assignedDocKeys.length;
            const authorName = w.researcher?.name || w.externalAuthor?.name || '—';
            return (
              <WorkItem
                key={w.id}
                onClick={() => {
                  setViewMember(null);
                  navigate(`/ilmiy-kengash/ilmiy-ishlar/${w.id}`);
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--color-text, #111827)',
                      marginBottom: 4,
                    }}
                  >
                    {lang === 'uz' ? w.title : w.titleRu || w.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      fontSize: 12,
                      color: 'var(--color-text-tertiary, #6b7280)',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    <span>{authorName}</span>
                    <span>{w.createdAt.slice(0, 10)}</span>
                    <Tag
                      color={allDone ? 'green' : writtenReviews > 0 ? 'blue' : 'orange'}
                      style={{ fontSize: 10, margin: 0 }}
                    >
                      {allDone && '✓ '}
                      {writtenReviews}/{assignedDocKeys.length} {t('scienceCouncil.member.review')}
                    </Tag>
                  </div>
                </div>
                <Tag color={statusColorMap[w.status] || 'default'}>{t(`scienceCouncil.status.${w.status}`)}</Tag>
                <RightOutlined style={{ color: 'var(--color-text-tertiary, #9ca3af)', fontSize: 12 }} />
              </WorkItem>
            );
          })
        )}
      </div>
    );
  };

  return (
    <PageContainer title={t('scienceCouncil.nav.members')}>
      <ToolBar>
        <Space size={12}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--color-text-tertiary, #9ca3af)' }} />}
            placeholder={t('scienceCouncil.member.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 280, borderRadius: 'var(--radius-md, 8px)' }}
          />
          <Select
            value={yearFilter}
            onChange={setYearFilter}
            allowClear
            placeholder={t('scienceCouncil.work.year')}
            style={{ width: 180 }}
            options={yearOptions}
          />
          <Select
            value={councilFilter}
            onChange={(v) => { setCouncilFilter(v); setPage(1); }}
            allowClear
            placeholder={t('scienceCouncil.settings.councilNumber')}
            style={{ width: 240 }}
            options={councilNumbers.map((c) => ({ value: c.id, label: c.number }))}
          />
          <Select
            value={specialtyFilter}
            onChange={(v) => { setSpecialtyFilter(v); setPage(1); }}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('scienceCouncil.form.specialtyCode')}
            style={{ width: 240 }}
            options={specialties.map((sp) => ({ value: sp.id, label: `${sp.code} — ${sp.title}` }))}
          />
        </Space>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 12, alignItems: 'center' }}>
          <ExportButton
            onExport={exportRows}
            disabled={filtered.length === 0}
            disabledReason={t('scienceCouncil.export.empty')}
          />
          {isSecretary && (
            <AddBtn type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              {t('scienceCouncil.member.addMember')}
            </AddBtn>
          )}
        </span>
      </ToolBar>

      <Card>
        <>
          <Table<CouncilMember>
            dataSource={pageRows}
            columns={columns}
            rowKey="id"
            loading={isLoading}
            size="small"
            pagination={false}
            onRow={(record) => ({
              onClick: () => setViewMember(record),
              style: { cursor: 'pointer' },
            })}
          />
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
          onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        />
        </>
      </Card>

      <MemberFormModal
        excludeUserIds={members
          .map((m) => m.userId)
          .filter((id) => !!id && id !== formEditData?.userId)}
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setFormEditData(null);
        }}
        onSubmit={handleFormSubmit}
        loading={createMut.isPending || updateMut.isPending}
        editData={formEditData}
      />

      <Modal
        title={
          <span style={{ color: '#dc2626' }}>
            <ExclamationCircleOutlined style={{ marginRight: 8 }} />
            {t('scienceCouncil.member.deleteMember')}
          </span>
        }
        open={!!deleteMemberState}
        onCancel={() => setDeleteMemberState(null)}
        onOk={handleDelete}
        confirmLoading={deleteMut.isPending}
        okText={lang === 'uz' ? "Ha, o'chirish" : 'Да, удалить'}
        cancelText={t('scienceCouncil.cancel')}
        okButtonProps={{ danger: true }}
      >
        {deleteMemberState && (
          <div>
            <div
              style={{
                background: '#fef2f2',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 13,
                color: '#7f1d1d',
                border: '1px solid #fecaca',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{deleteMemberState.name}</div>
              <div style={{ fontSize: 12 }}>
                {deleteMemberState.position} · {deleteMemberState.organization}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text, #374151)' }}>
              {t('scienceCouncil.member.deleteConfirm')}
            </div>
            {getWorksForMember(filteredWorks, deleteMemberState.userId).length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: '#fffbeb',
                  border: '1px solid #fcd34d',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#92400e',
                }}
              >
                {t('scienceCouncil.member.deleteWarning').replace(
                  '{count}',
                  String(getWorksForMember(filteredWorks, deleteMemberState.id).length),
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8, color: '#16a34a' }} />
            {t('scienceCouncil.member.assignedWorks')}
          </span>
        }
        open={!!viewMember}
        onCancel={() => setViewMember(null)}
        footer={null}
        width={640}
      >
        {memberWorksModal()}
      </Modal>
    </PageContainer>
  );
}
