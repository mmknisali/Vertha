import { useState, useEffect, useRef, useCallback } from 'react';

const WS_RECONNECT_INTERVAL = 3000;
const WS_MAX_RECONNECT_ATTEMPTS = 5;
const WS_HEARTBEAT_INTERVAL = 30000;

export default function useWebSocket({ url, onMessage, onOpen, onClose, onError, autoConnect = true }) {
  const [status, setStatus] = useState('disconnected');
  const [lastMessage, setLastMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const heartbeatTimerRef = useRef(null);
  const configRef = useRef({ url, onMessage, onOpen, onClose, onError });

  useEffect(() => {
    configRef.current = { url, onMessage, onOpen, onClose, onError };
  }, [url, onMessage, onOpen, onClose, onError]);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearTimers();
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, WS_HEARTBEAT_INTERVAL);
  }, [clearTimers]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    clearTimers();
    setStatus('connecting');

    try {
      const ws = new WebSocket(configRef.current.url);
      wsRef.current = ws;

      ws.onopen = (event) => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
        configRef.current.onOpen?.(event);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          if (data.type !== 'pong') {
            configRef.current.onMessage?.(data);
          }
        } catch (e) {
          setLastMessage({ raw: event.data });
        }
      };

      ws.onclose = (event) => {
        setStatus('disconnected');
        clearTimers();
        configRef.current.onClose?.(event);

        if (reconnectAttemptsRef.current < WS_MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          setStatus('reconnecting');
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, WS_RECONNECT_INTERVAL);
        }
      };

      ws.onerror = (error) => {
        configRef.current.onError?.(error);
      };

    } catch (e) {
      setStatus('error');
    }
  }, [clearTimers, startHeartbeat]);

  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = WS_MAX_RECONNECT_ATTEMPTS;
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, [clearTimers]);

  const send = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      wsRef.current.send(data);
      return true;
    }
    return false;
  }, []);

  const sendJSON = useCallback((obj) => {
    return send(JSON.stringify(obj));
  }, [send]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [autoConnect, connect, clearTimers]);

  return {
    status,
    lastMessage,
    connect,
    disconnect,
    send,
    sendJSON,
    isConnected: status === 'connected',
    isReconnecting: status === 'reconnecting',
  };
}