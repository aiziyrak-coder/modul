import styled from 'styled-components';

export const Head = styled.div`
  background: var(--color-fill-quaternary, #f6ffed);
  border: 1px solid var(--color-border-secondary, #b7eb8f);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-4, 16px) var(--space-5, 20px);
  margin-bottom: var(--space-5, 20px);

  strong {
    font-size: 16px;
    display: block;
  }

  span {
    color: var(--color-text-tertiary, #667085);
    font-size: 13px;
  }
`;

export const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: var(--space-4, 16px);
  padding: var(--space-3, 12px) 0;
  border-bottom: 1px solid var(--color-border, #f0f0f0);

  &:last-child {
    border-bottom: none;
  }
`;

export const Label = styled.div`
  color: var(--color-text-tertiary, #667085);
  font-size: 13px;
  flex-shrink: 0;
  max-width: 55%;
`;

export const Val = styled.div`
  font-weight: 600;
  font-size: 14px;
  text-align: right;
  word-break: break-word;
`;

export const DrawerFooter = styled.div`
  display: flex;
  gap: var(--space-3, 12px);

  button {
    flex: 1;
    height: 44px;
    font-weight: 600;
  }
`;

export const PointsBox = styled.div`
  background: var(--color-fill-quaternary, #f6ffed);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-4, 16px);
  text-align: center;
  margin-top: var(--space-4, 16px);

  .pts {
    font-size: 28px;
    font-weight: 800;
    color: var(--brand-primary, #37cb94);
  }

  .lbl {
    color: var(--color-text-tertiary, #667085);
    font-size: 13px;
  }
`;
