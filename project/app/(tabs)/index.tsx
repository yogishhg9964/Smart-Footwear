import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Shield, ShieldAlert, MapPin, Activity, Thermometer, Bell } from 'lucide-react-native';
import { fetchGpsData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';

export default function DashboardScreen() {
  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getData = async () => {
    try {
      const data = await fetchGpsData();
      setGpsData(data);
      setError(null);
      console.log("Fetched latest data:", data);
    } catch (err) {
      setError("Failed to fetch GPS data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getData();
    const interval = setInterval(() => {
      getData();
    }, 15000); // fetch every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const mockData = {
    user: {
      name: 'John Doe',
      safeZoneStatus: gpsData?.status || 'inside',
    },
    location: {
      latitude: gpsData?.latitude || 37.7749,
      longitude: gpsData?.longitude || -122.4194,
      distanceFromSafeZone: (gpsData?.distance || 0) / 1000, // convert meters to km
    },
    sensors: {
      pressure: 850,
      temperature: 36.8,
      lastUpdate: gpsData ? new Date(gpsData.createdAt).toLocaleTimeString() : '2 min ago',
    },
    alerts: [
      { id: 1, type: 'temperature', message: 'Slight temperature increase detected', time: '5 min ago' },
      { id: 2, type: 'zone', message: gpsData?.status === 'inside' ? 'Inside safe zone' : 'Outside safe zone', time: 'Just now' },
    ],
  };

  const isInSafeZone = mockData.user.safeZoneStatus === 'inside';

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
              <Text style={styles.greeting}>Good morning,</Text>
              <Text style={styles.userName}>{mockData.user.name}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Bell size={24} color="#666" />
            <View style={styles.notificationBadge} />
          </TouchableOpacity>
        </View>

        {/* Safe Zone Status */}
        <View style={[styles.statusCard, isInSafeZone ? styles.safeStatus : styles.alertStatus]}>
          <View style={styles.statusHeader}>
            {isInSafeZone ? (
              <Shield size={24} color="#4CAF50" />
            ) : (
              <ShieldAlert size={24} color="#F44336" />
            )}
            <Text style={styles.statusTitle}>Safe Zone Status</Text>
          </View>
          <Text style={[styles.statusText, isInSafeZone ? styles.safeText : styles.alertText]}>
            {isInSafeZone ? 'Inside Safe Zone ✅' : 'Outside Safe Zone 🚨'}
          </Text>
          <Text style={styles.statusSubtext}>
            Distance: {mockData.location.distanceFromSafeZone} km from center
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
                {mockData.location.latitude.toFixed(4)}°N
              </Text>
              <Text style={styles.sensorValue}>
                {Math.abs(mockData.location.longitude).toFixed(4)}°W
              </Text>
            </View>
            
            <View style={styles.sensorCard}>
              <Activity size={20} color="#FF9800" />
              <Text style={styles.sensorLabel}>Pressure</Text>
              <Text style={styles.sensorValue}>{mockData.sensors.pressure}</Text>
              <Text style={styles.sensorUnit}>hPa</Text>
            </View>
            
            <View style={styles.sensorCard}>
              <Thermometer size={20} color="#F44336" />
              <Text style={styles.sensorLabel}>Temperature</Text>
              <Text style={styles.sensorValue}>{mockData.sensors.temperature}°C</Text>
              <Text style={styles.sensorUnit}>Normal</Text>
            </View>
          </View>
          <Text style={styles.lastUpdate}>Last updated: {mockData.sensors.lastUpdate}</Text>
        </View>

        {/* Active Alerts */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Active Alerts</Text>
          {mockData.alerts.map((alert) => (
            <View key={alert.id} style={styles.alertItem}>
              <View style={[styles.alertDot, alert.type === 'temperature' ? styles.temperatureAlert : styles.zoneAlert]} />
              <View style={styles.alertContent}>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <Text style={styles.alertTime}>{alert.time}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>View Full Map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
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
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  userName: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
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
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginLeft: 8,
  },
  statusText: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
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
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
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
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#333',
  },
  sensorUnit: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 2,
  },
  lastUpdate: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
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
  temperatureAlert: {
    backgroundColor: '#FF9800',
  },
  zoneAlert: {
    backgroundColor: '#4CAF50',
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 16,
    fontFamily: 'Roboto-Regular',
    color: '#333',
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
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
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#2196F3',
  },
});