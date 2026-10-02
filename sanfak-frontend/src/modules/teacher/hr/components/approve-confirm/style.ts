import styled from 'styled-components';

export const WrapperApprove = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-5) var(--space-5);

  .confirmation {
    display: flex;
    align-items: center;
    gap: var(--space-3);

    .title {
      font-weight: 600;
      font-size: 16px;
      color: var(--color-text, #121926);
    }

    .pulse {
      width: max-content;
      height: max-content;
      display: inline-flex;
      flex-shrink: 0;
    }
  }

`;
