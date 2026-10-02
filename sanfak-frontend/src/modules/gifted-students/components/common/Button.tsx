import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styled, { css } from 'styled-components';

const variants = {
  primary: css`
    background: ${({ theme }) => theme.colors.primary};
    color: white;
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primaryDark};
    }
  `,
  danger: css`
    background: ${({ theme }) => theme.colors.danger};
    color: white;
    &:hover:not(:disabled) {
      background: #c0392b;
    }
  `,
  outline: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    border: 1px solid ${({ theme }) => theme.colors.primary};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.bg};
      color: ${({ theme }) => theme.colors.text};
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
    border: 1px solid ${({ theme }) => theme.colors.border};
    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,
} as const;

const sizes = {
  sm: css`
    padding: 5px 12px;
    font-size: 12px;
  `,
  md: css`
    padding: 8px 18px;
    font-size: 13px;
  `,
  lg: css`
    padding: 11px 24px;
    font-size: 14px;
  `,
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export default function Button({ variant = 'primary', size = 'md', children, ...props }: ButtonProps) {
  return (
    <Btn $variant={variant} $size={size} {...props}>
      {children}
    </Btn>
  );
}

const Btn = styled.button<{ $variant: ButtonVariant; $size: ButtonSize }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: ${({ theme }) => theme.radius.md};
  font-weight: 500;
  transition: all 0.15s;
  white-space: nowrap;
  ${({ $variant }) => variants[$variant] || variants.primary}
  ${({ $size }) => sizes[$size] || sizes.md}

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;
