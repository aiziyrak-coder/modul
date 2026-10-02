import styled from 'styled-components';

export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
`;

export const Section = styled.div`
  background: var(--color-bg, #fff);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-5) var(--space-6);
  margin-bottom: var(--space-4);
`;

export const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-4);
`;

export const Tiles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
`;
