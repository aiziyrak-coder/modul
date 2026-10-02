import styled from 'styled-components';

export const Box = styled.div`
  width: 130px;
  height: 130px;
  border-radius: var(--radius-lg);
  border: 1px dashed var(--color-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  cursor: pointer;
  color: var(--color-text-soft);
  font-size: 12px;
  text-align: center;
  overflow: hidden;
  margin-bottom: var(--space-5);
  background: var(--color-bg-elevate);
  padding: var(--space-3);

  .anticon {
    font-size: 28px;
  }

  &:hover {
    border-color: var(--brand-primary);
    color: var(--brand-primary);
  }
`;

export const Preview = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
