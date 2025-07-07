import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Shield, ShieldAlert, MapPin, Activity, Thermometer, Bell } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native'; // Import useFocusEffect
import * as FileSystem from 'expo-file-system'; // For file operations
import * as Sharing from 'expo-sharing';     // For sharing files

import { fetchGpsData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the DangerZone type, consistent with MapScreen
type DangerZone = {
  id: number;
  latitude: number;
  longitude: number;
  radius: number;
};

// Define the AlertItem type
type AlertItem = {
  id: string; // Unique ID for each alert (e.g., 'high_temp', 'danger_zone_inside')
  type: 'danger_zone' | 'temperature' | 'pressure' | 'gps_offline' | 'other';
  message: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'critical'; // For styling (green, yellow, red)
};

// --- Sensor Thresholds for Color Coding (Re-added for context, but not implemented in styling here) ---
const TEMPERATURE_THRESHOLDS = {
  normal: { min: 35.0, max: 37.5 },
  warning: { min: 37.6, max: 38.5 },
  critical: { min: 38.6 },
};

const PRESSURE_THRESHOLDS = {
  normal: { min: 800, max: 1050 }, // Typical atmospheric pressure range hPa
  warning: { min: 750, max: 1100 }, // Outside normal but not extreme
  critical: { max: 749, min: 1101 }, // Very low or very high pressure
};


export default function DashboardScreen() {
  const navigation = useNavigation(); // Initialize navigation hook

  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dangerStatus, setDangerStatus] = useState<string>('Checking...');
  const [dangerDistance, setDangerDistance] = useState<number>(0);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<AlertItem[]>([]); // New state for dynamic alerts
  const [lastUpdate, setLastUpdate] = useState<string>('N/A');

  // --- Reusable Utility Functions (Copied/Adapted from MapScreen) ---

  // Memoize calculateDistance for performance
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
  const TEMPERATURE_THRESHOLDS = {
    normal: { min: 35.0, max: 37.5 },
    warning: { min: 37.6, max: 38.5 },
    critical: { min: 38.6 },
    low: { max: 34.9 }
  };

  // Existing Implementation: Function to determine temperature status (low, normal, warning, critical, unknown)
  // This is where getTemperatureStatus is defined:
  const getTemperatureStatus = useCallback((temperature: number | null) => {
    if (temperature === null) return 'unknown';
    if (temperature < TEMPERATURE_THRESHOLDS.low.max) return 'low';
    if (temperature >= TEMPERATURE_THRESHOLDS.critical.min) return 'critical';
    if (temperature >= TEMPERATURE_THRESHOLDS.warning.min && temperature <= TEMPERATURE_THRESHOLDS.warning.max) return 'warning';
    if (temperature >= TEMPERATURE_THRESHOLDS.normal.min && temperature <= TEMPERATURE_THRESHOLDS.normal.max) return 'normal';
    return 'unknown';
  }, []);

 const currentStatus = getTemperatureStatus(gpsData?.temperature || null);

 const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'critical': return '#F44336'; // Red
      case 'warning': return '#FF9800';  // Orange
      case 'low': return '#2196F3';      // Blue
      case 'normal': return '#4CAF50';   // Green
      default: return '#9E9E9E';         // Gray for unknown
    }
  }, []);

  // Memoize checkDangerZones
  const checkDangerZones = useCallback((latitude: number, longitude: number, zones: DangerZone[]) => {
    let closestZone = null;
    let closestDistance = Infinity;
    let currentStatus = "Safe";

    if (zones.length === 0) {
      return { status: `Safe (No Danger Zones Configured)`, distance: 0 };
    }

    for (const zone of zones) {
      const distance = calculateDistance(latitude, longitude, zone.latitude, zone.longitude);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestZone = zone;
      }

      if (distance <= zone.radius) {
        currentStatus = `Inside Danger Zone ${zone.id} (Dist: ${distance.toFixed(2)}m)`;
        break;
      } else if (distance <= zone.radius + 100) {
        if (currentStatus !== "Inside Danger Zone") {
          currentStatus = `Near Danger Zone ${zone.id} (Dist: ${distance.toFixed(2)}m)`;
        }
      }
    }

    if (currentStatus === "Safe" && closestZone) {
      currentStatus = `Safe (Closest: Zone ${closestZone.id} at ${closestDistance.toFixed(2)}m)`;
    }

    return { status: currentStatus, distance: closestDistance };
  }, [calculateDistance]);

  // Memoize loadDangerZones
  const loadDangerZones = useCallback(async () => {
    try {
      const storedZones = await AsyncStorage.getItem('@danger_zones');
      if (storedZones !== null) {
        setDangerZones(JSON.parse(storedZones));
      } else {
        setDangerZones([]); // Ensure it's an empty array if nothing is stored
      }
    } catch (e) {
      console.error("Error loading danger zones:", e);
    }
  }, []);

  // --- Alert Generation and Management Function (GPS-centric & Sensor data) ---
  const generateAndManageAlerts = useCallback((
    latestGpsData: GpsData | null,
    currentDangerStatus: string,
    currentDangerDistance: number,
    currentAlerts: AlertItem[] // Pass current alerts to manage them
  ) => {
    const newAlertsMap = new Map<string, AlertItem>(); // Use a Map to easily manage unique alerts by ID
    const now = new Date();

    // Helper to add or update an alert in the map
    const addOrUpdateAlert = (
      id: string,
      type: AlertItem['type'],
      message: string,
      level: AlertItem['level']
    ) => {
      newAlertsMap.set(id, { id, type, message, timestamp: now, level });
    };

    // --- Danger Zone Alert ---
    // Corrected logic: prioritize 'Inside' then 'Near'
    if (currentDangerStatus.startsWith('Inside')) {
      addOrUpdateAlert(
        'danger_zone_inside',
        'danger_zone',
        `Critical: Inside Danger Zone!`,
        'critical'
      );
    } else if (currentDangerStatus.startsWith('Near')) { // Changed from 'if' to 'else if'
      addOrUpdateAlert(
        'danger_zone_near',
        'danger_zone',
        `Warning: Near Danger Zone (${currentDangerDistance.toFixed(0)}m)!`,
        'warning'
      );
    }

    // --- GPS Offline Alert (Example Threshold: 15 seconds) ---
    // If no GPS data is available at all OR if the last update is too old


    // --- Filter and Merge Alerts ---
    // Start with existing alerts that are still relevant or being updated
    const finalAlerts: AlertItem[] = [];

    // Add alerts that are currently active based on conditions in newAlertsMap
    newAlertsMap.forEach(alert => {
        finalAlerts.push(alert);
    });

    // Remove any old alerts that are no longer active based on current conditions
    currentAlerts.forEach(oldAlert => {
        if (!newAlertsMap.has(oldAlert.id)) { // If the alert isn't regenerated in this cycle
            // Specific logic to remove 'gps_offline' alert if GPS is now online
            if (oldAlert.id === 'gps_offline' && latestGpsData && (now.getTime() - new Date(latestGpsData.createdAt).getTime()) <= GPS_OFFLINE_THRESHOLD_MS) {
                 return; // GPS is now online, so remove the offline alert
            }
            // Specific logic to remove danger zone alerts if no longer inside/near
            if (oldAlert.type === 'danger_zone' && !(currentDangerStatus.startsWith('Inside') || currentDangerStatus.startsWith('Near'))) {
                 return; // Danger zone alert resolved
            }
            // Add any other specific cleanup logic for other alert types here.
        }
    });

    // Ensure no duplicates and keep the most recent version if an ID exists
    const uniqueFinalAlerts = Array.from(new Map(finalAlerts.map(alert => [alert.id, alert])).values());

    // Sort alerts by level (critical first) and then by timestamp (newest first)
    uniqueFinalAlerts.sort((a, b) => {
      const levelOrder = { 'critical': 3, 'warning': 2, 'info': 1 };
      const levelDiff = (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0);
      if (levelDiff !== 0) return levelDiff;
      return b.timestamp.getTime() - a.timestamp.getTime(); // Newest first
    });

    return uniqueFinalAlerts;
  }, []);

  // --- Main Data Fetching Logic ---
  const getData = useCallback(async () => {
    setLoading(true);
    let fetchedData: GpsData | null = null;
    let currentStatus = dangerStatus; // Use current status for initial evaluation
    let currentDistance = dangerDistance;

    try {
      fetchedData = await fetchGpsData();
      setGpsData(fetchedData);
      setLastUpdate(new Date(fetchedData.createdAt).toLocaleTimeString());
      setError(null);
      console.log("Dashboard: Fetched latest data:", fetchedData);

      // Only calculate danger zones if GPS data is available and valid
      if (fetchedData && fetchedData.latitude !== undefined && fetchedData.longitude !== undefined) {
          // IMPORTANT: Recalculate danger status and distance with the LATEST dangerZones state
          const { status, distance } = checkDangerZones(fetchedData.latitude, fetchedData.longitude, dangerZones);
          setDangerStatus(status);
          setDangerDistance(distance);
          currentStatus = status; // Update for alert generation
          currentDistance = distance;
      } else {
          // If no valid GPS data, set a default "unknown" status
          setDangerStatus("Location Unknown");
          setDangerDistance(0);
          currentStatus = "Location Unknown";
          currentDistance = 0;
      }

    } catch (err) {
      setError("Failed to fetch GPS data for dashboard");
      console.error(err);
      setGpsData(null); // Clear GPS data on error to indicate no fresh data
      setDangerStatus("Failed to Fetch Data");
      setDangerDistance(0);
      
      currentStatus = "Failed to Fetch Data";
      currentDistance = 0;
    } finally {
      // Always call generate alerts, even if data fetch failed, to handle offline alerts
      setActiveAlerts(prevAlerts => generateAndManageAlerts(fetchedData, currentStatus, currentDistance, prevAlerts));
      setLoading(false);
    }
  }, [dangerZones, checkDangerZones, generateAndManageAlerts, dangerStatus, dangerDistance]); // Added dangerZones to dependencies

  // --- Handler for Export Report Functionality ---
  const handleExportReport = useCallback(async () => {
    if (!gpsData) {
      Alert.alert("No Data", "No GPS data available to export in the report.");
      return;
    }

    try {
      // Create a simple CSV string with current data (you can expand this with historical data)
      const csvContent = [
        `Timestamp,Latitude,Longitude,Temperature(C),Pressure(hPa),DangerStatus,DangerDistance(m)`,
        `${gpsData.createdAt},${gpsData.latitude},${gpsData.longitude},"${dangerStatus}",${dangerDistance.toFixed(2)}`
      ].join('\n');

      const fileName = `DashboardReport_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
      const fileUri = FileSystem.cacheDirectory + fileName; // Use cache directory for temporary storage

      await FileSystem.writeAsStringAsync(fileUri, csvContent); // Write CSV content to file

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          UTI: 'public.comma-separated-values', // iOS UTI for CSV
          dialogTitle: 'Share Sensor Report',
        });
        Alert.alert("Report Exported", `Report "${fileName}" created and opened for sharing.`);
      } else {
        Alert.alert("Sharing Not Available", "File sharing is not available on your device.");
      }

    } catch (e) {
      console.error("Error exporting report:", e);
      Alert.alert("Export Failed", "Failed to export report. Please try again.");
    }
  }, [gpsData, dangerStatus, dangerDistance]); // Dependencies: current GPS data and danger status/distance

/*
  // --- Handler for View Full Map ---
  const handleViewFullMap = useCallback(() => {
    navigation.navigate('MapScreen'); // Ensure 'MapScreen' is the correct route name
  }, [navigation]);
*/
  // --- useEffect Hooks ---

  // Use useFocusEffect to load danger zones whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Dashboard screen focused: Reloading danger zones...');
      loadDangerZones();
      // Optionally, you might want to force a data fetch here as well
      // getData(); // Uncomment if you want to immediately refresh all data on focus
      return () => {
        // Cleanup function (optional)
        console.log('Dashboard screen unfocused.');
      };
    }, [loadDangerZones]) // Only re-run if loadDangerZones function changes
  );

  // Original useEffect for fetching GPS data periodically
  useEffect(() => {
    getData(); // Initial fetch
    const interval = setInterval(() => {
      getData();
    }, 15000); // Fetch every 15 seconds
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, [getData]); // Now getData depends on dangerZones, so this will implicitly re-run if dangerZones changes

  // Determine safe zone display status based on dangerStatus state
  const isCurrentlyInSafeZone = dangerStatus.startsWith('Safe (No Danger Zones Configured)') || dangerStatus.startsWith('Safe (Closest:');


  if (loading && gpsData === null && error === null) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading dashboard data...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <User size={24} color="#FFFFFF" />
            </View>
            <View>
              {/* Greeting text removed */}
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Bell size={24} color="#666" />
            {activeAlerts.length > 0 && <View style={styles.notificationBadge} />}
          </TouchableOpacity>
        </View>

        {/* Safe Zone Status */}
        <View style={[styles.statusCard, isCurrentlyInSafeZone ? styles.safeStatus : styles.alertStatus]}>
          <View style={styles.statusHeader}>
            {isCurrentlyInSafeZone ? (
              <Shield size={24} color="#4CAF50" />
            ) : (
              <ShieldAlert size={24} color="#F44336" />
            )}
            <Text style={styles.statusTitle}>Safe Zone Status</Text>
          </View>
          <Text style={[styles.statusText, isCurrentlyInSafeZone ? styles.safeText : styles.alertText]}>
            {dangerStatus}
          </Text>
          <Text style={styles.statusSubtext}>
            Distance: {dangerDistance.toFixed(2)} meters {dangerDistance > 0 ? `(${((dangerDistance / 1000)).toFixed(2)} km)` : ''}
          </Text>
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
                {gpsData?.longitude?.toFixed(4) || 'N/A'}°E
              </Text>
            </View>

            <View style={styles.sensorCard}>
              <Activity size={20} color="#FF9800" />
              <Text style={styles.sensorLabel}>Pressure</Text>
              <Text style={styles.sensorValue}>
                {gpsData?.pressure?.toFixed(2) || 'N/A'}
              </Text>
              <Text style={styles.sensorUnit}>Pa</Text>
            </View>

            <View style={styles.sensorCard}>
          <Thermometer size={20} color="#F44336" />
          <Text style={styles.sensorLabel}>Temperature</Text>
          <Text style={styles.sensorValue}>
            {/* Use currentTemperature from state, not gpsData directly here, as gpsData is a transient variable */}
            {gpsData?.temperature?.toFixed(2) || 'N/A'}°C
          </Text>
          {/* Dynamically set text and color based on currentStatus */}
          <Text style={[styles.sensorUnit, { color: getStatusColor(currentStatus) }]}>
            {currentStatus.toUpperCase()}
          </Text>
          <Text style={styles.lastUpdate}>Updated {lastUpdate}</Text>
        </View>
        </View>
        
          
          </View>

        {/* Active Alerts */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Active Alerts</Text>
          {activeAlerts.length > 0 ? (
            activeAlerts.map((alert) => (
              <View key={alert.id} style={styles.alertItem}>
                <View style={[styles.alertDot, styles[`${alert.level}AlertDot`]]} />
                <View style={styles.alertContent}>
                  <Text style={styles.alertMessage}>{alert.message}</Text>
                  <Text style={styles.alertTime}>
                    {`${Math.round((new Date().getTime() - alert.timestamp.getTime()) / (1000 * 60))} min ago`}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.alertItem}>
              <Text style={styles.alertMessage}>No active alerts.</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton} >
              <Text style={styles.actionButtonText}>View Full Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handleExportReport}>
              <Text style={styles.secondaryButtonText}>Export Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  greeting: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#666',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
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
  alertStatus: {
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  safeText: {
    color: '#4CAF50',
  },
  alertText: {
    color: '#F44336',
  },
  statusSubtext: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#666',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sensorGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
    fontWeight: 'normal',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  sensorUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
    marginTop: 2,
  },
  lastUpdate: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginRight: 12,
  },
  infoAlertDot: {
    backgroundColor: '#2196F3',
  },
  warningAlertDot: {
    backgroundColor: '#FF9800',
  },
  criticalAlertDot: {
    backgroundColor: '#F44336',
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#333',
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2196F3',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  }
});