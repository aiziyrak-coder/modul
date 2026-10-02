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
  font-size: 18px;
  line-height: 1;
  color: var(--color-text, #121926);
  margin-bottom: var(--space-2, 8px);
`;

export const FieldLabel = styled.div`
  font-weight: 500;
  font-size: 15px;
  line-height: 1;
  color: var(--color-text, #121926);
  margin-bottom: var(--space-2, 8px);
`;

export const TopicCard = styled.div`
  width: 100%;
  border: 1px solid var(--color-border, #e3e8ef);
  background: #ffffff;
  border-radius: var(--radius-md, 8px);
  padding: var(--space-6, 24px);
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

  .left-buttons,
  .right-buttons {
    display: flex;
    align-items: center;
    gap: var(--space-3, 10px);
  }
`;

export const HoursPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  background: var(--color-bg-elevate, #f5f7fb);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-lg, 12px);
  padding: var(--space-4, 16px) var(--space-5, 20px);
`;

export const HoursPanelTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-soft, #697586);
  text-transform: uppercase;
  letter-spacing: 0.02em;
`;

export const HoursPanelMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 8px) var(--space-5, 20px);
  font-size: 14px;
  color: var(--color-text, #121926);

  strong {
    font-weight: 600;
  }
`;

export const HoursChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 8px);
`;

export type HoursChipState = 'ok' | 'under' | 'over' | 'unplanned' | 'noPlan' | 'neutral';

const CHIP_BORDER: Record<HoursChipState, string> = {
  ok: 'var(--brand-primary, #34c18c)',
  under: 'var(--brand-warning, #f0c000)',
  over: 'var(--brand-error, #f04438)',
  unplanned: 'var(--brand-warning, #f0c000)',
  noPlan: 'var(--color-border, #e3e8ef)',
  neutral: 'var(--color-border, #e3e8ef)',
};

export const HoursChip = styled.span<{ $state: HoursChipState }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 var(--space-3, 12px);
  border-radius: var(--radius-md, 8px);
  background: #ffffff;
  border: 1px solid ${(p) => CHIP_BORDER[p.$state]};
  border-left-width: 4px;
  font-size: 14px;
  color: var(--color-text, #121926);
  white-space: nowrap;

  .chip-label {
    color: var(--color-text-soft, #697586);
  }
  .chip-value {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .chip-mark {
    font-weight: 700;
    color: ${(p) => CHIP_BORDER[p.$state]};
  }
`;

export const StickySummary = styled.div`
  position: sticky;
  top: 0;
  z-index: 5;
  background: #ffffff;
  padding-bottom: var(--space-3, 12px);
`;

export const RepeaterRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 8px);

  .ant-form-item {
    margin-bottom: 0;
  }
`;

export const RepeaterList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 12px);
`;

export const DerivedCode = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  padding: 0 var(--space-2, 8px);
  border: 1px dashed var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
  background: var(--color-bg-elevate, #f5f7fb);
  color: var(--color-text-soft, #697586);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;
