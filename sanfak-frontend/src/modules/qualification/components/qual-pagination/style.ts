import styled from 'styled-components';

export const Wrap = styled.div<{ $withSize?: boolean }>`
  display: flex;
  justify-content: ${({ $withSize }) => ($withSize ? 'space-between' : 'flex-end')};
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4, 16px);

  .ant-pagination-item {
    width: 32px;
    height: 32px;
    line-height: 32px;
    border-radius: var(--radius-md, 8px);

    a {
      font-size: 14px;
    }

    &:hover {
      border-color: var(--brand-primary, #37cb94);
      a {
        color: var(--brand-primary, #37cb94);
      }
    }
  }

  .ant-pagination-item-active {
    background-color: var(--color-bg, #fff);
    border-color: var(--brand-primary, #37cb94);

    a {
      color: var(--brand-primary, #37cb94);
    }
  }

  .ant-pagination-prev,
  .ant-pagination-next {
    width: 32px;
    height: 32px;
    line-height: 32px;
  }

  .ant-pagination-item-link {
    line-height: 32px;
  }

  .ant-pagination-prev:hover .ant-pagination-item-link,
  .ant-pagination-next:hover .ant-pagination-item-link {
    border-color: var(--brand-primary, #37cb94);
    color: var(--brand-primary, #37cb94);
  }
`;

export const SizeBox = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  height: 32px;

  h5 {
    margin: 0;
    font-weight: 400;
    font-size: 14px;
    color: var(--color-text, #121926);
    padding-right: var(--space-1, 4px);
  }
`;

export const SizeBtn = styled.span<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  cursor: pointer;
  transition: all ease 250ms;
  border: 1px solid ${({ $active }) => ($active ? 'var(--brand-primary, #37cb94)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--brand-primary, #37cb94)' : 'var(--color-text, #121926)')};

  &:hover {
    border-color: var(--brand-primary, #37cb94);
    color: var(--brand-primary, #37cb94);
  }
`;
