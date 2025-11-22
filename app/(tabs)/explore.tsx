import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, ActivityIndicator, Pressable, useColorScheme } from 'react-native';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000';

interface PublicChannel {
  id: string;
  name: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    generalLocation: string;
  } | null;
  createdAt: string;
}

interface Reading {
  timestamp: string;
  aqi: number;
  co2: number;
  co: number;
  no2: number;
  temperature: number;
  humidity: number;
}

function getAQIStatus(aqi?: number) {
  if (aqi == null || isNaN(aqi)) return { label: 'Unknown', color: '#9E9E9E' };
  if (aqi <= 50) return { label: 'Good', color: '#2ecc71' };
  if (aqi <= 100) return { label: 'Moderate', color: '#f1c40f' };
  if (aqi <= 150) return { label: 'Unhealthy (SG)', color: '#e67e22' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#e74c3c' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: '#8e44ad' };
  return { label: 'Hazardous', color: '#7f0000' };
}

export default function PublicStationsScreen() {
  const [channels, setChannels] = useState<PublicChannel[]>([]);
  const [readings, setReadings] = useState<Record<string, Reading | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  const fetchPublicChannels = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/channels/public`);
      if (!response.ok) throw new Error('Failed to fetch public channels');
      
      const data = await response.json() as { channels: PublicChannel[] };
      setChannels(data.channels);
      
      // Fetch all readings in parallel for better performance
      await fetchAllReadings(data.channels);
      
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load public stations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAllReadings = async (channelsList: PublicChannel[]) => {
    try {
      // Fetch all readings in parallel instead of sequentially
      const readingPromises = channelsList.map(async (channel) => {
        try {
          const response = await fetch(`${API_BASE}/api/channels/${channel.id}/latest`);
          if (!response.ok) return { channelId: channel.id, reading: null };
          
          const data = await response.json() as { reading: Reading | null };
          return { channelId: channel.id, reading: data.reading };
        } catch (error) {
          console.error('Failed to fetch reading for channel', channel.id);
          return { channelId: channel.id, reading: null };
        }
      });

      // Wait for all readings to complete
      const results = await Promise.all(readingPromises);
      
      // Update all readings at once to trigger only one re-render
      const newReadings: Record<string, Reading | null> = {};
      results.forEach(({ channelId, reading }) => {
        newReadings[channelId] = reading;
      });
      
      setReadings(newReadings);
    } catch (error) {
      console.error('Failed to fetch readings:', error);
    }
  };

  useEffect(() => {
    fetchPublicChannels();
  }, []);

  // Separate effect for auto-refresh that depends on channels
  useEffect(() => {
    if (channels.length === 0) return;
    
    // Auto-refresh every 15 seconds - fetch all readings in parallel
    const interval = setInterval(() => {
      fetchAllReadings(channels);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [channels]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPublicChannels();
  }, []);

  // Memoize station cards to prevent unnecessary re-renders
  const stationCards = useMemo(() => {
    return channels.map((channel) => {
      const reading = readings[channel.id];
      const status = getAQIStatus(reading?.aqi);
      
      return (
        <ThemedView
          key={channel.id}
          style={[
            styles.stationCard,
            { 
              backgroundColor: themeColors.background,
              borderColor: isDark ? '#444' : '#ddd'
            }
          ]}
        >
          <View style={styles.stationHeader}>
            <View style={styles.stationTitleRow}>
              <View style={styles.stationIconName}>
                <View style={[styles.stationIcon, { backgroundColor: status.color + '20' }]}>
                  <ThemedText style={{ fontSize: 24 }}>🏭</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="defaultSemiBold" style={styles.stationName}>
                    {channel.name}
                  </ThemedText>
                  <ThemedText style={styles.stationLocation}>
                    📍 {channel.location?.generalLocation || 'Location not available'}
                  </ThemedText>
                </View>
              </View>
              {reading && (
                <View style={[styles.aqiBadge, { backgroundColor: status.color }]}>
                  <ThemedText style={styles.aqiBadgeText}>{reading.aqi}</ThemedText>
                </View>
              )}
            </View>
            {channel.description && (
              <ThemedText style={styles.stationDesc}>📝 {channel.description}</ThemedText>
            )}
          </View>

          {reading ? (
            <View style={styles.readingsGrid}>
              <View style={styles.readingItem}>
                <ThemedText style={styles.readingLabel}>🌤️ Air Status</ThemedText>
                <ThemedText style={[styles.readingValue, { color: status.color }]}>
                  {status.label}
                </ThemedText>
              </View>
              <View style={styles.readingItem}>
                <ThemedText style={styles.readingLabel}>☁️ CO₂</ThemedText>
                <ThemedText style={styles.readingValue}>
                  {reading.co2.toFixed(1)} <ThemedText style={styles.unit}>ppm</ThemedText>
                </ThemedText>
              </View>
              <View style={styles.readingItem}>
                <ThemedText style={styles.readingLabel}>🔥 CO</ThemedText>
                <ThemedText style={styles.readingValue}>
                  {reading.co.toFixed(2)} <ThemedText style={styles.unit}>ppm</ThemedText>
                </ThemedText>
              </View>
              <View style={styles.readingItem}>
                <ThemedText style={styles.readingLabel}>💨 NO₂</ThemedText>
                <ThemedText style={styles.readingValue}>
                  {reading.no2.toFixed(3)} <ThemedText style={styles.unit}>ppm</ThemedText>
                </ThemedText>
              </View>
              <View style={styles.readingItem}>
                <ThemedText style={styles.readingLabel}>🌡️ Temperature</ThemedText>
                <ThemedText style={styles.readingValue}>
                  {reading.temperature.toFixed(1)} <ThemedText style={styles.unit}>°C</ThemedText>
                </ThemedText>
              </View>
              <View style={styles.readingItem}>
                <ThemedText style={styles.readingLabel}>💧 Humidity</ThemedText>
                <ThemedText style={styles.readingValue}>
                  {reading.humidity.toFixed(1)} <ThemedText style={styles.unit}>%</ThemedText>
                </ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <ActivityIndicator size="small" />
              <ThemedText style={styles.noDataText}>Loading data...</ThemedText>
            </View>
          )}

          {reading && (
            <ThemedText style={styles.timestamp}>
              Last updated: {new Date(reading.timestamp).toLocaleTimeString()}
            </ThemedText>
          )}
        </ThemedView>
      );
    });
  }, [channels, readings, themeColors.background, isDark]);

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#4A90E2', dark: '#2C5F8D' }}
      headerImage={
        <View style={styles.headerContainer}>
          <IconSymbol
            size={80}
            color="#fff"
            name="globe"
            style={styles.headerIcon}
          />
          <ThemedText type="title" style={styles.headerTitle}>Public Air Quality Stations</ThemedText>
          <ThemedText style={styles.headerSubtitle}>Real-time data from community sensors</ThemedText>
        </View>
      }
      refreshing={refreshing}
      onRefresh={onRefresh}
    >

      {loading && channels.length === 0 ? (
        <ThemedView style={styles.centerContainer}>
          <ActivityIndicator size="large" />
          <ThemedText style={{ marginTop: 16 }}>Loading public stations...</ThemedText>
        </ThemedView>
      ) : error ? (
        <ThemedView style={styles.errorContainer}>
          <ThemedText style={{ color: '#e74c3c', marginBottom: 12 }}>{error}</ThemedText>
          <Pressable onPress={fetchPublicChannels} style={styles.retryButton}>
            <ThemedText style={{ color: '#fff' }}>Retry</ThemedText>
          </Pressable>
        </ThemedView>
      ) : channels.length === 0 ? (
        <ThemedView style={styles.emptyContainer}>
          <IconSymbol size={64} name="globe" color="#ccc" />
          <ThemedText type="subtitle" style={{ marginTop: 16 }}>No Public Stations Yet</ThemedText>
          <ThemedText style={{ textAlign: 'center', marginTop: 8, opacity: 0.7 }}>
            Public air quality monitoring stations will appear here.
          </ThemedText>
          <ThemedText style={{ textAlign: 'center', marginTop: 8, opacity: 0.7 }}>
            Create a channel and toggle "Make Public" to share your air quality data with the community!
          </ThemedText>
        </ThemedView>
      ) : (
        <ThemedView style={styles.section}>
            <ThemedText type="subtitle" style={{ marginBottom: 12 }}>
              {channels.length} Active Station{channels.length !== 1 ? 's' : ''}
            </ThemedText>
            
            {stationCards}
        </ThemedView>
      )}

      <ThemedView style={styles.infoBox}>
        <ThemedText style={styles.infoTitle}>🔒 Privacy & Security</ThemedText>
        <ThemedText style={styles.infoText}>
          • All stations are completely anonymous{'\n'}
          • Owner identity hidden from public view{'\n'}
          • Only general location (city/area) is shown{'\n'}
          • Exact coordinates are never displayed{'\n'}
          • No personal information or addresses shared
        </ThemedText>
        <ThemedText style={[styles.infoText, { marginTop: 8, fontSize: 11, fontStyle: 'italic' }]}>
          💡 General locations help you find air quality data for your neighborhood while protecting privacy!
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerIcon: {
    marginBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    fontSize: 14,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContainer: {
    padding: 24,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  section: {
    padding: 16,
  },
  stationCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stationHeader: {
    marginBottom: 12,
  },
  stationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stationIconName: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  stationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  stationName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  aqiBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  aqiBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stationLocation: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 4,
  },
  stationDesc: {
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  readingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  readingItem: {
    flex: 1,
    minWidth: '45%',
  },
  readingLabel: {
    fontSize: 11,
    opacity: 0.6,
    marginBottom: 2,
  },
  readingValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  unit: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 'normal',
  },
  noDataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  noDataText: {
    opacity: 0.6,
  },
  timestamp: {
    fontSize: 10,
    opacity: 0.5,
    textAlign: 'right',
  },
  infoBox: {
    margin: 16,
    padding: 16,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 226, 0.3)',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 18,
  },
});
