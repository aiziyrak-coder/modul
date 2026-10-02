import { useLocation, useNavigate } from 'react-router-dom';
import { DoubleLeftOutlined, GlobalOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Avatar, Button, Dropdown } from 'antd';
import { LISTENER_MENU } from '@/app/menu';
import { logout, useSessionStore } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import * as S from './styles';

const LANG_LABEL: Record<string, string> = { uz: "O‘zbekcha", ru: 'Русский', en: 'English' };

function activeTitleKey(pathname: string): string {
  if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    return 'qualification.profile.title';
  }
  const hit = LISTENER_MENU.find(
    (n) => pathname === n.path || pathname.startsWith(`${n.path}/`),
  );
  return hit?.titleKey ?? '';
}

interface Props {
  expand: boolean;
  onToggle: () => void;
}

export function Navbar({ expand, onToggle }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useSessionStore((s) => s.user);
  const { t, lang, changeLanguage, langs } = useTranslation();

  const langMenu: MenuProps['items'] = langs.map((l) => ({
    key: l,
    label: LANG_LABEL[l] ?? l.toUpperCase(),
    onClick: () => changeLanguage(l),
  }));

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('qualification.nav.profile'),
      onClick: () => navigate('/profile'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('qualification.nav.logout'),
      onClick: () => {
        logout();
        navigate('/login', { replace: true });
      },
    },
  ];

  const titleKey = activeTitleKey(location.pathname);

  return (
    <S.Navbar>
      <S.NavbarLeft>
        <S.CollapseBtn $expand={expand} onClick={onToggle} aria-label="Toggle sidebar">
          <DoubleLeftOutlined />
        </S.CollapseBtn>
        {titleKey ? <S.NavbarTitle>{t(titleKey)}</S.NavbarTitle> : null}
      </S.NavbarLeft>

      <S.NavbarRight>
        <Dropdown menu={{ items: langMenu, selectedKeys: [lang] }} placement="bottomRight" trigger={['click']}>
          <Button type="text" icon={<GlobalOutlined />} style={{ fontWeight: 600, color: 'var(--color-text-soft, #697586)' }}>
            {lang.toUpperCase()}
          </Button>
        </Dropdown>

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
              <S.UserName>{user?.fullName ?? t('qualification.nav.role')}</S.UserName>
              <S.UserRole>{t('qualification.nav.role')}</S.UserRole>
            </S.UserTexts>
          </S.UserInfo>
        </Dropdown>
      </S.NavbarRight>
    </S.Navbar>
  );
}
