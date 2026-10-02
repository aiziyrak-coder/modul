import { useEffect, useState } from 'react';
import { useFormik } from 'formik';
import { Alert, App, Avatar, Button, Col, Input, Row, Select, Skeleton, Typography } from 'antd';
import { CheckCircleFilled, CloseOutlined, EditOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { PageContainer, PhoneInput, phoneToDisplay } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, useSessionStore } from '@/app/session';
import {
  useAccountDefaults,
  useMyTeacherProfile,
  useCreateTeacherProfile,
  useUpdateTeacherProfile,
  useFacultiesForSelect,
  useDepartmentsForSelect,
  usePositionsForSelect,
  getApiErrorMessage,
} from '../api/teacher-profile-api';
import { toFormValues } from '../api/mapper';
import { profileValidationSchema, formatDate } from '../model/helper';
import type { ProfileFormValues } from '../model/types';
import EducationDocumentsPanel from '../components/education-documents-panel';
import ProfileStatusPanel from '../components/profile-status-panel';
import ScientificWorksPanel from '../components/scientific-works-panel';
import { Card, DefaultValue, FieldDivider, HeaderSection, Label, LinkRow, SectionTitle } from './style';

const { Text } = Typography;

function stripHttps(v: string | null | undefined): string {
  return (v ?? '').replace(/^https?:\/\//, '');
}
function withHttps(v: string): string | null {
  const trimmed = v.trim();
  return trimmed ? `https://${trimmed}` : null;
}

const MyProfilePage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const sessionUser = useSessionStore((s) => s.user);

  const { data: profile, isLoading, isError, refetch, isFetching } = useMyTeacherProfile();
  const { data: faculties = [] } = useFacultiesForSelect();
  const { data: positions = [] } = usePositionsForSelect();

  const createMutation = useCreateTeacherProfile();
  const updateMutation = useUpdateTeacherProfile();

  const isNewProfile = !isLoading && !isError && !profile;
  const [editing, setEditing] = useState(false);
  const { data: account } = useAccountDefaults(isNewProfile);

  useEffect(() => {
    if (isNewProfile) setEditing(true);
  }, [isNewProfile]);

  const formik = useFormik<ProfileFormValues>({
    initialValues:
      profile || !account
        ? toFormValues(profile ?? null)
        : {
            ...toFormValues(null),
            faculty: account.facultyId,
            department: account.departmentId,
          },
    enableReinitialize: true,
    validationSchema: profileValidationSchema,
    onSubmit: async (values) => {
      try {
        if (profile?.id) {
          await updateMutation.mutateAsync({ id: profile.id, values });
          message.success(t('teacher.profile.updated'));
        } else {
          await createMutation.mutateAsync(values);
          message.success(t('teacher.profile.created'));
        }
        setEditing(false);
      } catch (err) {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  const { data: departments = [] } = useDepartmentsForSelect(formik.values.faculty);

  const set = <K extends keyof ProfileFormValues>(name: K, value: ProfileFormValues[K]) => {
    void formik.setFieldValue(name, value);
  };

  const handleCancel = () => {
    formik.resetForm();
    setEditing(false);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Skeleton active avatar paragraph={{ rows: 4 }} />
        <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 'var(--space-6)' }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Alert
          type="error"
          showIcon
          message={t('teacher.profile.loadError')}
          action={
            <Button icon={<ReloadOutlined />} onClick={() => void refetch()} loading={isFetching}>
              {t('teacher.common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const displayName = profile?.fullName ?? sessionUser?.fullName ?? '';
  const displayPosition = profile?.positionTitle ?? '';
  const sessionParts = (sessionUser?.fullName ?? '').split(' ').filter(Boolean);
  const shownFirstName = profile?.firstName ?? account?.firstName ?? sessionParts[1] ?? null;
  const shownLastName = profile?.lastName ?? account?.lastName ?? sessionParts[0] ?? null;
  const shownMiddleName =
    profile?.middleName ?? account?.middleName ?? (sessionParts.slice(2).join(' ') || null);
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const isVerified = profile?.hrApprovalStatus === 'approved';

  const addressValue = [profile?.addressRegion, profile?.addressDistrict, profile?.addressStreet]
    .filter(Boolean)
    .join(', ');
  const passportValue =
    profile?.passportSeries || profile?.passportNumber
      ? `${profile?.passportSeries ?? ''} ${profile?.passportNumber ?? ''}`.trim()
      : '';

  return (
    <PageContainer title={t('teacher.nav.profile')}>
      <form onSubmit={formik.handleSubmit}>
        <HeaderSection>
          <div className="banner" />
          <div className="row">
            <div className="avatar-wrap">
              <Avatar
                size={102}
                src={profile?.photo ?? undefined}
                style={{ background: 'var(--brand-primary)', fontWeight: 600, fontSize: 32 }}
              >
                {initials || '—'}
              </Avatar>
            </div>
            <div className="info">
              <div className="name-line">
                <h2>{displayName || t('teacher.profile.unnamed')}</h2>
                {isVerified ? <CheckCircleFilled className="verified" /> : null}
              </div>
              <p className="position">{displayPosition || t('teacher.profile.noPosition')}</p>
            </div>
            <div className="action">
              <Can perform={profile?.id ? 'teacher:update' : 'teacher:create'}>
                {editing ? (
                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {profile ? (
                      <Button icon={<CloseOutlined />} onClick={handleCancel} disabled={saving}>
                        {t('teacher.profile.cancel')}
                      </Button>
                    ) : null}
                    <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={saving}>
                      {t('teacher.profile.save')}
                    </Button>
                  </div>
                ) : (
                  <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                    {t('teacher.profile.update')}
                  </Button>
                )}
              </Can>
            </div>
          </div>
        </HeaderSection>

        <ProfileStatusPanel
          isNew={isNewProfile}
          status={profile?.hrApprovalStatus ?? 'pending'}
          approvedByName={profile?.hrApprovedByName ?? null}
          approvalDate={profile?.hrApprovalDate ?? null}
          comment={profile?.hrComment ?? null}
        />

        {editing && profile ? (
          <Alert
            type="warning"
            showIcon
            message={t('teacher.profile.reapprovalWarning')}
            style={{ marginBottom: 'var(--space-4)' }}
          />
        ) : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={11}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Card>
                <h3>{t('teacher.profile.section.education')}</h3>
                <EducationDocumentsPanel editing={editing} degrees={profile?.degrees ?? {
                  bachelorDegree: [], masterDegree: [], scientificDegree: [], scientificTitle: [],
                }} />
              </Card>

              <Can perform="article:readAll">
                <Card>
                  <h3>{t('teacher.scientificWorks.title')}</h3>
                  <ScientificWorksPanel />
                </Card>
              </Can>
            </div>
          </Col>

          <Col xs={24} lg={13}>
            <Card>
              <h3>{t('teacher.profile.section.personal')}</h3>

              <Row gutter={[20, 16]}>
                <Col span={12}>
                  <Label>{t('teacher.profile.field.firstName')}</Label>
                  <DefaultValue>{shownFirstName ?? '—'}</DefaultValue>
                </Col>
                <Col span={12}>
                  <Label>{t('teacher.profile.field.lastName')}</Label>
                  <DefaultValue>{shownLastName ?? '—'}</DefaultValue>
                </Col>
                <Col span={12}>
                  <Label>{t('teacher.profile.field.middleName')}</Label>
                  <DefaultValue>{shownMiddleName ?? '—'}</DefaultValue>
                </Col>
                <Col span={12}>
                  <Label>{t('teacher.profile.field.birthDate')}</Label>
                  <DefaultValue>{formatDate(profile?.birthDate)}</DefaultValue>
                </Col>
                <Col span={12}>
                  <Label>{t('teacher.profile.field.jshshir')}</Label>
                  <DefaultValue>{profile?.jshshir ?? '—'}</DefaultValue>
                </Col>
                <Col span={12}>
                  <Label>{t('teacher.profile.field.passport')}</Label>
                  <DefaultValue>{passportValue || '—'}</DefaultValue>
                </Col>
                <Col span={24}>
                  <Label>{t('teacher.profile.field.address')}</Label>
                  <DefaultValue>{addressValue || '—'}</DefaultValue>
                </Col>
              </Row>

              <FieldDivider />

              <Row gutter={[20, 16]}>
                <Col span={24} sm={{ span: 12 }}>
                  <Label>{t('teacher.profile.field.email')}</Label>
                  {editing ? (
                    <Input
                      type="email"
                      value={formik.values.email ?? ''}
                      onChange={(e) => set('email', e.target.value)}
                      status={formik.errors.email ? 'error' : ''}
                    />
                  ) : (
                    <DefaultValue>{profile?.email ?? '—'}</DefaultValue>
                  )}
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <Label>{t('teacher.profile.field.phone')}</Label>
                  {editing ? (
                    <PhoneInput
                      value={formik.values.phone ?? ''}
                      onChange={(v) => set('phone', v)}
                    />
                  ) : (
                    <DefaultValue>{phoneToDisplay(profile?.phone) || '—'}</DefaultValue>
                  )}
                </Col>
              </Row>

              <FieldDivider />

              <Row gutter={[20, 16]}>
                <Col span={24} sm={{ span: 12 }}>
                  <Label>{t('teacher.profile.field.faculty')}</Label>
                  {editing ? (
                    <Select
                      value={formik.values.faculty ?? undefined}
                      onChange={(v) => set('faculty', v)}
                      options={faculties.map((f) => ({ label: f.title, value: f.id }))}
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      allowClear
                    />
                  ) : (
                    <DefaultValue>{profile?.facultyTitle ?? '—'}</DefaultValue>
                  )}
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <Label>{t('teacher.profile.field.department')}</Label>
                  {editing ? (
                    <Select
                      value={formik.values.department ?? undefined}
                      onChange={(v) => set('department', v)}
                      options={departments.map((d) => ({ label: d.title, value: d.id }))}
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      allowClear
                    />
                  ) : (
                    <DefaultValue>{profile?.departmentTitle ?? '—'}</DefaultValue>
                  )}
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <Label>{t('teacher.profile.field.position')}</Label>
                  {editing ? (
                    <Select
                      value={formik.values.position ?? undefined}
                      onChange={(v) => set('position', v)}
                      options={positions.map((p) => ({ label: p.title, value: p.id }))}
                      style={{ width: '100%' }}
                      showSearch
                      optionFilterProp="label"
                      allowClear
                    />
                  ) : (
                    <DefaultValue>{profile?.positionTitle ?? '—'}</DefaultValue>
                  )}
                  {editing && isNewProfile && !formik.values.position ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('teacher.profile.positionFromAccountHint')}
                    </Text>
                  ) : null}
                </Col>
              </Row>

              <FieldDivider />

              <SectionTitle>{t('teacher.profile.section.internationalLinks')}</SectionTitle>
              <Row gutter={[20, 16]}>
                <Col span={24}>
                  <Label>{t('teacher.profile.field.googleScholar')}</Label>
                  {editing ? (
                    <Input
                      addonBefore="https://"
                      value={stripHttps(formik.values.googleScholarUrl)}
                      onChange={(e) => set('googleScholarUrl', withHttps(e.target.value))}
                      status={formik.errors.googleScholarUrl ? 'error' : ''}
                    />
                  ) : profile?.googleScholarUrl ? (
                    <LinkRow>
                      <a href={profile.googleScholarUrl} target="_blank" rel="noreferrer">
                        {profile.googleScholarUrl}
                      </a>
                    </LinkRow>
                  ) : (
                    <DefaultValue>—</DefaultValue>
                  )}
                  {editing && formik.errors.googleScholarUrl ? (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {t(formik.errors.googleScholarUrl)}
                    </Text>
                  ) : null}
                </Col>
                <Col span={24}>
                  <Label>{t('teacher.profile.field.scopus')}</Label>
                  {editing ? (
                    <Input
                      addonBefore="https://"
                      value={stripHttps(formik.values.scopusUrl)}
                      onChange={(e) => set('scopusUrl', withHttps(e.target.value))}
                      status={formik.errors.scopusUrl ? 'error' : ''}
                    />
                  ) : profile?.scopusUrl ? (
                    <LinkRow>
                      <a href={profile.scopusUrl} target="_blank" rel="noreferrer">
                        {profile.scopusUrl}
                      </a>
                    </LinkRow>
                  ) : (
                    <DefaultValue>—</DefaultValue>
                  )}
                  {editing && formik.errors.scopusUrl ? (
                    <Text type="danger" style={{ fontSize: 12 }}>
                      {t(formik.errors.scopusUrl)}
                    </Text>
                  ) : null}
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </form>
    </PageContainer>
  );
};

export default MyProfilePage;
