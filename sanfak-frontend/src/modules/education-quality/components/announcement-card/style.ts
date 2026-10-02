import styled from 'styled-components';

export const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
`;

export const Card = styled.div`
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-5, 20px) var(--space-5, 22px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  gap: var(--space-4, 16px);
`;

export const IconBox = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--color-fill-quaternary, #f6ffed);
  color: var(--brand-primary, #37cb94);
  display: grid;
  place-items: center;
  font-size: 20px;
  flex-shrink: 0;
`;

export const Title = styled.div`
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 4px;
`;

export const Meta = styled.div`
  color: var(--color-text-tertiary, #667085);
  font-size: 13px;
  margin-bottom: var(--space-2, 8px);
`;

export const Body = styled.div`
  color: var(--color-text-secondary, #475467);
  font-size: 14px;
  line-height: 1.6;
`;
