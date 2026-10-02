import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdCheck } from '../icons';
import { App } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { PageTitle, Btn } from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import TruncCell from '../components/common/TruncCell';
import { useNotifications, useMarkNotificationRead } from '../api/plan-api';

const fmt = (s: string | null) => (s ? s.slice(0, 16).replace('T', ' ') : '—');

export default function Bildirishnomalar() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useNotifications();
  const markM = useMarkNotificationRead();

  const mark = async (id: string) => {
    try {
      await markM.mutateAsync(id);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Xatolik'));
    }
  };

  return (
    <div>
      <PageTitle>Bildirishnomalar</PageTitle>
      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>#</Th>
              <Th>Nomi</Th>
              <Th>Izoh</Th>
              <Th>Vaqti</Th>
              <Th>Status</Th>
              <Th style={{ width: 150 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((n, i) => (
              <Tr key={n.id} $clickable={!!n.link} onClick={() => n.link && navigate(n.link)}>
                <Td>{i + 1}</Td>
                <Td>{n.title}</Td>
                <Td>
                  <TruncCell text={n.body ?? ''} />
                </Td>
                <Td>{fmt(n.createdAt)}</Td>
                <Td>
                  <Badge variant={n.read ? 'umumiy' : 'yangi'}>{n.read ? 'O‘qilgan' : 'Yangi'}</Badge>
                </Td>
                <Td>
                  {!n.read && (
                    <Btn
                      $variant="ghost"
                      $size="sm"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        mark(n.id);
                      }}
                    >
                      <MdCheck /> O‘qilgan
                    </Btn>
                  )}
                </Td>
              </Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Tr>
                <Td colSpan={6} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  Bildirishnoma yo‘q
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
