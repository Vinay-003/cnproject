import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, ScrollView, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import Svg, { Polyline, Circle } from 'react-native-svg';

// --- Types ---
interface Reading {
  timestamp: string; // ISO
  aqi: number; // Air Quality Index
  co2: number; // ppm
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

function formatTime(ts: string) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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

interface MiniLineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  min?: number;
  max?: number;
}
const MiniLineChart: React.FC<MiniLineChartProps> = ({
  data,
  width = 140,
  height = 60,
  color = '#2ecc71',
  strokeWidth = 2,
  backgroundColor = 'transparent',
  min,
  max,
}) => {
  if (!data.length) return <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}><ThemedText style={{ fontSize: 10 }}>No data</ThemedText></View>;
  const localMin = min ?? Math.min(...data);
  const localMax = max ?? Math.max(...data);
  const range = localMax - localMin || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 10) + 5; // padding
    const y = height - ((v - localMin) / range) * (height - 10) - 5;
    return `${x},${y}`;
  }).join(' ');
  const latest = data[data.length - 1];
  const latestX = (width - 10) + 5;
  const latestY = height - ((latest - localMin) / range) * (height - 10) - 5;
  return (
    <Svg width={width} height={height} style={{ backgroundColor }}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={latestX} cy={latestY} r={4} fill={color} />
    </Svg>
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

import { Path } from 'react-native-svg';
const PathWrapper: React.FC<{ d: string; stroke: string; strokeWidth: number }> = ({ d, stroke, strokeWidth }) => (
  <Path d={d} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
);

export default function HomeScreen() {
  const [history, setHistory] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const latest = history[history.length - 1];
  const status = getAQIStatus(latest?.aqi);

  const fetchData = useCallback(async (opts: { showLoader?: boolean } = {}) => {
    try {
      if (opts.showLoader) setLoading(true);
      setError(null);
      const resp = await fetch(API_ENDPOINT);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: Reading[] = await resp.json();
      // Normalize order -> ascending by timestamp
      const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setHistory(sorted.slice(-HISTORY_LIMIT));
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData({ showLoader: true });
    timerRef.current = setInterval(() => fetchData(), POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const series = useMemo(() => ({
    aqi: history.map(r => r.aqi),
    co2: history.map(r => r.co2),
    temp: history.map(r => r.temperature),
    hum: history.map(r => r.humidity),
    labels: history.map(r => formatTime(r.timestamp)),
  }), [history]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: status.color + '20', dark: status.color + '40' }}
      headerImage={
        <View style={[styles.headerStatusContainer, { backgroundColor: status.color }]}>
          <ThemedText type="title" style={styles.headerStatusText}>{status.label}</ThemedText>
          <ThemedText style={styles.headerSubText}>{latest ? new Date(latest.timestamp).toLocaleTimeString() : '—'}</ThemedText>
        </View>
      }
    >
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
          <View style={styles.cardsRow}>
            <MetricCard title="AQI" value={latest.aqi} unit="" color={status.color} subtitle={status.label} />
            <MetricCard title="CO₂" value={latest.co2} unit="ppm" color="#e74c3c" />
            <MetricCard title="Temp" value={latest.temperature} unit="°C" color="#3498db" />
            <MetricCard title="Humidity" value={latest.humidity} unit="%" color="#9b59b6" />
          </View>
        )}
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={{ marginBottom: 8 }}>AQI Gauge</ThemedText>
        <Gauge value={latest?.aqi} color={status.color} />
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={{ marginBottom: 8 }}>Trends</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          <View style={styles.chartCard}>
            <ThemedText style={styles.chartTitle}>AQI</ThemedText>
            <MiniLineChart data={series.aqi} color={status.color} />
          </View>
          <View style={styles.chartCard}>
            <ThemedText style={styles.chartTitle}>CO₂ (ppm)</ThemedText>
            <MiniLineChart data={series.co2} color="#e74c3c" />
          </View>
          <View style={styles.chartCard}>
            <ThemedText style={styles.chartTitle}>Temp (°C)</ThemedText>
            <MiniLineChart data={series.temp} color="#3498db" />
          </View>
          <View style={styles.chartCard}>
            <ThemedText style={styles.chartTitle}>Humidity (%)</ThemedText>
            <MiniLineChart data={series.hum} color="#9b59b6" />
          </View>
        </ScrollView>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
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
  refreshButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#ddd' },
  centerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  errorBox: { backgroundColor: '#c0392b', padding: 12, borderRadius: 8, gap: 8 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: '#922b21', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '47%', borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  chartCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#ccc', alignItems: 'center' },
  chartTitle: { marginBottom: 4, fontSize: 12 },
});
