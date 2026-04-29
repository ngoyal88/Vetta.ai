import { useCallback, useEffect, useRef, useState } from "react";
import { auth } from "firebaseConfig";
import toast from "react-hot-toast";
import { decodeJsonMessage } from "../utils/messageCodec";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;
const HEARTBEAT_INTERVAL = 30000;
const ACTIVITY_TIMEOUT = 300000;

const getWebSocketBaseUrl = () => {
  const raw = (process.env.REACT_APP_WS_URL || "").trim();
  const isSecure = typeof window !== "undefined" && window.location?.protocol === "https:";
  const protocol = isSecure ? "wss:" : "ws:";
  let hostPort = "localhost:8000";
  if (raw) {
    try {
      const parsed = new URL(raw.startsWith("ws") ? raw : `ws://${raw}`);
      hostPort = parsed.host;
    } catch {
      hostPort = raw.replace(/^wss?:\/\//, "").replace(/\/.*$/, "").trim() || hostPort;
    }
  }
  return `${protocol}//${hostPort}/ws`;
};

type UseWebSocketTransportOptions = {
  sessionId: string;
  onMessage: (message: Record<string, unknown>) => void;
};

export const useWebSocketTransport = (options: UseWebSocketTransportOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [networkIssue, setNetworkIssue] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const messageQueueRef = useRef<unknown[]>([]);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const lastActivityRef = useRef(Date.now());
  const shouldReconnectRef = useRef(true);
  const connectRef = useRef<() => Promise<void>>(async () => {});

  const flushMessageQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (messageQueueRef.current.length === 0) return;
    const queue = [...messageQueueRef.current];
    messageQueueRef.current = [];
    queue.forEach((msg) => {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        messageQueueRef.current.push(msg);
      }
    });
  }, []);

  const sendMessage = useCallback((message: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return;
      } catch {
        messageQueueRef.current.push(message);
        return;
      }
    }
    messageQueueRef.current.push(message);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current != null) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatIntervalRef.current = window.setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      sendMessage({ type: "ping" });
      const inactiveTime = Date.now() - lastActivityRef.current;
      if (inactiveTime > ACTIVITY_TIMEOUT) {
        const warning = (toast as unknown as { warning?: (message: string) => void }).warning;
        if (typeof warning === "function") warning("Are you still there?");
        else toast("Are you still there?");
      }
    }, HEARTBEAT_INTERVAL);
  }, [sendMessage, stopHeartbeat]);

  const attemptReconnect = useCallback(() => {
    if (!shouldReconnectRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError("Connection lost. Please refresh the page.");
      toast.error("Connection lost. Please refresh.");
      return;
    }
    reconnectAttemptsRef.current += 1;
    const attempt = reconnectAttemptsRef.current;
    const delay = RECONNECT_DELAY * Math.pow(1.5, attempt - 1);
    toast.loading(`Reconnecting... (${attempt}/${MAX_RECONNECT_ATTEMPTS})`);
    reconnectTimeoutRef.current = window.setTimeout(() => {
      void connectRef.current();
    }, delay);
  }, []);

  const connect = useCallback(async () => {
    const sessionId = optionsRef.current.sessionId;
    if (!sessionId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken() : null;
      if (!token) {
        setError("Not authenticated");
        toast.error("Please sign in to join the interview");
        return;
      }

      const wsBase = getWebSocketBaseUrl();
      const ws = new WebSocket(`${wsBase}/interview/${sessionId}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setStatus("connected");
        setError(null);
        setNetworkIssue(false);
        reconnectAttemptsRef.current = 0;
        lastActivityRef.current = Date.now();
        startHeartbeat();
        flushMessageQueue();
        toast.success("Connected to interview");
      };

      ws.onmessage = (event: MessageEvent) => {
        lastActivityRef.current = Date.now();
        const decoded = decodeJsonMessage(event.data as string);
        if (!decoded.ok) return;
        const message = decoded.message;
        if (message && typeof message === "object") {
          optionsRef.current.onMessage(message as Record<string, unknown>);
        }
      };

      ws.onerror = () => {
        setNetworkIssue(true);
        setError("Connection error");
      };

      ws.onclose = (event: CloseEvent) => {
        setConnected(false);
        setStatus("disconnected");
        stopHeartbeat();
        if (!shouldReconnectRef.current) return;
        if (event.code === 1006) {
          setNetworkIssue(true);
        }
        attemptReconnect();
      };
    } catch {
      setError("Failed to connect");
      toast.error("Connection failed");
    }
  }, [attemptReconnect, flushMessageQueue, startHeartbeat, stopHeartbeat]);

  connectRef.current = connect;

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    stopHeartbeat();
    if (reconnectTimeoutRef.current != null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      try {
        ws.close(1000, "User disconnected");
      } catch {}
      wsRef.current = null;
    }
    setConnected(false);
    setStatus("disconnected");
  }, [stopHeartbeat]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    return () => {
      shouldReconnectRef.current = false;
      stopHeartbeat();
      if (reconnectTimeoutRef.current != null) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [stopHeartbeat]);

  useEffect(() => {
    const handleOnline = () => {
      setNetworkIssue(false);
      toast.success("Network restored");
      if (!connected) {
        void connectRef.current();
      }
    };
    const handleOffline = () => {
      setNetworkIssue(true);
      toast.error("Network connection lost");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [connected]);

  return {
    wsRef,
    connected,
    status,
    error,
    networkIssue,
    setError,
    setStatus,
    connect,
    disconnect,
    sendMessage,
    sendBinary: (data: ArrayBuffer) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(data);
    },
  };
};
