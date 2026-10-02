import { useEffect, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { Button, Card, DatePicker, Flex, Form, Input, InputNumber, Select, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';
import { moneyFormatter, moneyParser } from '@/shared/ui';
import { EDU_FORM } from '../../model/course.types';
import type { CourseFormDefaults, CourseInput, EduForm, Option } from '../../model/course.types';
import TeacherPicker from '../teacher-picker';
import QualStepper from '../qual-stepper';
import { MethodSegmented } from './style';

const { Title, Paragraph } = Typography;

const blockNonDigitKey = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/[0-9]/.test(e.key)) e.preventDefault();
};
const blockNonDigitPaste = (e: ClipboardEvent<HTMLInputElement>) => {
  if (!/^\d+$/.test(e.clipboardData.getData('text').trim())) e.preventDefault();
};

interface IProps {
  courseTypeOptions: Option[];
  teacherOptions: Option[];
  optionsLoading?: boolean;
  submitting: boolean;
  defaultValues?: CourseFormDefaults;
  onSubmit: (input: CourseInput) => void;
  onCancel: () => void;
}

interface FormShape {
  courseType: string;
  form: EduForm;
  title: string;
  creditHours: number;
  price: number;
  listenersLimit: number;
  startDate: Dayjs;
  endDate: Dayjs;
  address: string;
  lat: string;
  lng: string;
  teachers: string[];
}

type StepKey = 'basic' | 'dates' | 'location' | 'teachers';
interface StepDef {
  key: StepKey;
  label: string;
  fields: (keyof FormShape)[];
}

const cardBody = { body: { padding: 'var(--space-6)' } } as const;
const headingStyle = { marginTop: 0, marginBottom: 'var(--space-4)' } as const;

