import type { Socket } from 'socket.io-client';
import { getAppSocket, disconnectAppSocket } from '@/shared/lib/socket';

let lastOnlineIds: string[] = [];

let watched: Socket | null = null;

export function getLastOnlineIds(): string[] {
  return lastOnlineIds;
}

export function getChatSocket(): Socket {
  const socket = getAppSocket();
  if (watched !== socket) {
    watched = socket;
    lastOnlineIds = [];
    socket.on('onlineUsers', (ids: string[]) => {
      lastOnlineIds = (ids ?? []).map(String);
    });
    socket.on('disconnect', () => {
      lastOnlineIds = [];
    });
    const pullOnline = () => socket?.emit('getOnlineUsers');
    socket.on('connect', pullOnline);
    if (socket.connected) pullOnline();
  }
  return socket;
}

export function disconnectChatSocket(): void {
  watched = null;
  lastOnlineIds = [];
  disconnectAppSocket();
}
