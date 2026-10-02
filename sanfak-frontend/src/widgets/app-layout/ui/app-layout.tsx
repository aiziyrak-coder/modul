import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSessionStore } from '@/app/session';
import { useTranslation } from '@/shared/lib/i18n';
import { buildAppMenu } from '@/app/modules/build-menu';
import { Sidebar } from './sidebar';
import { Navbar } from './navbar';
import * as S from './styles';

export function AppLayout() {
  const permissions = useSessionStore((s) => s.permissions);
  const { t } = useTranslation();
  const [expand, setExpand] = useState(true);

  const groups = useMemo(() => buildAppMenu(permissions, t), [permissions, t]);
  const navNodes = useMemo(() => groups.flatMap((g) => g.nodes), [groups]);

  return (
    <S.Container>
      <Sidebar groups={groups} expand={expand} onToggle={() => setExpand((v) => !v)} />
      <S.ContentArea>
        <Navbar nodes={navNodes} expand={expand} onToggle={() => setExpand((v) => !v)} />
        <S.Content className="app-content">
          <Outlet />
        </S.Content>
      </S.ContentArea>
    </S.Container>
  );
}
