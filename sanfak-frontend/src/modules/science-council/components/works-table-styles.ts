import styled from 'styled-components';
import { stickyFooterCard } from './table-pagination/style';

export const FiltersWrap = styled.div`
  .ant-select:first-of-type {
    min-width: 190px !important;
  }
`;

export const Card = styled.div`
  background: var(--color-bg, #fff);
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--color-border, #e3e8ef);
  ${stickyFooterCard}
`;

export const IndexCell = styled.span`
  color: var(--color-text-soft, #697586);
  font-size: 13px;
`;

export const TitleCell = styled.div`
  .title-link {
    font-weight: 600;
    color: var(--color-text, #121926);
    cursor: pointer;
    font-size: 13px;

    white-space: normal;
    overflow-wrap: break-word;
    line-height: 1.4;

    &:hover {
      color: var(--brand-primary, #37cb94);
    }
  }

  .author-sub {
    font-size: 12px;
    color: var(--color-text-soft, #697586);
    margin-top: 2px;
  }
`;

export const MutedCell = styled.span`
  font-size: 12px;
  color: var(--color-text-soft, #697586);
`;

export const SmallCell = styled.span`
  font-size: 13px;
  color: var(--color-text, #121926);
`;

export const ActionBtn = styled.button<{
  $variant?: 'view' | 'edit' | 'accept' | 'revision' | 'reject';
}>`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease-in-out;
  padding: 0;
  outline: none;

  .anticon {
    font-size: 13px;
  }

  ${({ $variant = 'view' }) => {
    if ($variant === 'accept')
      return `
        background: #ecfdf3;
        color: #16a34a;
        &:hover { background: #d1fae5; }
      `;
    if ($variant === 'revision')
      return `
        background: #faf5ff;
        color: #9333ea;
        &:hover { background: #f3e8ff; }
      `;
    if ($variant === 'reject')
      return `
        background: #fef2f2;
        color: #dc2626;
        &:hover { background: #fee2e2; }
      `;
    if ($variant === 'edit')
      return `
        background: #eef2f6;
        color: #121926;
        &:hover { color: var(--brand-primary, #37cb94); }
      `;
    return `
      background: #eef2f6;
      color: #9ca3af;
      &:hover { color: var(--brand-primary, #37cb94); }
    `;
  }}
`;
