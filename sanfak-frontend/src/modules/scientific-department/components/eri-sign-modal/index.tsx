import { useEffect, useState } from 'react';
import { App, Form, Input, Select } from 'antd';
import Modal from '../scroll-modal';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { useAcademicYears } from '../../api/reference-api';
import DecisionWarning from '../decision-warning';

const MOCK_ERI_KEYS = ['A1B2-C3D4-E5F6-G7H8', 'Z9Y8-X7W6-V5U4-T3S2'];

export interface EriSignValues {
  eriKey: string;
  registrationNumber?: string;
  academicYear?: string;
}

export default function EriSignModal({
  open,
  mode,
  summary,
  loading,
  defaultAcademicYear,
  onCancel,
  onOk,
}: {
  open: boolean;
  mode: 'sign' | 'rektor';
  summary: string;
  loading: boolean;
  defaultAcademicYear?: string | null;
  onCancel: () => void;
  onOk: (values: EriSignValues) => void;
}) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { data: academicYears = [] } = useAcademicYears();
  const activeYear =
    academicYears.find((y) => y.active)?.value ?? academicYears[0]?.value ?? '';
  const [eriKey, setEriKey] = useState<string>();
  const [regNumber, setRegNumber] = useState('');
  const [academicYear, setAcademicYear] = useState<string>(
    () => defaultAcademicYear || '',
  );

  useEffect(() => {
    if (open) setAcademicYear(defaultAcademicYear || activeYear);
  }, [open, defaultAcademicYear, activeYear]);

  const handleOk = () => {
    if (!eriKey) {
      message.error(t('scientificDepartment.eri.selectKey'));
      return;
    }
    onOk({
      eriKey,
      registrationNumber: mode === 'rektor' ? regNumber.trim() || undefined : undefined,
      academicYear: mode === 'rektor' ? academicYear : undefined,
    });
  };

  return (
    <Modal centered
      title={
        <span>
          <SafetyCertificateOutlined
            style={{ color: 'var(--brand-primary)', marginRight: 8 }}
          />
          {t('scientificDepartment.eri.signTitle')}
        </span>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={t('scientificDepartment.eri.signButton')}
      cancelText={t('scientificDepartment.cancel')}
      confirmLoading={loading}
      afterClose={() => {
        setEriKey(undefined);
        setRegNumber('');
        setAcademicYear(defaultAcademicYear || activeYear);
      }}
    >
      <div
        style={{
          background: 'var(--color-bg-elevate)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 12,
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {summary}
      </div>

      <Form layout="vertical">
        <Form.Item label={t('scientificDepartment.eri.key')} required>
          <Select
            value={eriKey}
            onChange={setEriKey}
            placeholder={t('scientificDepartment.eri.selectKey')}
            options={MOCK_ERI_KEYS.map((k, i) => ({
              value: k,
              label: `${t('scientificDepartment.eri.keyOption')} ${i + 1} (${k})`,
            }))}
          />
        </Form.Item>

        {mode === 'rektor' ? (
          <>
            <Form.Item label={t('scientificDepartment.articles.colAcademicYear')} required>
              <Select
                placeholder={t('scientificDepartment.eri.academicYearPlaceholder')}
                value={academicYear}
                onChange={setAcademicYear}
                options={academicYears.map((y) => ({ value: y.value, label: y.label }))}
              />
            </Form.Item>
            <Form.Item
              label={t('scientificDepartment.eri.number')}
              extra={t('scientificDepartment.eri.numberHint')}
            >
              <Input
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                placeholder="u-t-26-1"
              />
            </Form.Item>
            <div
              style={{
                background: 'color-mix(in srgb, var(--brand-warning) 12%, #fff)',
                border: '1px solid color-mix(in srgb, var(--brand-warning) 35%, #fff)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                fontSize: 12,
                color: '#92400e',
                marginBottom: 4,
              }}
            >
              {t('scientificDepartment.eri.numberInfo')}
            </div>
          </>
        ) : null}
      </Form>

      <DecisionWarning />
    </Modal>
  );
}
