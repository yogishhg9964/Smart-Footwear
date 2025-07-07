import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { MapPin, Navigation, Settings, Zap } from 'lucide-react-native';
import { fetchGpsData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';

export default function MapScreen() {
  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  const getData = async () => {
    try {
      const data = await fetchGpsData();
      setGpsData(data);
      setError(null);
      console.log("Fetched latest GPS data:", data);
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
    currentLocation: {
      latitude: gpsData?.latitude || 37.7749,
      longitude: gpsData?.longitude || -122.4194,
      address: '123 Main St, San Francisco, CA',
    },
    safeZone: {
      center: { latitude: 37.7849, longitude: -122.4094 },
      radius: 0.5, // km
    },
    isInSafeZone: gpsData?.status === 'inside',
  };

  const handleCenterMap = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: mockData.currentLocation.latitude,
        longitude: mockData.currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } else {
      Alert.alert('Map', 'Centering map to current location');
    }
  };

  const handleEditSafeZone = () => {
    Alert.alert('Safe Zone', 'Edit safe zone feature coming soon');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Location</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={handleEditSafeZone}>
          <Settings size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: mockData.currentLocation.latitude,
            longitude: mockData.currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          {/* Current Location Marker */}
          <Marker
            coordinate={{
              latitude: mockData.currentLocation.latitude,
              longitude: mockData.currentLocation.longitude,
            }}
            title="Current Location"
          >
            <View style={styles.currentLocationDot} />
          </Marker>

          {/* Safe Zone Circle */}
          <Circle
            center={mockData.safeZone.center}
            radius={mockData.safeZone.radius * 1000} // Convert km to meters
            strokeWidth={3}
            strokeColor={mockData.isInSafeZone ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)'}
            fillColor={mockData.isInSafeZone ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}
          />
        </MapView>
      </View>

      {/* Location Info */}
      <View style={styles.locationInfo}>
        <View style={styles.infoCard}>
          <MapPin size={20} color="#2196F3" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Current Address</Text>
            <Text style={styles.infoText}>{mockData.currentLocation.address}</Text>
          </View>
        </View>
        
        <View style={styles.infoCard}>
          <Zap size={20} color={mockData.isInSafeZone ? '#4CAF50' : '#F44336'} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Safe Zone Status</Text>
            <Text style={[styles.infoText, mockData.isInSafeZone ? styles.safeText : styles.alertText]}>
              {mockData.isInSafeZone ? 'Inside Safe Zone' : 'Outside Safe Zone'}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleCenterMap}>
          <Navigation size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Center Map</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.secondaryButton} onPress={handleEditSafeZone}>
          <Settings size={20} color="#2196F3" />
          <Text style={styles.secondaryButtonText}>Edit Safe Zone</Text>
        </TouchableOpacity>
      </View>

      {/* Coordinates Display */}
      <View style={styles.coordinatesContainer}>
        <Text style={styles.coordinatesTitle}>GPS Coordinates</Text>
        <Text style={styles.coordinatesText}>
          Lat: {gpsData?.latitude.toFixed(6) || 'Loading...'}°
        </Text>
        <Text style={styles.coordinatesText}>
          Lng: {gpsData?.longitude.toFixed(6) || 'Loading...'}°
        </Text>
        {loading && <Text style={styles.coordinatesText}>Updating...</Text>}
        {error && <Text style={[styles.coordinatesText, { color: '#F44336' }]}>{error}</Text>}
        <Text style={styles.coordinatesText}>
          Distance: {gpsData?.distance.toFixed(2) || '0.00'} meters
        </Text>
        <Text style={styles.coordinatesText}>
          Last Updated: {gpsData ? new Date(gpsData.createdAt).toLocaleTimeString() : 'Never'}
        </Text>
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
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    minHeight: 600,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  mapContainer: {
    height: '50%',
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mapPlaceholderText: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginTop: 12,
  },
  mapPlaceholderSubtext: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  locationMarker: {
    position: 'absolute',
    top: '40%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -25 }],
    alignItems: 'center',
  },
  currentLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  safeZoneIndicator: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    alignItems: 'center',
  },
  safeZoneCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  safeZoneActive: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  safeZoneInactive: {
    borderColor: '#F44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  safeZoneText: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  locationInfo: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  infoCard: {
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
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    color: '#666',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    fontFamily: 'Roboto-Regular',
    color: '#333',
  },
  safeText: {
    color: '#4CAF50',
  },
  alertText: {
    color: '#F44336',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    marginRight: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    marginLeft: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#2196F3',
    marginLeft: 8,
  },
  coordinatesContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  coordinatesTitle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginBottom: 8,
  },
  coordinatesText: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginBottom: 2,
  },
});