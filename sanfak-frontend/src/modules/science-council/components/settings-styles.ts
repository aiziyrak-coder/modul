import styled from 'styled-components';
import { stickyFooterCard } from './table-pagination/style';

export const ToolBar = styled.div`
  display: flex;
  gap: var(--space-3, 12px);
  margin-bottom: var(--space-5, 20px);
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
`;

export const Card = styled.div`
  background: var(--bg-surface, #fff);
  border-radius: var(--radius-lg, 14px);
  border: 1px solid var(--border-secondary, #e5e7eb);
  ${stickyFooterCard}
`;

export const InfoNote = styled.div`
  display: flex;
  gap: var(--space-3, 12px);
  align-items: flex-start;
  padding: var(--space-4, 16px) var(--space-5, 20px);
  margin-bottom: var(--space-5, 20px);
  background: var(--bg-muted, #f9fafb);
  border: 1px solid var(--border-secondary, #e5e7eb);
  border-left: 3px solid var(--brand-primary, #34c18c);
  border-radius: var(--radius-lg, 12px);
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-secondary, #475467);
`;

export const TemplateBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4, 16px);
  flex-wrap: wrap;
  padding: var(--space-4, 16px) var(--space-5, 20px);
  border-bottom: 1px solid var(--border-secondary, #e5e7eb);

  &:last-child {
    border-bottom: none;
  }
`;

export const FieldLabel = styled.div`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--color-text-tertiary, #667085);
  margin-bottom: 2px;
`;
