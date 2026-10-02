import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DownOutlined } from '@ant-design/icons';
import type { MenuGroup, MenuNode } from '@/app/modules/build-menu';
import { appConfig } from '@/shared/config';
import { findActiveMenuEntry } from './active-menu';
import * as S from './styles';

interface Props {
  groups: MenuGroup[];
  expand: boolean;
  onToggle: () => void;
}

export function Sidebar({ groups, expand, onToggle }: Props) {
  const location = useLocation();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const allNodes = useMemo(() => groups.flatMap((g) => g.nodes), [groups]);
  const activeLeafPath = useMemo(
    () => findActiveMenuEntry(allNodes, location.pathname)?.path,
    [allNodes, location.pathname],
  );

  useEffect(() => {
    if (!activeLeafPath) return;
    for (const group of groups) {
      const activeParent = group.nodes.find(
        (n) => n.children.length > 0 && n.children.some((c) => c.path === activeLeafPath),
      );
      if (activeParent) {
        setOpenKey(activeParent.path);
        return;
      }
    }
  }, [activeLeafPath, groups]);

  useEffect(() => {
    if (!expand) setOpenKey(null);
  }, [expand]);

  const handleParentClick = (node: MenuNode) => {
    if (!expand) {
      onToggle();
      setOpenKey(node.path);
      return;
    }
    setOpenKey((prev) => (prev === node.path ? null : node.path));
  };

  const renderNode = (node: MenuNode) => {
    const hasChildren = node.children.length > 0;
    const active =
      node.path === activeLeafPath || node.children.some((c) => c.path === activeLeafPath);
    const open = openKey === node.path;
    return (
      <S.ItemWrap key={node.path}>
        {hasChildren ? (
          <S.ItemRow
            as="button"
            type="button"
            $active={active}
            aria-expanded={open}
            onClick={() => handleParentClick(node)}
            title={node.title}
          >
            <S.ItemLeft $expand={expand}>
              {node.icon && <S.ItemIcon>{node.icon}</S.ItemIcon>}
              {expand && <S.ItemTitle>{node.title}</S.ItemTitle>}
            </S.ItemLeft>
            {expand && (
              <S.ItemChevron $open={open}>
                <DownOutlined />
              </S.ItemChevron>
            )}
          </S.ItemRow>
        ) : (
          <S.ItemRow
            as={Link}
            to={node.path}
            $active={active}
            aria-current={active ? 'page' : undefined}
            title={node.title}
          >
            <S.ItemLeft $expand={expand}>
              {node.icon && <S.ItemIcon>{node.icon}</S.ItemIcon>}
              {expand && <S.ItemTitle>{node.title}</S.ItemTitle>}
            </S.ItemLeft>
          </S.ItemRow>
        )}

        {hasChildren && expand && (
          <S.SubMenuWrap $open={open} $count={node.children.length}>
            {node.children.map((child) => (
              <S.SubItem
                key={child.path}
                as={Link}
                to={child.path}
                $active={child.path === activeLeafPath}
                aria-current={child.path === activeLeafPath ? 'page' : undefined}
                title={child.title}
              >
                {child.title}
              </S.SubItem>
            ))}
          </S.SubMenuWrap>
        )}
      </S.ItemWrap>
    );
  };

  return (
    <S.Sidebar $expand={expand} className="app-sidebar">
      <S.SidebarHeader $expand={expand}>
        {expand ? (
          <S.LogoWrapper>
            <S.LogoImg src="/logo.png" alt="Logo" />
            <S.LogoText>{appConfig.appName}</S.LogoText>
          </S.LogoWrapper>
        ) : (
          <S.LogoImg src="/logo.png" alt="Logo" />
        )}
      </S.SidebarHeader>

      <S.SidebarBody className="app-sidebar-body">
        {groups.map((group, gi) => (
          <S.SectionWrap key={group.key}>
            {expand ? (
              <S.SectionLabel title={group.title}>{group.title}</S.SectionLabel>
            ) : gi > 0 ? (
              <S.SectionDivider />
            ) : null}
            {group.nodes.map((node) => renderNode(node))}
          </S.SectionWrap>
        ))}
      </S.SidebarBody>
    </S.Sidebar>
  );
}
