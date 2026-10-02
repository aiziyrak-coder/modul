import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, DoubleLeftOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { MenuProps } from 'antd';
import { Avatar, Dropdown, LanguageSwitcher } from '@/shared/ui';
import { useSessionStore } from '@/app/session';
import { useAuth } from '@/app/auth';
import { useTranslation } from '@/shared/lib/i18n';
import { usePageTitleStore } from '@/shared/lib/page-title-store';
import type { MenuNode } from '@/app/modules/build-menu';
import { NavbarSlots } from '@/app/modules/navbar-slots';
import { findActiveMenuEntry } from './active-menu';
import * as S from './styles';

interface Props {
  nodes: MenuNode[];
  expand: boolean;
  onToggle: () => void;
}

export function Navbar({ nodes, expand, onToggle }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const { logout } = useAuth();

  const dynamicTitle = usePageTitleStore((s) => s.title);
  const showBack = usePageTitleStore((s) => s.back);
  const menuTitle = findActiveMenuEntry(nodes, location.pathname)?.title ?? '';
  const title = dynamicTitle !== '' ? dynamicTitle : menuTitle;

  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('logout'),
      onClick: () => void logout(),
    },
  ];

  return (
    <S.Navbar>
      <S.NavbarLeft>
        <S.CollapseBtn $expand={expand} onClick={onToggle} aria-label="Toggle sidebar">
          <DoubleLeftOutlined />
        </S.CollapseBtn>
        {showBack ? (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            aria-label="Orqaga"
            style={{ color: 'var(--color-text-soft, #697586)', marginRight: -6 }}
          />
        ) : null}
        {title ? <S.NavbarTitle>{title}</S.NavbarTitle> : null}
      </S.NavbarLeft>

      <S.NavbarRight>
        <LanguageSwitcher />
        <NavbarSlots />
        <Dropdown menu={{ items: userMenu }} placement="bottomRight">
          <S.UserInfo>
            <Avatar
              size={44}
              style={{
                background: '#fff',
                border: '1px solid var(--color-border-soft, #eef2f6)',
                flexShrink: 0,
              }}
              icon={<UserOutlined style={{ color: 'var(--color-text-soft, #697586)' }} />}
            />
            <S.UserTexts>
              <S.UserName>{user?.fullName ?? user?.email ?? 'User'}</S.UserName>
              <S.UserRole>{user?.roles?.[0]?.name ?? 'Admin'}</S.UserRole>
            </S.UserTexts>
          </S.UserInfo>
        </Dropdown>
      </S.NavbarRight>
    </S.Navbar>
  );
}
