import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';
import { Navbar } from './navbar';
import * as S from './styles';

export function AppLayout() {
  const [expand, setExpand] = useState(true);

  return (
    <S.Container>
      <Sidebar expand={expand} onToggle={() => setExpand((v) => !v)} />
      <S.ContentArea>
        <Navbar expand={expand} onToggle={() => setExpand((v) => !v)} />
        <S.Content className="app-content">
          <Outlet />
        </S.Content>
      </S.ContentArea>
    </S.Container>
  );
}
