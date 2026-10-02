import { useState, useMemo, useCallback } from 'react';
import { Alert, Form, Button, InputNumber, Select, Empty, Tag, App as AntApp } from 'antd';
import { SendOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { Indicator, Semester, SubmissionInput } from '../model/types';
import {
  useActiveIndicators,
  useAcademicYears,
  useCreateSubmission,
  useTeacherAccess,
} from '../api/education-quality-api';
import { getCurrentTeacherId } from '../lib/current-teacher';
import { isTeacherActive } from '../lib/teacher-access';
import DynamicField from '../components/dynamic-field';
import * as S from '../components/indicator-picker/style';

export default function SubmitPage() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [form] = Form.useForm();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: activeIndicators } = useActiveIndicators();
  const { data: academicYears } = useAcademicYears();
  const createMut = useCreateSubmission();

  const teacherId = useMemo(() => getCurrentTeacherId(), []);
  const { data: access } = useTeacherAccess(teacherId);
  const canSubmit = access ? isTeacherActive(access) : true;
  const restrictedMsg = t('educationQuality.submit.restricted', {
    date: access?.activeFrom ?? t('educationQuality.submit.dateUnset'),
  });

  const indicators = activeIndicators ?? [];
  const selected = indicators.find((i) => i._id === selectedId) ?? null;

  const pick = useCallback(
    (ind: Indicator) => {
      setSelectedId(ind._id);
      form.resetFields();
      form.setFieldValue('authorsCount', 1);
    },
    [form],
  );

  const handleSubmit = useCallback(async () => {
    if (!selected) return;
    const values = await form.validateFields();
    const { authorsCount, academicYear, semester, ...rest } = values as Record<string, unknown> & {
      authorsCount: number;
      academicYear: string;
      semester: Semester;
    };

    const data: Record<string, unknown> = {};
    for (const f of selected.dataFields) {
      const v = rest[f.key];
      if (f.type === 'date' && v) {
        data[f.key] = (v as { format: (s: string) => string }).format('YYYY-MM-DD');
      } else if (f.type === 'file' && v) {
        const picked = (v as { originFileObj?: File }[])[0]?.originFileObj;
        if (picked) data[f.key] = picked;
      } else {
        data[f.key] = v;
      }
    }

    const authorShare = Math.round(100 / (authorsCount || 1));
    const input: SubmissionInput = {
      indicator: selected._id,
      academicYear,
      semester,
      data,
      authorShare,
    };

    createMut.mutate(input, {
      onSuccess: () => {
        message.success(t('educationQuality.submit.success'));
        form.resetFields();
        setSelectedId(null);
      },
    });
  }, [selected, form, createMut, message, t]);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>{t('educationQuality.submit.title')}</h2>
        <div style={{ color: 'var(--color-text-tertiary, #667085)', marginTop: 4 }}>
          {t('educationQuality.submit.subtitle')}
        </div>
      </div>

      {!canSubmit && (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 16 }}
          message={restrictedMsg}
        />
      )}

      <S.Layout>
        <S.PickerCard>
          {indicators.map((ind, idx) => (
            <S.IndItem key={ind._id} $active={ind._id === selectedId} onClick={() => pick(ind)}>
              <S.Num $active={ind._id === selectedId}>{idx + 1}</S.Num>
              <span>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>{ind.title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #475467)', marginTop: 2 }}>
                  {t('educationQuality.submit.points', { count: ind.coefficient })}
                </div>
              </span>
            </S.IndItem>
          ))}
        </S.PickerCard>

        {!canSubmit ? (
          <S.FormCard>
            <Empty
              image={<LockOutlined style={{ fontSize: 48, color: 'var(--brand-warning, #F0C000)' }} />}
              description={restrictedMsg}
              style={{ padding: '60px 0' }}
            />
          </S.FormCard>
        ) : selected ? (
          <S.FormCard>
            <S.FormHead>
              <div>
                <h3>{selected.title}</h3>
                <p>{selected.desc}</p>
              </div>
              <Tag color="success" style={{ fontWeight: 700, fontSize: 14, padding: '4px 12px' }}>
                {t('educationQuality.submit.points', { count: selected.coefficient })}
              </Tag>
            </S.FormHead>

            <Form form={form} layout="vertical" initialValues={{ authorsCount: 1 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0 16px',
              }}>
                <Form.Item
                  name="academicYear"
                  label={t('educationQuality.common.academicYear')}
                  rules={[{ required: true, message: t('educationQuality.submit.yearPlaceholder') }]}
                >
                  <Select
                    placeholder={t('educationQuality.submit.yearPlaceholder')}
                    options={(academicYears ?? []).map((a) => ({ label: a.title, value: a._id }))}
                  />
                </Form.Item>
                <Form.Item
                  name="semester"
                  label={t('educationQuality.common.semester')}
                  rules={[{ required: true, message: t('educationQuality.semester.placeholder') }]}
                >
                  <Select
                    placeholder={t('educationQuality.semester.placeholder')}
                    options={[
                      { label: t('educationQuality.semester.s1'), value: 1 },
                      { label: t('educationQuality.semester.s2'), value: 2 },
                    ]}
                  />
                </Form.Item>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0 16px',
              }}>
                {selected.dataFields.map((f) => (
                  <div
                    key={f.key}
                    style={{
                      gridColumn: f.type === 'textarea' || f.type === 'file' ? '1 / -1' : 'auto',
                    }}
                  >
                    <DynamicField field={f} />
                  </div>
                ))}
              </div>

              <Form.Item
                name="authorsCount"
                label={t('educationQuality.submit.authorsCount')}
                tooltip={t('educationQuality.submit.authorsTooltip')}
                style={{ maxWidth: 240 }}
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSubmit}
                  loading={createMut.isPending}
                >
                  {t('educationQuality.submit.send')}
                </Button>
                <Button onClick={() => { form.resetFields(); setSelectedId(null); }}>
                  {t('educationQuality.common.cancel')}
                </Button>
              </div>
            </Form>
          </S.FormCard>
        ) : (
          <S.FormCard>
            <Empty
              image={<LockOutlined style={{ fontSize: 48, color: 'var(--color-text-quaternary, #D0D5DD)' }} />}
              description={t('educationQuality.submit.pickHint')}
              style={{ padding: '60px 0' }}
            />
          </S.FormCard>
        )}
      </S.Layout>
    </div>
  );
}
