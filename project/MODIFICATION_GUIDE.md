# Sentinel Sole - Modification Guide

## 🎨 Easy Visual Customizations

### Change Colors
Edit the color scheme in any screen file:

```typescript
// Example: Change primary blue to green
const styles = StyleSheet.create({
  primaryButton: {
    backgroundColor: '#4CAF50', // Changed from '#2196F3'
  }
});
```

### Modify Mock Data
Update the sensor readings and user data:

```typescript
// In any screen file, find mockData object
const mockData = {
  currentTemp: 37.2, // Change temperature
  currentPressure: 920, // Change pressure
  user: {
    name: 'Your Name', // Change user name
  }
};
```

## 🔧 Functional Modifications

### 1. Add Real Sensor Integration
Replace mock data with real ThingSpeak API calls:

```typescript
// Add to any screen
useEffect(() => {
  const fetchSensorData = async () => {
    try {
      const response = await fetch('https://api.thingspeak.com/channels/YOUR_CHANNEL/feeds.json');
      const data = await response.json();
      // Update state with real data
    } catch (error) {
      console.error('Failed to fetch sensor data:', error);
    }
  };
  
  fetchSensorData();
  const interval = setInterval(fetchSensorData, 30000); // Update every 30 seconds
  return () => clearInterval(interval);
}, []);
```

### 2. Add Push Notifications
```bash
expo install expo-notifications
```

### 3. Add Real GPS Tracking
```bash
expo install expo-location
```

### 4. Add Data Storage
```bash
expo install expo-sqlite
```

## 📱 Platform-Specific Features

### Add Haptic Feedback (Mobile Only)
```typescript
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const triggerAlert = () => {
  if (Platform.OS !== 'web') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};
```

### Add Camera for QR Code Scanning
```typescript
import { CameraView } from 'expo-camera';
// Use for scanning device QR codes
```

## 🌐 Backend Integration

### Connect to ThingSpeak
1. Get your ThingSpeak API key
2. Replace mock data with real API calls
3. Add error handling for network issues

### Add User Authentication
```bash
expo install expo-auth-session expo-crypto
```

## 🎯 Specific Customizations

### Change Safe Zone Radius
```typescript
// In map.tsx
const mockData = {
  safeZone: {
    radius: 1.0, // Change from 0.5 to 1.0 km
  }
};
```

### Add New Alert Types
```typescript
// In any screen
const alerts = [
  { type: 'temperature', message: 'High temperature detected' },
  { type: 'pressure', message: 'Abnormal pressure reading' },
  { type: 'battery', message: 'Low sensor battery' }, // New alert type
];
```

### Customize Temperature Thresholds
```typescript
// In temperature.tsx
const getTemperatureStatus = (temp: number) => {
  if (temp >= 39.0) return 'fever';     // Adjust threshold
  if (temp > 37.8) return 'high';       // Adjust threshold
  if (temp < 35.5) return 'low';        // Adjust threshold
  return 'normal';
};
```

## 🚀 Advanced Features to Add

1. **Real-time Alerts**: WebSocket connection for instant notifications
2. **Data Export**: PDF/CSV generation for medical reports
3. **Multi-user Support**: Family/caregiver accounts
4. **Offline Mode**: Local data storage when internet is unavailable
5. **Voice Commands**: Accessibility features for elderly users
6. **Integration with Health Apps**: Apple Health, Google Fit
7. **Machine Learning**: Predictive health analytics

## 📋 Testing Your Changes

1. **Hot Reload**: Changes appear instantly while developing
2. **Device Testing**: Test on both iOS and Android
3. **Web Testing**: Test responsive design in browser
4. **Performance**: Monitor app performance with Flipper

## 🔒 Security Considerations

- Never store API keys in client code
- Use environment variables for sensitive data
- Implement proper user authentication
- Encrypt sensitive health data
- Follow HIPAA guidelines if applicable

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [ThingSpeak API Documentation](https://www.mathworks.com/help/thingspeak/)
- [Material Design Guidelines](https://material.io/design)