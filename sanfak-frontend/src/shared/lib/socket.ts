import { io, type Socket } from 'socket.io-client';
import { appConfig } from '@/shared/config';
import { getAccessToken, refreshAccessToken } from '@/shared/api';

let socket: Socket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let reconnectRefreshInFlight = false;

function socketUrl(): string {
  return appConfig.apiUrl.replace(/\/api\/?$/, '');
}

const AUTH_CONNECT_ERROR_MESSAGES = new Set(["Token topilmadi", "Token noto'g'ri"]);

async function handleConnectError(error: Error): Promise<void> {
  if (!AUTH_CONNECT_ERROR_MESSAGES.has(error.message) || reconnectRefreshInFlight) return;
  reconnectRefreshInFlight = true;
  try {
    const token = await refreshAccessToken();
    if (token && socket && !socket.connected) socket.connect();
  } finally {
    reconnectRefreshInFlight = false;
  }
}

export function getAppSocket(): Socket {
  if (!socket) {
    socket = io(socketUrl() || '/', {
      auth: (cb: (data: { token: string }) => void) =>
        cb({ token: getAccessToken() ?? '' }),
      autoConnect: true,
      reconnection: true,
    });
    socket.on('connect_error', (error: Error) => {
      void handleConnectError(error);
    });
    heartbeatTimer = setInterval(() => {
      if (socket?.connected) socket.emit('heartbeat');
    }, 60000);
  }
  return socket;
}

export function disconnectAppSocket(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
