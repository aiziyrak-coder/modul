import styled from 'styled-components';

export const WizardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

export const FormWrapper = styled.div`
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  padding: var(--space-6, 24px) 0 var(--space-8, 40px);
  flex: 1;
`;

export const FormContent = styled.div`
  margin-top: var(--space-6, 24px);
  padding-top: var(--space-6, 24px);
  border-top: 1px solid var(--color-border, #e3e8ef);
`;

export const FormElements = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
`;

export const SectionLabel = styled.div`
  font-weight: 600;
  font-size: 16px;
  line-height: 1.3;
  color: var(--color-text, #121926);
  margin-bottom: var(--space-3, 12px);
`;

export const FieldLabel = styled.div`
  font-weight: 500;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text, #121926);
  margin-bottom: var(--space-2, 8px);
`;

export const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4, 16px) var(--space-5, 20px);
  background: var(--color-bg-elevate, #f5f7fb);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-4, 16px) var(--space-5, 20px);
`;

export const InfoItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

export const InfoItemLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-soft, #697586);
  font-weight: 500;
`;

export const InfoItemValue = styled.span`
  font-size: 14px;
  color: var(--color-text, #121926);
  font-weight: 600;
`;

export const TopicCard = styled.div`
  width: 100%;
  border: 1px solid var(--color-border, #e3e8ef);
  background: #ffffff;
  border-radius: var(--radius-md, 8px);
  padding: var(--space-5, 20px) var(--space-6, 24px) var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
  position: relative;
  box-sizing: border-box;
`;

export const TopicDeleteBtn = styled.button`
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: #fef3f2;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand-error, #f04438);
  font-size: 13px;
  transition: background 0.2s;

  &:hover {
    background: #fee2e0;
  }
`;

export const FooterSection = styled.div`
  margin-top: auto;
  width: 100%;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5, 20px);
  border-top: 1px solid var(--color-border, #e3e8ef);
  background: #ffffff;
  padding: 0 var(--space-5, 20px);
  box-sizing: border-box;

  .right-buttons {
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
  }
`;

export const CriteriaBlock = styled.div`
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
  padding: var(--space-5, 20px) var(--space-6, 24px);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
`;
