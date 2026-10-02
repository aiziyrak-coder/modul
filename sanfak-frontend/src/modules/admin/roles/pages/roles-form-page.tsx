import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { App, Button, Flex, Form, Input, Select, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, WarningFilled } from '@ant-design/icons';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { RoleStatsCard } from '../components/role-stats-card';
import { RoleModuleList } from '../components/role-module-list';
import { RolePermissionSections } from '../components/role-permission-sections';
import {
  useAdminRole,
  useCreateRole,
  useUpdateRole,
  useSectionsGrouped,
} from '../api/roles-api';
import type { AdminRoleInput, PermissionSection } from '../model/types';
import {
  type PermissionSetMap,
  permissionsToMap,
  mapToPermissions,
} from '../model/permission-map';
import { SCOPE_LEVEL_OPTION_DEFS } from '../lib/scope-labels';
import { actionLabelKey } from '../lib/action-labels';
import { findViewPermissionWarnings } from '../lib/view-permission-warnings';

const { Text } = Typography;

const Layout = styled.div`
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
  padding-bottom: 80px;
`;

const LeftCard = styled.div`
  width: 100%;
  max-width: 527px;
  background: #fff;
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-lg, 12px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;

  @media (max-width: 1150px) {
    max-width: 100%;
  }

  h3 {
    margin: 0;
    font-family: Inter;
    font-weight: 600;
    font-size: 20px;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--color-text, #121926);
  }
`;

const RightCard = styled.div`
  flex: 1;
  min-width: 380px;
  background: #fff;
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-lg, 12px);
  overflow: hidden;
`;

const RightHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border, #e3e8ef);

  h3 {
    margin: 0;
    font-family: Inter;
    font-weight: 600;
    font-size: 20px;
    line-height: 1;
    letter-spacing: -0.02em;
    color: var(--color-text, #121926);
  }
`;

const RightBody = styled.div`
  padding: 0 24px;
`;

const BackBar = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, #e3e8ef);
  background: #fff;
  color: var(--color-text, #121926);
  font-family: Inter;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--color-border-soft, #eef2f6);
  }
`;

const BackTitle = styled.h2`
  margin: 0;
  font-family: Inter;
  font-weight: 600;
  font-size: 22px;
  line-height: 1;
  color: var(--color-text, #121926);
`;

const StickyBar = styled.div`
  position: fixed;
  left: var(--sidebar-width, 280px);
  right: 0;
  bottom: 0;
  background: #fff;
  border-top: 1px solid var(--color-border, #e3e8ef);
  padding: 14px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  z-index: 10;
`;

const labelStyle = { fontWeight: 500, fontSize: 14 } as const;

const WarningBanner = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: color-mix(in srgb, var(--brand-warning) 12%, #fff);
  border: 1px solid color-mix(in srgb, var(--brand-warning) 35%, #fff);
  border-radius: var(--radius-lg, 12px);
  padding: 14px 18px;
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text, #121926);

  .anticon {
    color: var(--brand-warning);
    font-size: 18px;
    margin-top: 1px;
    flex-shrink: 0;
  }
`;

const WarningBannerTitle = styled.div`
  font-weight: 600;
  margin-bottom: 2px;
`;

export default function RolesFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  const [submitting, setSubmitting] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [permissionsMap, setPermissionsMap] = useState<PermissionSetMap>({});

  const { data: existing, isLoading: loadingRole } = useAdminRole(id);
  const { data: sectionsData, isLoading: loadingSections } = useSectionsGrouped();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  useEffect(() => {
    if (existing) {
      form.setFieldsValue({ title: existing.title, scopeLevel: existing.scopeLevel ?? 'self' });
      setPermissionsMap(permissionsToMap(existing.permissions));
    }
  }, [existing, form]);

  useEffect(() => {
    const first = sectionsData?.groups?.[0];
    if (first && !activeGroupId) setActiveGroupId(first._id);
  }, [sectionsData, activeGroupId]);

  const activeGroup = useMemo(
    () => sectionsData?.groups.find((g) => g._id === activeGroupId) ?? null,
    [sectionsData, activeGroupId],
  );

  const totalActions = useMemo(() => {
    if (!sectionsData) return 0;
    let total = 0;
    for (const g of sectionsData.groups) {
      for (const p of g.permissions) total += p.actionKeys.length;
    }
    for (const p of sectionsData.ungrouped) total += p.actionKeys.length;
    return total;
  }, [sectionsData]);

  const selectedCount = useMemo(() => {
    let n = 0;
    for (const s of Object.values(permissionsMap)) n += s.size;
    return n;
  }, [permissionsMap]);

  const allSections = useMemo<PermissionSection[]>(() => {
    if (!sectionsData) return [];
    const fromGroups = sectionsData.groups.flatMap((g) => g.permissions);
    return [...fromGroups, ...sectionsData.ungrouped];
  }, [sectionsData]);

  const viewWarnings = useMemo(
    () =>
      findViewPermissionWarnings(allSections, permissionsMap).filter(
        (w) => w.severity === 'blocking',
      ),
    [allSections, permissionsMap],
  );

  const scopeOptions = useMemo(
    () =>
      SCOPE_LEVEL_OPTION_DEFS.map((d) => ({
        value: d.value,
        label: t(d.labelKey),
        hint: t(d.hintKey),
      })),
    [t],
  );

  const togglePermission = (section: string, key: string) => {
    setPermissionsMap((prev) => {
      const next = { ...prev };
      const set = new Set(prev[section] ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      if (set.size) next[section] = set;
      else delete next[section];
      return next;
    });
  };

  const selectAll = (section: string, keys: string[]) => {
    setPermissionsMap((prev) => ({ ...prev, [section]: new Set(keys) }));
  };

  const cancelAll = (section: string) => {
    setPermissionsMap((prev) => {
      if (!prev[section]) return prev;
      const next = { ...prev };
      delete next[section];
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const body: AdminRoleInput = {
        title: values.title,
        desc: existing?.desc,
        permissions: mapToPermissions(permissionsMap),
        scopeLevel: values.scopeLevel ?? existing?.scopeLevel ?? 'self',
        active: existing?.active ?? true,
      };
      if (isEdit && id) {
        await updateRole.mutateAsync({ id, body });
        message.success(t('admin.role.updated'));
      } else {
        await createRole.mutateAsync(body);
        message.success(t('admin.role.created'));
      }
      navigate('/admin/roles');
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return;
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if ((isEdit && loadingRole) || loadingSections) {
    return (
      <PageContainer title="">
        <Flex justify="center" style={{ padding: 64 }}>
          <Spin size="large" />
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="">
      <BackBar>
        <BackBtn onClick={() => navigate('/admin/roles')} aria-label={t('admin.role.back')}>
          <ArrowLeftOutlined />
          {t('admin.role.back')}
        </BackBtn>
        <BackTitle>{isEdit ? t('admin.role.editTitle') : t('admin.role.createTitle')}</BackTitle>
      </BackBar>

      {viewWarnings.length > 0 && (
        <WarningBanner>
          <WarningFilled />
          <div>
            <WarningBannerTitle>
              {t('admin.role.warning.bannerTitle', { count: viewWarnings.length })}
            </WarningBannerTitle>
            <div>
              {t('admin.role.warning.bannerDetail', {
                sections: viewWarnings.map((w) => w.sectionTitle).join(', '),
                readLabel: t(actionLabelKey('read')),
                readAllLabel: t(actionLabelKey('readAll')),
              })}
            </div>
          </div>
        </WarningBanner>
      )}

      <Layout>
        <LeftCard>
          <h3>{t('admin.role.basicInfoTitle')}</h3>

          <RoleStatsCard selected={selectedCount} total={totalActions} />

          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{ scopeLevel: 'self' }}
          >
            <Form.Item
              name="title"
              label={<Text style={labelStyle}>{t('admin.role.fields.title.label')}</Text>}
              rules={[{ required: true, message: t('admin.common.required') }]}
            >
              <Input
                size="large"
                placeholder={t('admin.role.fields.title.placeholder')}
              />
            </Form.Item>
            <Form.Item
              name="scopeLevel"
              label={<Text style={labelStyle}>{t('admin.role.fields.scopeLevel.label')}</Text>}
              rules={[{ required: true, message: t('admin.common.required') }]}
              extra={t('admin.role.fields.scopeLevel.extra')}
              style={{ marginBottom: 0 }}
            >
              <Select
                size="large"
                options={scopeOptions}
                optionRender={(opt) => (
                  <div>
                    <div>{opt.data.label}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {opt.data.hint}
                    </Typography.Text>
                  </div>
                )}
              />
            </Form.Item>
          </Form>

          <div>
            <h3 style={{ marginBottom: 16 }}>{t('admin.role.modulesTitle')}</h3>
            {sectionsData ? (
              <RoleModuleList
                groups={sectionsData.groups}
                activeId={activeGroupId}
                onSelect={setActiveGroupId}
                selectedMap={permissionsMap}
              />
            ) : (
              <Text type="secondary">{t('admin.role.modulesNotLoaded')}</Text>
            )}
          </div>
        </LeftCard>

        <RightCard>
          <RightHeader>
            <h3>{t('admin.role.permissionsTitle')}</h3>
          </RightHeader>
          <RightBody>
            {activeGroup ? (
              <RolePermissionSections
                sections={activeGroup.permissions}
                selectedMap={permissionsMap}
                onToggle={togglePermission}
                onSelectAll={selectAll}
                onCancelAll={cancelAll}
              />
            ) : (
              <Flex justify="center" style={{ padding: 32 }}>
                <Text type="secondary">{t('admin.role.selectModuleHint')}</Text>
              </Flex>
            )}
          </RightBody>
        </RightCard>
      </Layout>

      <StickyBar>
        <Button
          onClick={() => navigate('/admin/roles')}
          style={{
            background: 'var(--color-border-soft)',
            color: 'var(--color-text)',
            border: 'none',
            height: 44,
            minWidth: 120,
            fontWeight: 500,
          }}
        >
          {t('admin.common.cancel')}
        </Button>
        <Button
          type="primary"
          loading={submitting}
          onClick={handleSubmit}
          style={{ height: 44, minWidth: 120, fontWeight: 500 }}
        >
          {t('admin.common.save')}
        </Button>
      </StickyBar>
    </PageContainer>
  );
}
