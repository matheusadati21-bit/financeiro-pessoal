import { useEffect } from 'react';
import { io } from 'socket.io-client';

export const useRealtime = (onUpdate: () => void) => {
  useEffect(() => {
    const socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('finance:updated', onUpdate);
    return () => {
      socket.off('finance:updated', onUpdate);
      socket.disconnect();
    };
  }, [onUpdate]);
};
