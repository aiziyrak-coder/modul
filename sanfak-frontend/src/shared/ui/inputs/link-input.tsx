import type { CSSProperties } from 'react';
import { Input } from 'antd';
import type { InputProps } from 'antd';

interface Props extends Omit<InputProps, 'onChange'> {
  label?: string;
  onChange?: (value: string) => void;
  maxWidth?: string | number;
  labelStyle?: CSSProperties;
}

export function LinkInput({ label, onChange, maxWidth, labelStyle, style, ...rest }: Props) {
  return (
    <div style={{ maxWidth }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: 6,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text, #121926)',
            ...labelStyle,
          }}
        >
          {label}
        </label>
      )}
      <Input
        addonBefore="https://"
        onChange={(e) => onChange?.(e.target.value)}
        size="large"
        style={style}
        {...rest}
      />
    </div>
  );
}
