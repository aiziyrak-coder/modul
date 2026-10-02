import { useEffect, useMemo, useState } from 'react';
import { Form, Input, Modal, Radio, Select, Switch } from 'antd';
import { PhoneInput } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { CouncilMember, MemberFormInput, MemberType } from '../../model/types';
import {
  useFacultiesRef,
  useDepartmentsRef,
  useDivisionsRef,
  useAllStaff,
  useSpecialties,
  useCouncilNumbers,
  useAcademicTitlesRef,
  useAcademicLevelsRef,
} from '../../api/science-council-api';
import { staffOptionsFor, isCascadeNarrowedEmpty } from '../../lib/staff-cascade';

interface MemberFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: MemberFormInput) => void;
  loading?: boolean;
  editData?: CouncilMember | null;
  excludeUserIds?: string[];
}

export function MemberFormModal({ open, onClose, onSubmit, loading, editData, excludeUserIds }: MemberFormModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<MemberFormInput>();
  const { data: specialties = [] } = useSpecialties();
  const { data: councilNumbers = [] } = useCouncilNumbers();
  const { data: academicTitles = [] } = useAcademicTitlesRef();
  const { data: academicLevels = [] } = useAcademicLevelsRef();
  const [councilFilter, setCouncilFilter] = useState<string | undefined>(undefined);
  const specialtyOptions = useMemo(() => {
    if (!councilFilter) return specialties;
    const cn = councilNumbers.find((c) => c.id === councilFilter);
    const ids = new Set((cn?.specialties ?? []).map((sp) => sp.id));
    return specialties.filter((sp) => ids.has(sp.id));
  }, [councilFilter, councilNumbers, specialties]);
  const [memberType, setMemberType] = useState<MemberType>('internal');

  const [selectedFaculty, setSelectedFaculty] = useState<string>();
  const [selectedDept, setSelectedDept] = useState<string>();
  const [selectedDivision, setSelectedDivision] = useState<string>();

  const isEdit = !!editData;
  const { data: faculties = [] } = useFacultiesRef();
  const { data: departments = [] } = useDepartmentsRef(selectedFaculty);
  const { data: divisions = [] } = useDivisionsRef();
  const { data: allStaff = [], isLoading: staffLoading } = useAllStaff();

  useEffect(() => {
    if (!open) return;
    setSelectedFaculty(undefined);
    setSelectedDept(undefined);
    setSelectedDivision(undefined);

    if (!editData) {
      setMemberType('internal');
      form.resetFields();
      form.setFieldsValue({ type: 'internal', active: true });
      return;
    }

    setMemberType(editData.type);
    if (editData.type === 'external') {
      form.setFieldsValue({
        type: 'external',
        name: editData.name,
        workplace: editData.organization,
        position: editData.position,
        academicTitle: editData.academicTitle || undefined,
        degree: editData.degree || undefined,
        passportSeries: editData.passportSeries,
        passportNumber: editData.passportNumber,
        email: editData.email,
        phone: editData.phone,
        specialtyIds: editData.specialties.map((sp) => sp.id),
        active: editData.active,
      });
    } else {
      form.setFieldsValue({
        type: 'internal',
        specialtyIds: editData.specialties.map((sp) => sp.id),
        active: editData.active,
      });
    }
  }, [open, editData, form]);

  const allOptions = staffOptionsFor(allStaff, selectedDivision, selectedDept, selectedFaculty, departments);
  const excluded = new Set(excludeUserIds ?? []);
  const authorOptions = excluded.size
    ? allOptions.filter((o) => !excluded.has(String(o.value)))
    : allOptions;
  const notFoundContent = isCascadeNarrowedEmpty(authorOptions.length, selectedDivision, selectedDept, selectedFaculty) ? (
    <span style={{ padding: '4px 0' }}>{t('scienceCouncil.form.noStaffInUnit')}</span>
  ) : undefined;

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({ ...values, type: editData?.type ?? memberType });
  };

  return (
    <Modal
      title={isEdit ? t('scienceCouncil.member.editMember') : t('scienceCouncil.member.addMember')}
      open={open}
      onCancel={handleClose}
      onOk={handleOk}
      confirmLoading={loading}
      okText={t('scienceCouncil.save')}
      cancelText={t('scienceCouncil.cancel')}
      okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
      width={520}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }} initialValues={{ type: 'internal', active: true }}>
        {!isEdit && (
          <Form.Item name="type" label={t('scienceCouncil.member.type')}>
            <Radio.Group onChange={(e) => setMemberType(e.target.value)}>
              <Radio value="internal">{t('scienceCouncil.work.internal')}</Radio>
              <Radio value="external">{t('scienceCouncil.work.external')}</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {memberType === 'internal' ? (
          isEdit ? (
            <div
              style={{
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{editData?.name}</div>
              <div style={{ color: 'var(--color-text-tertiary, #6b7280)' }}>
                {[editData?.position, editData?.email, editData?.phone].filter(Boolean).join(' · ')}
              </div>
            </div>
          ) : (
            <>
              <Form.Item
                name="divisionId"
                label={t('scienceCouncil.form.division')}
                tooltip={t('scienceCouncil.form.divisionTooltip')}
              >
                <Select
                  placeholder={t('scienceCouncil.form.selectDivision')}
                  allowClear
                  disabled={!!selectedFaculty}
                  onChange={(v) => {
                    setSelectedDivision(v);
                    form.setFieldsValue({ userId: undefined });
                  }}
                  options={divisions.map((d) => ({ value: d.id, label: d.title }))}
                />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                <Form.Item name="facultyId" label={t('scienceCouncil.form.faculty')}>
                  <Select
                    placeholder={t('scienceCouncil.form.selectFaculty')}
                    allowClear
                    disabled={!!selectedDivision}
                    onChange={(v) => {
                      setSelectedFaculty(v);
                      setSelectedDept(undefined);
                      form.setFieldValue('departmentId', undefined);
                      form.setFieldValue('userId', undefined);
                    }}
                    options={faculties.map((f) => ({ value: f.id, label: f.title }))}
                  />
                </Form.Item>
                <Form.Item name="departmentId" label={t('scienceCouncil.form.department')}>
                  <Select
                    placeholder={t('scienceCouncil.form.selectDepartment')}
                    allowClear
                    disabled={!!selectedDivision || !selectedFaculty}
                    onChange={(v) => {
                      setSelectedDept(v);
                      form.setFieldValue('userId', undefined);
                    }}
                    options={departments.map((d) => ({ value: d.id, label: d.title }))}
                  />
                </Form.Item>
              </div>

              <Form.Item
                name="userId"
                label={t('scienceCouncil.member.name')}
                rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
              >
                <Select
                  placeholder={
                    selectedDivision
                      ? t('scienceCouncil.form.selectDivisionStaff')
                      : t('scienceCouncil.form.selectTeacher')
                  }
                  options={authorOptions}
                  loading={staffLoading}
                  notFoundContent={notFoundContent}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </>
          )
        ) : (
          <>
            <Form.Item
              name="name"
              label={t('scienceCouncil.form.fullName')}
              rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
            >
              <Input placeholder={t('scienceCouncil.form.fullNamePlaceholder')} />
            </Form.Item>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <Form.Item
                name="workplace"
                label={t('scienceCouncil.form.workplace')}
                rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
              >
                <Input placeholder={t('scienceCouncil.form.workplacePlaceholder')} />
              </Form.Item>
              <Form.Item
                name="position"
                label={t('scienceCouncil.member.position')}
                rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
              >
                <Input placeholder={t('scienceCouncil.form.positionPlaceholder')} />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <Form.Item name="academicTitle" label={t('scienceCouncil.form.scientificTitle')}>
                <Select
                  placeholder={t('scienceCouncil.form.selectScientificTitle')}
                  options={academicTitles.map((o) => ({ value: o.title, label: o.title }))}
                  notFoundContent={t('scienceCouncil.form.refEmpty')}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item name="degree" label={t('scienceCouncil.form.degree')}>
                <Select
                  placeholder={t('scienceCouncil.form.selectDegree')}
                  options={academicLevels.map((o) => ({ value: o.title, label: o.title }))}
                  notFoundContent={t('scienceCouncil.form.refEmpty')}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                />
              </Form.Item>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <Form.Item name="passportSeries" label={t('scienceCouncil.form.passportSeries')}>
                <Input placeholder="AB" maxLength={2} />
              </Form.Item>
              <Form.Item name="passportNumber" label={t('scienceCouncil.form.passportNumber')}>
                <Input placeholder="1234567" maxLength={7} />
              </Form.Item>
            </div>
          </>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
          <Form.Item label={t('scienceCouncil.settings.councilNumber')}>
            <Select
              value={councilFilter}
              onChange={setCouncilFilter}
              placeholder={t('scienceCouncil.member.councilNumberHint')}
              options={councilNumbers.map((c) => ({ value: c.id, label: c.number }))}
              notFoundContent={t('scienceCouncil.form.refEmpty')}
              showSearch
              allowClear
              optionFilterProp="label"
            />
          </Form.Item>

          <Form.Item name="specialtyIds" label={t('scienceCouncil.form.specialtyCode')}>
            <Select
              mode="multiple"
              placeholder={t('scienceCouncil.form.selectCode')}
              options={specialtyOptions.map((sp) => ({ value: sp.id, label: `${sp.code} — ${sp.title}` }))}
              notFoundContent={t('scienceCouncil.form.refEmpty')}
              showSearch
              allowClear
              optionFilterProp="label"
            />
          </Form.Item>
        </div>

        {memberType === 'external' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
            <Form.Item name="email" label={t('scienceCouncil.member.email')}>
              <Input type="email" />
            </Form.Item>
            <Form.Item name="phone" label={t('scienceCouncil.member.phone')}>
              <PhoneInput />
            </Form.Item>
          </div>
        )}

        {isEdit && (
          <Form.Item label={t('scienceCouncil.member.active')} name="active" valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
