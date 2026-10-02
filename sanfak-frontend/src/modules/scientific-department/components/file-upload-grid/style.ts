import styled from 'styled-components';

export const SlotCell = styled.div`
  min-width: 0;

  .ant-upload-wrapper,
  .ant-upload-wrapper .ant-upload.ant-upload-select,
  .ant-upload-wrapper .ant-upload.ant-upload-select > .ant-upload {
    display: block;
    width: 100%;
    min-width: 0;
  }
`;

export const SlotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;
