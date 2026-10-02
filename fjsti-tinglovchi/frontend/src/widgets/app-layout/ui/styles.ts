import styled from 'styled-components';

export const Container = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas: 'sidebar content';
  height: 100vh;
  overflow: hidden;
`;

export const Sidebar = styled.aside<{ $expand: boolean }>`
  grid-area: sidebar;
  width: ${({ $expand }) => ($expand ? 'var(--sidebar-width)' : 'var(--sidebar-close-width)')};
  height: 100vh;
  display: grid;
  grid-template-rows: var(--sidebar-header-height) 1fr;
  background: var(--color-bg-sidebar);
  transition: width 0.2s ease-in-out;
  overflow: hidden;
  z-index: 11;
`;

export const SidebarHeader = styled.div<{ $expand: boolean }>`
  height: var(--sidebar-header-height);
  display: flex;
  align-items: center;
  justify-content: ${({ $expand }) => ($expand ? 'space-between' : 'center')};
  padding: ${({ $expand }) => ($expand ? '0 12px 0 24px' : '0 8px')};
  border-bottom: 1px solid var(--sidebar-border);
  overflow: hidden;
  gap: 8px;
`;

export const Logo = styled.span`
  font-family: Inter;
  font-weight: 700;
  font-size: 15px;
  line-height: 1.3;
  letter-spacing: -0.3px;
  color: var(--brand-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`;

export const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  flex: 1;
  min-width: 0;
`;

export const LogoImg = styled.img`
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  object-fit: contain;
  border-radius: 50%;
`;

export const LogoText = styled.span`
  font-family: Inter;
  font-weight: 600;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-text, #121926);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export const CollapseBtn = styled.button<{ $expand?: boolean }>`
  position: absolute;
  left: -16px;
  top: 50%;
  transform: translateY(-50%) rotate(${({ $expand }) => ($expand ? '0deg' : '180deg')});
  z-index: 12;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: #ffffff;
  box-shadow: 9px 8px 34px 0px rgba(47, 66, 108, 0.21);
  cursor: pointer;
  font-size: 12px;
  color: var(--color-text-soft, #697586);
  transition: box-shadow 0.15s, color 0.15s, transform 0.3s ease;

  &:hover {
    box-shadow: 9px 8px 34px 0px rgba(47, 66, 108, 0.35);
    color: var(--brand-primary, #37cb94);
  }
`;

export const SidebarBody = styled.div`
  overflow-y: scroll;
  overflow-x: hidden;
  padding: 8px 0;

  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const SectionWrap = styled.div`
  & + & {
    margin-top: 2px;
  }
`;

export const SectionLabel = styled.div`
  padding: 14px 22px 6px;
  font-family: Inter;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-soft, #697586);
  opacity: 0.72;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
`;

export const SectionDivider = styled.div`
  height: 1px;
  margin: 8px 14px;
  background: var(--sidebar-border, rgba(105, 117, 134, 0.16));
`;

export const SubSectionLabel = styled.div`
  padding: 8px 20px 4px 28px;
  font-family: Inter;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-soft, #697586);
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
`;

export const ItemWrap = styled.div`
  padding: 1px 10px;
`;

export const ItemRow = styled.div<{ $active: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.3s ease;
  border-radius: 10px;
  margin: 2px 0;
  cursor: pointer;
  width: 100%;
  height: 45px;
  position: relative;
  padding-right: 10px;
  box-sizing: border-box;
  color: ${({ $active }) => ($active ? '#fff' : 'var(--color-text-soft)')};
  background: ${({ $active }) =>
    $active
      ? 'var(--sidebar-item-active)'
      : 'transparent'};

  &:hover {
    background: var(--sidebar-item-active);
    color: #fff;
  }
`;

export const ItemLeft = styled.div<{ $expand: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: ${({ $expand }) => ($expand ? '0 10px' : '0')};
  justify-content: ${({ $expand }) => ($expand ? 'flex-start' : 'center')};
  overflow: hidden;
`;

export const ItemIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  font-size: 20px;
  line-height: 1;
  color: inherit;
`;

export const ItemTitle = styled.span`
  font-family: Inter;
  font-size: 15px;
  line-height: 24px;
  font-weight: 500;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ItemChevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  align-items: center;
  font-size: 16px;
  color: inherit;
  transition: transform 0.2s ease;
  transform: rotate(${({ $open }) => ($open ? '180deg' : '0deg')});
`;

export const SubMenuWrap = styled.div<{ $open: boolean; $count: number }>`
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: height 0.35s ease-in-out;
  height: ${({ $open, $count }) => ($open ? `${$count * 42 + 5}px` : '0px')};
  padding-top: ${({ $open }) => ($open ? '5px' : '0')};
`;

export const SubItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  height: 40px;
  padding: 8px 12px 8px 48px;
  cursor: pointer;
  border-radius: 8px;
  font-family: Inter;
  font-weight: 500;
  font-size: 14px;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${({ $active }) => ($active ? '#f5f7fb' : 'transparent')};

  &:hover { background: #f5f7fb; }
`;

export const ContentArea = styled.div`
  grid-area: content;
  height: 100vh;
  display: grid;
  grid-template-rows: var(--navbar-height) 1fr;
`;

export const Navbar = styled.header`
  height: var(--navbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--color-bg-elevate);
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 20px;
    right: 20px;
    height: 1px;
    background: var(--navbar-border);
  }
`;

export const NavbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;

export const NavbarTitle = styled.h2`
  margin: 0;
  font-family: Inter;
  font-weight: 600;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -0.01em;
  color: var(--navbar-title);
`;

export const NavbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
`;

export const NotifBtn = styled.button`
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  color: var(--color-text-soft, #697586);
  position: relative;
  transition: background 0.15s;

  &:hover { background: var(--color-border-soft, #eef2f6); }
`;

export const NotifDot = styled.span`
  position: absolute;
  top: 4px;
  right: 4px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand-error, #f04438);
  border: 1.5px solid var(--color-bg-elevate, #f5f7fb);
`;

export const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-md, 8px);
  transition: background 0.15s;

  &:hover { background: var(--color-border-soft, #eef2f6); }
`;

export const UserTexts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;

export const UserName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text, #121926);
  font-family: Inter;
  line-height: 1.2;
`;

export const UserRole = styled.span`
  font-size: 12px;
  color: var(--color-text-soft, #697586);
  font-family: Inter;
  line-height: 1.2;
`;

export const Content = styled.main`
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--color-bg-elevate);
  padding: var(--content-body-padding);
  box-sizing: border-box;
`;
