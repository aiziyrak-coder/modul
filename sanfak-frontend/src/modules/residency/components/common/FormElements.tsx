import styled, { css } from 'styled-components';

export const FormGroup = styled.div`
  margin-bottom: 16px;
`;

export const Label = styled.label`
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 6px;
`;

export const HelperText = styled.div<{ $error?: boolean }>`
  font-size: 11px;
  margin-top: 4px;
  color: ${({ $error, theme }) => ($error ? '#EF4444' : theme.colors.textMuted)};
`;

export type BtnVariant = 'primary' | 'success' | 'danger' | 'outline' | 'ghost';
export type BtnSize = 'sm' | 'md' | 'lg';

export const Btn = styled.button<{ $variant?: BtnVariant; $size?: BtnSize }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: 10px;
  font-weight: 500;
  white-space: nowrap;
  transition: all 0.15s;
  border: 1px solid transparent;

  padding: ${({ $size }) => ($size === 'sm' ? '5px 12px' : $size === 'lg' ? '11px 24px' : '8px 18px')};
  font-size: ${({ $size }) => ($size === 'sm' ? '12px' : $size === 'lg' ? '14px' : '13px')};

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'primary':
        return css`
          background: ${theme.colors.primary};
          color: #fff;
          border-color: ${theme.colors.primary};
          &:hover {
            background: ${theme.colors.primaryDark};
            border-color: ${theme.colors.primaryDark};
          }
        `;
      case 'success':
        return css`
          background: ${theme.colors.success};
          color: #fff;
          border-color: ${theme.colors.success};
          &:hover {
            background: #1e8449;
            border-color: #1e8449;
          }
        `;
      case 'danger':
        return css`
          background: ${theme.colors.danger};
          color: #fff;
          border-color: ${theme.colors.danger};
          &:hover {
            background: #c0392b;
            border-color: #c0392b;
          }
        `;
      case 'outline':
        return css`
          background: transparent;
          color: ${theme.colors.primary};
          border-color: ${theme.colors.primary};
          &:hover {
            background: ${theme.colors.primaryLight};
          }
        `;
      case 'ghost':
        return css`
          background: transparent;
          color: ${theme.colors.textMuted};
          border-color: transparent;
          &:hover {
            background: ${theme.colors.bg};
            color: ${theme.colors.text};
          }
        `;
      default:
        return css`
          background: ${theme.colors.bg};
          color: ${theme.colors.text};
          border-color: ${theme.colors.border};
          &:hover {
            border-color: ${theme.colors.primary};
            color: ${theme.colors.primary};
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

export const FilterBar = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 16px;
`;

export const Tabs = styled.div`
  display: flex;
  border-bottom: 2px solid ${({ theme }) => theme.colors.border};
  margin-bottom: 20px;
  gap: 2px;
`;

export const Tab = styled.button<{ $active?: boolean }>`
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  border-bottom: 2px solid ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
  margin-bottom: -2px;
  transition: color 0.15s, border-color 0.15s;
  background: none;
  border-top: none;
  border-left: none;
  border-right: none;
  white-space: nowrap;
  &:hover {
    color: ${({ theme }) => theme.colors.primary};
  }
`;

export const PageTitle = styled.h1`
  font-size: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 20px;
`;

export const SectionTitle = styled.h2`
  font-size: 15px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

export const StatCards = styled.div`
  display: flex;
  gap: 14px;
  margin-bottom: 24px;
  flex-wrap: wrap;
`;

export const Pagination = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-top: 14px;
`;

export const PageBtn = styled.button<{ $active?: boolean }>`
  min-width: 32px;
  flex-shrink: 0;
  height: 32px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primary : '#F4F6F9')};
  color: ${({ theme, $active }) => ($active ? '#fff' : theme.colors.textMuted)};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  &:hover:not(:disabled) {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme, $active }) => ($active ? '#fff' : theme.colors.primary)};
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
