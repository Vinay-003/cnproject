import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Dimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import Svg, { Polyline, Line, Text as SvgText, Circle } from 'react-native-svg';
import { Colors } from '@/constants/theme';
import { getAQIStatus } from '@/utils/aqiCalculator';

interface Reading {
  timestamp: string;
  aqi: number;
  co2: number;
  co: number;
  no2: number;
  temperature: number;
  humidity: number;
}

interface HistoricalDataProps {
  channelId: string;
  apiKey: string;
  isDark: boolean;
}

type TimeRange = 'hour' | 'day' | 'week' | 'month' | 'custom';

const HistoricalDataAnalysis: React.FC<HistoricalDataProps> = ({ channelId, apiKey, isDark }) => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('day');
  const [loading, setLoading] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'aqi' | 'co2' | 'co' | 'no2' | 'temperature' | 'humidity'>('aqi');
  const [stats, setStats] = useState<{
    min: number;
    max: number;
    avg: number;
    current: number;
  } | null>(null);

  const themeColors = {
    background: isDark ? Colors.dark.background : Colors.light.background,
    text: isDark ? Colors.dark.text : Colors.light.text,
    border: isDark ? '#444' : '#ddd',
  };

  useEffect(() => {
    fetchHistoricalData();
  }, [timeRange, channelId]);

  const fetchHistoricalData = async () => {
    setLoading(true);
    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000';
      
      // Calculate time range
      const now = new Date();
      let startTime: Date;
      
      switch (timeRange) {
        case 'hour':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const response = await fetch(
        `${API_BASE}/api/channels/${channelId}/readings?startTime=${startTime.toISOString()}&endTime=${now.toISOString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setReadings(data.readings || []);
        calculateStats(data.readings || []);
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Reading[]) => {
    if (data.length === 0) {
      setStats(null);
      return;
    }

    const values = data.map(r => r[selectedMetric] as number).filter(v => !isNaN(v));
    
    if (values.length === 0) {
      setStats(null);
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const current = values[values.length - 1];

    setStats({ min, max, avg, current });
  };

  useEffect(() => {
    if (readings.length > 0) {
      calculateStats(readings);
    }
  }, [selectedMetric, readings]);

  const renderChart = () => {
    if (readings.length === 0) {
      return (
        <View style={styles.emptyChart}>
          <ThemedText>No data available for selected time range</ThemedText>
        </View>
      );
    }

    const width = Dimensions.get('window').width - 60;
    const height = 200;
    const padding = { top: 20, right: 40, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const values = readings.map(r => r[selectedMetric] as number).filter(v => !isNaN(v));
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;

    const points = readings.map((reading, i) => {
      const value = reading[selectedMetric] as number;
      if (isNaN(value)) return null;
      
      const x = padding.left + (i / (readings.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
      return `${x},${y}`;
    }).filter(p => p !== null).join(' ');

    // Get color based on metric
    let color = '#2ecc71';
    if (selectedMetric === 'aqi') {
      const currentValue = values[values.length - 1];
      color = getAQIStatus(currentValue).color;
    } else if (selectedMetric === 'co2') {
      color = '#3498db';
    } else if (selectedMetric === 'temperature') {
      color = '#e74c3c';
    } else if (selectedMetric === 'humidity') {
      color = '#9b59b6';
    }

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={Math.max(width, readings.length * 20)} height={height}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartHeight * (1 - ratio);
            const value = minValue + range * ratio;
            return (
              <React.Fragment key={ratio}>
                <Line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke={isDark ? '#444' : '#e0e0e0'}
                  strokeWidth={1}
                  strokeDasharray="5,5"
                />
                <SvgText
                  x={padding.left - 10}
                  y={y + 5}
                  fontSize="10"
                  fill={themeColors.text}
                  textAnchor="end"
                >
                  {value.toFixed(0)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* X-axis */}
          <Line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight}
            stroke={themeColors.text}
            strokeWidth={2}
          />

          {/* Y-axis */}
          <Line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke={themeColors.text}
            strokeWidth={2}
          />

          {/* Data line */}
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
          />

          {/* Data points */}
          {readings.map((reading, i) => {
            const value = reading[selectedMetric] as number;
            if (isNaN(value)) return null;
            
            const x = padding.left + (i / (readings.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
            
            return (
              <Circle
                key={i}
                cx={x}
                cy={y}
                r={3}
                fill={color}
              />
            );
          })}

          {/* Time labels */}
          {readings.filter((_, i) => i % Math.ceil(readings.length / 6) === 0).map((reading, i, arr) => {
            const originalIndex = readings.findIndex(r => r.timestamp === reading.timestamp);
            const x = padding.left + (originalIndex / (readings.length - 1)) * chartWidth;
            const time = new Date(reading.timestamp);
            const label = timeRange === 'hour' 
              ? `${time.getHours()}:${time.getMinutes().toString().padStart(2, '0')}`
              : `${time.getMonth() + 1}/${time.getDate()}`;
            
            return (
              <SvgText
                key={i}
                x={x}
                y={padding.top + chartHeight + 20}
                fontSize="10"
                fill={themeColors.text}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          })}
        </Svg>
      </ScrollView>
    );
  };

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'aqi': return 'Air Quality Index';
      case 'co2': return 'CO₂ (ppm)';
      case 'co': return 'CO (ppm)';
      case 'no2': return 'NO₂ (ppm)';
      case 'temperature': return 'Temperature (°C)';
      case 'humidity': return 'Humidity (%)';
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>📊 Historical Data Analysis</ThemedText>

      {/* Time Range Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRangeContainer}>
        {(['hour', 'day', 'week', 'month'] as TimeRange[]).map((range) => (
          <Pressable
            key={range}
            onPress={() => setTimeRange(range)}
            style={[
              styles.timeRangeButton,
              {
                backgroundColor: timeRange === range ? '#2ecc71' : themeColors.background,
                borderColor: timeRange === range ? '#2ecc71' : themeColors.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.timeRangeText,
                { color: timeRange === range ? '#fff' : themeColors.text },
              ]}
            >
              {range === 'hour' ? 'Last Hour' : range === 'day' ? 'Last Day' : range === 'week' ? 'Last Week' : 'Last Month'}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {/* Metric Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricContainer}>
        {(['aqi', 'co2', 'co', 'no2', 'temperature', 'humidity'] as typeof selectedMetric[]).map((metric) => (
          <Pressable
            key={metric}
            onPress={() => setSelectedMetric(metric)}
            style={[
              styles.metricButton,
              {
                backgroundColor: selectedMetric === metric ? '#3498db' : themeColors.background,
                borderColor: selectedMetric === metric ? '#3498db' : themeColors.border,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.metricText,
                { color: selectedMetric === metric ? '#fff' : themeColors.text },
              ]}
            >
              {metric.toUpperCase()}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {/* Statistics */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
            <ThemedText style={styles.statLabel}>Min</ThemedText>
            <ThemedText style={styles.statValue}>{stats.min.toFixed(1)}</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
            <ThemedText style={styles.statLabel}>Avg</ThemedText>
            <ThemedText style={styles.statValue}>{stats.avg.toFixed(1)}</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
            <ThemedText style={styles.statLabel}>Max</ThemedText>
            <ThemedText style={styles.statValue}>{stats.max.toFixed(1)}</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
            <ThemedText style={styles.statLabel}>Current</ThemedText>
            <ThemedText style={styles.statValue}>{stats.current.toFixed(1)}</ThemedText>
          </View>
        </View>
      )}

      {/* Chart Title */}
      <ThemedText type="defaultSemiBold" style={styles.chartTitle}>
        {getMetricLabel()}
      </ThemedText>

      {/* Chart */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ThemedText>Loading historical data...</ThemedText>
        </View>
      ) : (
        renderChart()
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginBottom: 20,
  },
  title: {
    marginBottom: 16,
  },
  timeRangeContainer: {
    marginBottom: 12,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metricContainer: {
    marginBottom: 16,
  },
  metricButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chartTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyChart: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default HistoricalDataAnalysis;
