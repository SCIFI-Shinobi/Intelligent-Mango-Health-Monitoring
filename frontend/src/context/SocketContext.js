import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { AuthContext } from './AuthContext';
import { getWsBaseUrl } from '../utils/apiBase';

const WS_BASE_URL = getWsBaseUrl();
const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { token } = useContext(AuthContext);
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const shouldReconnect = useRef(true);

  const connectWebSocket = useCallback(() => {
    if (!token) return;
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    ws.current = new WebSocket(`${WS_BASE_URL}/ws?token=${token}`);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        // Dispatch global event for components that don't use this context
        window.dispatchEvent(new CustomEvent('mangoguard-live-update', { detail: incoming }));
      } catch (e) {
        console.error('WebSocket message error:', e);
      }
    };

    ws.current.onclose = () => {
      if (!shouldReconnect.current) return;
      console.log('WebSocket closed, reconnecting...');
      reconnectTimer.current = setTimeout(() => connectWebSocket(), 3000);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [token]);

  useEffect(() => {
    shouldReconnect.current = true;
    connectWebSocket();

    return () => {
      shouldReconnect.current = false;
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, [connectWebSocket]);

  return (
    <SocketContext.Provider value={{ ws: ws.current }}>
      {children}
    </SocketContext.Provider>
  );
};
