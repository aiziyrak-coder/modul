import { useField } from 'formik';
import { Button, Form, Input, InputNumber, Select, Switch } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';

interface BaseProps {
  name: string;
  label?: string;
  placeholder?: string;
}

function useTranslatedError(name: string): string | undefined {
  const [, meta] = useField(name);
  const { t } = useTranslation();
  return meta.touched && meta.error ? t(meta.error) : undefined;
}

export function TextField({
  name,
  label,
  placeholder,
  password,
  disabled,
}: BaseProps & { password?: boolean; disabled?: boolean }) {
  const { t } = useTranslation();
  const [field, , helpers] = useField(name);
  const error = useTranslatedError(name);
  const Component = password ? Input.Password : Input;
  return (
    <Form.Item label={label ? t(label) : undefined} validateStatus={error ? 'error' : ''} help={error}>
      <Component
        disabled={disabled}
        value={field.value ?? ''}
        placeholder={placeholder ? t(placeholder) : undefined}
        onChange={(e) => helpers.setValue(e.target.value)}
        onBlur={() => helpers.setTouched(true)}
      />
    </Form.Item>
  );
}

export function TextAreaField({ name, label, placeholder, rows = 3 }: BaseProps & { rows?: number }) {
  const { t } = useTranslation();
  const [field, , helpers] = useField(name);
  const error = useTranslatedError(name);
  return (
    <Form.Item label={label ? t(label) : undefined} validateStatus={error ? 'error' : ''} help={error}>
      <Input.TextArea
        rows={rows}
        value={field.value ?? ''}
        placeholder={placeholder ? t(placeholder) : undefined}
        onChange={(e) => helpers.setValue(e.target.value)}
        onBlur={() => helpers.setTouched(true)}
      />
    </Form.Item>
  );
}

export function NumberField({ name, label, min, max }: BaseProps & { min?: number; max?: number }) {
  const { t } = useTranslation();
  const [field, , helpers] = useField(name);
  const error = useTranslatedError(name);
  return (
    <Form.Item label={label ? t(label) : undefined} validateStatus={error ? 'error' : ''} help={error}>
      <InputNumber
        style={{ width: '100%' }}
        min={min}
        max={max}
        value={field.value}
        onChange={(value) => helpers.setValue(value)}
        onBlur={() => helpers.setTouched(true)}
      />
    </Form.Item>
  );
}

export function SwitchField({ name, label }: BaseProps) {
  const { t } = useTranslation();
  const [field, , helpers] = useField(name);
  return (
    <Form.Item label={label ? t(label) : undefined}>
      <Switch checked={Boolean(field.value)} onChange={(checked) => helpers.setValue(checked)} />
    </Form.Item>
  );
}

interface SelectFieldProps extends BaseProps {
  options: { label: string; value: string | number }[];
  mode?: 'multiple';
}

export function SelectField({ name, label, placeholder, options, mode }: SelectFieldProps) {
  const { t } = useTranslation();
  const [field, , helpers] = useField(name);
  const error = useTranslatedError(name);
  return (
    <Form.Item label={label ? t(label) : undefined} validateStatus={error ? 'error' : ''} help={error}>
      <Select
        mode={mode}
        style={{ width: '100%' }}
        value={field.value}
        options={options}
        placeholder={placeholder ? t(placeholder) : undefined}
        onChange={(value) => helpers.setValue(value)}
        onBlur={() => helpers.setTouched(true)}
        allowClear
      />
    </Form.Item>
  );
}

export function SubmitButton({ label = 'save', loading }: { label?: string; loading?: boolean }) {
  const { t } = useTranslation();
  return (
    <Button type="primary" htmlType="submit" loading={loading} block>
      {t(label)}
    </Button>
  );
}
