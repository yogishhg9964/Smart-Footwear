import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle } from 'react-native-maps';
import { MapPin, Navigation, Settings, Zap, Plus, Trash2, AlertTriangle, Construction, Car, Building } from 'lucide-react-native';
import { fetchGpsData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';
import * as Location from 'expo-location';
import { Modal, TextInput, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type DangerZoneCategory = 'construction' | 'traffic' | 'restricted' | 'hazard' | 'custom';

type DangerZone = {
  id: number;
  latitude: number;
  longitude: number;
  radius: number;
  category: DangerZoneCategory;
  name: string;
  description?: string;
  color: string;
  icon: string;
};

type ZoneTemplate = {
  id: string;
  name: string;
  category: DangerZoneCategory;
  defaultRadius: number;
  color: string;
  icon: string;
  description: string;
};

// Zone templates for quick creation
const ZONE_TEMPLATES: ZoneTemplate[] = [
  {
    id: 'construction',
    name: 'Construction Site',
    category: 'construction',
    defaultRadius: 100,
    color: '#FF9800',
    icon: 'construction',
    description: 'Active construction area with potential hazards'
  },
  {
    id: 'traffic',
    name: 'High Traffic Area',
    category: 'traffic',
    defaultRadius: 50,
    color: '#F44336',
    icon: 'car',
    description: 'Busy road or intersection with heavy traffic'
  },
  {
    id: 'restricted',
    name: 'Restricted Zone',
    category: 'restricted',
    defaultRadius: 75,
    color: '#9C27B0',
    icon: 'building',
    description: 'Private property or restricted access area'
  },
  {
    id: 'hazard',
    name: 'General Hazard',
    category: 'hazard',
    defaultRadius: 80,
    color: '#E91E63',
    icon: 'alert-triangle',
    description: 'General dangerous area requiring caution'
  },
  {
    id: 'custom',
    name: 'Custom Zone',
    category: 'custom',
    defaultRadius: 100,
    color: '#607D8B',
    icon: 'alert-triangle',
    description: 'Create a custom danger zone with your own name and radius'
  }
];

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
      const address = `${name ?? ''} ${street ?? ''}, ${city ?? ''}, ${region ?? ''} ${postalCode ?? ''}, ${country ?? ''}`.trim();
      return address || 'Address not found';
    } else {
      return 'Address not found';
    }
  } catch (error) {
    console.error("Error reverse geocoding:", error);
    return 'Reverse geocoding failed';
  }
}

// Helper function to get short location name
function getShortLocationName(address: string): string {
  if (!address || address === 'Address not found' || address === 'Permission Denied') {
    return 'Unknown Location';
  }

  const parts = address.split(',');
  if (parts.length >= 2) {
    return `${parts[0].trim()}, ${parts[1].trim()}`;
  }
  return parts[0]?.trim() || 'Unknown Location';
}

