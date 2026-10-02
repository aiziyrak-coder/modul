import styled from 'styled-components';

export const FeedRoot = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

export const SpinArea = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  margin-bottom: var(--space-6, 24px);

  > .ant-spin-nested-loading,
  > .ant-spin-nested-loading > .ant-spin-container {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  > .ant-spin-nested-loading > div > .ant-spin {
    max-height: none;
  }
`;

export const FeedScrollArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
`;

export const PagerBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-5, 20px);
  flex-shrink: 0;
  box-sizing: border-box;
  padding: var(--space-4, 16px) var(--space-5, 20px);
  background-color: var(--color-bg, #fff);
  border-top: 1px solid var(--color-border, #e3e8ef);
  margin: 0 calc(-1 * var(--content-body-padding, 24px))
    calc(-1 * var(--content-body-padding, 24px));
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  z-index: 5;

  .ant-pagination-item {
    width: 32px;
    height: 32px;
    line-height: 32px;
    border-radius: var(--radius-md, 8px);

    a {
      color: var(--color-text, #121926);
      font-size: 14px;
    }

    &:hover {
      border: 1px solid var(--brand-primary, #37cb94);
      background: var(--color-bg, #fff) !important;

      a {
        color: var(--brand-primary, #37cb94);
      }
    }
  }

  .ant-pagination-item-active {
    background-color: var(--color-bg, #fff);
    border: 1px solid var(--brand-primary, #37cb94);

    a {
      color: var(--brand-primary, #37cb94);
    }
  }

  .ant-pagination-prev,
  .ant-pagination-next {
    line-height: 32px;
    background-color: var(--color-bg, #fff);
    width: 32px;
    height: 32px;
  }

  .ant-pagination-item-link {
    box-sizing: border-box;
    background-color: var(--color-bg, #fff);
    border-radius: var(--radius-md, 8px);
    outline: none;
    line-height: 32px;
    border: none;
  }

  .ant-pagination-prev:hover .ant-pagination-item-link,
  .ant-pagination-next:hover .ant-pagination-item-link {
    border: 1px solid var(--brand-primary, #37cb94);
    border-radius: var(--radius-md, 8px);
    background-color: var(--color-bg, #fff);
  }

  .ant-pagination-prev:hover svg,
  .ant-pagination-next:hover svg {
    fill: var(--brand-primary, #37cb94);
  }

  .ant-select.ant-select-outlined {
    border: none;
  }
`;

export const SizeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  height: 32px;

  h5 {
    font-weight: 400;
    font-size: 14px;
    line-height: 100%;
    color: var(--color-text, #121926);
    padding-right: var(--space-1, 4px);
    margin: 0;
  }
`;

export const SizeButton = styled.span<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md, 8px);
  transition: all ease 250ms;
  font-weight: 400;
  font-size: 14px;
  line-height: 100%;
  cursor: pointer;
  border: 1px solid
    ${({ $active }) => ($active ? 'var(--brand-primary, #37cb94)' : 'transparent')};
  color: ${({ $active }) =>
    $active ? 'var(--brand-primary, #37cb94)' : 'var(--color-text, #121926)'};

  &:hover {
    border-color: var(--brand-primary, #37cb94);
  }
`;
