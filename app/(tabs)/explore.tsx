import { Image } from 'expo-image';
import { Platform, StyleSheet } from 'react-native';

import { Collapsible } from '@/components/ui/collapsible';
import { ExternalLink } from '@/components/external-link';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

export default function TabTwoScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>


      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={{
            fontFamily: Fonts.rounded,
          }}>
          About Air Quality
        </ThemedText>
      </ThemedView>
      <ThemedText>Learn about air quality monitoring and what the measurements mean for your health.</ThemedText>
      
      <Collapsible title="Air Quality Index (AQI)">
        <ThemedText>
          The AQI is calculated based on sensor readings from CO₂, temperature, and humidity levels.
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          <ThemedText type="defaultSemiBold">0-50 (Good):</ThemedText> Air quality is satisfactory. Safe for outdoor activities.
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">51-100 (Moderate):</ThemedText> Acceptable quality. Sensitive individuals should be cautious.
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">101-150 (Unhealthy for SG):</ThemedText> Sensitive groups may experience health effects.
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">151-200 (Unhealthy):</ThemedText> Everyone may begin to experience health effects.
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">201-300 (Very Unhealthy):</ThemedText> Health alert. Everyone may experience serious effects.
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">300+ (Hazardous):</ThemedText> Health warning. Emergency conditions.
        </ThemedText>
      </Collapsible>

      <Collapsible title="CO₂ Levels">
        <ThemedText>
          Carbon dioxide (CO₂) concentration is measured in parts per million (ppm).
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          <ThemedText type="defaultSemiBold">400-600 ppm:</ThemedText> Excellent air quality (outdoor levels)
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">600-1000 ppm:</ThemedText> Acceptable indoor air quality
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">1000-1500 ppm:</ThemedText> Poor ventilation, drowsiness possible
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">1500+ ppm:</ThemedText> Stale air, health concerns
        </ThemedText>
      </Collapsible>

      <Collapsible title="Temperature & Humidity">
        <ThemedText>
          Indoor comfort depends on both temperature and humidity levels.
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          <ThemedText type="defaultSemiBold">Optimal Temperature:</ThemedText> 20-26°C (68-79°F)
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          <ThemedText type="defaultSemiBold">Optimal Humidity:</ThemedText> 40-60%
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          Low humidity (&lt;40%) can cause dry skin and respiratory irritation. High humidity (&gt;60%) promotes mold growth and discomfort.
        </ThemedText>
      </Collapsible>

      <Collapsible title="How AQI is Calculated">
        <ThemedText>
          This IoT system calculates AQI by combining multiple sensor readings:
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          • <ThemedText type="defaultSemiBold">CO₂ levels</ThemedText> have the most significant impact on air quality
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          • <ThemedText type="defaultSemiBold">Temperature</ThemedText> affects comfort and air quality perception
        </ThemedText>
        <ThemedText style={{ marginTop: 4 }}>
          • <ThemedText type="defaultSemiBold">Humidity</ThemedText> influences both comfort and air quality
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          The algorithm weights these factors to produce a single AQI value that represents overall environmental quality.
        </ThemedText>
      </Collapsible>

      <Collapsible title="About This App">
        <ThemedText>
          This IoT-based air quality monitoring system provides real-time environmental data using sensor readings.
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          Built with React Native and Expo, the app displays live data from simulated IoT sensors with automatic updates every 15 seconds.
        </ThemedText>
        <ThemedText style={{ marginTop: 8 }}>
          Features include interactive charts, color-coded status indicators, and historical trend analysis.
        </ThemedText>
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});
