import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useSocket = (serverUrl) => {
  const socketRef = useRef(null);

  // Auto-detect server URL based on environment
  if (!serverUrl) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      // Production: Vercel doesn't support WebSockets with serverless functions
      if (hostname.includes('vercel.app') || hostname.includes('plotpointedashboard.com')) {
        console.log('🚫 WebSocket disabled in production (Vercel limitation)');
        return { socketRef };
      } else if (hostname === 'localhost' || hostname === '127.0.0.1') {
        // Development: use localhost with port 5001
        serverUrl = 'http://localhost:5001';
        console.log('🏠 Development WebSocket URL:', serverUrl);
      } else {
        // Fallback: use current domain
        serverUrl = `${window.location.protocol}//${window.location.host}`;
        console.log('🔄 Fallback WebSocket URL:', serverUrl);
      }
    } else {
      // Server-side fallback
      serverUrl = 'http://localhost:5001';
    }
  }

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
    });

    socket.on('disconnect', () => {
      console.log('❌ Disconnected from WebSocket server');
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
    });

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [serverUrl]);

  // Function to listen for status updates
  const onStatusUpdate = (callback) => {
    if (socketRef.current) {
      socketRef.current.on('statusUpdate', callback);
    }
  };

  // Function to remove status update listener
  const offStatusUpdate = (callback) => {
    if (socketRef.current) {
      socketRef.current.off('statusUpdate', callback);
    }
  };

  return {
    socket: socketRef.current,
    onStatusUpdate,
    offStatusUpdate,
  };
};

export default useSocket;
