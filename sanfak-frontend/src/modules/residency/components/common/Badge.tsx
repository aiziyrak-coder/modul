import type { ReactNode } from 'react';
import styled, { css, type RuleSet } from 'styled-components';

const variants: Record<string, RuleSet<object>> = {
  faol: css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  tasdiqlangan: css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  bajarildi: css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  yakunlangan: css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  "chop etilgan": css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  "ko'rib chiqilgan": css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  grant: css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  byudjet: css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,
  success: css`background:#EAFAF1; color:#27AE60; border-color:#A9DFBF;`,

  kutilmoqda: css`background:#FEF9E7; color:#F39C12; border-color:#FAD7A0;`,
  rejalashtirilgan: css`background:#FEF9E7; color:#F39C12; border-color:#FAD7A0;`,
  "ko'rib chiqilmoqda": css`background:#FEF9E7; color:#F39C12; border-color:#FAD7A0;`,
  kontrakt: css`background:#FEF9E7; color:#F39C12; border-color:#FAD7A0;`,
  shartnoma: css`background:#FEF9E7; color:#F39C12; border-color:#FAD7A0;`,
  warning: css`background:#FEF9E7; color:#F39C12; border-color:#FAD7A0;`,

  "rad etilgan": css`background:#FDEDEC; color:#E74C3C; border-color:#F1948A;`,
  qaytarilgan: css`background:#FDEDEC; color:#E74C3C; border-color:#F1948A;`,
  muhim: css`background:#FDEDEC; color:#E74C3C; border-color:#F1948A;`,
  danger: css`background:#FDEDEC; color:#E74C3C; border-color:#F1948A;`,

  yuborilgan: css`background:#EBF5FB; color:#3498DB; border-color:#AED6F1;`,
  tadbir: css`background:#EBF5FB; color:#3498DB; border-color:#AED6F1;`,
  info: css`background:#EBF5FB; color:#3498DB; border-color:#AED6F1;`,
  yangi: css`background:#EBF5FB; color:#3498DB; border-color:#AED6F1;`,

  "ta'tilda": css`background:#F5EEF8; color:#9B59B6; border-color:#D7BDE2;`,

  umumiy: css`background:#F4F6F9; color:#7F8C8D; border-color:#E8ECEF;`,
  nofaol: css`background:#F4F6F9; color:#7F8C8D; border-color:#E8ECEF;`,
};

const Wrap = styled.span<{ $variant: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: 12px;
  font-weight: 500;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.bg};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  ${({ $variant }) => variants[$variant] ?? ''}
`;

export default function Badge({ children, variant }: { children: ReactNode; variant?: string }) {
  const raw = (variant ?? (typeof children === 'string' ? children : '') ?? '').toString();
  const key = raw.toLowerCase().replace(/[‘’]/g, "'");
  return <Wrap $variant={key}>{children}</Wrap>;
}
