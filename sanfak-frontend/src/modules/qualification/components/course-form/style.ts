import styled from 'styled-components';
import { Segmented } from 'antd';

export const MethodSegmented = styled(Segmented)`
  &&&.ant-segmented {
    height: 48px;
    padding: 4px;
    box-sizing: border-box;
  }
  &&& .ant-segmented-item,
  &&& .ant-segmented-thumb {
    height: 40px;
    min-height: 40px;
  }
  &&& .ant-segmented-item-label {
    height: 40px;
    min-height: 40px;
    line-height: 40px;
    padding: 0 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

export const StepsWrap = styled.div`
  .ant-steps-item-finish .ant-steps-item-icon {
    background-color: var(--brand-primary);
    border-color: var(--brand-primary);
  }
  .ant-steps-item-finish .ant-steps-item-icon .ant-steps-icon {
    color: var(--ant-color-text-light-solid);
  }

  .ant-steps-item-process .ant-steps-item-icon {
    background-color: var(--ant-color-bg-container);
    border-color: var(--brand-primary);
  }
  .ant-steps-item-process .ant-steps-item-icon .ant-steps-icon {
    color: var(--brand-primary);
  }
`;
