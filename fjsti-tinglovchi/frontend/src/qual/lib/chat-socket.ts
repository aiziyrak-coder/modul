import { io, type Socket } from 'socket.io-client';
import { appConfig } from '@/shared/config';
import { getAccessToken } from '@/shared/api';

let socket: Socket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

let lastOnlineIds: string[] = [];

export function getLastOnlineIds(): string[] {
  return lastOnlineIds;
}

export function getChatSocket(): Socket {
  if (!socket) {
    socket = io(appConfig.socketUrl, {
      auth: (cb: (data: { token: string }) => void) =>
        cb({ token: getAccessToken() ?? '' }),
      autoConnect: true,
      reconnection: true,
    });
    socket.on('onlineUsers', (ids: string[]) => {
      lastOnlineIds = (ids ?? []).map(String);
    });
    socket.on('disconnect', () => {
      lastOnlineIds = [];
    });
    const pullOnline = () => socket?.emit('getOnlineUsers');
    socket.on('connect', pullOnline);
    if (socket.connected) pullOnline();
    heartbeatTimer = setInterval(() => {
      if (socket?.connected) socket.emit('heartbeat');
    }, 60000);
  }
  return socket;
}

export function disconnectChatSocket(): void {
  lastOnlineIds = [];
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
