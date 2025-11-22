/**
 * WebSocket Hook for Real-Time Sensor Data
 * Uses Socket.IO for real-time push updates from backend
 * Replaces 15-second HTTP polling with instant WebSocket notifications
 * 
 * Features:
 * - Auto-reconnect on disconnection
 * - Channel room management
 * - Connection state tracking
 * - Latency measurement for performance metrics
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = 'http://192.168.1.12:3000';

interface SensorReading {
  id: string;
  channelId: string;
  aqi: number;
  co2: number;
  co: number;
  no2: number;
  temperature: number;
  humidity: number;
  timestamp: string;
}

interface NewReadingEvent {
  channelId: string;
  reading: SensorReading;
  timestamp: string;
  serverTransmitTime?: number; // Server's Date.now() when emitting the message
}

interface WebSocketMetrics {
  latency: number; // milliseconds from server emission to client reception
  messagesReceived: number;
  bytesReceived: number;
  connectionTime: Date | null;
  lastMessageTime: Date | null;
}

interface UseWebSocketOptions {
  enabled?: boolean;
  onNewReading?: (reading: SensorReading) => void;
  onError?: (error: Error) => void;
}

export function useWebSocket(channelId: string | null, options: UseWebSocketOptions = {}) {
  const { enabled = true, onNewReading, onError } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [metrics, setMetrics] = useState<WebSocketMetrics>({
    latency: 0,
    messagesReceived: 0,
    bytesReceived: 0,
    connectionTime: null,
    lastMessageTime: null,
  });
  
  const socketRef = useRef<Socket | null>(null);
  const currentChannelRef = useRef<string | null>(null);
  
  // Store callbacks in refs to avoid recreating socket on every callback change
  const onNewReadingRef = useRef(onNewReading);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onNewReadingRef.current = onNewReading;
    onErrorRef.current = onError;
  }, [onNewReading, onError]);

  // Initialize WebSocket connection (only once when enabled changes)
  useEffect(() => {
    if (!enabled) return;
    
    // Prevent multiple connections
    if (socketRef.current?.connected) {
      console.log('🔌 [WebSocket] Already connected, skipping initialization');
      return;
    }

    console.log('🔌 [WebSocket] Initializing connection to', API_URL);
    
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 [WebSocket] Connected with ID:', socket.id);
      setIsConnected(true);
      setMetrics(prev => ({
        ...prev,
        connectionTime: new Date(),
      }));
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 [WebSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 [WebSocket] Connection error:', error.message);
      onErrorRef.current?.(error);
    });

    socket.on('newReading', (data: NewReadingEvent) => {
      const receiveTime = Date.now();
      
      // Calculate latency using server's transmit time if available
      // Otherwise use reading timestamp (may be inaccurate due to clock skew)
      const serverTime = data.serverTransmitTime 
        ? data.serverTransmitTime 
        : new Date(data.timestamp).getTime();
      const latency = receiveTime - serverTime;
      
      console.log('📥 [WebSocket] Received newReading for channel:', data.channelId);
      console.log('   Latency:', Math.abs(latency), 'ms', latency < 0 ? '(clock skew detected)' : '');
      
      const messageSize = JSON.stringify(data).length;
      
      setMetrics(prev => ({
        latency: Math.abs(latency), // Use absolute value to avoid negative display
        messagesReceived: prev.messagesReceived + 1,
        bytesReceived: prev.bytesReceived + messageSize,
        connectionTime: prev.connectionTime,
        lastMessageTime: new Date(),
      }));
      
      setLatestReading(data.reading);
      onNewReadingRef.current?.(data.reading);
    });

    return () => {
      console.log('🔌 [WebSocket] Cleaning up connection');
      socket.disconnect();
    };
  }, [enabled]); // Only depend on enabled, not callbacks

  // Join/leave channel rooms
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected || !channelId) return;

    // Leave previous channel
    if (currentChannelRef.current && currentChannelRef.current !== channelId) {
      console.log('📡 [WebSocket] Leaving channel:', currentChannelRef.current);
      socket.emit('leave-channel', currentChannelRef.current);
    }

    // Join new channel
    console.log('📡 [WebSocket] Joining channel:', channelId);
    socket.emit('join-channel', channelId);
    currentChannelRef.current = channelId;

    socket.once('joined', (data) => {
      console.log('✅ [WebSocket] Successfully joined channel:', data.channelId);
    });

    return () => {
      if (currentChannelRef.current) {
        console.log('📡 [WebSocket] Leaving channel on cleanup:', currentChannelRef.current);
        socket.emit('leave-channel', currentChannelRef.current);
        currentChannelRef.current = null;
      }
    };
  }, [channelId, isConnected]);

  const reconnect = useCallback(() => {
    console.log('🔄 [WebSocket] Manual reconnect triggered');
    socketRef.current?.disconnect();
    socketRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    console.log('🔌 [WebSocket] Manual disconnect triggered');
    socketRef.current?.disconnect();
  }, []);

  return {
    isConnected,
    latestReading,
    metrics,
    reconnect,
    disconnect,
  };
}
