import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, ShieldAlert, MapPin, Activity, Thermometer, Bell, AlertTriangle, RefreshCw, Navigation, Clock, Zap, Volume2, VolumeX } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';

import { fetchGpsData, clearThingSpeakCache } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alertManager, DangerZone } from '../../services/AlertManager';
import { notificationService, NotificationAlert } from '../../services/NotificationService';

// Legacy AlertItem type for compatibility
type AlertItem = NotificationAlert;

// Sensor Thresholds for monitoring
const TEMPERATURE_THRESHOLDS = {
  normal: { min: 35.0, max: 37.5 },
  warning: { min: 37.6, max: 38.5 },
  critical: { min: 38.6 },
  low: { max: 34.9 }
};

const PRESSURE_THRESHOLDS = {
  normal: { min: 800, max: 1050 },
  warning: { min: 750, max: 1100 },
  critical: { max: 749, min: 1101 }
};

// GPS offline threshold (5 minutes)
const GPS_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;


export default function DashboardScreen() {
  const navigation = useNavigation();

  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dangerStatus, setDangerStatus] = useState<string>('Checking...');
  const [dangerDistance, setDangerDistance] = useState<number>(0);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<NotificationAlert[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('N/A');
  const [currentLocationName, setCurrentLocationName] = useState<string>('Loading...');
  const [deviceLocation, setDeviceLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [alertIntensity, setAlertIntensity] = useState<string>('medium');
  const [isLocationCached, setIsLocationCached] = useState<boolean>(false);

  // Refs for managing intervals, app state, and preventing duplicate calls
  const dataFetchInterval = useRef<NodeJS.Timeout | null>(null);
  const appState = useRef(AppState.currentState);
  const isFetchingData = useRef<boolean>(false);
  const isRequestingLocation = useRef<boolean>(false);
  const lastLocationRequest = useRef<number>(0);
  const LOCATION_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // --- Utility Functions ---

  // Calculate distance between two coordinates
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Radius of Earth in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  }, []);

  // Load cached device location from AsyncStorage
  const loadCachedLocation = useCallback(async () => {
    try {
      const cachedLocation = await AsyncStorage.getItem('@device_location');
      const cachedTimestamp = await AsyncStorage.getItem('@device_location_timestamp');

      if (cachedLocation && cachedTimestamp) {
        const timestamp = parseInt(cachedTimestamp, 10);
        const now = Date.now();

        // Use cached location if it's less than 5 minutes old
        if (now - timestamp < LOCATION_CACHE_DURATION) {
          const location = JSON.parse(cachedLocation);
          setDeviceLocation(location);
          setIsLocationCached(true);
          console.log('Using cached device location:', location);
          return location;
        }
      }
    } catch (error) {
      console.error('Error loading cached location:', error);
    }
    return null;
  }, []);

  // Save device location to AsyncStorage
  const saveCachedLocation = useCallback(async (location: {latitude: number, longitude: number}) => {
    try {
      await AsyncStorage.setItem('@device_location', JSON.stringify(location));
      await AsyncStorage.setItem('@device_location_timestamp', Date.now().toString());
      console.log('Device location cached successfully');
    } catch (error) {
      console.error('Error caching location:', error);
    }
  }, []);

  // Get device location with caching and debouncing
  const getDeviceLocation = useCallback(async (forceRefresh: boolean = false) => {
    // Prevent duplicate location requests
    if (isRequestingLocation.current && !forceRefresh) {
      console.log('Location request already in progress, skipping...');
      return deviceLocation;
    }

    // Check if we have a recent cached location and don't need to refresh
    if (!forceRefresh && deviceLocation && isLocationCached) {
      const timeSinceLastRequest = Date.now() - lastLocationRequest.current;
      if (timeSinceLastRequest < LOCATION_CACHE_DURATION) {
        console.log('Using existing cached device location');
        return deviceLocation;
      }
    }

    isRequestingLocation.current = true;
    lastLocationRequest.current = Date.now();

    try {
      console.log('Requesting fresh device location...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        isRequestingLocation.current = false;
        return deviceLocation; // Return cached location if available
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Use balanced instead of high for better performance
        maximumAge: 60000, // Accept location up to 1 minute old
      });

      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setDeviceLocation(newLocation);
      setIsLocationCached(true);
      await saveCachedLocation(newLocation);

      console.log('Fresh device location obtained:', newLocation);
      return newLocation;

    } catch (error) {
      console.error('Error getting device location:', error);
      return deviceLocation; // Return cached location if available
    } finally {
      isRequestingLocation.current = false;
    }
  }, [deviceLocation, isLocationCached, saveCachedLocation]);

  // Get address from coordinates
  const getAddressFromCoords = useCallback(async (latitude: number, longitude: number) => {
    try {
      const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geocode.length > 0) {
        const { name, street, city, region } = geocode[0];
        return `${name || street || ''}, ${city || ''}, ${region || ''}`.trim() || 'Unknown Location';
      }
      return 'Unknown Location';
    } catch (error) {
      console.error('Error getting address:', error);
      return 'Unknown Location';
    }
  }, []);

  // Get short location name for display
  const getShortLocationName = useCallback((address: string) => {
    if (!address || address === 'Unknown Location') return 'Unknown Location';
    const parts = address.split(',');
    return parts[0]?.trim() || 'Unknown Location';
  }, []);

  // Temperature status determination
  const getTemperatureStatus = useCallback((temperature: number | null) => {
    if (temperature === null || temperature === undefined) return 'unknown';
    if (temperature < TEMPERATURE_THRESHOLDS.low.max) return 'low';
    if (temperature >= TEMPERATURE_THRESHOLDS.critical.min) return 'critical';
    if (temperature >= TEMPERATURE_THRESHOLDS.warning.min && temperature <= TEMPERATURE_THRESHOLDS.warning.max) return 'warning';
    if (temperature >= TEMPERATURE_THRESHOLDS.normal.min && temperature <= TEMPERATURE_THRESHOLDS.normal.max) return 'normal';
    return 'unknown';
  }, []);

  // Pressure status determination
  const getPressureStatus = useCallback((pressure: number | null) => {
    if (pressure === null || pressure === undefined) return 'unknown';
    if (pressure < PRESSURE_THRESHOLDS.critical.max || pressure > PRESSURE_THRESHOLDS.critical.min) return 'critical';
    if (pressure < PRESSURE_THRESHOLDS.warning.min || pressure > PRESSURE_THRESHOLDS.warning.max) return 'warning';
    if (pressure >= PRESSURE_THRESHOLDS.normal.min && pressure <= PRESSURE_THRESHOLDS.normal.max) return 'normal';
    return 'unknown';
  }, []);

  // Get status color for UI
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'critical': return '#F44336'; // Red
      case 'warning': return '#FF9800';  // Orange
      case 'low': return '#2196F3';      // Blue
      case 'normal': return '#4CAF50';   // Green
      default: return '#9E9E9E';         // Gray for unknown
    }
  }, []);

  // Check danger zones status
  const checkDangerZones = useCallback((latitude: number, longitude: number, zones: DangerZone[]) => {
    let closestZone = null;
    let closestDistance = Infinity;
    let currentStatus = "Safe";

    if (zones.length === 0) {
      return { status: "Safe (No Danger Zones)", distance: 0 };
    }

    for (const zone of zones) {
      const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestZone = zone;
      }

      // Check if inside danger zone
      if (distance <= zone.radius) {
        const zoneName = zone.name || `Zone ${zone.id}`;
        currentStatus = `⚠️ INSIDE ${zoneName.toUpperCase()}`;
        break;
      }
      // Check if near danger zone (within 100m of boundary)
      else if (distance <= zone.radius + 100) {
        if (!currentStatus.startsWith("⚠️ INSIDE")) {
          const zoneName = zone.name || `Zone ${zone.id}`;
          currentStatus = `⚠️ APPROACHING ${zoneName.toUpperCase()}`;
        }
      }
    }

    if (currentStatus === "Safe" && closestZone) {
      const zoneName = closestZone.name || `Zone ${closestZone.id}`;
      currentStatus = `✅ Safe (${zoneName}: ${(closestDistance/1000).toFixed(1)}km away)`;
    }

    return { status: currentStatus, distance: closestDistance };
  }, [calculateDistance]);

  // Load danger zones from storage
  const loadDangerZones = useCallback(async () => {
    try {
      const storedZones = await AsyncStorage.getItem('@danger_zones');
      if (storedZones !== null) {
        const zones = JSON.parse(storedZones);
        setDangerZones(zones);
        console.log(`Loaded ${zones.length} danger zones`);
      } else {
        setDangerZones([]);
      }
    } catch (e) {
      console.error("Error loading danger zones:", e);
      setDangerZones([]);
    }
  }, []);

  // Initialize notification service and handle app state changes
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await notificationService.initialize();
        console.log('Notification service initialized');
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();

    // Optimized app state change handling
    const handleAppStateChange = (nextAppState: string) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App has come to the foreground - checking for stale data');

        // Check if location data is stale (older than cache duration)
        const timeSinceLastRequest = Date.now() - lastLocationRequest.current;
        if (timeSinceLastRequest > LOCATION_CACHE_DURATION) {
          console.log('Location data is stale, requesting fresh location');
          getDeviceLocation(true);
        }

        // Only refresh data if it's not currently being fetched
        if (!isFetchingData.current) {
          getData();
        }
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
      notificationService.cleanup();
      // Clear any pending requests
      isFetchingData.current = false;
      isRequestingLocation.current = false;
    };
  }, [getData, getDeviceLocation]);

  // Toggle notifications
  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled(prev => {
      const newValue = !prev;
      notificationService.updateConfig({
        enableHaptics: newValue,
        enableAudio: newValue,
        enableVisual: newValue
      });
      return newValue;
    });
  }, []);

  // Optimized data fetching with proper debouncing and caching
  const getData = useCallback(async () => {
    // Prevent duplicate API calls
    if (isFetchingData.current) {
      console.log('Data fetch already in progress, skipping...');
      return;
    }

    isFetchingData.current = true;
    if (!refreshing) setLoading(true);

    let fetchedData: GpsData | null = null;
    let finalLocation = null;

    try {
      // Fetch GPS data from ThingSpeak with caching
      console.log("Fetching GPS data from ThingSpeak...");
      fetchedData = await fetchGpsData(refreshing); // Force refresh only on manual refresh
      console.log("Dashboard: Fetched GPS data:", fetchedData);

      // Determine location to use (sensor GPS or cached device GPS)
      if (fetchedData && fetchedData.latitude !== 0 && fetchedData.longitude !== 0) {
        finalLocation = {
          latitude: fetchedData.latitude,
          longitude: fetchedData.longitude
        };
        console.log("Using sensor GPS location");
      } else {
        // Use cached device location as fallback (don't request new location every time)
        if (deviceLocation) {
          finalLocation = deviceLocation;
          console.log("Using cached device GPS location");
        } else {
          // Only request device location if we don't have a cached one
          console.log("No cached device location, requesting fresh location...");
          const deviceLoc = await getDeviceLocation(false);
          if (deviceLoc) {
            finalLocation = deviceLoc;
            console.log("Using fresh device GPS location");
          }
        }
      }

      if (finalLocation) {
        // Update GPS data with final location
        const updatedData = fetchedData ? {
          ...fetchedData,
          latitude: finalLocation.latitude,
          longitude: finalLocation.longitude
        } : {
          createdAt: new Date().toISOString(),
          entryId: 0,
          latitude: finalLocation.latitude,
          longitude: finalLocation.longitude,
          distance: 0,
          status: 'unknown',
          temperature: undefined,
          pressure: undefined
        } as GpsData;

        setGpsData(updatedData);
        setError(null);

        // Get address and update location name (with caching to avoid repeated geocoding)
        if (!updatedData.address || refreshing) {
          const address = await getAddressFromCoords(finalLocation.latitude, finalLocation.longitude);
          setGpsData(prev => prev ? { ...prev, address } : null);
          setCurrentLocationName(getShortLocationName(address));
        }

        setLastUpdate(new Date().toLocaleTimeString());
      } else {
        throw new Error("No location data available");
      }

    } catch (err) {
      setError("Failed to fetch sensor data");
      setCurrentLocationName("Location unavailable");
      console.error("Dashboard error:", err);
    }

    // Process alerts using the AlertManager
    try {
      const alerts = await alertManager.processAlerts(fetchedData, dangerZones, deviceLocation);
      setActiveAlerts(alerts);

      // Update danger status from alerts
      const dangerAlert = alerts.find(alert => alert.type === 'danger_zone');
      if (dangerAlert) {
        setDangerStatus(dangerAlert.message);
        setDangerDistance(dangerAlert.distance || 0);
      } else {
        setDangerStatus(dangerZones.length > 0 ? '✅ Safe (No immediate threats)' : '✅ Safe (No danger zones configured)');
        setDangerDistance(0);
      }

    } catch (alertError) {
      console.error("Error processing alerts:", alertError);
    } finally {
      setLoading(false);
      setRefreshing(false);
      isFetchingData.current = false;
    }
  }, [dangerZones, getDeviceLocation, getAddressFromCoords, getShortLocationName, refreshing, deviceLocation]);

  // Handle manual refresh with cache clearing and location update
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Clear caches on manual refresh
    clearThingSpeakCache();
    // Force refresh device location on manual refresh
    await getDeviceLocation(true);
    getData();
  }, [getData, getDeviceLocation]);

  // Export functionality removed per user request

  // Navigate to map screen
  const handleViewMap = useCallback(() => {
    // @ts-ignore - Navigation type issue
    navigation.navigate('map');
  }, [navigation]);

  // Initialize cached location and danger zones when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Dashboard screen focused: Loading danger zones and cached location...');
      loadDangerZones();
      loadCachedLocation();
      return () => {
        console.log('Dashboard screen unfocused.');
      };
    }, [loadDangerZones, loadCachedLocation])
  );

  // Optimized data fetching with proper interval management
  useEffect(() => {
    // Initial setup: load cached location and get fresh data
    const initializeData = async () => {
      await loadCachedLocation();
      // Get fresh device location if no cached location or if it's old
      if (!deviceLocation || !isLocationCached) {
        await getDeviceLocation(false);
      }
      getData(); // Initial fetch
    };

    initializeData();

    return () => {
      // Cleanup on unmount
      if (dataFetchInterval.current) {
        clearInterval(dataFetchInterval.current);
        dataFetchInterval.current = null;
      }
      isFetchingData.current = false;
    };
  }, []); // Only run once on mount

  // Separate effect for managing update intervals based on alert levels
  useEffect(() => {
    // Clear any existing interval
    if (dataFetchInterval.current) {
      clearInterval(dataFetchInterval.current);
      dataFetchInterval.current = null;
    }

    // Set up dynamic interval based on alert level
    const getUpdateInterval = () => {
      const criticalAlerts = activeAlerts.filter(alert => alert.level === 'critical');
      const warningAlerts = activeAlerts.filter(alert => alert.level === 'warning');

      if (criticalAlerts.length > 0) {
        console.log('Setting critical alert interval: 5 seconds');
        return 5000;  // 5 seconds for critical alerts
      }
      if (warningAlerts.length > 0) {
        console.log('Setting warning alert interval: 8 seconds');
        return 8000;  // 8 seconds for warning alerts
      }
      console.log('Setting normal interval: 10 seconds');
      return 10000; // 10 seconds for normal operation
    };

    const interval = getUpdateInterval();
    dataFetchInterval.current = setInterval(() => {
      if (!isFetchingData.current) {
        getData();
      }
    }, interval);

    return () => {
      if (dataFetchInterval.current) {
        clearInterval(dataFetchInterval.current);
        dataFetchInterval.current = null;
      }
    };
  }, [activeAlerts, getData]); // Re-run when alert levels change

  // Determine safety status for UI styling
  const isCurrentlyInSafeZone = dangerStatus.includes('✅ Safe') || dangerStatus.includes('Safe (No Danger Zones)');
  const isInDangerZone = dangerStatus.includes('INSIDE');
  const isApproachingDangerZone = dangerStatus.includes('APPROACHING');


  if (loading && gpsData === null && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading dashboard data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Smart Footwear</Text>
            <Text style={styles.subtitle}>Real-time Monitoring</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <RefreshCw size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.notificationToggle, !notificationsEnabled && styles.notificationDisabled]}
              onPress={toggleNotifications}
            >
              {notificationsEnabled ? (
                <Volume2 size={20} color="#2196F3" />
              ) : (
                <VolumeX size={20} color="#999" />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.notificationButton}>
              <Bell size={24} color="#666" />
              {activeAlerts.length > 0 && (
                <View style={[
                  styles.notificationBadge,
                  activeAlerts.some(alert => alert.level === 'critical') && styles.criticalBadge
                ]}>
                  <Text style={styles.notificationBadgeText}>{activeAlerts.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <AlertTriangle size={20} color="#F44336" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Safety Status Card */}
        <View style={[
          styles.statusCard,
          isInDangerZone ? styles.dangerStatus :
          isApproachingDangerZone ? styles.warningStatus :
          styles.safeStatus
        ]}>
          <View style={styles.statusHeader}>
            {isInDangerZone ? (
              <ShieldAlert size={28} color="#F44336" />
            ) : isApproachingDangerZone ? (
              <AlertTriangle size={28} color="#FF9800" />
            ) : (
              <Shield size={28} color="#4CAF50" />
            )}
            <View style={styles.statusHeaderText}>
              <Text style={styles.statusTitle}>Safety Status</Text>
              <Text style={styles.statusTime}>Updated {lastUpdate}</Text>
            </View>
          </View>

          <Text style={[
            styles.statusText,
            isInDangerZone ? styles.dangerText :
            isApproachingDangerZone ? styles.warningText :
            styles.safeText
          ]}>
            {dangerStatus}
          </Text>

          {dangerDistance > 0 && (
            <View style={styles.distanceInfo}>
              <MapPin size={16} color="#666" />
              <Text style={styles.distanceText}>
                Distance: {(dangerDistance/1000).toFixed(2)} km ({dangerDistance.toFixed(0)}m)
              </Text>
            </View>
          )}
        </View>

        {/* Current Location Card */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <Navigation size={24} color="#2196F3" />
            <Text style={styles.locationTitle}>Current Location</Text>
          </View>
          <Text style={styles.locationName}>{currentLocationName}</Text>
          {gpsData && (
            <View style={styles.coordinatesContainer}>
              <Text style={styles.coordinates}>
                📍 {gpsData.latitude.toFixed(6)}°, {gpsData.longitude.toFixed(6)}°
              </Text>
            </View>
          )}
        </View>

        {/* Live Sensor Data */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Live Sensor Data</Text>
          <View style={styles.sensorGrid}>
            <View style={styles.sensorCard}>
              <MapPin size={20} color="#2196F3" />
              <Text style={styles.sensorLabel}>Location</Text>
              <Text style={styles.sensorValue}>
                {gpsData?.latitude?.toFixed(4) || 'N/A'}°N
              </Text>
              <Text style={styles.sensorValue}>
                {gpsData?.longitude?.toFixed(4) || 'N/A'}°W
              </Text>
            </View>

            <View style={styles.sensorCard}>
              <Activity size={20} color="#FF9800" />
              <Text style={styles.sensorLabel}>Pressure</Text>
              <Text style={styles.sensorValue}>
                {gpsData?.pressure !== undefined ? gpsData.pressure.toFixed(0) : 'N/A'}
              </Text>
              <Text style={styles.sensorUnit}>FSR</Text>
              <Text style={styles.sensorStatus}>
                MONITORING
              </Text>
            </View>

            <View style={styles.sensorCard}>
              <Thermometer size={20} color="#F44336" />
              <Text style={styles.sensorLabel}>Temperature</Text>
              <Text style={[styles.sensorValue, { color: getStatusColor(getTemperatureStatus(gpsData?.temperature || null)) }]}>
                {gpsData?.temperature !== undefined ? `${gpsData.temperature.toFixed(1)}°C` : 'N/A'}
              </Text>
              <Text style={[styles.sensorStatus, { color: getStatusColor(getTemperatureStatus(gpsData?.temperature || null)) }]}>
                {getTemperatureStatus(gpsData?.temperature || null).toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Real-time Status Info */}
          <View style={styles.updateInfo}>
            <Clock size={16} color="#666" />
            <Text style={styles.updateText}>Last updated: {lastUpdate}</Text>
            <View style={[styles.statusIndicator, {
              backgroundColor: loading ? '#FF9800' :
                              activeAlerts.some(alert => alert.level === 'critical') ? '#F44336' :
                              activeAlerts.some(alert => alert.level === 'warning') ? '#FF9800' : '#4CAF50'
            }]} />
            <Text style={styles.statusText}>
              {loading ? 'Updating...' :
               activeAlerts.some(alert => alert.level === 'critical') ? 'Critical' :
               activeAlerts.some(alert => alert.level === 'warning') ? 'Warning' : 'Normal'}
            </Text>
          </View>

          {/* Alert Intensity Indicator */}
          {dangerDistance > 0 && dangerDistance <= 200 && (
            <View style={styles.intensityIndicator}>
              <Text style={styles.intensityLabel}>Alert Intensity:</Text>
              <View style={styles.intensityBar}>
                <View style={[
                  styles.intensityFill,
                  {
                    width: `${Math.max(10, 100 - (dangerDistance / 200) * 100)}%`,
                    backgroundColor: dangerDistance <= 50 ? '#F44336' :
                                   dangerDistance <= 100 ? '#FF9800' : '#2196F3'
                  }
                ]} />
              </View>
              <Text style={styles.intensityText}>
                {dangerDistance <= 50 ? 'MAXIMUM' :
                 dangerDistance <= 100 ? 'HIGH' :
                 dangerDistance <= 200 ? 'MEDIUM' : 'LOW'}
              </Text>
            </View>
          )}
        </View>

        {/* Active Alerts */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Alerts</Text>
            {activeAlerts.length > 0 && (
              <View style={styles.alertCount}>
                <Text style={styles.alertCountText}>{activeAlerts.length}</Text>
              </View>
            )}
          </View>

          {activeAlerts.length > 0 ? (
            activeAlerts.map((alert, index) => (
              <View key={`${alert.id}-${index}`} style={[
                styles.alertItem,
                alert.level === 'critical' ? styles.criticalAlert :
                alert.level === 'warning' ? styles.warningAlert : styles.infoAlert
              ]}>
                <View style={styles.alertLeft}>
                  <View style={[styles.alertDot, { backgroundColor: getAlertColor(alert.level) }]} />
                  <View style={styles.alertContent}>
                    <Text style={styles.alertMessage}>{alert.message}</Text>
                    <View style={styles.alertMeta}>
                      <Text style={styles.alertTime}>
                        {getTimeAgo(alert.timestamp)}
                      </Text>
                      {alert.distance && (
                        <Text style={styles.alertDistance}>
                          • {(alert.distance/1000).toFixed(1)}km away
                        </Text>
                      )}
                      {alert.value && alert.threshold && (
                        <Text style={styles.alertValue}>
                          • {alert.value.toFixed(1)} (threshold: {alert.threshold})
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.alertRight}>
                  {alert.level === 'critical' && (
                    <View style={styles.alertIcon}>
                      <Zap size={16} color="#F44336" />
                    </View>
                  )}
                  {alert.level === 'warning' && (
                    <View style={styles.alertIcon}>
                      <AlertTriangle size={16} color="#FF9800" />
                    </View>
                  )}
                  {alert.level === 'info' && (
                    <View style={styles.alertIcon}>
                      <Bell size={16} color="#2196F3" />
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noAlertsContainer}>
              <Shield size={32} color="#4CAF50" />
              <Text style={styles.noAlertsText}>All systems normal</Text>
              <Text style={styles.noAlertsSubtext}>
                {notificationsEnabled ?
                  'No active alerts • Notifications enabled' :
                  'No active alerts • Notifications disabled'
                }
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={[styles.actionButton, styles.fullWidthButton]} onPress={handleViewMap}>
              <MapPin size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>View Full Map</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper functions for alerts
const getAlertColor = (level: string) => {
  switch (level) {
    case 'critical': return '#F44336';
    case 'warning': return '#FF9800';
    case 'info': return '#2196F3';
    default: return '#9E9E9E';
  }
};

const getTimeAgo = (timestamp: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
    marginRight: 8,
  },
  notificationToggle: {
    padding: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  notificationDisabled: {
    backgroundColor: '#E0E0E0',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
  },
  criticalBadge: {
    backgroundColor: '#D32F2F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  notificationBadgeText: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    color: '#FFFFFF',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#D32F2F',
    flex: 1,
    marginLeft: 12,
  },
  retryButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryButtonText: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  safeStatus: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  warningStatus: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  dangerStatus: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontFamily: 'Roboto-Medium',
    color: '#333',
  },
  statusTime: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 2,
  },
  statusText: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    marginBottom: 12,
  },
  safeText: {
    color: '#4CAF50',
  },
  warningText: {
    color: '#FF9800',
  },
  dangerText: {
    color: '#F44336',
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  distanceText: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginLeft: 6,
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginLeft: 8,
  },
  locationName: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 8,
  },
  coordinatesContainer: {
    marginTop: 8,
  },
  coordinates: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginBottom: 4,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#333',
  },
  alertCount: {
    backgroundColor: '#F44336',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCountText: {
    fontSize: 12,
    fontFamily: 'Roboto-Bold',
    color: '#FFFFFF',
  },
  sensorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sensorCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  sensorLabel: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 2,
  },
  sensorUnit: {
    fontSize: 10,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginBottom: 4,
  },
  sensorStatus: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    textAlign: 'center',
  },
  updateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
  },
  updateText: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginLeft: 6,
    marginRight: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#666',
  },
  intensityIndicator: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  intensityLabel: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginBottom: 8,
  },
  intensityBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  intensityFill: {
    height: '100%',
    borderRadius: 3,
  },
  intensityText: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    color: '#666',
    textAlign: 'center',
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  criticalAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  warningAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  infoAlert: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#333',
    marginBottom: 6,
    lineHeight: 20,
  },
  alertMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  alertTime: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  alertDistance: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginLeft: 4,
  },
  alertValue: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginLeft: 4,
  },
  alertRight: {
    marginLeft: 12,
  },
  alertIcon: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  noAlertsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  noAlertsText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#4CAF50',
    marginTop: 12,
    marginBottom: 4,
  },
  noAlertsSubtext: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  fullWidthButton: {
    marginHorizontal: 0,
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 16,
  }
});