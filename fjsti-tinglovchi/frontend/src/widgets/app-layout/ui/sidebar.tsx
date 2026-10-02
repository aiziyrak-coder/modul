import { useLocation, useNavigate } from 'react-router-dom';
import { appConfig } from '@/shared/config';
import { LISTENER_MENU } from '@/app/menu';
import { useTranslation } from '@/shared/lib/i18n';
import * as S from './styles';

function isActivePath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

interface Props {
  expand: boolean;
  onToggle: () => void;
}

export function Sidebar({ expand }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
        <S.SectionWrap>
          {expand ? (
            <S.SectionLabel title={t('qualification.nav.section')}>
              {t('qualification.nav.section')}
            </S.SectionLabel>
          ) : null}
          {LISTENER_MENU.map((item) => (
            <S.ItemWrap key={item.path}>
              <S.ItemRow
                $active={isActivePath(location.pathname, item.path)}
                onClick={() => navigate(item.path)}
                title={t(item.titleKey)}
              >
                <S.ItemLeft $expand={expand}>
                  <S.ItemIcon>{item.icon}</S.ItemIcon>
                  {expand && <S.ItemTitle>{t(item.titleKey)}</S.ItemTitle>}
                </S.ItemLeft>
              </S.ItemRow>
            </S.ItemWrap>
          ))}
        </S.SectionWrap>
      </S.SidebarBody>
    </S.Sidebar>
  );
}
