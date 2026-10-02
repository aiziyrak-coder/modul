import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, App as AntApp, Button, Form, Input, Result, Select, Spin, Steps,
} from 'antd';
import {
  CheckCircleOutlined, DownloadOutlined, FilePdfOutlined, UploadOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import {
  usePublicFormRefs,
  useSubmitPublicApplication,
  publicApiMessage,
  type PublicApplicationInput,
} from '../api/public-api';
import * as S from '../components/public-application/style';

const LAST_STEP = 1;

const popupInCard = (trigger: HTMLElement): HTMLElement =>
  trigger.parentElement ?? document.body;

export default function PublicApplicationPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm<PublicApplicationInput>();

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: refs, isLoading, isError, refetch, isFetching } = usePublicFormRefs();
  const submitMut = useSubmitPublicApplication();

  useEffect(() => {
    if (refs?.years.length && !form.getFieldValue('year')) {
      form.setFieldsValue({ year: refs.years[0] });
    }
  }, [refs, form]);

  const specialtyOptions = useMemo(
    () => (refs?.specialties ?? []).map((sp) => ({ value: sp.id, label: sp.title })),
    [refs],
  );
  const codeOptions = useMemo(
    () => (refs?.specialties ?? []).map((sp) => ({ value: sp.id, label: sp.code })),
    [refs],
  );

  const handleFileChange = useCallback(
    (f: File | null) => {
      if (!f) return;
      if (f.type !== 'application/pdf') {
        message.error(t('scienceCouncil.apply.fileTypeError'));
        return;
      }
      setFile(f);
    },
    [message, t],
  );

  const fieldsForStep = (s: number): (keyof PublicApplicationInput)[] =>
    s === 0
      ? [
          'title', 'specialty', 'year', 'fullName', 'workplace', 'position',
          'passportSeries', 'passportNumber', 'pinfl', 'phone', 'email',
        ]
      : ['supervisorName', 'supervisorWorkplace', 'supervisorPosition'];

  const handleNext = useCallback(async () => {
    try {
      await form.validateFields(fieldsForStep(0));
    } catch {
      return;
    }
    if (!file) {
      message.error(t('scienceCouncil.apply.fileRequired'));
      return;
    }
    setStep(1);
  }, [form, file, message, t]);

  const handleSubmit = useCallback(async () => {
    let values: PublicApplicationInput;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    if (!file) {
      message.error(t('scienceCouncil.apply.fileRequired'));
      setStep(0);
      return;
    }
    try {
      const res = await submitMut.mutateAsync({ values, file });
      setSubmittedId(res.id);
    } catch (err) {
      message.error(publicApiMessage(err, t('scienceCouncil.public.submitError')));
    }
  }, [form, file, submitMut, message, t]);

  const startNew = useCallback(() => {
    form.resetFields();
    setFile(null);
    setStep(0);
    setSubmittedId(null);
    if (refs?.years.length) form.setFieldsValue({ year: refs.years[0] });
  }, [form, refs]);

  if (submittedId) {
    return (
      <S.Page>
        <S.Card>
          <Result
            status="success"
            title={t('scienceCouncil.public.successTitle')}
            subTitle={
              <span>
                {t('scienceCouncil.public.successText')}
                <br />
                <span style={{ fontSize: 12, color: 'var(--color-text-tertiary, #667085)' }}>
                  {t('scienceCouncil.public.refLabel')}: <code>{submittedId}</code>
                </span>
              </span>
            }
            extra={
              <Button onClick={startNew}>{t('scienceCouncil.public.newApplication')}</Button>
            }
          />
        </S.Card>
      </S.Page>
    );
  }

  if (isLoading) {
    return (
      <S.Page>
        <S.Card style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Spin size="large" />
        </S.Card>
      </S.Page>
    );
  }

  if (isError || !refs) {
    return (
      <S.Page>
        <S.Card>
          <Alert
            type="error"
            showIcon
            message={t('scienceCouncil.public.loadError')}
            action={
              <Button size="small" loading={isFetching} onClick={() => refetch()}>
                {t('scienceCouncil.public.retry')}
              </Button>
            }
          />
        </S.Card>
      </S.Page>
    );
  }

  const stepStyle = (s: number) => ({ display: step === s ? 'block' : 'none' });
  const required = [{ required: true, message: t('scienceCouncil.form.required') }];

  return (
    <S.Page>
      <S.Card>
        <S.Title>{t('scienceCouncil.public.pageTitle')}</S.Title>
        <S.Subtitle>{t('scienceCouncil.public.subtitle')}</S.Subtitle>

        <Steps
          current={step}
          size="small"
          style={{ margin: '0 0 18px' }}
          items={[
            { title: t('scienceCouncil.step.general') },
            { title: t('scienceCouncil.step.supervisor') },
          ]}
        />

        <Form form={form} layout="vertical" requiredMark>
          <S.FieldsScope>
            <div style={stepStyle(0)}>
              {refs.template && (
                <S.TemplateBox>
                  <FilePdfOutlined style={{ fontSize: 24, color: 'var(--brand-error, #F04438)' }} />
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
                    href={refs.template.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('scienceCouncil.settings.templateDownload')}
                  </Button>
                </S.TemplateBox>
              )}

              <Form.Item name="title" label={t('scienceCouncil.work.title')} rules={required}>
                <Input.TextArea rows={2} placeholder={t('scienceCouncil.form.titlePlaceholder')} />
              </Form.Item>

              <S.Row $right="180px">
                <Form.Item
                  name="specialty"
                  label={t('scienceCouncil.form.specialtyTitle')}
                  rules={required}
                >
                  <Select
                    getPopupContainer={popupInCard}
                    placeholder={t('scienceCouncil.form.selectSpecialty')}
                    showSearch
                    optionFilterProp="label"
                    options={specialtyOptions}
                  />
                </Form.Item>
                <Form.Item
                  name="specialty"
                  label={t('scienceCouncil.form.specialtyCode')}
                  rules={required}
                >
                  <Select
                    getPopupContainer={popupInCard}
                    placeholder={t('scienceCouncil.form.selectCode')}
                    showSearch
                    optionFilterProp="label"
                    options={codeOptions}
                  />
                </Form.Item>
              </S.Row>

              <S.Row $right="minmax(0, 1fr)">
                <Form.Item name="year" label={t('scienceCouncil.work.year')} rules={required}>
                  <Select
                    getPopupContainer={popupInCard}
                    options={refs.years.map((y) => ({ value: y, label: y }))}
                  />
                </Form.Item>
                <div />
              </S.Row>

              <div style={{ marginBottom: 6, fontWeight: 500, fontSize: 13 }}>
                {t('scienceCouncil.apply.file')}
                <span style={{ color: 'var(--brand-error, #F04438)' }}> *</span>
              </div>
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
                    <CheckCircleOutlined style={{ fontSize: 18, color: 'var(--brand-primary, #34c18c)' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-primary, #34c18c)' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary, #667085)', marginTop: 2 }}>
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary, #475467)', marginTop: 4 }}>
                      {t('scienceCouncil.apply.chooseAnother')}
                    </div>
                  </div>
                ) : (
                  <div>
                    <UploadOutlined style={{ fontSize: 18, color: 'var(--color-text-quaternary, #98a2b3)' }} />
                    <div style={{ fontSize: 13, color: 'var(--color-text-tertiary, #667085)' }}>
                      {t('scienceCouncil.apply.chooseFile')}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-quaternary, #98a2b3)', marginTop: 2 }}>PDF</div>
                  </div>
                )}
              </S.Dropzone>

              <S.SectionTitle style={{ marginTop: 20 }}>
                {t('scienceCouncil.public.researcherSection')}
              </S.SectionTitle>

              <Form.Item name="fullName" label={t('scienceCouncil.form.fullName')} rules={required}>
                <Input placeholder={t('scienceCouncil.form.fullNamePlaceholder')} />
              </Form.Item>

              <S.Row>
                <Form.Item
                  name="workplace"
                  label={t('scienceCouncil.form.workplace')}
                  rules={required}
                >
                  <Input placeholder={t('scienceCouncil.form.workplacePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name="position"
                  label={t('scienceCouncil.form.position')}
                  rules={required}
                >
                  <Input placeholder={t('scienceCouncil.form.positionPlaceholder')} />
                </Form.Item>
              </S.Row>

              <S.Row>
                <Form.Item
                  name="passportSeries"
                  label={t('scienceCouncil.form.passportSeries')}
                  rules={[
                    ...required,
                    {
                      pattern: /^[A-Za-zА-Яа-я]{2}$/,
                      message: t('scienceCouncil.public.passportSeriesInvalid'),
                    },
                  ]}
                >
                  <Input maxLength={2} placeholder="AA" style={{ textTransform: 'uppercase' }} />
                </Form.Item>
                <Form.Item
                  name="passportNumber"
                  label={t('scienceCouncil.form.passportNumber')}
                  rules={[
                    ...required,
                    {
                      pattern: /^\d{7}$/,
                      message: t('scienceCouncil.public.passportNumberInvalid'),
                    },
                  ]}
                >
                  <Input maxLength={7} placeholder="1234567" />
                </Form.Item>
              </S.Row>

              <Form.Item
                name="pinfl"
                label={t('scienceCouncil.form.pinfl')}
                rules={[
                  ...required,
                  { pattern: /^\d{14}$/, message: t('scienceCouncil.public.pinflInvalid') },
                ]}
              >
                <Input maxLength={14} placeholder={t('scienceCouncil.public.pinflPlaceholder')} />
              </Form.Item>

              <S.Row>
                <Form.Item name="phone" label={t('scienceCouncil.form.phone')} rules={required}>
                  <Input placeholder={t('scienceCouncil.form.phonePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name="email"
                  label={t('scienceCouncil.form.email')}
                  rules={[
                    ...required,
                    { type: 'email', message: t('scienceCouncil.form.emailInvalid') },
                  ]}
                >
                  <Input placeholder={t('scienceCouncil.form.emailPlaceholder')} />
                </Form.Item>
              </S.Row>
            </div>

            <div style={stepStyle(1)}>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={t('scienceCouncil.public.supervisorNote')}
              />

              <Form.Item
                name="supervisorName"
                label={t('scienceCouncil.form.fullName')}
                rules={required}
              >
                <Input placeholder={t('scienceCouncil.form.fullNamePlaceholder')} />
              </Form.Item>

              <S.Row>
                <Form.Item
                  name="supervisorWorkplace"
                  label={t('scienceCouncil.form.workplace')}
                  rules={required}
                >
                  <Input placeholder={t('scienceCouncil.form.workplacePlaceholder')} />
                </Form.Item>
                <Form.Item
                  name="supervisorPosition"
                  label={t('scienceCouncil.form.position')}
                  rules={required}
                >
                  <Input placeholder={t('scienceCouncil.form.positionPlaceholder')} />
                </Form.Item>
              </S.Row>

              <S.Row>
                <Form.Item
                  name="supervisorAcademicTitle"
                  label={t('scienceCouncil.form.scientificTitle')}
                >
                  <Select
                    getPopupContainer={popupInCard}
                    placeholder={t('scienceCouncil.form.selectScientificTitle')}
                    options={refs.academicTitles.map((v) => ({ value: v, label: v }))}
                    notFoundContent={t('scienceCouncil.form.refEmpty')}
                    showSearch
                    allowClear
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item name="supervisorDegree" label={t('scienceCouncil.form.degree')}>
                  <Select
                    getPopupContainer={popupInCard}
                    placeholder={t('scienceCouncil.form.selectDegree')}
                    options={refs.academicLevels.map((v) => ({ value: v, label: v }))}
                    notFoundContent={t('scienceCouncil.form.refEmpty')}
                    showSearch
                    allowClear
                    optionFilterProp="label"
                  />
                </Form.Item>
              </S.Row>

              <S.Row>
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
              </S.Row>
            </div>
          </S.FieldsScope>
        </Form>

        <S.Footer>
          {step > 0 && (
            <Button onClick={() => setStep(0)}>{t('scienceCouncil.form.back')}</Button>
          )}
          {step < LAST_STEP ? (
            <Button type="primary" onClick={handleNext}>
              {t('scienceCouncil.form.next')}
            </Button>
          ) : (
            <Button type="primary" loading={submitMut.isPending} onClick={handleSubmit}>
              {t('scienceCouncil.apply.submit')}
            </Button>
          )}
        </S.Footer>
      </S.Card>
    </S.Page>
  );
}
