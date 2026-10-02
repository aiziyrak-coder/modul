import { Input, type InputProps } from 'antd';
import type { ChangeEvent } from 'react';
import { useField } from 'formik';
import { Form } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import {
  phoneToDisplay,
  phoneToStored,
  jshshirMask,
  moneyToDisplay,
  moneyToRaw,
} from './masks';

type BaseProps = Omit<InputProps, 'value' | 'onChange'> & {
  value?: string | number | null;
  onChange?: (value: string) => void;
};

export function PhoneInput({ value, onChange, placeholder = '+998 90 123-45-67', ...rest }: BaseProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(phoneToStored(e.target.value));
  };
  return (
    <Input
      {...rest}
      inputMode="tel"
      autoComplete="tel"
      value={phoneToDisplay(value == null ? '' : String(value))}
      onChange={handle}
      placeholder={placeholder}
    />
  );
}

export function JshshirInput({ value, onChange, placeholder = '00000000000000', ...rest }: BaseProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(jshshirMask(e.target.value));
  };
  return (
    <Input
      {...rest}
      inputMode="numeric"
      autoComplete="off"
      value={jshshirMask(value == null ? '' : String(value))}
      onChange={handle}
      placeholder={placeholder}
    />
  );
}

export function MoneyInput({ value, onChange, placeholder = '0', suffix = "so'm", ...rest }: BaseProps) {
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(moneyToRaw(e.target.value));
  };
  return (
    <Input
      {...rest}
      inputMode="numeric"
      value={moneyToDisplay(value == null ? '' : String(value))}
      onChange={handle}
      placeholder={placeholder}
      suffix={suffix}
    />
  );
}

export function PhoneField({ name, label }: { name: string; label?: string }) {
  const { t } = useTranslation();
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? t(meta.error) : undefined;
  return (
    <Form.Item
      label={label ? t(label) : undefined}
      validateStatus={error ? 'error' : ''}
      help={error}
    >
      <PhoneInput
        value={field.value ?? ''}
        onChange={(v) => void helpers.setValue(v)}
        onBlur={() => void helpers.setTouched(true)}
      />
    </Form.Item>
  );
}
