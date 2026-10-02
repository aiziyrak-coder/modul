import styled from 'styled-components';

export const Wrap = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

export const IconBtn = styled.button<{ $danger?: boolean }>`
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

  .anticon {
    font-size: 13px;
  }

  background: ${({ $danger }) =>
    $danger ? 'var(--ant-color-error-bg)' : 'var(--color-bg-table-head)'};
  color: ${({ $danger }) => ($danger ? 'var(--brand-error)' : 'var(--color-text)')};

  &:hover {
    color: ${({ $danger }) => ($danger ? 'var(--brand-error)' : 'var(--brand-primary)')};
  }
`;