export default function MapScreen() {
  const [gpsData, setGpsData] = useState<GpsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ZoneTemplate | null>(null);
  const [selectedZone, setSelectedZone] = useState<DangerZone | null>(null);
  const [tapToCreateMode, setTapToCreateMode] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocationName, setCurrentLocationName] = useState('Loading location...');
  const [dangerStatus, setDangerStatus] = useState<string>('Checking...');
  const [dangerDistance, setDangerDistance] = useState<number>(0);
  const [dangerZones, setDangerZones] = useState<DangerZone[]>([]);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [customZoneName, setCustomZoneName] = useState('');
  const [customZoneRadius, setCustomZoneRadius] = useState('100');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<{ latitude: number; longitude: number } | null>(null);

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

  // Get device current location
  const getDeviceLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
    } catch (error) {
      console.error("Error getting device location:", error);
      return null;
    }
  }, []);

  // Check if sensor data is valid
  const isValidSensorData = (data: GpsData): boolean => {
    return data.latitude !== 0 && data.longitude !== 0 &&
           data.latitude !== null && data.longitude !== null &&
           !isNaN(data.latitude) && !isNaN(data.longitude);
  };

  // Memoize getData to avoid re-creation on every render
  const getData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGpsData();
      console.log("Fetched GPS data from sensor:", data);

      let finalLocation = { latitude: data.latitude, longitude: data.longitude };

      // Check if sensor data is invalid (0, null, or NaN)
      if (!isValidSensorData(data)) {
        const deviceLoc = await getDeviceLocation();
        if (deviceLoc) {
          finalLocation = deviceLoc;
          setDeviceLocation(deviceLoc);
        }
      }

      // Create updated GPS data with correct location
      const updatedData = {
        ...data,
        latitude: finalLocation.latitude,
        longitude: finalLocation.longitude
      };

      setGpsData(updatedData);
      setError(null);

      // Get address and update location name
      const address = await getAddressFromCoords(finalLocation.latitude, finalLocation.longitude);
      setGpsData(prev => prev ? { ...prev, address } : null);
      setCurrentLocationName(getShortLocationName(address));

      // Check danger zones status
      const { status, distance } = checkDangerZones(finalLocation.latitude, finalLocation.longitude, dangerZones);
      setDangerStatus(status);
      setDangerDistance(distance);

    } catch (err) {
      setError("Failed to fetch GPS data");
      setCurrentLocationName("Location unavailable");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dangerZones, checkDangerZones, getDeviceLocation]);

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

  // Get current location for map display
  const getCurrentLocation = () => {
    if (gpsData && gpsData.latitude !== 0 && gpsData.longitude !== 0) {
      return {
        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        address: gpsData.address || 'Current Location'
      };
    }

    // Fallback to device location if available
    if (deviceLocation) {
      return {
        latitude: deviceLocation.latitude,
        longitude: deviceLocation.longitude,
        address: 'Current Location'
      };
    }

    // Default location if nothing is available
    return {
      latitude: 12.9716,
      longitude: 77.5946,
      address: 'Loading location...'
    };
  };

  const currentLocation = getCurrentLocation();

  // Handle map press for tap-to-create zones
  const handleMapPress = (event: any) => {
    if (tapToCreateMode) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      setPendingLocation({ latitude, longitude });
      setTapToCreateMode(false);
      setTemplateModalVisible(true);
    }
  };

  // Create zone from template
  const handleCreateZoneFromTemplate = async (template: ZoneTemplate) => {
    if (!pendingLocation) return;

    if (template.id === 'custom') {
      setShowCustomForm(true);
      return;
    }

    const newId = Date.now();
    const address = await getAddressFromCoords(pendingLocation.latitude, pendingLocation.longitude);

    const newZone: DangerZone = {
      id: newId,
      latitude: pendingLocation.latitude,
      longitude: pendingLocation.longitude,
      radius: template.defaultRadius,
      category: template.category,
      name: template.name,
      description: template.description,
      color: template.color,
      icon: template.icon
    };

    const updatedZones = [...dangerZones, newZone];
    setDangerZones(updatedZones);
    await saveDangerZones(updatedZones);

    setTemplateModalVisible(false);
    setPendingLocation(null);
    getData();

    // Animate to new zone
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: pendingLocation.latitude,
        longitude: pendingLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // Create custom zone
  const handleCreateCustomZone = async () => {
    if (!pendingLocation || !customZoneName.trim()) {
      Alert.alert('Error', 'Please enter a zone name');
      return;
    }

    const radius = parseInt(customZoneRadius);
    if (isNaN(radius) || radius <= 0) {
      Alert.alert('Error', 'Please enter a valid radius');
      return;
    }

    const newId = Date.now();
    const newZone: DangerZone = {
      id: newId,
      latitude: pendingLocation.latitude,
      longitude: pendingLocation.longitude,
      radius: radius,
      category: 'custom',
      name: customZoneName.trim(),
      description: `Custom danger zone: ${customZoneName.trim()}`,
      color: '#607D8B',
      icon: 'alert-triangle'
    };

    const updatedZones = [...dangerZones, newZone];
    setDangerZones(updatedZones);
    await saveDangerZones(updatedZones);

    setTemplateModalVisible(false);
    setShowCustomForm(false);
    setPendingLocation(null);
    setCustomZoneName('');
    setCustomZoneRadius('100');
    getData();

    // Animate to new zone
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: pendingLocation.latitude,
        longitude: pendingLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  // Handle zone editing
  const handleEditZone = (zone: DangerZone) => {
    setSelectedZone(zone);
    setEditModalVisible(true);
  };

  // Update existing zone
  const handleUpdateZone = async (updatedZone: DangerZone) => {
    const updatedZones = dangerZones.map(zone =>
      zone.id === updatedZone.id ? updatedZone : zone
    );
    setDangerZones(updatedZones);
    await saveDangerZones(updatedZones);
    setEditModalVisible(false);
    setSelectedZone(null);
    getData();
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
    if (mapRef.current) {
      const location = getCurrentLocation();
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } else {
      Alert.alert('Map', 'Current location data not available to center map.');
    }
  };

  // Get zone icon component
  const getZoneIcon = (iconName: string, color: string) => {
    const iconProps = { size: 16, color };
    switch (iconName) {
      case 'construction': return <Construction {...iconProps} />;
      case 'car': return <Car {...iconProps} />;
      case 'building': return <Building {...iconProps} />;
      case 'alert-triangle': return <AlertTriangle {...iconProps} />;
      default: return <AlertTriangle {...iconProps} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Enhanced Header - Fixed outside ScrollView */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Smart Location</Text>
          <Text style={styles.locationName}>{currentLocationName}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerButton, showCoordinates && styles.headerButtonActive]}
            onPress={() => setShowCoordinates(!showCoordinates)}
          >
            <MapPin size={18} color={showCoordinates ? "#2196F3" : "#666"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setModalVisible(true)}>
            <Settings size={18} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >

        {/* Tap-to-Create Mode Banner */}
        {tapToCreateMode && (
          <View style={styles.tapModeBanner}>
            <Text style={styles.tapModeText}>Tap on the map to create a danger zone</Text>
            <TouchableOpacity onPress={() => setTapToCreateMode(false)}>
              <Text style={styles.tapModeCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            region={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.03,
              longitudeDelta: 0.03,
            }}
            onPress={handleMapPress}
          >
          {/* Current Location Marker */}
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Current Location"
            description={currentLocation.address}
          >
            <View style={styles.currentLocationDot} />
          </Marker>

          {/* Enhanced Danger Zones */}
          {dangerZones.map(zone => (
            <React.Fragment key={zone.id}>
              <Marker
                coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                title={zone.name}
                description={`${zone.description} • ${zone.radius}m radius`}
                onCalloutPress={() => handleEditZone(zone)}
              >
                <View style={[styles.zoneMarker, { backgroundColor: zone.color }]}>
                  {getZoneIcon(zone.icon, '#FFFFFF')}
                </View>
              </Marker>
              <Circle
                center={{ latitude: zone.latitude, longitude: zone.longitude }}
                radius={zone.radius}
                strokeColor={zone.color}
                fillColor={`${zone.color}30`}
                strokeWidth={2}
              />
            </React.Fragment>
          ))}
        </MapView>
      </View>

      {/* Zone Template Selection Modal */}
      <Modal
        visible={templateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setTemplateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Danger Zone Type</Text>
            <Text style={styles.modalSubtitle}>Choose a template for your danger zone</Text>

            {!showCustomForm ? (
              <>
                <ScrollView style={styles.templateList}>
                  {ZONE_TEMPLATES.map(template => (
                    <TouchableOpacity
                      key={template.id}
                      style={[styles.templateItem, { borderLeftColor: template.color }]}
                      onPress={() => {
                        setSelectedTemplate(template);
                      }}
                    >
                      <View style={styles.templateIcon}>
                        {getZoneIcon(template.icon, template.color)}
                      </View>
                      <View style={styles.templateInfo}>
                        <Text style={styles.templateName}>{template.name}</Text>
                        <Text style={styles.templateDescription}>{template.description}</Text>
                        <Text style={styles.templateRadius}>Default radius: {template.defaultRadius}m</Text>
                      </View>
                      {selectedTemplate?.id === template.id && (
                        <View style={styles.selectedIndicator}>
                          <Text style={styles.selectedText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setTemplateModalVisible(false);
                      setPendingLocation(null);
                      setSelectedTemplate(null);
                    }}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalOkButton, !selectedTemplate && styles.disabledButton]}
                    onPress={() => {
                      if (selectedTemplate) {
                        handleCreateZoneFromTemplate(selectedTemplate);
                        setSelectedTemplate(null);
                      }
                    }}
                    disabled={!selectedTemplate}
                  >
                    <Text style={[styles.modalOkButtonText, !selectedTemplate && styles.disabledButtonText]}>
                      Create Zone
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.customFormTitle}>Create Custom Zone</Text>

                <View style={styles.customForm}>
                  <Text style={styles.inputLabel}>Zone Name</Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Enter zone name (e.g., Construction Site)"
                    value={customZoneName}
                    onChangeText={setCustomZoneName}
                  />

                  <Text style={styles.inputLabel}>Radius (meters)</Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Enter radius in meters"
                    value={customZoneRadius}
                    onChangeText={setCustomZoneRadius}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => {
                      setShowCustomForm(false);
                      setCustomZoneName('');
                      setCustomZoneRadius('100');
                    }}
                  >
                    <Text style={styles.modalCancelButtonText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOkButton}
                    onPress={handleCreateCustomZone}
                  >
                    <Text style={styles.modalOkButtonText}>Create Zone</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Zone Management Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage Danger Zones</Text>
            <Text style={styles.modalSubtitle}>
              {dangerZones.length} zone{dangerZones.length !== 1 ? 's' : ''} created
            </Text>

            {dangerZones.length > 0 ? (
              <ScrollView style={styles.zonesList}>
                {dangerZones.map(zone => (
                  <View key={zone.id} style={[styles.zoneListItem, { borderLeftColor: zone.color }]}>
                    <View style={styles.zoneListIcon}>
                      {getZoneIcon(zone.icon, zone.color)}
                    </View>
                    <View style={styles.zoneListInfo}>
                      <Text style={styles.zoneListName}>{zone.name}</Text>
                      <Text style={styles.zoneListDetails}>
                        {zone.radius}m radius • {zone.category}
                      </Text>
                      <Text style={styles.zoneListDescription}>{zone.description}</Text>
                    </View>
                    <View style={styles.zoneListActions}>
                      <TouchableOpacity
                        style={styles.zoneActionButton}
                        onPress={() => {
                          if (mapRef.current) {
                            mapRef.current.animateToRegion({
                              latitude: zone.latitude,
                              longitude: zone.longitude,
                              latitudeDelta: 0.01,
                              longitudeDelta: 0.01,
                            }, 1000);
                          }
                          setModalVisible(false);
                        }}
                      >
                        <MapPin size={16} color="#2196F3" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.zoneActionButton}
                        onPress={() => {
                          Alert.alert(
                            'Delete Zone',
                            `Are you sure you want to delete "${zone.name}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: () => handleDeleteDangerZone(zone.id) }
                            ]
                          );
                        }}
                      >
                        <Trash2 size={16} color="#F44336" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyZones}>
                <AlertTriangle size={48} color="#CCC" />
                <Text style={styles.emptyZonesText}>No danger zones created yet</Text>
                <Text style={styles.emptyZonesSubtext}>Tap the "Add Zone" button to create your first danger zone</Text>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOkButton}
                onPress={() => {
                  setModalVisible(false);
                  setTapToCreateMode(true);
                }}
              >
                <Text style={styles.modalOkButtonText}>Add New Zone</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Info */}
      <View style={styles.locationInfo}>
        <View style={styles.infoCard}>
          <MapPin size={20} color="#2196F3" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Current Location</Text>
            <Text style={styles.infoText}>{currentLocationName}</Text>
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

      {/* Enhanced Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={() => setTapToCreateMode(true)}
        >
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Add Zone</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryActionButton]}
          onPress={handleCenterMap}
        >
          <Navigation size={18} color="#2196F3" />
          <Text style={styles.secondaryButtonText}>Center</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryActionButton]}
          onPress={() => setModalVisible(true)}
        >
          <Settings size={18} color="#2196F3" />
          <Text style={styles.secondaryButtonText}>Manage</Text>
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
    minHeight: 800,
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
    height: 300,
    marginHorizontal: 16,
    marginVertical: 8,
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
    paddingVertical: 8,
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
    paddingVertical: 16,
    marginTop: 8,
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
    marginTop: 8,
    marginBottom: 20,
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginRight: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  modalCancelButtonText: {
    color: '#333333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalAddButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    marginLeft: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalAddButtonText: {
    color: '#FFFFFF',
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
  // Enhanced Header Styles
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationName: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 6,
  },
  headerButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  // Tap Mode Banner
  tapModeBanner: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapModeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  tapModeCancel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  // Enhanced Zone Marker
  zoneMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  // Template Modal Styles
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  templateList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  templateIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  templateRadius: {
    fontSize: 12,
    color: '#999',
  },
  // Zone Management Modal Styles
  zonesList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  zoneListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  zoneListIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  zoneListInfo: {
    flex: 1,
  },
  zoneListName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  zoneListDetails: {
    fontSize: 14,
    color: '#666',
  },
  zoneListActions: {
    flexDirection: 'row',
  },
  zoneActionButton: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  emptyZones: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyZonesText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptyZonesSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  // Enhanced Info Card Styles
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Enhanced Action Button Styles
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  primaryActionButton: {
    backgroundColor: '#2196F3',
  },
  secondaryActionButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  // Custom Form Styles
  customFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  customForm: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  modalOkButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalOkButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Enhanced Zone List Styles
  zoneListDescription: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  // Selection Indicator Styles
  selectedIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  selectedText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Disabled Button Styles
  disabledButton: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#999999',
  },
});