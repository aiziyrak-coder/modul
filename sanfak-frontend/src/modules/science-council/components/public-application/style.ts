import styled from 'styled-components';

export const Page = styled.div`
  min-height: 100%;
  padding: 24px 16px 40px;
  background: var(--bg-muted, #f5f7fa);

  @media (max-width: 600px) {
    padding: 12px 8px 24px;
  }
`;

export const Card = styled.div`
  max-width: 780px;
  margin: 0 auto;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #e5e7eb);
  border-radius: var(--radius-xl, 16px);
  box-shadow: 0 4px 16px rgb(16 24 40 / 6%);
  padding: 24px 28px 20px;

  @media (max-width: 600px) {
    padding: 16px 14px 14px;
  }
`;

export const Title = styled.h1`
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary, #101828);
`;

export const Subtitle = styled.p`
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-tertiary, #667085);
`;

export const SectionTitle = styled.div`
  margin: 4px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-secondary, #eef0f3);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--color-text-tertiary, #667085);
`;

export const Row = styled.div<{ $right?: string }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) ${({ $right }) => $right ?? 'minmax(0, 1fr)'};
  gap: 14px;

  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
`;

export const TemplateBox = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 16px;
  background: var(--bg-muted, #f9fafb);
  border: 1px solid var(--border-secondary, #e5e7eb);
  border-left: 3px solid var(--brand-primary, #34c18c);
  border-radius: var(--radius-lg, 12px);
`;

export const Dropzone = styled.div<{ $active: boolean }>`
  border: 2px dashed var(--border-secondary, #d1d5db);
  border-radius: var(--radius-lg, 10px);
  padding: 14px 16px;
  text-align: center;
  cursor: pointer;
  background: ${({ $active }) => ($active ? '#f0fdf4' : '#fafafa')};
  transition: all 0.2s;

  &:hover {
    border-color: var(--brand-primary, #34c18c);
  }
`;

export const FieldsScope = styled.div`
  position: relative;

  .ant-form-item {
    margin-bottom: 14px;
  }

  .ant-form-item-label {
    padding-bottom: 2px;
  }

  .ant-select-dropdown {
    max-width: 100%;
  }

  .ant-select-item-option-content,
  .ant-select-selection-item,
  .ant-select-selection-placeholder {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--border-secondary, #eef0f3);
`;
