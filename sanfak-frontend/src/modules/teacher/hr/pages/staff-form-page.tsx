import { useState } from 'react';
import { useFormik } from 'formik';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Col, Input, Row, Select, Skeleton } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import {
  App,
  JshshirInput,
  LineTab,
  LinkInput,
  PageContainer,
  PassportNumber,
  PassportSeria,
  PhoneInput,
} from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { useTranslation } from '@/shared/lib/i18n';
import {
  getApiErrorMessage,
  useCreateStaff,
  useDepartmentsForSelect,
  useFacultiesForSelect,
  usePositionsForSelect,
  useAcademicTitlesForSelect,
  useStaffById,
  useUpdateStaff,
} from '../api/staff-api';
import { toStaffFormValues } from '../api/staff-mapper';
import { staffFormSchema } from '../model/staff-schema';
import type { StaffFormValues } from '../model/staff-types';
import { EDUCATION_TABS, type EducationTabKey } from '../model/types';
import PhotoUploadBox from '../components/photo-upload-box';
import EducationDocUploader from '../components/education-doc-uploader';
import SpecialtyFields from '../components/specialty-fields';
import { ActionBar, Divider, FieldLabel, LeftCard, RightCard, SectionTitle, TabSubTitle } from './style';
import { PassportRow } from './staff-form-style';

const TAB_LABEL_KEY: Record<EducationTabKey, string> = {
  bachelorDegree: 'teacher.hr.staff.form.tab.bachelor',
  masterDegree: 'teacher.hr.staff.form.tab.master',
  scientificDegree: 'teacher.hr.staff.form.tab.scientificDegree',
  scientificTitle: 'teacher.hr.staff.form.tab.scientificTitle',
};

const TAB_PLACEHOLDER_KEY: Record<EducationTabKey, string> = {
  bachelorDegree: 'teacher.hr.staff.form.docPlaceholder.bachelor',
  masterDegree: 'teacher.hr.staff.form.docPlaceholder.master',
  scientificDegree: 'teacher.hr.staff.form.docPlaceholder.scientificDegree',
  scientificTitle: 'teacher.hr.staff.form.docPlaceholder.scientificTitle',
};

const TAB_NEW_FIELD: Record<EducationTabKey, keyof StaffFormValues> = {
  bachelorDegree: 'bachelorDegreeNew',
  masterDegree: 'masterDegreeNew',
  scientificDegree: 'scientificDegreeNew',
  scientificTitle: 'scientificTitleNew',
};

