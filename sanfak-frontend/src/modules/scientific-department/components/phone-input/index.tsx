import type { ChangeEvent } from 'react';
import { Input } from 'antd';
import type { InputProps } from 'antd';
import { toNational, toDisplay, toStored } from './mask';

interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
}

export function PhoneInput({ value, onChange, placeholder, ...rest }: PhoneInputProps) {
  const national = toNational(value ?? '');
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange?.(toStored(toNational(e.target.value)));
  };
  return (
    <Input
      {...rest}
      inputMode="numeric"
      value={toDisplay(national)}
      onChange={handleChange}
      placeholder={placeholder ?? '+998 90 123 45 67'}
    />
  );
}
