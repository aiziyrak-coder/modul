import styled from 'styled-components';
import { useTranslation } from '@/shared/lib/i18n';
import type { PermissionGroup } from '../model/types';
import { countGroup, countState, type SelectedMap } from '../lib/permission-counts';

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Item = styled.div<{ $active?: boolean; $empty?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-family: Inter;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out, border-color 0.2s ease-in-out;
  background: ${({ $active }) => ($active ? 'var(--brand-primary-soft)' : 'var(--color-bg-elevate)')};
  border: 1px solid ${({ $active }) => ($active ? 'var(--brand-primary)' : 'transparent')};
  color: ${({ $active, $empty }) =>
    $active ? 'var(--brand-primary)' : $empty ? 'var(--color-text-soft)' : 'var(--color-text)'};

  &:hover {
    background: ${({ $active }) => ($active ? 'var(--brand-primary-soft)' : 'var(--color-border-soft)')};
  }
`;

const Name = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Badge = styled.span<{ $state: 'none' | 'partial' | 'full' }>`
  flex: 0 0 auto;
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
    $state === 'full' ? 'var(--brand-primary)' : $state === 'partial' ? 'var(--brand-primary-soft)' : 'transparent'};
  color: ${({ $state }) =>
    $state === 'full' ? 'var(--color-bg, #fff)' : $state === 'partial' ? 'var(--brand-primary)' : 'var(--color-text-mute)'};
`;

interface Props {
  groups: PermissionGroup[];
  activeId: string | null;
  onSelect: (id: string) => void;
  selectedMap: SelectedMap;
}

export function RoleModuleList({ groups, activeId, onSelect, selectedMap }: Props) {
  const { t } = useTranslation();
  return (
    <List>
      {groups.map((g) => {
        const count = countGroup(g, selectedMap);
        const state = countState(count);
        return (
          <Item
            key={g._id}
            $active={g._id === activeId}
            $empty={state === 'none'}
            onClick={() => onSelect(g._id)}
            title={
              state === 'none'
                ? t('admin.role.moduleList.noneTooltip', { title: g.title })
                : t('admin.role.moduleList.countTooltip', {
                    title: g.title,
                    selected: count.selected,
                    total: count.total,
                  })
            }
          >
            <Name>{g.title}</Name>
            <Badge $state={state}>
              {state === 'none' ? '—' : `${count.selected}/${count.total}`}
            </Badge>
          </Item>
        );
      })}
    </List>
  );
}
