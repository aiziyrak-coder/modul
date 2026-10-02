import type { CSSProperties } from 'react';
import { Input } from 'antd';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  status?: '' | 'error' | 'warning';
  style?: CSSProperties;
  placeholder?: string;
}

export function PassportNumber({ value = '', onChange, status, style, placeholder = '1234567' }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 7);
    onChange?.(val);
  };

  return (
    <Input
      value={value}
      onChange={handleChange}
      maxLength={7}
      placeholder={placeholder}
      status={status}
      style={style}
      size="large"
      inputMode="numeric"
    />
  );
}
