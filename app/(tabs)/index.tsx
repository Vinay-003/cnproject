import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, ScrollView, Pressable, Alert, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/theme';
import * as Clipboard from 'expo-clipboard';
import HistoricalDataAnalysis from '@/components/historical-data-analysis';
import { calculatePollutantAQI, getAQIStatus as getDetailedAQIStatus } from '@/utils/aqiCalculator';
import { useWebSocket } from '@/hooks/use-websocket';

// --- Types ---
interface Reading {
  timestamp: string; // ISO
  aqi: number; // Air Quality Index
  co2: number; // ppm
  co: number; // ppm
  no2: number; // ppm
  temperature: number; // °C
  humidity: number; // %
}

// --- Config ---
const POLL_INTERVAL_MS = 15_000; // 15s
const HISTORY_LIMIT = 50; // show last 50 points
const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000';
const API_ENDPOINT = `${API_BASE}/api/air-quality/latest?limit=${HISTORY_LIMIT}`; // Expect array newest->oldest or oldest->newest (we'll normalize)

// --- Helpers ---
function getAQIStatus(aqi?: number) {
  if (aqi == null || isNaN(aqi)) return { label: 'Unknown', color: '#9E9E9E' };
  if (aqi <= 50) return { label: 'Good', color: '#2ecc71' };
  if (aqi <= 100) return { label: 'Moderate', color: '#f1c40f' };
  if (aqi <= 150) return { label: 'Unhealthy (SG)', color: '#e67e22' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#e74c3c' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#8e44ad' };
  return { label: 'Hazardous', color: '#7f0000' };
}

const MetricCard: React.FC<{ title: string; value?: number; unit: string; color?: string; subtitle?: string }>
  = ({ title, value, unit, color, subtitle }) => {
  return (
    <ThemedView style={[styles.metricCard, { borderColor: color || '#ccc' }]}>
      <ThemedText type="defaultSemiBold" style={{ color }}>{title}</ThemedText>
      <ThemedText type="title" style={{ color }}>
        {value != null && !isNaN(value) ? value.toFixed(1) : '--'}<ThemedText type="default" style={{ fontSize: 16 }}> {unit}</ThemedText>
      </ThemedText>
      {!!subtitle && <ThemedText style={{ color, fontSize: 12 }}>{subtitle}</ThemedText>}
    </ThemedView>
  );
};

interface GaugeProps { value?: number; min?: number; max?: number; size?: number; color?: string; }
const Gauge: React.FC<GaugeProps> = ({ value = 0, min = 0, max = 500, size = 140, color = '#2ecc71' }) => {
  const radius = size / 2 - 12;
  const strokeWidth = 10;
  const cx = size / 2;
  const cy = size / 2;
  const clamped = Math.min(max, Math.max(min, value));
  const pct = (clamped - min) / (max - min);
  const startAngle = Math.PI; // 180° (left)
  const endAngle = Math.PI * (1 - pct); // sweep from left to right
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy + radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy + radius * Math.sin(endAngle);
  const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
  const backgroundPath = describeArc(cx, cy, radius, 180, 0);
  const valuePath = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 0 ${x2} ${y2}`;
  return (
    <Svg width={size} height={size / 2 + 10}>
      <PathWrapper d={backgroundPath} stroke="#e0e0e0" strokeWidth={strokeWidth} />
      <PathWrapper d={valuePath} stroke={color} strokeWidth={strokeWidth} />
      <ThemedText style={{ position: 'absolute', top: size / 4 - 8, alignSelf: 'center', width: '100%', textAlign: 'center', fontSize: 18 }}>
        {value.toFixed(0)}
      </ThemedText>
    </Svg>
  );
};

function describeArc(x: number, y: number, r: number, startAngleDeg: number, endAngleDeg: number) {
  const start = polarToCartesian(x, y, r, endAngleDeg);
  const end = polarToCartesian(x, y, r, startAngleDeg);
  const largeArcFlag = endAngleDeg - startAngleDeg <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = (angleDeg - 90) * Math.PI / 180.0;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

const PathWrapper: React.FC<{ d: string; stroke: string; strokeWidth: number }> = ({ d, stroke, strokeWidth }) => (
  <Path d={d} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
);

interface Channel {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  writeApiKey?: string;
  readApiKey?: string;
}

interface User {
  id: string;
  username: string;
  email: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [simulatorStatus, setSimulatorStatus] = useState<Record<string, boolean>>({});
  const [useWebSocketMode, setUseWebSocketMode] = useState(true); // Toggle between WebSocket and polling
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // WebSocket for real-time updates
  const { isConnected: wsConnected, latestReading: wsReading, metrics: wsMetrics } = useWebSocket(
    selectedChannel,
    {
      enabled: useWebSocketMode && !!selectedChannel,
      onNewReading: (reading) => {
        console.log('📥 [Home] Received real-time reading:', reading);
        // Add to history
        setHistory(prev => {
          const updated = [...prev, reading];
          // Keep only last HISTORY_LIMIT items
          return updated.slice(-HISTORY_LIMIT);
        });
      },
      onError: (error) => {
        console.error('❌ [Home] WebSocket error:', error);
      }
    }
  );

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        router.replace('/login' as any);
        return;
      }
      const userData = JSON.parse(userStr);
      setUser(userData);
      loadChannels(userData.id);
    } catch (error) {
      console.error('Auth check failed:', error);
      router.replace('/login' as any);
    }
  };

  const loadChannels = async (userId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/channels/user/${userId}`);
      if (!response.ok) throw new Error('Failed to load channels');
      
      const data = await response.json() as { channels: Channel[] };
      setChannels(data.channels);
      
      // Auto-select first channel if available
      if (data.channels.length > 0 && !selectedChannel) {
        setSelectedChannel(data.channels[0].id);
      }

      // Check simulator status for all channels
      checkAllSimulatorStatus(data.channels);
    } catch (e: any) {
      setError(e.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const checkAllSimulatorStatus = async (channelList: Channel[]) => {
    const statusMap: Record<string, boolean> = {};
    
    await Promise.all(
      channelList.map(async (channel) => {
        try {
          const response = await fetch(`${API_BASE}/api/simulator/status/${channel.id}`);
          if (response.ok) {
            const data = await response.json();
            statusMap[channel.id] = data.running || false;
          }
        } catch (error) {
          console.error('Failed to check simulator status:', error);
        }
      })
    );

    setSimulatorStatus(statusMap);
  };

  const startSimulator = async (
    channelId: string, 
    writeApiKey: string, 
    transport: 'http' | 'mqtt' = 'http',
    mqttQos: 0 | 1 | 2 = 1
  ) => {
    try {
      const serverUrl = API_BASE.replace('localhost', '192.168.1.12');
      const mqttBrokerUrl = 'mqtt://192.168.1.12:1883';
      
      const response = await fetch(`${API_BASE}/api/simulator/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          writeApiKey,
          serverUrl,
          useMqtt: transport === 'mqtt',
          mqttBrokerUrl: transport === 'mqtt' ? mqttBrokerUrl : undefined,
          mqttQos: transport === 'mqtt' ? mqttQos : undefined,
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSimulatorStatus(prev => ({ ...prev, [channelId]: true }));
        const mode = transport === 'mqtt' ? `MQTT (QoS ${mqttQos})` : 'HTTP';
        Alert.alert(
          '✅ Simulator Started!', 
          `Simulator is now running in ${mode} mode.\n\nPID: ${data.pid}\nTransport: ${mode}`
        );
      } else {
        if (data.status === 'already_running') {
          Alert.alert('ℹ️ Already Running', 'Simulator is already running for this channel.');
        } else {
          Alert.alert('❌ Failed to Start', data.error || 'Could not start simulator');
        }
      }
    } catch (error: any) {
      Alert.alert('❌ Error', 'Failed to start simulator: ' + error.message);
    }
  };

  const stopSimulator = async (channelId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/simulator/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId })
      });

      const data = await response.json();

      if (response.ok) {
        setSimulatorStatus(prev => ({ ...prev, [channelId]: false }));
        Alert.alert('✅ Simulator Stopped', 'Simulator has been stopped for this channel.');
      } else {
        Alert.alert('❌ Failed to Stop', data.error || 'Could not stop simulator');
      }
    } catch (error: any) {
      Alert.alert('❌ Error', 'Failed to stop simulator: ' + error.message);
    }
  };

  const handleToggleSimulator = async (channel: Channel) => {
    const isRunning = simulatorStatus[channel.id];
    
    if (isRunning) {
      // Stop simulator
      Alert.alert(
        'Stop Simulator?',
        `Stop the simulator for "${channel.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Stop', style: 'destructive', onPress: () => stopSimulator(channel.id) }
        ]
      );
    } else {
      // Start simulator - Ask for transport mode
      Alert.alert(
        'Start Simulator',
        `Choose transport protocol for "${channel.name}":`,
        [
          { 
            text: 'HTTP (Original)', 
            onPress: () => startSimulator(channel.id, channel.writeApiKey || '', 'http')
          },
          { 
            text: 'MQTT QoS 0', 
            onPress: () => startSimulator(channel.id, channel.writeApiKey || '', 'mqtt', 0)
          },
          { 
            text: 'MQTT QoS 1 ⭐', 
            onPress: () => startSimulator(channel.id, channel.writeApiKey || '', 'mqtt', 1)
          },
          { 
            text: 'MQTT QoS 2', 
            onPress: () => startSimulator(channel.id, channel.writeApiKey || '', 'mqtt', 2)
          },
          { text: 'Cancel', style: 'cancel' }
        ],
        { cancelable: true }
      );
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    router.replace('/login' as any);
  };

  const handleCreateChannel = () => {
    router.push('/modal' as any);
  };

  const handleShowChannelInfo = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return;

    const copyBoth = async () => {
      const text = `CHANNEL_ID=${channel.id}\nWRITE_API_KEY=${channel.writeApiKey}`;
      await Clipboard.setStringAsync(text);
      Alert.alert('✅ Copied!', 'Channel ID and Write API Key copied to clipboard.\n\nYou can now paste them in your terminal to start the NodeMCU simulator.');
    };

    const copyChannelId = async () => {
      await Clipboard.setStringAsync(channel.id);
      Alert.alert('✅ Copied!', 'Channel ID copied to clipboard');
    };

    const copyWriteKey = async () => {
      await Clipboard.setStringAsync(channel.writeApiKey || '');
      Alert.alert('✅ Copied!', 'Write API Key copied to clipboard');
    };

    const copySimulatorCommand = async (mode: 'http' | 'mqtt' = 'http', qos: 0 | 1 | 2 = 1) => {
      const serverUrl = API_BASE.replace('localhost', '192.168.1.12');
      const mqttBrokerUrl = 'mqtt://192.168.1.12:1883';
      
      let command = `CHANNEL_ID=${channel.id} WRITE_API_KEY=${channel.writeApiKey} SERVER_URL=${serverUrl}`;
      
      if (mode === 'mqtt') {
        command += ` USE_MQTT=true MQTT_BROKER_URL=${mqttBrokerUrl} MQTT_QOS=${qos}`;
      }
      
      command += ` node simulator/nodemcu.js`;
      
      await Clipboard.setStringAsync(command);
      Alert.alert(
        '✅ Command Copied!', 
        `${mode === 'mqtt' ? `MQTT (QoS ${qos})` : 'HTTP'} simulator command copied!\n\nPaste in terminal to start.`,
        [{ text: 'OK' }]
      );
    };

    const showSimulatorInstructions = () => {
      const serverUrl = API_BASE.replace('localhost', '192.168.1.12');
      const mqttBrokerUrl = 'mqtt://192.168.1.12:1883';
      
      Alert.alert(
        '� Choose Command Type',
        'Select the transport protocol:',
        [
          {
            text: 'HTTP (Original)',
            onPress: () => Alert.alert(
              '�🔧 HTTP Simulator Command',
              `CHANNEL_ID=${channel.id}\n` +
              `WRITE_API_KEY=${channel.writeApiKey}\n` +
              `SERVER_URL=${serverUrl}\n` +
              `node simulator/nodemcu.js`,
              [
                { text: 'Copy', onPress: () => copySimulatorCommand('http') },
                { text: 'Close' }
              ]
            )
          },
          {
            text: 'MQTT QoS 0',
            onPress: () => Alert.alert(
              '🔧 MQTT QoS 0 Simulator Command',
              `USE_MQTT=true\n` +
              `MQTT_QOS=0\n` +
              `MQTT_BROKER_URL=${mqttBrokerUrl}\n` +
              `CHANNEL_ID=${channel.id}\n` +
              `WRITE_API_KEY=${channel.writeApiKey}\n` +
              `node simulator/nodemcu.js`,
              [
                { text: 'Copy', onPress: () => copySimulatorCommand('mqtt', 0) },
                { text: 'Close' }
              ]
            )
          },
          {
            text: 'MQTT QoS 1 ⭐',
            onPress: () => Alert.alert(
              '🔧 MQTT QoS 1 Simulator Command',
              `USE_MQTT=true\n` +
              `MQTT_QOS=1\n` +
              `MQTT_BROKER_URL=${mqttBrokerUrl}\n` +
              `CHANNEL_ID=${channel.id}\n` +
              `WRITE_API_KEY=${channel.writeApiKey}\n` +
              `node simulator/nodemcu.js`,
              [
                { text: 'Copy', onPress: () => copySimulatorCommand('mqtt', 1) },
                { text: 'Close' }
              ]
            )
          },
          {
            text: 'MQTT QoS 2',
            onPress: () => Alert.alert(
              '🔧 MQTT QoS 2 Simulator Command',
              `USE_MQTT=true\n` +
              `MQTT_QOS=2\n` +
              `MQTT_BROKER_URL=${mqttBrokerUrl}\n` +
              `CHANNEL_ID=${channel.id}\n` +
              `WRITE_API_KEY=${channel.writeApiKey}\n` +
              `node simulator/nodemcu.js`,
              [
                { text: 'Copy', onPress: () => copySimulatorCommand('mqtt', 2) },
                { text: 'Close' }
              ]
            )
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    };

    const isRunning = simulatorStatus[channelId];
    
    const handleStartStop = () => {
      if (isRunning) {
        stopSimulator(channelId);
      } else {
        startSimulator(channelId, channel.writeApiKey || '');
      }
    };

    Alert.alert(
      `📡 ${channel.name}`,
      `Channel ID:\n${channel.id}\n\nWrite API Key:\n${channel.writeApiKey}\n\nRead API Key:\n${channel.readApiKey}\n\nSimulator: ${isRunning ? '🟢 Running' : '🔴 Stopped'}`,
      [
        { 
          text: isRunning ? '⏸️ Stop Simulator' : '▶️ Start Simulator', 
          onPress: handleStartStop 
        },
        { text: '🚀 Copy Commands', onPress: showSimulatorInstructions },
        { text: '📋 Copy Channel ID', onPress: copyChannelId },
        { text: '📋 Copy Write Key', onPress: copyWriteKey },
        { text: '✕ Close', style: 'cancel' }
      ],
      { cancelable: true }
    );
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!user) return;
    
    // Get channel name for confirmation
    const channel = channels.find(c => c.id === channelId);
    const channelName = channel?.name || 'this channel';
    
    Alert.alert(
      'Delete Channel',
      `Are you sure you want to delete "${channelName}"? All sensor data will be permanently lost.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop simulator if running before deleting channel
              if (simulatorStatus[channelId]) {
                try {
                  await fetch(`${API_BASE}/api/simulator/stop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channelId })
                  });
                  setSimulatorStatus(prev => ({ ...prev, [channelId]: false }));
                } catch (simError) {
                  console.warn('Failed to stop simulator, but continuing with delete:', simError);
                }
              }

              const response = await fetch(`${API_BASE}/api/channels/${channelId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
              });

              if (!response.ok) throw new Error('Failed to delete channel');

              // Refresh channels
              loadChannels(user.id);
              
              // Clear selection if deleted channel was selected
              if (selectedChannel === channelId) {
                setSelectedChannel(null);
                setHistory([]);
              }
              
              Alert.alert('Success', 'Channel and simulator stopped (if running) successfully');
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete channel: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const latest = history[history.length - 1];
  const status = getAQIStatus(latest?.aqi);

  const fetchData = useCallback(async (opts: { showLoader?: boolean } = {}) => {
    if (!selectedChannel) return;
    try {
      if (opts.showLoader) setLoading(true);
      setError(null);
      const resp = await fetch(`${API_BASE}/api/channels/${selectedChannel}/readings?limit=${HISTORY_LIMIT}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { readings: Reading[] };
      // Normalize order -> ascending by timestamp
      const sorted = [...data.readings].sort((a: Reading, b: Reading) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setHistory(sorted.slice(-HISTORY_LIMIT));
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedChannel]);

  // Polling mode (only when WebSocket is disabled)
  useEffect(() => {
    if (selectedChannel && !useWebSocketMode) {
      fetchData({ showLoader: true });
      timerRef.current = setInterval(() => fetchData(), POLL_INTERVAL_MS);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else if (selectedChannel && useWebSocketMode) {
      // Initial load when switching to WebSocket mode
      fetchData({ showLoader: true });
    }
  }, [fetchData, selectedChannel, useWebSocketMode]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Refresh all data: channels, readings, and simulator status
    if (user) {
      loadChannels(user.id);
    }
    fetchData();
  }, [fetchData, user, loadChannels]);

  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  // Show login screen if not authenticated
  if (!user) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 16 }}>Checking authentication...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: status.color + '20', dark: status.color + '40' }}
      headerImage={
        <View style={[styles.headerStatusContainer, { backgroundColor: status.color }]}>
          <ThemedText type="title" style={styles.headerStatusText}>{status.label}</ThemedText>
          <ThemedText style={styles.headerSubText}>{latest ? new Date(latest.timestamp).toLocaleTimeString() : '—'}</ThemedText>
        </View>
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {/* User Info & Channel Selection */}
      <ThemedView style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="subtitle">Welcome, {user.username || user.email?.split('@')[0] || 'User'}!</ThemedText>
          <Pressable 
            onPress={handleLogout} 
            style={[
              styles.logoutButton,
              { backgroundColor: isDark ? '#4a1a1a' : '#ffe5e5' }
            ]}
          >
            <ThemedText style={{ fontSize: 12, color: '#e74c3c' }}>Logout</ThemedText>
          </Pressable>
        </View>

        <View style={styles.sectionHeaderRow}>
          <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>My Channels</ThemedText>
          <Pressable 
            onPress={() => user && loadChannels(user.id)} 
            style={[
              styles.refreshButton,
              { backgroundColor: isDark ? '#333' : '#ddd' }
            ]}
          >
            <ThemedText style={{ fontSize: 12 }}>🔄 Refresh</ThemedText>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.channelScrollView}>
          {channels.map((channel) => (
            <View key={channel.id} style={styles.channelCardWrapper}>
              <View
                style={[
                  styles.channelCard,
                  { 
                    backgroundColor: themeColors.background,
                    borderColor: selectedChannel === channel.id ? '#007AFF' : (colorScheme === 'dark' ? '#444' : '#ddd')
                  },
                  selectedChannel === channel.id && styles.channelCardSelected
                ]}
              >
                <View style={styles.channelCardHeader}>
                  <Pressable 
                    onPress={() => setSelectedChannel(channel.id)}
                    style={{ flex: 1 }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <ThemedText 
                        style={[
                          styles.channelName, 
                          selectedChannel === channel.id && styles.channelNameSelected
                        ]}
                        numberOfLines={1}
                      >
                        {channel.name}
                      </ThemedText>
                      <View 
                        style={[
                          styles.statusDot,
                          { backgroundColor: simulatorStatus[channel.id] ? '#28a745' : '#999' }
                        ]} 
                      />
                    </View>
                  </Pressable>
                  <Pressable 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleShowChannelInfo(channel.id);
                    }}
                    style={styles.menuButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <ThemedText style={{ fontSize: 20, fontWeight: 'bold', lineHeight: 20 }}>⋮</ThemedText>
                  </Pressable>
                </View>
                <Pressable onPress={() => setSelectedChannel(channel.id)}>
                  <ThemedText style={styles.channelDesc} numberOfLines={2}>
                    {channel.description || 'No description'}
                  </ThemedText>
                  <ThemedText style={styles.channelId}>
                    ID: {channel.id.substring(0, 20)}...
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.channelActions}>
                <Pressable 
                  onPress={() => handleToggleSimulator(channel)} 
                  style={[
                    styles.simulatorButton, 
                    simulatorStatus[channel.id] 
                      ? { backgroundColor: isDark ? '#4a1a1a' : '#ffe5e5', borderColor: '#e74c3c' }
                      : { backgroundColor: isDark ? '#1a3a1a' : '#e6f7e6', borderColor: '#28a745' }
                  ]}
                >
                  <ThemedText 
                    style={[
                      styles.simulatorButtonText,
                      { color: simulatorStatus[channel.id] ? '#e74c3c' : '#28a745' }
                    ]}
                  >
                    {simulatorStatus[channel.id] ? '⏸️ Stop' : '▶️ Start'}
                  </ThemedText>
                </Pressable>
                <Pressable 
                  onPress={() => handleDeleteChannel(channel.id)} 
                  style={styles.deleteButton}
                >
                  <ThemedText style={styles.deleteButtonText}>🗑️ Delete</ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
          <Pressable 
            onPress={handleCreateChannel} 
            style={[
              styles.addChannelCard,
              { backgroundColor: colorScheme === 'dark' ? '#1a1a1a' : '#f9f9f9' }
            ]}
          >
            <ThemedText style={styles.addChannelIcon}>+</ThemedText>
            <ThemedText style={styles.addChannelText}>Add Channel</ThemedText>
          </Pressable>
        </ScrollView>
      </ThemedView>

      {/* WebSocket Connection Status */}
      <ThemedView style={styles.section}>
        <View style={[styles.wsStatusContainer, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.statusDot, { backgroundColor: wsConnected ? '#28a745' : '#dc3545', width: 10, height: 10 }]} />
            <ThemedText style={{ fontSize: 13 }}>
              {useWebSocketMode ? (wsConnected ? 'WebSocket Connected' : 'WebSocket Disconnected') : 'HTTP Polling Mode'}
            </ThemedText>
          </View>
          <Pressable 
            onPress={() => setUseWebSocketMode(prev => !prev)}
            style={[styles.modeToggleButton, { backgroundColor: isDark ? '#444' : '#ddd' }]}
          >
            <ThemedText style={{ fontSize: 11 }}>{useWebSocketMode ? '📡 Switch to HTTP' : '🔌 Switch to WS'}</ThemedText>
          </Pressable>
        </View>
        {useWebSocketMode && wsConnected && (
          <View style={[styles.wsMetricsBox, { backgroundColor: isDark ? '#1a1a1a' : '#e8f5e9' }]}>
            <ThemedText style={{ fontSize: 11, opacity: 0.8 }}>
              📊 Latency: {wsMetrics.latency}ms | Messages: {wsMetrics.messagesReceived} | Data: {(wsMetrics.bytesReceived / 1024).toFixed(2)}KB
            </ThemedText>
          </View>
        )}
      </ThemedView>

      <ThemedView style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <ThemedText type="title">Live Air Quality</ThemedText>
          <Pressable onPress={() => fetchData({ showLoader: true })} style={styles.refreshButton}>
            <ThemedText style={{ fontSize: 12 }}>Refresh</ThemedText>
          </Pressable>
        </View>
        {loading && !history.length && (
          <View style={styles.centerRow}><ActivityIndicator /><ThemedText style={{ marginLeft: 8 }}>Loading...</ThemedText></View>
        )}
        {error && (
          <View style={styles.errorBox}>
            <ThemedText style={{ color: '#fff' }}>{error}</ThemedText>
            <Pressable onPress={() => fetchData({ showLoader: true })} style={styles.retryBtn}><ThemedText style={{ color: '#fff' }}>Retry</ThemedText></Pressable>
          </View>
        )}
        {!!latest && (
          <>
            <View style={styles.cardsRow}>
              <MetricCard title="AQI" value={latest.aqi} unit="" color={status.color} subtitle={status.label} />
              <MetricCard title="CO₂" value={latest.co2} unit="ppm" color="#e74c3c" />
              <MetricCard title="CO" value={latest.co} unit="ppm" color="#ff6b6b" />
              <MetricCard title="NO₂" value={latest.no2} unit="ppm" color="#f39c12" />
              <MetricCard title="Temp" value={latest.temperature} unit="°C" color="#3498db" />
              <MetricCard title="Humidity" value={latest.humidity} unit="%" color="#9b59b6" />
            </View>

            {/* Pollutant Sub-Indices */}
            {latest.co != null && latest.co2 != null && latest.no2 != null && (
              <View style={styles.subIndicesContainer}>
                <ThemedText type="defaultSemiBold" style={{ marginBottom: 8 }}>Pollutant Sub-Indices</ThemedText>
                <View style={styles.subIndicesRow}>
                  {(() => {
                    const aqiData = calculatePollutantAQI(latest.co, latest.co2, latest.no2);
                    const coStatus = getDetailedAQIStatus(aqiData.coAQI);
                    const co2Status = getDetailedAQIStatus(aqiData.co2AQI);
                    const no2Status = getDetailedAQIStatus(aqiData.no2AQI);
                    
                    return (
                      <>
                        <View style={[styles.subIndexCard, { borderColor: coStatus.color }]}>
                          <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>CO AQI</ThemedText>
                          <ThemedText type="title" style={{ color: coStatus.color }}>
                            {aqiData.coAQI.toFixed(0)}
                          </ThemedText>
                          <ThemedText style={{ fontSize: 10, color: coStatus.color }}>
                            {coStatus.label}
                            {aqiData.dominant === 'CO' && ' 🔴'}
                          </ThemedText>
                        </View>
                        <View style={[styles.subIndexCard, { borderColor: co2Status.color }]}>
                          <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>CO₂ AQI</ThemedText>
                          <ThemedText type="title" style={{ color: co2Status.color }}>
                            {aqiData.co2AQI.toFixed(0)}
                          </ThemedText>
                          <ThemedText style={{ fontSize: 10, color: co2Status.color }}>
                            {co2Status.label}
                            {aqiData.dominant === 'CO2' && ' 🔴'}
                          </ThemedText>
                        </View>
                        <View style={[styles.subIndexCard, { borderColor: no2Status.color }]}>
                          <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>NO₂ AQI</ThemedText>
                          <ThemedText type="title" style={{ color: no2Status.color }}>
                            {aqiData.no2AQI.toFixed(0)}
                          </ThemedText>
                          <ThemedText style={{ fontSize: 10, color: no2Status.color }}>
                            {no2Status.label}
                            {aqiData.dominant === 'NO2' && ' 🔴'}
                          </ThemedText>
                        </View>
                      </>
                    );
                  })()}
                </View>
                <ThemedText style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                  🔴 indicates dominant pollutant
                </ThemedText>
              </View>
            )}
          </>
        )}
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={{ marginBottom: 8 }}>AQI Gauge</ThemedText>
        <Gauge value={latest?.aqi} color={status.color} />
      </ThemedView>

      {/* Historical Data Analysis - Replaces old Trends section with comprehensive time-based analysis */}
      {selectedChannel && (
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Historical Data Analysis</ThemedText>
          <ThemedText style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
            View detailed historical data with hour/day/week/month filters
          </ThemedText>
          <HistoricalDataAnalysis
            channelId={selectedChannel}
            apiKey={channels.find(c => c.id === selectedChannel)?.readApiKey || ''}
            isDark={isDark}
          />
        </ThemedView>
      )}
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerStatusContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  headerStatusText: { fontWeight: '600' },
  headerSubText: { fontSize: 12 },
  section: { marginBottom: 24, gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoutButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  channelScrollView: {
    marginBottom: 12,
  },
  channelCardWrapper: {
    marginRight: 12,
  },
  channelCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  channelCardSelected: {
    borderWidth: 3,
  },
  channelCardHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  channelName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  menuButton: {
    padding: 6,
    marginLeft: 8,
    minWidth: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  channelNameSelected: {
    color: '#007AFF',
  },
  channelDesc: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 18,
  },
  channelId: {
    fontSize: 10,
    opacity: 0.5,
    fontFamily: 'monospace',
  },
  channelActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  simulatorButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#28a745',
  },
  simulatorButtonText: {
    color: '#28a745',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ff4444',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addChannelCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    width: 200,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addChannelIcon: {
    fontSize: 40,
    color: '#007AFF',
    marginBottom: 8,
  },
  addChannelText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 14,
  },
  centerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  errorBox: { backgroundColor: '#c0392b', padding: 12, borderRadius: 8, gap: 8 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: '#922b21', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '47%', borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  subIndicesContainer: { marginTop: 16, gap: 8 },
  subIndicesRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  subIndexCard: { flex: 1, borderWidth: 2, borderRadius: 8, padding: 12, alignItems: 'center', gap: 4 },
  wsStatusContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 8,
    marginBottom: 8,
  },
  modeToggleButton: { 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6 
  },
  wsMetricsBox: {
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
});
