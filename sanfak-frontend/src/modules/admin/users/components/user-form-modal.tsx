import { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Col,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Spin,
  Switch,
  Typography,
} from 'antd';
import { useQuery } from '@tanstack/react-query';
import { fetchList, getApiErrorMessage, uploadMultipart } from '@/shared/api';
import { PassportNumber, PassportSeria, JshshirInput, PhoneInput } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useAdminUser } from '../api/users-api';
import { useAdminRoles } from '../../roles/api/roles-api';
import { useReferenceOptions } from '../../lib/reference-crud/reference-api';

interface DeptDoc {
  _id: string;
  title?: string;
  faculty?: { _id: string } | string | null;
}
function useDepartmentsWithFaculty() {
  return useQuery({
    queryKey: ['admin-users', 'departments-with-faculty'],
    queryFn: async () => {
      const docs = await fetchList<DeptDoc>('/departments', { active: true });
      return docs.map((d) => ({
        value: d._id,
        label: String(d.title ?? d._id),
        facultyId:
          typeof d.faculty === 'object' && d.faculty ? d.faculty._id : (d.faculty ?? null),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

interface TitleDoc {
  _id: string;
  title?: string;
  position?: { _id: string } | string | null;
}
function useAcademicTitlesWithPosition() {
  return useQuery({
    queryKey: ['admin-users', 'academic-titles-with-position'],
    queryFn: async () => {
      const docs = await fetchList<TitleDoc>('/academic-titles', { active: true });
      return docs.map((d) => ({
        value: d._id,
        label: String(d.title ?? d._id),
        positionId:
          typeof d.position === 'object' && d.position ? d.position._id : (d.position ?? null),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

const { Text } = Typography;
const LabelStyle = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)' } as const;

interface Props {
  open: boolean;
  editId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function UserFormModal({ open, editId, onClose, onSuccess }: Props) {
  const isEdit = !!editId;
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  const { data: rolesData, isLoading: loadingRoles } = useAdminRoles(1, 200);
  const { data: positionOptions, isLoading: loadingPositions } = useReferenceOptions('/positions');
  const { data: divisionOptions, isLoading: loadingDivisions } = useReferenceOptions('/divisions');
  const { data: allAcademicTitles = [], isLoading: loadingAcademicTitles } =
    useAcademicTitlesWithPosition();
  const { data: facultyOptions, isLoading: loadingFaculties } = useReferenceOptions('/faculties');
  const { data: allDepartments = [], isLoading: loadingDepartments } = useDepartmentsWithFaculty();

  const divisionVal = Form.useWatch('division', form);
  const facultyVal = Form.useWatch('faculty', form);
  const departmentVal = Form.useWatch('department', form);
  const showDivision = !facultyVal && !departmentVal;
  const showFacDept = !divisionVal;
  const departmentOptions = allDepartments.filter((d) => d.facultyId === facultyVal);

  const positionVal = Form.useWatch('position', form);
  const academicTitleOptions = positionVal
    ? allAcademicTitles.filter((t) => !t.positionId || t.positionId === positionVal)
    : allAcademicTitles;

  const handlePositionChange = (val?: string) => {
    const current = form.getFieldValue('academicTitle');
    if (!current || !val) return;
    const title = allAcademicTitles.find((t) => t.value === current);
    if (title?.positionId && title.positionId !== val) {
      form.setFieldValue('academicTitle', undefined);
    }
  };

  const handleAcademicTitleChange = (val?: string) => {
    if (!val) return;
    const title = allAcademicTitles.find((t) => t.value === val);
    if (title?.positionId && !form.getFieldValue('position')) {
      form.setFieldValue('position', title.positionId);
    }
  };

  const { data: existingUser } = useAdminUser(editId ?? undefined);

  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      form.resetFields();
      form.setFieldValue('active', true);
      return;
    }
  }, [open, isEdit, form]);

  useEffect(() => {
    if (!isEdit || !existingUser || !open) return;
    setLoadingUser(true);
    form.setFieldsValue({
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      middleName: existingUser.middleName ?? '',
      passportSeria: existingUser.passportSeria ?? '',
      passportNumber: existingUser.passportNumber ?? '',
      position: typeof existingUser.position === 'object' && existingUser.position
        ? existingUser.position.id
        : (existingUser.position ?? undefined),
      phone: existingUser.phone ?? '',
      email: existingUser.email ?? '',
      division: typeof existingUser.division === 'object' && existingUser.division
        ? existingUser.division.id
        : (existingUser.division ?? undefined),
      department: typeof existingUser.department === 'object' && existingUser.department
        ? existingUser.department.id
        : (existingUser.department ?? undefined),
      faculty: typeof existingUser.faculty === 'object' && existingUser.faculty
        ? existingUser.faculty.id
        : (existingUser.faculty ?? undefined),
      academicTitle: typeof existingUser.academicTitle === 'object' && existingUser.academicTitle
        ? existingUser.academicTitle.id
        : (existingUser.academicTitle ?? undefined),
      publications: existingUser.publications ?? '',
      hIndex: existingUser.hIndex ?? '',
      workingHours: existingUser.workingHours ?? '',
      office: existingUser.office ?? '',
      role: existingUser.role?.id,
      active: existingUser.active,
    });
    setLoadingUser(false);
  }, [existingUser, isEdit, open, form]);

  const handleClose = useCallback(() => {
    form.resetFields();
    onClose();
  }, [form, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (
        document.querySelector(
          '.ant-select-dropdown:not(.ant-select-dropdown-hidden),' +
            '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
        )
      )
        return;
      handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handleClose]);

  const onFinish = async (values: Record<string, unknown>) => {
    setSubmitting(true);
    try {
      const endpoint = isEdit ? `/users/${editId}` : '/users';
      const method = isEdit ? 'PUT' : 'POST';
      await uploadMultipart(endpoint, method, {
        firstName: String(values.firstName ?? ''),
        lastName: String(values.lastName ?? ''),
        middleName: String(values.middleName ?? ''),
        passportSeria: String(values.passportSeria ?? ''),
        passportNumber: String(values.passportNumber ?? ''),
        oneIdPin: isEdit ? undefined : String(values.oneIdPin ?? ''),
        position: String(values.position ?? ''),
        phone: String(values.phone ?? ''),
        email: String(values.email ?? ''),
        division: String(values.division ?? ''),
        department: String(values.department ?? ''),
        faculty: String(values.faculty ?? ''),
        academicTitle: String(values.academicTitle ?? ''),
        publications: String(values.publications ?? ''),
        hIndex: String(values.hIndex ?? ''),
        workingHours: String(values.workingHours ?? ''),
        office: String(values.office ?? ''),
        role: String(values.role ?? ''),
        active: String(values.active ?? true),
      });
      message.success(isEdit ? t('admin.user.updated') : t('admin.user.created'));
      onSuccess();
      handleClose();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const roleOptions = (rolesData?.items ?? []).map((r) => ({ value: r.id, label: r.title }));

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <Text style={{ fontWeight: 600, fontSize: 18, color: 'var(--color-text)' }}>
          {isEdit ? t('admin.user.editTitle') : t('admin.user.createTitle')}
        </Text>
      }
      footer={null}
      width={545}
      centered
      destroyOnClose
      styles={{
        body: {
          maxHeight: 'calc(85vh - 120px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingTop: 8,
        },
        content: { overflowX: 'hidden' },
      }}
    >
      {(isEdit && loadingUser) ? (
        <Flex justify="center" style={{ padding: 40 }}><Spin /></Flex>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
        >
          <Row gutter={[12, 0]}>
            <Col span={12}>
              <Form.Item name="firstName" label={<Text style={LabelStyle}>{t('admin.user.fields.firstName.label')}</Text>} rules={[{ required: true, message: t('admin.common.required') }]}>
                <Input size="large" placeholder={t('admin.user.fields.firstName.placeholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lastName" label={<Text style={LabelStyle}>{t('admin.user.fields.lastName.label')}</Text>} rules={[{ required: true, message: t('admin.common.required') }]}>
                <Input size="large" placeholder={t('admin.user.fields.lastName.placeholder')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="middleName" label={<Text style={LabelStyle}>{t('admin.user.fields.middleName.label')}</Text>}>
                <Input size="large" placeholder={t('admin.user.fields.middleName.placeholder')} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Text style={{ ...LabelStyle, display: 'block', marginBottom: 8 }}>
                {t('admin.user.fields.passport.label')}
              </Text>
              <Flex gap={8} style={{ marginBottom: 16 }}>
                <Form.Item name="passportSeria" style={{ margin: 0, width: 80 }} rules={[{ len: 2, message: t('admin.user.fields.passportSeria.lenError') }]}>
                  <PassportSeria style={{ width: 80 }} />
                </Form.Item>
                <Form.Item name="passportNumber" style={{ margin: 0, flex: 1 }} rules={[{ len: 7, message: t('admin.user.fields.passportNumber.lenError') }]}>
                  <PassportNumber style={{ width: '100%' }} />
                </Form.Item>
              </Flex>
            </Col>

            {!isEdit ? (
              <Col span={24}>
                <Form.Item
                  name="oneIdPin"
                  label={<Text style={LabelStyle}>{t('admin.user.fields.oneIdPin.label')}</Text>}
                  extra={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('admin.user.fields.oneIdPin.extra')}
                    </Text>
                  }
                  rules={[
                    { required: true, message: t('admin.common.required') },
                    { len: 14, message: t('admin.user.fields.oneIdPin.lenError') },
                  ]}
                >
                  <JshshirInput size="large" />
                </Form.Item>
              </Col>
            ) : null}

            <Col span={12}>
              <Form.Item name="position" label={<Text style={LabelStyle}>{t('admin.user.fields.position.label')}</Text>}>
                <Select
                  size="large"
                  loading={loadingPositions}
                  options={positionOptions}
                  placeholder={t('admin.user.fields.position.placeholder')}
                  onChange={handlePositionChange}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label={<Text style={LabelStyle}>{t('admin.user.fields.phone.label')}</Text>} rules={[{ required: true, message: t('admin.common.required') }]}>
                <PhoneInput size="large" />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item
                name="employmentType"
                label={<Text style={LabelStyle}>{t('admin.user.fields.employmentType.label')}</Text>}
              >
                <Select
                  size="large"
                  allowClear
                  placeholder={t('admin.user.fields.employmentType.placeholder')}
                  options={[
                    { label: t('admin.user.fields.employmentType.asosiy'), value: 'asosiy' },
                    { label: t('admin.user.fields.employmentType.orindosh'), value: 'orindosh' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="academicTitle" label={<Text style={LabelStyle}>{t('admin.user.fields.academicTitle.label')}</Text>}>
                <Select
                  size="large"
                  loading={loadingAcademicTitles}
                  options={academicTitleOptions}
                  placeholder={t('admin.user.fields.academicTitle.placeholder')}
                  onChange={handleAcademicTitleChange}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="publications" label={<Text style={LabelStyle}>{t('admin.user.fields.publications.label')}</Text>}>
                <Input size="large" type="number" min={0} placeholder={t('admin.user.fields.numericPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hIndex" label={<Text style={LabelStyle}>{t('admin.user.fields.hIndex.label')}</Text>}>
                <Input size="large" type="number" min={0} placeholder={t('admin.user.fields.numericPlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="workingHours" label={<Text style={LabelStyle}>{t('admin.user.fields.workingHours.label')}</Text>}>
                <Input size="large" placeholder={t('admin.user.fields.workingHours.placeholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="office" label={<Text style={LabelStyle}>{t('admin.user.fields.office.label')}</Text>}>
                <Input size="large" placeholder={t('admin.user.fields.office.placeholder')} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item name="email" label={<Text style={LabelStyle}>{t('admin.user.fields.email.label')}</Text>} rules={[{ type: 'email', message: t('admin.user.fields.email.invalid') }]}>
                <Input size="large" type="email" placeholder={t('admin.user.fields.email.placeholder')} />
              </Form.Item>
            </Col>

            {showDivision ? (
              <Col span={24}>
                <Form.Item name="division" label={<Text style={LabelStyle}>{t('admin.user.fields.division.label')}</Text>}>
                  <Select
                    size="large"
                    loading={loadingDivisions}
                    options={divisionOptions}
                    placeholder={t('admin.user.fields.division.placeholder')}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    onChange={(v) => {
                      if (v) form.setFieldsValue({ faculty: undefined, department: undefined });
                    }}
                  />
                </Form.Item>
              </Col>
            ) : null}

            {showFacDept ? (
              <>
                <Col span={12}>
                  <Form.Item name="faculty" label={<Text style={LabelStyle}>{t('admin.user.fields.faculty.label')}</Text>}>
                    <Select
                      size="large"
                      loading={loadingFaculties}
                      options={facultyOptions}
                      placeholder={t('admin.user.fields.faculty.placeholder')}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      onChange={() =>
                        form.setFieldsValue({ division: undefined, department: undefined })
                      }
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="department" label={<Text style={LabelStyle}>{t('admin.user.fields.department.label')}</Text>}>
                    <Select
                      size="large"
                      loading={loadingDepartments}
                      options={departmentOptions}
                      placeholder={facultyVal ? t('admin.user.fields.department.placeholder') : t('admin.user.fields.department.placeholderDisabled')}
                      disabled={!facultyVal}
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      onChange={(v) => {
                        if (v) form.setFieldValue('division', undefined);
                      }}
                    />
                  </Form.Item>
                </Col>
              </>
            ) : null}

            <Col span={24}>
              <Form.Item name="role" label={<Text style={LabelStyle}>{t('admin.user.fields.role.label')}</Text>} rules={[{ required: true, message: t('admin.common.required') }]}>
                <Select
                  size="large"
                  loading={loadingRoles}
                  options={roleOptions}
                  placeholder={t('admin.user.fields.role.placeholder')}
                  allowClear
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label={<Text style={LabelStyle}>{t('admin.user.fields.status.label')}</Text>}>
                <Flex align="center" gap={10}>
                  <Form.Item name="active" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                  <Text type="secondary" style={{ fontSize: 13 }}>{t('admin.user.statusActive')}</Text>
                </Flex>
              </Form.Item>
            </Col>
          </Row>

          <Flex
            gap={12}
            style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}
          >
            <Button
              onClick={handleClose}
              style={{
                flex: 1,
                background: '#e3e8ef',
                color: 'var(--color-text)',
                border: 'none',
                height: 44,
                fontWeight: 500,
                borderRadius: 10,
              }}
            >
              {t('admin.common.cancel')}
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              style={{ flex: 1, height: 44, fontWeight: 500, borderRadius: 10 }}
            >
              {t('admin.common.save')}
            </Button>
          </Flex>
        </Form>
      )}
    </Modal>
  );
}
