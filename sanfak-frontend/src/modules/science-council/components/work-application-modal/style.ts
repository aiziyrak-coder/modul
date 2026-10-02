import styled from 'styled-components';

export const Dropzone = styled.div<{ $active: boolean }>`
  border: 2px dashed var(--border-secondary, #d1d5db);
  border-radius: var(--radius-lg, 10px);
  padding: 8px 16px;
  text-align: center;
  cursor: pointer;
  background: ${({ $active }) => ($active ? '#f0fdf4' : '#fafafa')};
  transition: all 0.2s;
`;

export const FieldsScope = styled.div`
  position: relative;

  .ant-form-item {
    margin-bottom: 12px;
  }

  .ant-form-item-label {
    padding-bottom: 2px;
  }

  .ant-select-dropdown {
    max-width: 100%;
  }

  .ant-select-item-option-content,
  .ant-select-selection-item,
  .ant-select-selection-placeholder {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
