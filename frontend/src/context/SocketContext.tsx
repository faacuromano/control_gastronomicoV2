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

  useEffect(() => {
    // In dev, backend is localhost:3001. In prod, relative or ENV.
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    // Remove /api/v1 if it exists in the URL because socket.io connects to root
    const baseUrl = socketUrl.replace('/api/v1', '');

    const socketInstance = io(baseUrl, {
      transports: ['websocket'],
      autoConnect: true,
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    // P1-006: Handle auth failures to prevent silent disconnection
    socketInstance.on('connect_error', (error) => {
      if (error.message === 'authentication_error' || error.message === 'jwt expired') {
        logout();
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [logout]);

  const contextValue = React.useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
