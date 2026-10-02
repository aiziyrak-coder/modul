import { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, Modal, Radio, Select, Steps, message } from 'antd';
import { CheckCircleOutlined, DownloadOutlined, FilePdfOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { SupervisorType, WorkInput } from '../../model/types';
import {
  useFacultiesRef,
  useDepartmentsRef,
  useDivisionsRef,
  useAllStaff,
  useApplicationTemplate,
  useSpecialties,
  useAcademicTitlesRef,
  useAcademicLevelsRef,
} from '../../api/science-council-api';
import { staffOptionsFor, isCascadeNarrowedEmpty } from '../../lib/staff-cascade';
import * as S from './style';

export interface WorkApplicationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Partial<WorkInput>, file: File) => void;
  loading?: boolean;
}

const YEARS = [
  { value: '2025-2026', label: '2025-2026' },
  { value: '2024-2025', label: '2024-2025' },
  { value: '2026-2027', label: '2026-2027' },
];

const LAST_STEP = 1;
const ALLOWED_FILE_TYPES = ['application/pdf'];

const popupInModal = (trigger: HTMLElement): HTMLElement =>
  trigger.parentElement ?? document.body;

export function WorkApplicationModal({ open, onClose, onSubmit, loading }: WorkApplicationModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<WorkInput>();
  const [step, setStep] = useState(0);
  const { data: template } = useApplicationTemplate();
  const { data: specialties = [] } = useSpecialties();
  const { data: academicTitles = [] } = useAcademicTitlesRef();
  const { data: academicLevels = [] } = useAcademicLevelsRef();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [supervisorType, setSupervisorType] = useState<SupervisorType>('internal');
  const [supFaculty, setSupFaculty] = useState<string>();
  const [supDept, setSupDept] = useState<string>();
  const [supDivision, setSupDivision] = useState<string>();

  const { data: faculties = [] } = useFacultiesRef();
  const { data: supDepartments = [] } = useDepartmentsRef(supFaculty);
  const { data: divisions = [] } = useDivisionsRef();
  const { data: allStaff = [], isLoading: staffLoading } = useAllStaff();

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setFile(null);
    setSupervisorType('internal');
    setSupFaculty(undefined);
    setSupDept(undefined);
    setSupDivision(undefined);
    form.resetFields();
    form.setFieldsValue({ supervisorType: 'internal' });
  }, [open, form]);

  const supervisorOptions = staffOptionsFor(allStaff, supDivision, supDept, supFaculty, supDepartments);

  const notFoundFor = (options: unknown[], division?: string, dept?: string, faculty?: string) =>
    isCascadeNarrowedEmpty(options.length, division, dept, faculty) ? (
      <span style={{ padding: '4px 0' }}>{t('scienceCouncil.form.noStaffInUnit')}</span>
    ) : undefined;

  const handleClose = () => {
    form.resetFields();
    setFile(null);
    onClose();
  };

  const handleFileChange = (f: File | null) => {
    if (f && !ALLOWED_FILE_TYPES.includes(f.type)) {
      message.error(t('scienceCouncil.apply.fileTypeError'));
      return;
    }
    setFile(f);
  };

  const fieldsForStep = (s: number): (keyof WorkInput)[] =>
    s === 0
      ? ['title', 'specialtyId', 'year']
      : supervisorType === 'internal'
        ? ['supervisorUserId']
        : ['supervisorName', 'supervisorWorkplace', 'supervisorPosition'];

  const handleNext = async () => {
    await form.validateFields(fieldsForStep(step));
    if (step === 0 && !file) {
      message.warning(t('scienceCouncil.apply.fileRequired'));
      return;
    }
    setStep((s) => Math.min(s + 1, LAST_STEP));
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    if (!file) {
      message.warning(t('scienceCouncil.apply.fileRequired'));
      setStep(0);
      return;
    }
    onSubmit(values, file);
  };

  const stepItems = [
    { title: t('scienceCouncil.step.general') },
    { title: t('scienceCouncil.step.supervisor') },
  ];

  const stepStyle = (s: number) => ({ display: step === s ? 'block' : 'none' });

  return (
    <Modal
      title={t('scienceCouncil.apply.title')}
      open={open}
      onCancel={handleClose}
      width={640}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={handleClose}>
          {t('scienceCouncil.cancel')}
        </Button>,
        step > 0 ? (
          <Button key="back" onClick={() => setStep((s) => s - 1)}>
            {t('scienceCouncil.form.back')}
          </Button>
        ) : null,
        step < LAST_STEP ? (
          <Button key="next" type="primary" onClick={handleNext}>
            {t('scienceCouncil.form.next')}
          </Button>
        ) : (
          <Button key="save" type="primary" loading={loading} onClick={handleOk}>
            {t('scienceCouncil.apply.submit')}
          </Button>
        ),
      ]}
    >
      <Steps current={step} items={stepItems} size="small" style={{ margin: '8px 0 14px' }} />

      <Form form={form} layout="vertical" initialValues={{ supervisorType: 'internal' as SupervisorType }}>
        <S.FieldsScope>
        <div style={stepStyle(0)}>
          {template && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                marginBottom: 12,
                background: 'var(--bg-muted, #f9fafb)',
                border: '1px solid var(--border-secondary, #e5e7eb)',
                borderLeft: '3px solid var(--brand-primary, #34c18c)',
                borderRadius: 'var(--radius-lg, 12px)',
              }}
            >
              <FilePdfOutlined style={{ fontSize: 22, color: 'var(--brand-error, #F04438)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {t('scienceCouncil.apply.templateTitle')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)' }}>
                  {t('scienceCouncil.apply.templateHint')}
                </div>
              </div>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                href={template.fileUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('scienceCouncil.settings.templateDownload')}
              </Button>
            </div>
          )}

          <Form.Item
            name="title"
            label={t('scienceCouncil.work.title')}
            rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
          >
            <Input.TextArea rows={2} placeholder={t('scienceCouncil.form.titlePlaceholder')} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0, 1fr)', gap: 12 }}>
            <Form.Item
              name="specialtyId"
              label={t('scienceCouncil.form.specialtyCode')}
              rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
            >
              <Select
                getPopupContainer={popupInModal}
                placeholder={t('scienceCouncil.form.selectCode')}
                showSearch
                optionFilterProp="label"
                options={specialties.map((sp) => ({ value: sp.id, label: sp.code }))}
              />
            </Form.Item>
            <Form.Item
              name="specialtyId"
              label={t('scienceCouncil.form.specialtyTitle')}
              rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
            >
              <Select
                getPopupContainer={popupInModal}
                placeholder={t('scienceCouncil.form.selectSpecialty')}
                showSearch
                optionFilterProp="label"
                options={specialties.map((sp) => ({ value: sp.id, label: sp.title }))}
              />
            </Form.Item>
          </div>

          <Form.Item name="year" label={t('scienceCouncil.work.year')} initialValue="2025-2026" rules={[{ required: true }]}>
            <Select
            getPopupContainer={popupInModal} options={YEARS} />
          </Form.Item>

          <div style={{ marginBottom: 4, fontWeight: 500, fontSize: 13 }}>{t('scienceCouncil.apply.file')}</div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          />
          <S.Dropzone $active={!!file} onClick={() => fileInputRef.current?.click()}>
            {file ? (
              <div>
                <CheckCircleOutlined style={{ fontSize: 16, color: '#16a34a', marginBottom: 2 }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {(file.size / 1024).toFixed(1)} KB
                </div>
                <div style={{ fontSize: 11, color: '#0891b2', marginTop: 4 }}>
                  {t('scienceCouncil.apply.chooseAnother')}
                </div>
              </div>
            ) : (
              <div>
                <UploadOutlined style={{ fontSize: 16, color: '#9ca3af', marginBottom: 2 }} />
                <div style={{ fontSize: 13, color: '#6b7280' }}>{t('scienceCouncil.apply.chooseFile')}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>PDF</div>
              </div>
            )}
          </S.Dropzone>
        </div>

        <div style={stepStyle(1)}>
          <Form.Item name="supervisorType" label={t('scienceCouncil.form.supervisorType')}>
            <Radio.Group onChange={(e) => setSupervisorType(e.target.value)}>
              <Radio value="internal">{t('scienceCouncil.work.internal')}</Radio>
              <Radio value="external">{t('scienceCouncil.work.external')}</Radio>
            </Radio.Group>
          </Form.Item>

          {supervisorType === 'internal' ? (
            <>
              <Form.Item
                name="supervisorDivisionId"
                label={t('scienceCouncil.form.division')}
                tooltip={t('scienceCouncil.form.divisionTooltip')}
              >
                <Select
            getPopupContainer={popupInModal}
                  placeholder={t('scienceCouncil.form.selectDivision')}
                  allowClear
                  disabled={!!supFaculty}
                  onChange={(v) => {
                    setSupDivision(v);
                    form.setFieldsValue({ supervisorUserId: undefined });
                  }}
                  options={divisions.map((d) => ({ value: d.id, label: d.title }))}
                />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                <Form.Item name="supervisorFacultyId" label={t('scienceCouncil.form.faculty')}>
                  <Select
            getPopupContainer={popupInModal}
                    placeholder={t('scienceCouncil.form.selectFaculty')}
                    allowClear
                    disabled={!!supDivision}
                    onChange={(v) => {
                      setSupFaculty(v);
                      setSupDept(undefined);
                      form.setFieldValue('supervisorDepartmentId', undefined);
                      form.setFieldValue('supervisorUserId', undefined);
                    }}
                    options={faculties.map((f) => ({ value: f.id, label: f.title }))}
                  />
                </Form.Item>
                <Form.Item name="supervisorDepartmentId" label={t('scienceCouncil.form.department')}>
                  <Select
            getPopupContainer={popupInModal}
                    placeholder={t('scienceCouncil.form.selectDepartment')}
                    allowClear
                    disabled={!!supDivision || !supFaculty}
                    onChange={(v) => {
                      setSupDept(v);
                      form.setFieldValue('supervisorUserId', undefined);
                    }}
                    options={supDepartments.map((d) => ({ value: d.id, label: d.title }))}
                  />
                </Form.Item>
              </div>

              <Form.Item
                name="supervisorUserId"
                label={t('scienceCouncil.form.supervisor')}
                rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
              >
                <Select
            getPopupContainer={popupInModal}
                  placeholder={t('scienceCouncil.form.selectSupervisor')}
                  options={supervisorOptions}
                  loading={staffLoading}
                  notFoundContent={notFoundFor(supervisorOptions, supDivision, supDept, supFaculty)}
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="supervisorName"
                label={t('scienceCouncil.form.fullName')}
                rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
              >
                <Input placeholder={t('scienceCouncil.form.fullNamePlaceholder')} />
              </Form.Item>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                <Form.Item
                  name="supervisorWorkplace"
                  label={t('scienceCouncil.form.workplace')}
                  rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
                >
                  <Input placeholder={t('scienceCouncil.form.workplacePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name="supervisorPosition"
                  label={t('scienceCouncil.form.position')}
                  rules={[{ required: true, message: t('scienceCouncil.form.required') }]}
                >
                  <Input placeholder={t('scienceCouncil.form.positionPlaceholder')} />
                </Form.Item>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                <Form.Item name="supervisorAcademicTitle" label={t('scienceCouncil.form.scientificTitle')}>
                  <Select
                    getPopupContainer={popupInModal}
                    placeholder={t('scienceCouncil.form.selectScientificTitle')}
                    options={academicTitles.map((o) => ({ value: o.title, label: o.title }))}
                    notFoundContent={t('scienceCouncil.form.refEmpty')}
                    showSearch
                    allowClear
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item name="supervisorDegree" label={t('scienceCouncil.form.degree')}>
                  <Select
                    getPopupContainer={popupInModal}
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
                <Form.Item
                  name="supervisorEmail"
                  label={t('scienceCouncil.form.email')}
                  rules={[{ type: 'email', message: t('scienceCouncil.form.emailInvalid') }]}
                >
                  <Input placeholder={t('scienceCouncil.form.emailPlaceholder')} />
                </Form.Item>
                <Form.Item name="supervisorPhone" label={t('scienceCouncil.form.phone')}>
                  <Input placeholder={t('scienceCouncil.form.phonePlaceholder')} />
                </Form.Item>
              </div>
            </>
          )}
        </div>
        </S.FieldsScope>
      </Form>
    </Modal>
  );
}
