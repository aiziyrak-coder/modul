import { useState } from 'react';
import styled from 'styled-components';
import { Checkbox, Typography } from 'antd';
import { PlusOutlined, CloseOutlined, CheckCircleOutlined, CloseCircleOutlined, WarningFilled } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { actionLabelKey } from '../lib/action-labels';
import type { PermissionSection } from '../model/types';
import { countSection, countState } from '../lib/permission-counts';
import {
  sectionViewWarning,
  VIEW_WARNING_ACTION_KEYS,
  VIEW_WARNING_MESSAGE_KEYS,
} from '../lib/view-permission-warnings';

const SectionWrap = styled.div`
  border-bottom: 1px solid var(--color-border, #e3e8ef);

  &:last-child {
    border-bottom: none;
  }
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  cursor: pointer;
  user-select: none;

  span {
    font-family: Inter;
    font-weight: 500;
    font-size: 15px;
    color: var(--color-text, #121926);
  }
`;

const Badge = styled.span<{ $state: 'none' | 'partial' | 'full' }>`
  min-width: 46px;
  text-align: center;
  padding: 2px 8px;
  border-radius: var(--radius-pill, 9999px);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  border: 1px solid
    ${({ $state }) => ($state === 'none' ? 'var(--color-border)' : 'var(--brand-primary)')};
  background: ${({ $state }) =>
    $state === 'full'
      ? 'var(--brand-primary)'
      : $state === 'partial'
        ? 'var(--brand-primary-soft)'
        : 'transparent'};
  color: ${({ $state }) =>
    $state === 'full'
      ? 'var(--color-bg, #fff)'
      : $state === 'partial'
        ? 'var(--brand-primary)'
        : 'var(--color-text-mute)'};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const WarningIcon = styled(WarningFilled)`
  color: var(--brand-warning);
  font-size: 16px;
`;

const WarningRow = styled.div<{ $muted?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: color-mix(in srgb, var(--brand-warning) 12%, #fff);
  border: 1px solid color-mix(in srgb, var(--brand-warning) 35%, #fff);
  border-radius: var(--radius-md, 8px);
  padding: 10px 12px;
  margin-bottom: 16px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text, #121926);

  .anticon {
    color: var(--brand-warning);
    margin-top: 2px;
    flex-shrink: 0;
  }

  ${(p) =>
    p.$muted
      ? 'background: var(--color-bg-subtle, #f8fafc);' +
        'border-color: var(--color-border, #e3e8ef);'
      : ''}
`;

const ToggleBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--color-border, #e3e8ef);
  background: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-soft, #697586);
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--color-border-soft, #eef2f6);
    color: var(--brand-primary, #37cb94);
  }
`;

const Body = styled.div`
  padding-bottom: 16px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  row-gap: 16px;
  column-gap: 12px;
  margin-bottom: 16px;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const PillBtn = styled.button<{ $variant: 'select' | 'cancel' }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-pill, 9999px);
  font-family: Inter;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  background: ${({ $variant }) => ($variant === 'select' ? 'var(--brand-primary-soft)' : 'transparent')};
  border: 1px solid ${({ $variant }) => ($variant === 'select' ? 'var(--brand-primary)' : 'var(--color-border)')};
  color: ${({ $variant }) => ($variant === 'select' ? 'var(--brand-primary)' : 'var(--color-text-soft)')};

  &:hover {
    background: ${({ $variant }) => ($variant === 'select' ? 'var(--brand-primary)' : 'var(--color-border-soft)')};
    color: ${({ $variant }) => ($variant === 'select' ? 'var(--color-bg)' : 'var(--color-text)')};
  }
`;

interface Props {
  sections: PermissionSection[];
  selectedMap: Record<string, Set<string>>;
  onToggle: (section: string, key: string) => void;
  onSelectAll: (section: string, keys: string[]) => void;
  onCancelAll: (section: string) => void;
}

export function RolePermissionSections({
  sections,
  selectedMap,
  onToggle,
  onSelectAll,
  onCancelAll,
}: Props) {
  const { t } = useTranslation();
  const [openSet, setOpenSet] = useState<Set<string>>(new Set());

  const toggleOpen = (section: string) => {
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  if (sections.length === 0) {
    return (
      <Typography.Text type="secondary">
        {t('admin.role.permissionSections.empty')}
      </Typography.Text>
    );
  }

  return (
    <div>
      {sections.map((sec) => {
        const isOpen = openSet.has(sec.section);
        const selected = selectedMap[sec.section] ?? new Set<string>();
        const count = countSection(sec, selectedMap);
        const state = countState(count);
        const allSelected =
          sec.actionKeys.length > 0 && sec.actionKeys.every((k) => selected.has(k));
        const warning = sectionViewWarning(sec, selectedMap);
        const warningMessage = warning
          ? t(VIEW_WARNING_MESSAGE_KEYS[warning.kind], {
              action: t(actionLabelKey(VIEW_WARNING_ACTION_KEYS[warning.kind])),
            })
          : undefined;

        return (
          <SectionWrap key={sec.section}>
            <Header onClick={() => toggleOpen(sec.section)}>
              <span>{sec.title ?? sec.section}</span>
              <HeaderRight>
                {warning?.severity === 'blocking' && (
                  <WarningIcon title={warningMessage} />
                )}
                <Badge
                  $state={state}
                  title={
                    state === 'none'
                      ? t('admin.role.permissionSections.noneTooltip')
                      : t('admin.role.permissionSections.countTooltip', {
                          selected: count.selected,
                          total: count.total,
                        })
                  }
                >
                  {state === 'none' ? '—' : `${count.selected}/${count.total}`}
                </Badge>
                <ToggleBtn
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOpen(sec.section);
                  }}
                  aria-label={isOpen ? t('admin.role.permissionSections.close') : t('admin.role.permissionSections.open')}
                >
                  {isOpen ? <CloseOutlined /> : <PlusOutlined />}
                </ToggleBtn>
              </HeaderRight>
            </Header>

            {isOpen && (
              <Body>
                <Grid>
                  {sec.actionKeys.map((key) => (
                    <Checkbox
                      key={key}
                      checked={selected.has(key)}
                      onChange={() => onToggle(sec.section, key)}
                    >
                      <span style={{ fontSize: 14, color: 'var(--color-text)' }}>
                        {t(actionLabelKey(key))}
                      </span>
                    </Checkbox>
                  ))}
                </Grid>
                {warning && (
                  <WarningRow $muted={warning.severity === 'info'}>
                    <WarningFilled />
                    <span>{warningMessage}</span>
                  </WarningRow>
                )}
                {allSelected ? (
                  <PillBtn $variant="cancel" onClick={() => onCancelAll(sec.section)}>
                    <CloseCircleOutlined />
                    {t('admin.common.cancel')}
                  </PillBtn>
                ) : (
                  <PillBtn
                    $variant="select"
                    onClick={() => onSelectAll(sec.section, sec.actionKeys)}
                  >
                    <CheckCircleOutlined />
                    {t('admin.role.selectAll')}
                  </PillBtn>
                )}
              </Body>
            )}
          </SectionWrap>
        );
      })}
    </div>
  );
}
