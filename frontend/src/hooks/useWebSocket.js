import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';

export const useWebSocket = (sessionId) => {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  
  const connect = useCallback(() => {
    if (!sessionId) return;
    
    // Include API token if available (adapt env var name as needed)
    const apiToken = process.env.REACT_APP_API_TOKEN;
    const tokenParam = apiToken ? `?token=${encodeURIComponent(`Bearer ${apiToken}`)}` : '';
    const ws = new WebSocket(`${WS_URL}/ws/interview/${sessionId}${tokenParam}`);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'error' && data.code === 401) {
          console.error('Auth error, stopping reconnect attempts:', data.message);
          // Prevent infinite reconnect loop on auth failure
          wsRef.current = null;
          ws.close();
          return;
        }
        setMessages(prev => [...prev, data]);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = (evt) => {
      console.log('WebSocket disconnected', evt.code, evt.reason);
      setConnected(false);
      // Stop reconnecting if auth failed
      if (evt.reason === 'auth_failed' || evt.code === 4401) {
        return;
      }
      // Auto-reconnect after 3 seconds (basic backoff could be added)
      setTimeout(() => {
        console.log('Attempting to reconnect...');
        connect();
      }, 3000);
    };
    
    wsRef.current = ws;
  }, [sessionId]);
  
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);
  
  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);
  
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
  
  return { connected, messages, sendMessage };
};