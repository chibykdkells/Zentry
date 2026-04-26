import { io, Socket } from 'socket.io-client';
import { getRoleFromJwt } from '@/lib/auth-token';

function resolveWsUrl() {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return 'http://localhost:4000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

let socket: Socket | null = null;
let socketToken: string | null = null;

export function connectSocket(accessToken: string): Socket {
  if (!getRoleFromJwt(accessToken)) {
    throw new Error('Refusing to connect socket with an invalid or expired token.');
  }

  if (socket && socketToken === accessToken) {
    if (!socket.connected) {
      socket.connect();
    }
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = io(`${resolveWsUrl()}/ws`, {
    transports: ['websocket', 'polling'],
    auth: { token: accessToken },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });
  socketToken = accessToken;

  socket.on('connect_error', () => {
    // Stop reconnect churn on stale/invalid tokens. A later valid token will
    // establish a fresh socket through connectSocket().
    if (socketToken !== accessToken) {
      return;
    }

    socket?.disconnect();
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socketToken = null;
}

export function getSocket(): Socket | null {
  return socket;
}
