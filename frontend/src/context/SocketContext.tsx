import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const logout = useAuthStore((state) => state.logout);
  // FIX: Use isAuthenticated to know when to connect
  // The actual JWT is in HttpOnly cookie (not accessible to JS for security)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    // Don't connect if not authenticated
    if (!isAuthenticated) {
      console.log('[Socket] Not authenticated, skipping socket connection');
      return;
    }

    // INF-005: Use env var for socket URL, only fall back to localhost in dev
    const socketUrl = import.meta.env.VITE_API_URL
      || (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');
    // Remove /api/v1 if it exists in the URL because socket.io connects to root
    const baseUrl = socketUrl.replace('/api/v1', '');

    console.log('[Socket] Attempting connection to:', baseUrl);

    const socketInstance = io(baseUrl, {
      // Allow both polling and websocket - polling first for reliability
      transports: ['polling', 'websocket'],
      autoConnect: true,
      withCredentials: true,
      // Shorter timeout to fail faster and show errors
      timeout: 5000,
    });

    console.log('[Socket] Socket instance created, waiting for connection...');

    socketInstance.on('connect', () => {
      console.log('[Socket] ✅ Connected!', { socketId: socketInstance.id, transport: socketInstance.io.engine?.transport?.name });
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('[Socket] ❌ Connection error:', error.message);
      // Don't logout on every error, only on explicit auth failures
      if (error.message.includes('Authentication') || error.message === 'jwt expired') {
        console.log('[Socket] Auth failure, logging out');
        logout();
      }
    });

    socketInstance.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    setSocket(socketInstance);

    return () => {
      console.log('[Socket] Cleaning up connection');
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [logout, isAuthenticated]); // Reconnect when auth state changes (login/logout)

  const contextValue = React.useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
