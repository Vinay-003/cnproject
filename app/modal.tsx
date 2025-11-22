import React, { useState } from 'react';
import { StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:3000';

export default function CreateChannelModal() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name) {
      Alert.alert('Error', 'Please enter a channel name');
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
          description
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

      Alert.alert(
        'Channel Created!',
        `Channel ID: ${data.channel.id}\nWrite API Key: ${data.channel.writeApiKey}\n\nUse these credentials in the NodeMCU simulator.`,
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
});
