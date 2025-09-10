import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const useSocket = (serverUrl) => {
  const socketRef = useRef(null);

  // Check if WebSocket should be disabled in production
  const isProduction = typeof window !== 'undefined' &&
    (window.location.hostname.includes('vercel.app') ||
     window.location.hostname.includes('plotpointedashboard.com'));

  // Auto-detect server URL based on environment
  if (!serverUrl && !isProduction) {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
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
    // Skip WebSocket initialization in production
    if (isProduction) {
      console.log('🚫 WebSocket disabled in production (Vercel limitation)');
      return;
    }

    if (!serverUrl) {
      return;
    }

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
  }, [serverUrl, isProduction]);

  // Function to listen for status updates
  const onStatusUpdate = (callback) => {
    if (isProduction) {
      // No-op in production
      return;
    }
    if (socketRef.current) {
      socketRef.current.on('statusUpdate', callback);
    }
  };

  // Function to remove status update listener
  const offStatusUpdate = (callback) => {
    if (isProduction) {
      // No-op in production
      return;
    }
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
