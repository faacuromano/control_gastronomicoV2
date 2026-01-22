import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

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

  useEffect(() => {
    // In dev, backend is localhost:3001. In prod, relative or ENV.
    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    // Remove /api/v1 if it exists in the URL because socket.io connects to root
    const baseUrl = socketUrl.replace('/api/v1', '');
    
    const socketInstance = io(baseUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      // Socket connected
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      // Socket disconnected
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const contextValue = React.useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};
