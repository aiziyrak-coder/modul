import { Form, Input, InputNumber, DatePicker, Select, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { moneyFormatter, moneyParser } from '@/shared/ui';
import type { DataField } from '../../model/types';

const { TextArea } = Input;

interface Props {
  field: DataField;
}

export default function DynamicField({ field }: Props) {
  const { t } = useTranslation();

  const label = t(`educationQuality.field.${field.key}`, { defaultValue: field.label });

  const rules = field.required
    ? [{ required: true, message: t('educationQuality.dynamicField.required', { label }) }]
    : [];

  const renderInput = () => {
    switch (field.type) {
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder={label} />;
      case 'money':
        return (
          <InputNumber<number>
            style={{ width: '100%' }}
            placeholder="0"
            formatter={moneyFormatter}
            parser={moneyParser}
            addonAfter={t('educationQuality.dynamicField.currency')}
          />
        );
      case 'date':
        return (
          <DatePicker
            style={{ width: '100%' }}
            format="DD.MM.YYYY"
            placeholder={t('educationQuality.dynamicField.datePlaceholder')}
          />
        );
      case 'select':
        return (
          <Select
            placeholder={t('educationQuality.dynamicField.selectPlaceholder')}
            options={(field.options ?? []).map((o) => ({
              label: t(`educationQuality.fieldOption.${o.toLowerCase()}`, { defaultValue: o }),
              value: o,
            }))}
          />
        );
      case 'url':
        return <Input placeholder="https://..." />;
      case 'textarea':
        return <TextArea rows={3} placeholder={label} />;
      case 'file':
        return (
          <Upload beforeUpload={() => false} maxCount={1} accept=".pdf">
            <Button icon={<UploadOutlined />}>
              {t('educationQuality.dynamicField.uploadPdf')}
            </Button>
          </Upload>
        );
      default:
        return <Input placeholder={label} />;
    }
  };

  return (
    <Form.Item
      name={field.key}
      label={label}
      rules={rules}
      valuePropName={field.type === 'file' ? 'fileList' : undefined}
      getValueFromEvent={field.type === 'file' ? (e) => (Array.isArray(e) ? e : e?.fileList) : undefined}
    >
      {renderInput()}
    </Form.Item>
  );
}