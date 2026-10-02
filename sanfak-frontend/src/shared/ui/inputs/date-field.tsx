import { useField } from 'formik';
import { DatePicker, Form } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';

export function DateField({ name, label }: { name: string; label?: string }) {
  const { t } = useTranslation();
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? t(meta.error) : undefined;
  return (
    <Form.Item label={label ? t(label) : undefined} validateStatus={error ? 'error' : ''} help={error}>
      <DatePicker
        style={{ width: '100%' }}
        value={field.value ? dayjs(field.value as string) : null}
        onChange={(date) => helpers.setValue(date ? date.toISOString() : undefined)}
      />
    </Form.Item>
  );
}
