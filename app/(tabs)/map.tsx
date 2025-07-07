import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { MapPin, Navigation, Settings, Zap } from 'lucide-react-native';
import { fetchGpsData } from '../../services/ThingSpeakService'; // Adjust path as needed
import { GpsData } from '../../models/GpsData'; // Adjust path as needed
import * as Location from 'expo-location';
import { Modal, TextInput, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DangerZone = {
  id: number;
  latitude: number;
  longitude: number;
  radius: number;
};

// Helper function to get address from coordinates
async function getAddressFromCoords(latitude: number, longitude: number) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return 'Permission Denied';
    }

    const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (geocode.length > 0) {
      const { name, street, city, region, postalCode, country } = geocode[0];
      return `${name ?? ''} ${street ?? ''}, ${city ?? ''}, ${region ?? ''} ${postalCode ?? ''}, ${country ?? ''}`;
    } else {
      return 'Address not found';
    }
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return 'Reverse geocoding failed';
  }
}

export default function MapScreen() {
  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newZone, setNewZone] = useState<{ latitude: string; longitude: string; radius: string; }>({ latitude: '', longitude: '', radius: '' });
  const [dangerStatus, setDangerStatus] = useState<string>('Checking...');
  const [dangerDistance, setDangerDistance] = useState<number>(0);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);

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
  }, []); // No dependencies, so it's created once

  // Memoize checkDangerZones as it uses calculateDistance and dangerZones
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
        break; // Once inside a danger zone, we can stop checking
      } else if (distance <= zone.radius + 100) { // Within 100 meters of a danger zone
        // Only set to 'Near' if not already 'Inside' a zone
        if (currentStatus !== "Inside Danger Zone") {
          currentStatus = `Near Danger Zone ${zone.id} (Dist: ${distance.toFixed(2)}m)`;
        }
      }
    }

    if (currentStatus === "Safe" && closestZone) {
      currentStatus = `Safe (Closest: Zone ${closestZone.id} at ${closestDistance.toFixed(2)}m)`;
    }

    return { status: currentStatus, distance: closestDistance };
  }, [calculateDistance]); // Depends on calculateDistance

  const saveDangerZones = async (zones: DangerZone[]) => {
    try {
      await AsyncStorage.setItem('@danger_zones', JSON.stringify(zones));
    } catch (e) {
      console.error("Error saving danger zones:", e);
    }
  };

  // Memoize loadDangerZones
  const loadDangerZones = useCallback(async () => {
    try {
      const storedZones = await AsyncStorage.getItem('@danger_zones');
      if (storedZones !== null) {
        setDangerZones(JSON.parse(storedZones));
      }
    } catch (e) {
      console.error("Error loading danger zones:", e);
    }
  }, []); // No dependencies for loadDangerZones

  // Memoize getData to avoid re-creation on every render
  const getData = useCallback(async () => {
    setLoading(true); // Set loading true at the start of fetch
    try {
      const data = await fetchGpsData();
      setGpsData(data);
      setError(null);
      console.log("Fetched latest GPS data:", data);

      // Get address and update gpsData
      const address = await getAddressFromCoords(data.latitude, data.longitude);
      setGpsData(prev => prev ? { ...prev, address } : null); // Update state with address

      // Check danger zones status
      const { status, distance } = checkDangerZones(data.latitude, data.longitude, dangerZones);
      setDangerStatus(status);
      setDangerDistance(distance);

    } catch (err) {
      setError("Failed to fetch GPS data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dangerZones, checkDangerZones]); // Dependencies: dangerZones and checkDangerZones

  // Effect to load danger zones once on component mount
  useEffect(() => {
    loadDangerZones();
  }, [loadDangerZones]);

  // Effect to handle periodic data fetching and initial fetch
  useEffect(() => {
    // Initial fetch when the component mounts or getData changes
    getData();

    const interval = setInterval(() => {
      getData();
    }, 15000); // fetch every 15 seconds

    return () => clearInterval(interval); // Cleanup interval on unmount
  }, [getData]); // Dependency on getData (which itself depends on dangerZones and checkDangerZones)

  const mockData = {
    currentLocation: {
      latitude: gpsData?.latitude || 12.9716, // Default to Bengaluru city center if no GPS data yet
      longitude: gpsData?.longitude || 77.5946,
      address: gpsData?.address || 'Loading address...',
    },
  };

  const handleAddDangerZone = async () => {
    const lat = parseFloat(newZone.latitude);
    const lon = parseFloat(newZone.longitude);
    const rad = parseFloat(newZone.radius);

    console.log("Input values for new zone:", { lat, lon, rad });

    if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
      Alert.alert('Invalid Input', 'Please enter valid numbers for latitude, longitude, and radius.');
      return;
    }
    if (rad <= 0) {
      Alert.alert('Invalid Input', 'Radius must be a positive number.');
      return;
    }

    const newId = Date.now(); // Simple unique ID
    const updatedZones = [
      ...dangerZones,
      {
        id: newId,
        latitude: lat,
        longitude: lon,
        radius: rad,
      },
    ];
    setDangerZones(updatedZones);
    console.log("Updated danger zones array:", updatedZones);
    await saveDangerZones(updatedZones); // Save updated zones to AsyncStorage
    setNewZone({ latitude: '', longitude: '', radius: '' }); // Clear input fields
    setModalVisible(false); // Close modal
    getData(); // Trigger an immediate data fetch to re-evaluate status with new zone
    // Optionally, animate map to the new zone
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: lat,
        longitude: lon,
        latitudeDelta: rad / 100000, // Adjust delta based on radius for good zoom
        longitudeDelta: rad / 100000,
      }, 1000);
    }
  };

  const handleDeleteDangerZone = async (id: number) => {
    Alert.alert(
      "Delete Danger Zone",
      "Are you sure you want to delete this danger zone?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: async () => {
            const updatedZones = dangerZones.filter(zone => zone.id !== id);
            setDangerZones(updatedZones);
            await saveDangerZones(updatedZones); // Save updated zones to AsyncStorage
            getData(); // Trigger an immediate data fetch to re-evaluate status
          },
          style: "destructive"
        }
      ]
    );
  };

  const handleCenterMap = () => {
    if (mapRef.current && gpsData) {
      mapRef.current.animateToRegion({
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } else {
      Alert.alert('Map', 'Current location data not available to center map.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Location</Text>
        <TouchableOpacity style={styles.settingsButton} onPress={() => setModalVisible(true)}>
          <Settings size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          // Use 'region' for dynamic updates based on GPS data
          region={{
            latitude: mockData.currentLocation.latitude,
            longitude: mockData.currentLocation.longitude,
            latitudeDelta: 0.03, // You might adjust these based on how zoomed out you want the initial view
            longitudeDelta: 0.03,
          }}
          // If you want the map to automatically pan to the current location marker as it updates:
          // onRegionChangeComplete={(region) => console.log('Map moved to:', region)}
        >
          {/* Current Location Marker */}
          {gpsData && ( // Only render current location marker if gpsData is available
            <Marker
              coordinate={{
                latitude: gpsData.latitude,
                longitude: gpsData.longitude,
              }}
              title="Current Location"
              description={gpsData.address}
            >
              <View style={styles.currentLocationDot} />
            </Marker>
          )}

          {/* Danger Zones Markers and Circles */}
          {dangerZones.map(zone => (
            <React.Fragment key={zone.id}>
              <Marker
                coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                title={`Danger Zone ${zone.id}`}
                description={`Radius: ${zone.radius.toFixed(0)}m`}
                pinColor="red"
                onCalloutPress={() => handleDeleteDangerZone(zone.id)}
              />
              <Circle
                center={{ latitude: zone.latitude, longitude: zone.longitude }}
                radius={zone.radius}
                strokeColor="rgba(255, 0, 0, 0.8)"
                fillColor="rgba(255, 0, 0, 0.3)"
                strokeWidth={2}
              />
            </React.Fragment>
          ))}
        </MapView>
      </View>

      {/* Modal for adding/editing Danger Zones */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.scrollViewContent}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Manage Danger Zones</Text>

              <TextInput
                placeholder="Latitude (e.g., 12.9716)"
                keyboardType="numeric"
                style={styles.inputStyle}
                value={newZone.latitude}
                onChangeText={(text) => setNewZone({ ...newZone, latitude: text })}
              />
              <TextInput
                placeholder="Longitude (e.g., 77.5946)"
                keyboardType="numeric"
                style={styles.inputStyle}
                value={newZone.longitude}
                onChangeText={(text) => setNewZone({ ...newZone, longitude: text })}
              />
              <TextInput
                placeholder="Radius (meters, e.g., 500)"
                keyboardType="numeric"
                style={styles.inputStyle}
                value={newZone.radius}
                onChangeText={(text) => setNewZone({ ...newZone, radius: text })}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCancelButton}>
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAddDangerZone}
                  style={styles.modalAddButton}
                >
                  <Text style={styles.modalAddButtonText}>Add Zone</Text>
                </TouchableOpacity>
              </View>

              {/* Display existing danger zones with delete option */}
              {dangerZones.length > 0 && (
                <View style={styles.existingZonesContainer}>
                  <Text style={styles.existingZonesTitle}>Existing Danger Zones:</Text>
                  {dangerZones.map(zone => (
                    <View key={zone.id} style={styles.zoneItem}>
                      <Text style={styles.zoneItemText}>Lat: {zone.latitude.toFixed(4)}, Lng: {zone.longitude.toFixed(4)}, Rad: {zone.radius.toFixed(0)}m</Text>
                      <TouchableOpacity onPress={() => handleDeleteDangerZone(zone.id)}>
                        <Text style={styles.deleteZoneText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

            </View>
          </ScrollView>
        </View>
      </Modal>

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
          <Zap size={20} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Danger Zone Status</Text>
            {dangerStatus.startsWith("Inside") && (
              <Text style={[styles.infoText, styles.dangerInsideText]}>{dangerStatus}</Text>
            )}
            {dangerStatus.startsWith("Near") && (
              <Text style={[styles.infoText, styles.dangerNearText]}>{dangerStatus}</Text>
            )}
            {dangerStatus.startsWith("Safe") && (
              <Text style={[styles.infoText, styles.dangerSafeText]}>{dangerStatus}</Text>
            )}
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleCenterMap}>
          <Navigation size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Center Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => {
          setNewZone({ latitude: '', longitude: '', radius: '' }); // Clear input fields when opening modal
          setModalVisible(true);
        }}>
          <Settings size={20} color="#2196F3" />
          <Text style={styles.secondaryButtonText}>Manage Danger Zones</Text>
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
          Distance to Closest Danger Zone: {dangerDistance.toFixed(2) || '0.00'} meters
        </Text>
        <Text style={styles.coordinatesText}>
          Last Updated: {gpsData ? new Date(gpsData.createdAt).toLocaleTimeString() : 'Never'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    // fontFamily: 'Roboto-Bold', // Ensure you have this font loaded
    fontWeight: 'bold', // Fallback
    color: '#333',
  },
  settingsButton: {
    padding: 8,
  },
  mapContainer: {
    
    height: 100,
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
    // fontFamily: 'Roboto-Medium',
    fontWeight: '500', // Fallback
    color: '#666',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 16,
    // fontFamily: 'Roboto-Regular',
    fontWeight: 'normal', // Fallback
    color: '#333',
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
    // fontFamily: 'Roboto-Medium',
    fontWeight: '500', // Fallback
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
    // fontFamily: 'Roboto-Medium',
    fontWeight: '500', // Fallback
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
    // fontFamily: 'Roboto-Medium',
    fontWeight: '500', // Fallback
    color: '#333',
    marginBottom: 8,
  },
  coordinatesText: {
    fontSize: 14,
    // fontFamily: 'Roboto-Regular',
    fontWeight: 'normal', // Fallback
    color: '#666',
    marginBottom: 2,
  },
  inputStyle: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontSize: 16, // Added for better readability in TextInput
  },
  dangerInsideText: {
    color: '#F44336', // Red
    fontWeight: 'bold',
  },
  dangerNearText: {
    color: '#FF9800', // Orange
    fontWeight: 'bold',
  },
  dangerSafeText: {
    color: '#4CAF50', // Green
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%', // Limit modal height
  },
  modalTitle: {
    fontSize: 20, // Slightly larger title
    fontWeight: 'bold',
    marginBottom: 15, // Increased margin
    textAlign: 'center',
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20, // Increased margin
  },
  modalCancelButton: {
    flex: 1,
    padding: 12, // Increased padding
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalAddButton: {
    flex: 1,
    padding: 12, // Increased padding
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    marginLeft: 10,
    alignItems: 'center',
  },
  modalAddButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  existingZonesContainer: {
    marginTop: 25, // Increased margin
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 15,
  },
  existingZonesTitle: {
    fontSize: 18, // Slightly larger title
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  zoneItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10, // Increased padding
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  zoneItemText: {
    fontSize: 15, // Added for readability
    color: '#555',
  },
  deleteZoneText: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 15, // Added for readability
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center', // Center content in the scroll view
  },
});