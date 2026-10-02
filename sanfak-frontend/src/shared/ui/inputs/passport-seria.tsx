import type { CSSProperties, KeyboardEvent } from 'react';
import { Input } from 'antd';

interface Props {
  value?: string;
  onChange?: (value: string) => void;
  status?: '' | 'error' | 'warning';
  style?: CSSProperties;
  placeholder?: string;
}

export function PassportSeria({ value = '', onChange, status, style, placeholder = 'AA' }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    onChange?.(val);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!/[a-zA-Z]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <Input
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      maxLength={2}
      placeholder={placeholder}
      status={status}
      style={{ textTransform: 'uppercase', width: 80, ...style }}
      size="large"
    />
  );
}
