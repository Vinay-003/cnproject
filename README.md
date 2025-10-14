# Air Quality monitoring app

A React Native application for monitoring and visualizing air quality and environmental data.

## Overview

This air quality monitor is a cross-platform mobile application built with React Native and Expo that provides real-time monitoring of air quality metrics. The app displays current readings and historical trends for:

- Air Quality Index (AQI)
- CO₂ levels (ppm)
- Temperature (°C)
- Humidity (%)

## Features

- Real-time data visualization with automatic polling
- AQI status indicators with color coding
- Interactive gauge visualization
- Historical trend charts for all metrics
- Responsive design with light/dark mode support
- Pull-to-refresh functionality

## Technical Implementation

The application is built using:

- React Native / Expo
- TypeScript
- File-based routing
- SVG-based data visualizations
- Parallel scroll views with parallax effects

## Project Structure

```
WeatherMonitor/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx      # Home screen with main dashboard
│   │   ├── explore.tsx    # Exploration/info screen
│   │   └── _layout.tsx    # Tab navigation configuration
│   ├── _layout.tsx        # Root layout with theme provider
│   └── modal.tsx          # Modal screen component
├── components/
│   ├── themed-text.tsx
│   ├── themed-view.tsx
│   ├── parallax-scroll-view.tsx
│   └── ...
└── ...
```

## Data Flow

1. The app fetches air quality data from a configurable API endpoint
2. Data is polled at regular intervals (default: 15 seconds)
3. The UI updates in real-time with new readings
4. Historical data is stored and displayed as trend lines

## Setup and Development

1. Clone the repository
2. Install dependencies with `npm install`
3. Start the development server with `npm start`
4. Open on iOS, Android, or web using the Expo tools

## Environment Configuration

The application uses environment variables for configuration:

- `EXPO_PUBLIC_API_BASE`: Base URL for the API (defaults to http://localhost:3000)

## Future Improvements

- Add location-based monitoring
- Implement push notifications for unhealthy air quality alerts
- Add customizable thresholds and alert settings
- Expand historical data analysis

## License

[MIT License]