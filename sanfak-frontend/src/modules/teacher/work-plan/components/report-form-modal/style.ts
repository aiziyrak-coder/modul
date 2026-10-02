import styled from 'styled-components';

export const FormWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  > form {
    display: flex;
    flex-direction: column;
  }

  .form-body {
    padding: var(--space-5) var(--space-5) var(--space-4);
  }

  .form-footer {
    flex-shrink: 0;
    padding: var(--space-3) var(--space-5);
    background: var(--color-bg, #fff);
    border-top: 1px solid var(--color-border, #e3e8ef);
  }

  .ant-form-item {
    margin-bottom: 6px;
  }
  .ant-form-item-label {
    padding-bottom: 4px;
  }
`;
