import styled from 'styled-components';

export const FormWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;

  > form {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .form-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 20px 16px;
  }

  .form-footer {
    flex-shrink: 0;
    padding: 12px 20px;
    background: var(--color-bg, #fff);
    border-top: 1px solid var(--color-border, #e3e8ef);
    box-shadow: 0 -2px 8.7px 0 rgba(204, 204, 204, 0.25);
  }

  .ant-form-item {
    margin-bottom: 6px;
  }
  .ant-form-item-label {
    padding-bottom: 4px;
  }
`;