const StaffFormPage = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  usePageTitle(isEdit ? t('teacher.hr.staff.form.editTitle') : t('teacher.hr.staff.form.createTitle'), {
    back: true,
  });

  const [activeTab, setActiveTab] = useState<EducationTabKey>('bachelorDegree');

  const { data: detail, isLoading: detailLoading, isError: detailError, refetch } = useStaffById(id);
  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();

  const formik = useFormik<StaffFormValues>({
    initialValues: toStaffFormValues(detail ?? null),
    enableReinitialize: true,
    validationSchema: staffFormSchema,
    onSubmit: async (values) => {
      try {
        if (isEdit && id) {
          await updateMutation.mutateAsync({ id, values });
          message.success(t('teacher.hr.staff.form.updated'));
        } else {
          await createMutation.mutateAsync(values);
          message.success(t('teacher.hr.staff.form.created'));
        }
        navigate('/teacher/hr/staff');
      } catch (err) {
        message.error(getApiErrorMessage(err));
      }
    },
  });

  const set = <K extends keyof StaffFormValues>(name: K, value: StaffFormValues[K]) => {
    void formik.setFieldValue(name, value);
  };

  const { data: faculties = [] } = useFacultiesForSelect();
  const { data: departments = [] } = useDepartmentsForSelect(formik.values.faculty);
  const { data: positions = [] } = usePositionsForSelect();
  const { data: academicTitles = [] } = useAcademicTitlesForSelect();

  const saving = createMutation.isPending || updateMutation.isPending;

  if (isEdit && detailLoading) {
    return (
      <PageContainer title={t('teacher.hr.staff.form.editTitle')}>
        <Skeleton active avatar paragraph={{ rows: 6 }} />
      </PageContainer>
    );
  }

  if (isEdit && detailError) {
    return (
      <PageContainer title={t('teacher.hr.staff.form.editTitle')}>
        <Alert
          type="error"
          showIcon
          message={t('teacher.hr.staff.notFound')}
          action={
            <Button icon={<ReloadOutlined />} onClick={() => void refetch()}>
              {t('teacher.hr.staff.retry')}
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const tabExisting = {
    bachelorDegree: formik.values.bachelorDegree,
    masterDegree: formik.values.masterDegree,
    scientificDegree: formik.values.scientificDegree,
    scientificTitle: formik.values.scientificTitle,
  }[activeTab];

  const tabPending = {
    bachelorDegree: formik.values.bachelorDegreeNew,
    masterDegree: formik.values.masterDegreeNew,
    scientificDegree: formik.values.scientificDegreeNew,
    scientificTitle: formik.values.scientificTitleNew,
  }[activeTab];

  return (
    <PageContainer
      title={isEdit ? t('teacher.hr.staff.form.editTitle') : t('teacher.hr.staff.form.createTitle')}
    >
      <form onSubmit={formik.handleSubmit}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={13}>
            <LeftCard>
              <SectionTitle>{t('teacher.hr.staff.form.section.personal')}</SectionTitle>

              <PhotoUploadBox
                value={formik.values.photo ?? formik.values.existingPhotoUrl}
                onChange={(file) => set('photo', file)}
              />

              <Row gutter={[20, 16]}>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>
                    {t('teacher.hr.staff.form.field.firstName')} <span style={{ color: 'var(--brand-error)' }}>*</span>
                  </FieldLabel>
                  <Input
                    value={formik.values.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder={t('teacher.hr.staff.form.placeholder.firstName')}
                    status={formik.errors.firstName ? 'error' : ''}
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>
                    {t('teacher.hr.staff.form.field.lastName')} <span style={{ color: 'var(--brand-error)' }}>*</span>
                  </FieldLabel>
                  <Input
                    value={formik.values.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder={t('teacher.hr.staff.form.placeholder.lastName')}
                    status={formik.errors.lastName ? 'error' : ''}
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.middleName')}</FieldLabel>
                  <Input
                    value={formik.values.middleName}
                    onChange={(e) => set('middleName', e.target.value)}
                    placeholder={t('teacher.hr.staff.form.placeholder.middleName')}
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.phone')}</FieldLabel>
                  <PhoneInput
                    value={formik.values.phone}
                    onChange={(v) => set('phone', v)}
                    placeholder={t('teacher.hr.staff.form.placeholder.phone')}
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.jshshir')}</FieldLabel>
                  <JshshirInput
                    value={formik.values.jshshir}
                    onChange={(v) => set('jshshir', v)}
                    placeholder={t('teacher.hr.staff.form.placeholder.jshshir')}
                    status={formik.errors.jshshir ? 'error' : ''}
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.passport')}</FieldLabel>
                  <PassportRow>
                    <PassportSeria
                      value={formik.values.passportSeries}
                      onChange={(v) => set('passportSeries', v)}
                      status={formik.errors.passportSeries ? 'error' : ''}
                    />
                    <PassportNumber
                      value={formik.values.passportNumber}
                      onChange={(v) => set('passportNumber', v)}
                      status={formik.errors.passportNumber ? 'error' : ''}
                    />
                  </PassportRow>
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.email')}</FieldLabel>
                  <Input
                    type="email"
                    value={formik.values.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder={t('teacher.hr.staff.form.placeholder.email')}
                    status={formik.errors.email ? 'error' : ''}
                  />
                </Col>
              </Row>

              <Divider />

              <Row gutter={[20, 16]}>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.faculty')}</FieldLabel>
                  <Select
                    value={formik.values.faculty ?? undefined}
                    onChange={(v) => {
                      set('faculty', v ?? null);
                      set('department', null);
                    }}
                    options={faculties.map((f) => ({ label: f.title, value: f.id }))}
                    placeholder={t('teacher.hr.staff.form.placeholder.faculty')}
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="label"
                    allowClear
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.department')}</FieldLabel>
                  <Select
                    value={formik.values.department ?? undefined}
                    onChange={(v) => set('department', v ?? null)}
                    options={departments.map((d) => ({ label: d.title, value: d.id }))}
                    placeholder={t('teacher.hr.staff.form.placeholder.department')}
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="label"
                    allowClear
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.position')}</FieldLabel>
                  <Select
                    value={formik.values.position ?? undefined}
                    onChange={(v) => set('position', v ?? null)}
                    options={positions.map((p) => ({ label: p.title, value: p.id }))}
                    placeholder={t('teacher.hr.staff.form.placeholder.position')}
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="label"
                    allowClear
                  />
                </Col>
                <Col span={24} sm={{ span: 12 }}>
                  <FieldLabel>{t('teacher.hr.staff.form.field.academicTitle')}</FieldLabel>
                  <Select
                    value={formik.values.academicTitle ?? undefined}
                    onChange={(v) => set('academicTitle', v ?? null)}
                    options={academicTitles.map((a) => ({ label: a.title, value: a.id }))}
                    placeholder={t('teacher.hr.staff.form.placeholder.academicTitle')}
                    style={{ width: '100%' }}
                    showSearch
                    optionFilterProp="label"
                    allowClear
                  />
                </Col>
              </Row>

              <Divider />

              <SectionTitle>{t('teacher.hr.staff.form.section.specialty')}</SectionTitle>
              <SpecialtyFields
                name={formik.values.teachingSpecialtyName}
                code={formik.values.teachingSpecialtyCode}
                basis={formik.values.teachingSpecialtyBasis}
                note={formik.values.teachingSpecialtyNote}
                codeError={formik.errors.teachingSpecialtyCode}
                noteError={formik.errors.teachingSpecialtyNote}
                onChangeName={(specialtyName, specialtyCode) => {
                  set('teachingSpecialtyName', specialtyName);
                  set('teachingSpecialtyCode', specialtyCode ?? '');
                }}
                onChangeCode={(specialtyCode) => set('teachingSpecialtyCode', specialtyCode)}
                onChangeBasis={(specialtyBasis) => set('teachingSpecialtyBasis', specialtyBasis)}
                onChangeNote={(specialtyNote) => set('teachingSpecialtyNote', specialtyNote)}
              />
            </LeftCard>

            <LeftCard>
              <SectionTitle>{t('teacher.hr.staff.form.section.internationalLinks')}</SectionTitle>
              <Row gutter={[20, 16]}>
                <Col span={24}>
                  <LinkInput
                    label={t('teacher.hr.staff.form.field.googleScholar')}
                    value={formik.values.googleScholarUrl}
                    onChange={(v) => set('googleScholarUrl', v)}
                  />
                </Col>
                <Col span={24}>
                  <LinkInput
                    label={t('teacher.hr.staff.form.field.scopus')}
                    value={formik.values.scopusUrl}
                    onChange={(v) => set('scopusUrl', v)}
                  />
                </Col>
              </Row>
            </LeftCard>
          </Col>

          <Col xs={24} lg={11}>
            <RightCard>
              <h3>{t('teacher.hr.staff.form.section.education')}</h3>
              <LineTab
                activeTab={activeTab}
                setActiveTab={(k) => setActiveTab(k as EducationTabKey)}
                data={EDUCATION_TABS.map((key) => ({ key, label: t(TAB_LABEL_KEY[key]) }))}
              />

              <TabSubTitle>{t(TAB_LABEL_KEY[activeTab])}</TabSubTitle>

              <EducationDocUploader
                existing={tabExisting}
                pending={tabPending}
                onPendingChange={(files) => set(TAB_NEW_FIELD[activeTab], files)}
                placeholder={t(TAB_PLACEHOLDER_KEY[activeTab])}
              />
            </RightCard>
          </Col>
        </Row>

        <ActionBar>
          <Button onClick={() => navigate('/teacher/hr/staff')} disabled={saving}>
            {t('teacher.hr.staff.form.cancel')}
          </Button>
          <Button type="primary" htmlType="submit" loading={saving}>
            {t('teacher.hr.staff.form.save')}
          </Button>
        </ActionBar>
      </form>
    </PageContainer>
  );
};

export default StaffFormPage;