export default function CourseForm({
  courseTypeOptions,
  teacherOptions,
  optionsLoading,
  submitting,
  defaultValues,
  onSubmit,
  onCancel,
}: IProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<FormShape>();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!defaultValues) return;
    form.setFieldsValue({
      courseType: defaultValues.courseType,
      form: defaultValues.form,
      title: defaultValues.title,
      creditHours: defaultValues.creditHours,
      price: defaultValues.price,
      listenersLimit: defaultValues.listenersLimit,
      startDate: defaultValues.startDate ? dayjs(defaultValues.startDate) : undefined,
      endDate: defaultValues.endDate ? dayjs(defaultValues.endDate) : undefined,
      address: defaultValues.address,
      lat: defaultValues.lat,
      lng: defaultValues.lng,
      teachers: defaultValues.teachers,
    });
  }, [defaultValues, form]);

  const req = [{ required: true, message: t('qualification.courses.required') }];
  const teacherRules = [
    { required: true, type: 'array' as const, min: 1, message: t('qualification.courses.required') },
  ];

  const watchedForm = Form.useWatch('form', form);
  const isOffline = watchedForm === EDU_FORM.OFFLINE;

  const steps: StepDef[] = [
    {
      key: 'basic',
      label: t('qualification.courses.step.basic'),
      fields: ['form', 'courseType', 'title', 'creditHours', 'listenersLimit', 'price'],
    },
    { key: 'dates', label: t('qualification.courses.step.dates'), fields: ['startDate', 'endDate'] },
    ...(isOffline
      ? [
          {
            key: 'location' as const,
            label: t('qualification.courses.step.location'),
            fields: ['address', 'lat', 'lng'] as (keyof FormShape)[],
          },
        ]
      : []),
    { key: 'teachers', label: t('qualification.courses.step.teachers'), fields: ['teachers'] },
  ];

  const lastIndex = steps.length - 1;
  useEffect(() => {
    if (step > lastIndex) setStep(lastIndex);
  }, [step, lastIndex]);

  const stepIndex = Math.min(step, lastIndex);
  const active = steps[stepIndex];
  const show = (key: StepKey) => ({ display: active?.key === key ? 'block' : 'none' });

  const next = async () => {
    try {
      await form.validateFields(active?.fields ?? []);
      setStep(stepIndex + 1);
    } catch {}
  };

  const finish = async () => {
    try {
      const v = await form.validateFields();
      const input: CourseInput = {
        courseType: v.courseType,
        title: v.title.trim(),
        creditHours: Number(v.creditHours),
        price: Number(v.price),
        form: v.form,
        listenersLimit: Number(v.listenersLimit),
        startDate: v.startDate.toISOString(),
        endDate: v.endDate.toISOString(),
        teachers: v.teachers,
      };
      if (v.address?.trim()) input.address = v.address.trim();
      if (v.lat && v.lng) input.location = { lat: String(v.lat), lng: String(v.lng) };
      onSubmit(input);
    } catch {}
  };

  return (
    <Flex vertical gap={16}>
      <Card styles={cardBody}>
        <QualStepper current={stepIndex + 1} steps={steps.map((s) => ({ label: s.label }))} />
      </Card>

      <Card styles={cardBody}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ form: EDU_FORM.ONLINE }}
          requiredMark={(labelNode, info) => (
            <>
              {labelNode}
              {info.required ? <span style={{ color: 'var(--brand-error)' }}> *</span> : null}
            </>
          )}
        >
          <div style={show('basic')}>
            <Title level={5} style={headingStyle}>
              {t('qualification.courses.step.basic')}
            </Title>

            <Form.Item name="form" label={t('qualification.courses.field.form')} rules={req}>
              <MethodSegmented
                size="large"
                block
                options={[
                  { value: EDU_FORM.ONLINE, label: t('qualification.courses.form.online') },
                  { value: EDU_FORM.OFFLINE, label: t('qualification.courses.form.offline') },
                ]}
              />
            </Form.Item>

            <Form.Item name="courseType" label={t('qualification.courses.field.courseType')} rules={req}>
              <Select
                size="large"
                loading={optionsLoading}
                options={courseTypeOptions}
                placeholder={t('qualification.courses.field.courseTypePh')}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item name="title" label={t('qualification.courses.field.title')} rules={req}>
              <Input size="large" placeholder={t('qualification.courses.field.titlePh')} />
            </Form.Item>

            <Flex gap={12} wrap>
              <Form.Item
                name="creditHours"
                label={t('qualification.courses.field.creditHours')}
                rules={req}
                style={{ flex: 1, minWidth: 180 }}
              >
                <InputNumber
                  size="large"
                  min={1}
                  style={{ width: '100%' }}
                  placeholder={t('qualification.courses.field.creditHoursPh')}
                  onKeyDown={blockNonDigitKey}
                  onPaste={blockNonDigitPaste}
                />
              </Form.Item>
              <Form.Item
                name="listenersLimit"
                label={t('qualification.courses.field.listenersLimit')}
                rules={req}
                style={{ flex: 1, minWidth: 180 }}
              >
                <InputNumber
                  size="large"
                  min={1}
                  style={{ width: '100%' }}
                  placeholder={t('qualification.courses.field.listenersLimitPh')}
                  onKeyDown={blockNonDigitKey}
                  onPaste={blockNonDigitPaste}
                />
              </Form.Item>
            </Flex>

            <Form.Item name="price" label={t('qualification.courses.field.price')} rules={req}>
              <InputNumber<number>
                size="large"
                min={0}
                style={{ width: '100%' }}
                placeholder={t('qualification.courses.field.pricePh')}
                formatter={moneyFormatter}
                parser={moneyParser}
                onKeyDown={blockNonDigitKey}
                onPaste={blockNonDigitPaste}
              />
            </Form.Item>
          </div>

          <div style={show('dates')}>
            <Title level={5} style={headingStyle}>
              {t('qualification.courses.step.dates')}
            </Title>
            <Flex gap={12} wrap>
              <Form.Item
                name="startDate"
                label={t('qualification.courses.field.startDate')}
                rules={req}
                style={{ flex: 1, minWidth: 200 }}
              >
                <DatePicker
                  size="large"
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder={t('qualification.courses.field.datePh')}
                />
              </Form.Item>
              <Form.Item
                name="endDate"
                label={t('qualification.courses.field.endDate')}
                dependencies={['startDate']}
                style={{ flex: 1, minWidth: 200 }}
                rules={[
                  ...req,
                  {
                    validator: (_r, value: Dayjs) => {
                      const start = form.getFieldValue('startDate') as Dayjs | undefined;
                      if (!value || !start || value.isAfter(start)) return Promise.resolve();
                      return Promise.reject(new Error(t('qualification.courses.endAfterStart')));
                    },
                  },
                ]}
              >
                <DatePicker
                  size="large"
                  style={{ width: '100%' }}
                  format="DD.MM.YYYY"
                  placeholder={t('qualification.courses.field.datePh')}
                />
              </Form.Item>
            </Flex>
          </div>

          {isOffline ? (
            <div style={show('location')}>
              <Title level={5} style={headingStyle}>
                {t('qualification.courses.step.location')}
              </Title>
              <Form.Item name="address" label={t('qualification.courses.field.address')} rules={req}>
                <Input size="large" placeholder={t('qualification.courses.field.addressPh')} />
              </Form.Item>
              <Flex gap={12}>
                <Form.Item name="lat" label={t('qualification.courses.field.lat')} rules={req} style={{ flex: 1 }}>
                  <Input size="large" placeholder="40.3864" />
                </Form.Item>
                <Form.Item name="lng" label={t('qualification.courses.field.lng')} rules={req} style={{ flex: 1 }}>
                  <Input size="large" placeholder="71.7864" />
                </Form.Item>
              </Flex>
            </div>
          ) : null}

          <div style={show('teachers')}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 'var(--space-2)' }}>
              {t('qualification.courses.step.teachers')}
            </Title>
            <Paragraph type="secondary" style={{ marginBottom: 'var(--space-4)' }}>
              {t('qualification.courses.teachersHint')}
            </Paragraph>
            <Form.Item name="teachers" rules={teacherRules}>
              <TeacherPicker options={teacherOptions} />
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Flex justify="space-between" align="center">
        <Button type="text" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Flex gap={12}>
          {stepIndex > 0 ? (
            <Button onClick={() => setStep(stepIndex - 1)} style={{ height: 44, minWidth: 100 }}>
              {t('qualification.courses.back')}
            </Button>
          ) : null}
          {stepIndex < lastIndex ? (
            <Button type="primary" onClick={next} style={{ height: 44, minWidth: 120 }}>
              {t('qualification.courses.next')}
            </Button>
          ) : (
            <Button type="primary" loading={submitting} onClick={finish} style={{ height: 44, minWidth: 120 }}>
              {t('save')}
            </Button>
          )}
        </Flex>
      </Flex>
    </Flex>
  );
}
