import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';

const variants = {
  approved: css`
    background: ${({ theme }) => theme.colors.successLight};
    color: ${({ theme }) => theme.colors.success};
    border: 1px solid ${({ theme }) => theme.colors.successBorder};
  `,
  pending: css`
    background: ${({ theme }) => theme.colors.warningLight};
    color: ${({ theme }) => theme.colors.warning};
    border: 1px solid ${({ theme }) => theme.colors.warningBorder};
  `,
  rejected: css`
    background: white;
    color: ${({ theme }) => theme.colors.danger};
    border: 1px solid ${({ theme }) => theme.colors.danger};
  `,
  info: css`
    background: ${({ theme }) => theme.colors.infoLight};
    color: ${({ theme }) => theme.colors.info};
    border: 1px solid ${({ theme }) => theme.colors.infoBorder};
  `,
  recommended: css`
    background: ${({ theme }) => theme.colors.successLight};
    color: ${({ theme }) => theme.colors.success};
    border: 1px solid ${({ theme }) => theme.colors.successBorder};
  `,
  default: css`
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.textMuted};
    border: 1px solid ${({ theme }) => theme.colors.border};
  `,
} as const;

export type BadgeVariant = keyof typeof variants;

export const statusLabel: Record<string, string> = {
  approved: '✓ Tasdiqlangan',
  pending: '⏳ Kutmoqda',
  rejected: '✗ Rad etilgan',
  recommended: '★ Tavsiya etildi',
};

export default function Badge({
  variant = 'default',
  children,
}: {
  variant?: BadgeVariant;
  children?: ReactNode;
}) {
  return <Chip $variant={variant}>{children}</Chip>;
}

const Chip = styled.span<{ $variant: BadgeVariant }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  ${({ $variant }) => variants[$variant] || variants.default}
`;
