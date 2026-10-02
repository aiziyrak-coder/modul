import styled from 'styled-components';

export const PickerCard = styled.div`
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-2, 8px);
  max-height: 640px;
  overflow-y: auto;
`;

export const IndItem = styled.button<{ $active: boolean }>`
  width: 100%;
  text-align: left;
  border: 1px solid ${({ $active }) => ($active ? 'var(--brand-primary, #37cb94)' : 'transparent')};
  background: ${({ $active }) => ($active ? 'var(--color-fill-quaternary, #f6ffed)' : 'transparent')};
  border-radius: 10px;
  padding: var(--space-3, 12px) 14px;
  cursor: pointer;
  margin-bottom: 4px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  transition: background 0.15s;

  &:hover {
    background: var(--color-fill-quaternary, #fafafa);
  }
`;

export const Num = styled.span<{ $active: boolean }>`
  width: 26px;
  height: 26px;
  border-radius: var(--radius-md, 8px);
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
  background: ${({ $active }) =>
    $active ? 'var(--brand-primary, #37cb94)' : 'var(--color-fill-quaternary, #f6ffed)'};
  color: ${({ $active }) =>
    $active ? '#fff' : 'var(--brand-primary, #37cb94)'};
`;

export const FormCard = styled.div`
  background: var(--color-bg-container, #fff);
  border: 1px solid var(--color-border, #f0f0f0);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-6, 24px);
`;

export const FormHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4, 16px);
  margin-bottom: var(--space-5, 20px);
  padding-bottom: var(--space-4, 16px);
  border-bottom: 1px solid var(--color-border, #f0f0f0);

  h3 {
    margin: 0 0 4px;
    font-size: 18px;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary, #475467);
    font-size: 14px;
  }
`;

export const Layout = styled.div`
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: var(--space-5, 20px);
  align-items: start;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;
