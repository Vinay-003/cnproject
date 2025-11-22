import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000';

export default function CreateChannelModal() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number; generalLocation: string } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loading, setLoading] = useState(false);

  // Get device location on mount if not already set
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed for public channels');
        return;
      }

      // Get current location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = currentLocation.coords;

      // Reverse geocode to get very detailed location
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      const address = addresses[0];
      
      // Build hyper-local location for better air quality monitoring
      // Format: "Street/Area, Neighborhood, District, City, State, Country"
      // Example: "Sector 21, Gandhinagar, Gujarat, India" -> "Near Plaza Road, Sector 21, Gandhinagar, Gujarat, India"
      const locationParts = [
        address.street || address.name,                          // Street or landmark name
        address.district || address.subregion,                   // Neighborhood/District
        address.city,                                            // City
        address.region,                                          // State/Region
        address.country                                          // Country
      ].filter(Boolean);
      
      const generalLocation = locationParts.join(', ');

      setLocation({
        latitude,
        longitude,
        generalLocation: generalLocation || 'Unknown Location'
      });
    } catch (error: any) {
      console.error('Location error:', error);
      Alert.alert('Location Error', 'Could not get your location. You can still create a private channel.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleCreate = async () => {
    if (!name) {
      Alert.alert('Error', 'Please enter a channel name');
      return;
    }

    if (isPublic && !location) {
      Alert.alert('Error', 'Location is required for public channels. Please wait or try again.');
      return;
    }

    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        Alert.alert('Error', 'Not logged in');
        return;
      }

      const user = JSON.parse(userStr);
      setLoading(true);

      const response = await fetch(`${API_BASE}/api/channels/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name,
          description,
          isPublic,
          location: isPublic ? location : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to create channel');
      }

      const data = await response.json() as { 
        channel: { 
          id: string; 
          writeApiKey: string; 
          readApiKey: string;
        } 
      };

      const visibilityMsg = isPublic 
        ? '\n\n🌍 This channel is PUBLIC. Anyone can view the air quality data (your identity remains anonymous).'
        : '\n\n🔒 This channel is PRIVATE. Only you can view the data.';

      Alert.alert(
        'Channel Created!',
        `Channel ID: ${data.channel.id}\nWrite API Key: ${data.channel.writeApiKey}${visibilityMsg}\n\nUse these credentials in the NodeMCU simulator.`,
        [
          { text: 'OK', onPress: () => router.back() }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>Create New Channel</ThemedText>
        <ThemedText style={styles.subtitle}>Set up a new monitoring channel for your IoT sensors</ThemedText>

        <ThemedView style={styles.form}>
          <ThemedText type="defaultSemiBold" style={styles.label}>Channel Name *</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="e.g., Living Room Monitor"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />

          <ThemedText type="defaultSemiBold" style={styles.label}>Description</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="e.g., Air quality monitoring with MQ-135 and DHT11"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            editable={!loading}
          />

          <ThemedView style={styles.switchRow}>
            <ThemedView style={styles.switchLabel}>
              <ThemedText type="defaultSemiBold">Make Public</ThemedText>
              <ThemedText style={styles.switchSubtext}>
                Allow anyone to view air quality data (your identity stays anonymous)
              </ThemedText>
            </ThemedView>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              disabled={loading}
            />
          </ThemedView>

          {isPublic && (
            <ThemedView style={styles.locationBox}>
              <ThemedText style={styles.locationLabel}>📍 Location</ThemedText>
              {loadingLocation ? (
                <ThemedView style={styles.locationLoading}>
                  <ActivityIndicator size="small" />
                  <ThemedText style={styles.locationText}>Getting location...</ThemedText>
                </ThemedView>
              ) : location ? (
                <ThemedView>
                  <ThemedText style={styles.locationText}>{location.generalLocation}</ThemedText>
                  <ThemedText style={styles.locationCoords}>
                    {location.latitude.toFixed(4)}°, {location.longitude.toFixed(4)}°
                  </ThemedText>
                  <Pressable onPress={getCurrentLocation} style={styles.refreshLocationBtn}>
                    <ThemedText style={styles.refreshLocationText}>🔄 Refresh Location</ThemedText>
                  </Pressable>
                </ThemedView>
              ) : (
                <Pressable onPress={getCurrentLocation} style={styles.getLocationBtn}>
                  <ThemedText style={styles.getLocationText}>📍 Get Current Location</ThemedText>
                </Pressable>
              )}
            </ThemedView>
          )}

          <Pressable 
            style={[styles.button, loading && styles.buttonDisabled]} 
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Create Channel</ThemedText>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} disabled={loading}>
            <ThemedText style={styles.cancelText}>Cancel</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
    fontSize: 14,
  },
  form: {
    gap: 16,
  },
  label: {
    marginBottom: -8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#666',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  switchLabel: {
    flex: 1,
  },
  switchSubtext: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  locationBox: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
  },
  locationLabel: {
    fontWeight: '600',
    marginBottom: 8,
  },
  locationLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 14,
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 11,
    opacity: 0.5,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  refreshLocationBtn: {
    paddingVertical: 6,
  },
  refreshLocationText: {
    fontSize: 12,
    color: '#007AFF',
  },
  getLocationBtn: {
    padding: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignItems: 'center',
  },
  getLocationText: {
    color: '#fff',
    fontSize: 14,
  },
});
