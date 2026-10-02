import styled from 'styled-components';

export const FormWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;

  .form-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4) var(--space-5);
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

export const TeacherInfoBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-layout, #f5f7fb);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
`;

export const HoursListWrapper = styled.div`
  background: var(--color-bg-layout, #f5f7fb);
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

export const HoursListItem = styled.div`
  display: grid;
  grid-template-columns: 1fr 84px 84px;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-5);
  border-bottom: 1px solid var(--color-border, #e3e8ef);

  &:last-child {
    border-bottom: none;
  }
`;

export const HoursListHead = styled(HoursListItem)`
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
  background: var(--color-bg-elevate, #eef2f6);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-soft, #697586);
`;

export const HoursListFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-5);
  background: var(--color-bg-layout, #f5f7fb);
`;

export const StreamChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  background: var(--color-bg-layout, #f5f7fb);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-sm);
  font-size: 12px;
`;
