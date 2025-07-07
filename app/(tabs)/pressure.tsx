import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gauge, TrendingUp, TrendingDown, Activity, RefreshCw } from 'lucide-react-native';

import { fetchGpsData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';

export default function PressureScreen() {
  const [currentPressure, setCurrentPressure] = useState<number | null>(null);
  const [pressureTrend, setPressureTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [lastUpdate, setLastUpdate] = useState<string>('N/A');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pressureHistory, setPressureHistory] = useState<{ time: string; pressure: number; }[]>([]);
  const [gpsData, setGpsData] = useState<GpsData | null>(null);

  const NORMAL_PRESSURE_RANGE = { min: 800, max: 1050 };

  const getPressureStatus = useCallback((pressure: number | null) => {
    if (pressure === null) return 'unknown';
    if (pressure < NORMAL_PRESSURE_RANGE.min) return 'low';
    if (pressure > NORMAL_PRESSURE_RANGE.max) return 'high';
    return 'normal';
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'high': return '#F44336';
      case 'low': return '#FF9800';
      case 'normal': return '#4CAF50';
      default: return '#9E9E9E';
    }
  }, []);

  const getTrendIcon = useCallback(() => {
    switch (pressureTrend) {
      case 'up': return <TrendingUp size={16} color="#F44336" />;
      case 'down': return <TrendingDown size={16} color="#2196F3" />;
      default: return <Activity size={16} color="#4CAF50" />;
    }
  }, [pressureTrend]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data: GpsData = await fetchGpsData();
      setGpsData(data); // Store the full GPS data

      if (data && data.pressure !== undefined && data.pressure !== null) {
        const newPressure = data.pressure;
        setCurrentPressure(newPressure);
        setLastUpdate(new Date(data.createdAt).toLocaleTimeString());

        setPressureHistory(prevHistory => {
          const newHistoryPoint = {
            time: new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            pressure: newPressure
          };

          if (prevHistory.length > 0) {
            const lastRecordedPressure = prevHistory[prevHistory.length - 1].pressure;
            if (newPressure > lastRecordedPressure) {
              setPressureTrend('up');
            } else if (newPressure < lastRecordedPressure) {
              setPressureTrend('down');
            } else {
              setPressureTrend('stable');
            }
          } else {
            setPressureTrend('stable');
          }

          const updatedHistory = [...prevHistory, newHistoryPoint];
          return updatedHistory.slice(Math.max(0, updatedHistory.length - 6));
        });

        setError(null);
      } else {
        setError('Pressure data not available.');
        setCurrentPressure(null);
        setPressureTrend('stable');
      }
    } catch (err) {
      setError('Failed to fetch pressure data.');
      console.error("Error fetching pressure data:", err);
      setCurrentPressure(null);
      setPressureTrend('stable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // FIX: Explicitly type the return value to be a template literal string representing a percentage
  const getMarkerLeftPosition = useCallback((): `${number}%` => {
    if (currentPressure === null) return '0%'; // Default or handle as needed
    const { min, max } = NORMAL_PRESSURE_RANGE;
    if (currentPressure <= min) return '0%';
    if (currentPressure >= max) return '100%';
    const percentage = ((currentPressure - min) / (max - min)) * 100;
    return `${percentage}%`; // TypeScript now knows this is of type `${number}%`
  }, [currentPressure]);


  if (loading && currentPressure === null && error === null) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading pressure data...</Text>
      </View>
    );
  }

  // --- Mock Data (for parts not yet connected to ThingSpeak) ---
  const mockData = {
    currentPressure: 850,
    normalRange: { min: 800, max: 900 },
    trend: 'stable',
    lastUpdate: '30 seconds ago',
    footSensors: [
      { id: 1, name: 'Heel', pressure: 920, position: 'heel', status: 'high' },
      { id: 2, name: 'Arch', pressure: 780, position: 'arch', status: 'normal' },
      { id: 3, name: 'Ball', pressure: 865, position: 'ball', status: 'normal' },
      { id: 4, name: 'Toes', pressure: 720, position: 'toes', status: 'normal' },
    ],
    history: [
      { time: '10:00', pressure: 845 },
      { time: '10:15', pressure: 852 },
      { time: '10:30', pressure: 848 },
      { time: '10:45', pressure: 850 },
      { time: '11:00', pressure: 850 },
    ],
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Pressure Monitoring</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchData}>
            <RefreshCw size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Current Pressure Display */}
        <View style={styles.currentPressureCard}>
          <View style={styles.pressureHeader}>
            <Gauge size={24} color="#2196F3" />
            <Text style={styles.pressureTitle}>Current Pressure</Text>
            {getTrendIcon()}
          </View>

          <View style={styles.pressureDisplay}>
            <Text style={styles.pressureValue}>
              {currentPressure !== null ? currentPressure.toFixed(0) :
               gpsData?.pressure !== undefined ? gpsData.pressure.toFixed(0) : 'N/A'}
            </Text>
            <Text style={styles.pressureUnit}>FSR</Text>
          </View>

          <View style={styles.pressureStatus}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(getPressureStatus(currentPressure)) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(getPressureStatus(currentPressure)) }]}>
              {getPressureStatus(currentPressure).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.lastUpdate}>Updated {lastUpdate}</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Normal Range Info */}
        <View style={styles.rangeCard}>
          <Text style={styles.rangeTitle}>Normal Range</Text>
          <Text style={styles.rangeText}>
            {NORMAL_PRESSURE_RANGE.min} - {NORMAL_PRESSURE_RANGE.max} hPa
          </Text>
          <View style={styles.rangeBar}>
            <View style={styles.rangeBackground} />
            <View style={[styles.currentMarker, {
              left: getMarkerLeftPosition()
            }]} />
          </View>
        </View>

        {/* Foot Pressure Map (Still using mockData for sensor details) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Foot Pressure Map (Mock Data)</Text>
          <View style={styles.footMapContainer}>
            <View style={styles.footShape}>
              <Text style={styles.footLabel}>Right Foot</Text>

              {/* Toes */}
              <View style={[styles.sensorPoint, styles.toesPosition]}>
                <View style={[styles.sensorDot, { backgroundColor: getStatusColor(mockData.footSensors[3].status) }]} />
                <Text style={styles.sensorLabel}>Toes</Text>
                <Text style={styles.sensorValue}>{mockData.footSensors[3].pressure}</Text>
              </View>

              {/* Ball */}
              <View style={[styles.sensorPoint, styles.ballPosition]}>
                <View style={[styles.sensorDot, { backgroundColor: getStatusColor(mockData.footSensors[2].status) }]} />
                <Text style={styles.sensorLabel}>Ball</Text>
                <Text style={styles.sensorValue}>{mockData.footSensors[2].pressure}</Text>
              </View>

              {/* Arch */}
              <View style={[styles.sensorPoint, styles.archPosition]}>
                <View style={[styles.sensorDot, { backgroundColor: getStatusColor(mockData.footSensors[1].status) }]} />
                <Text style={styles.sensorLabel}>Arch</Text>
                <Text style={styles.sensorValue}>{mockData.footSensors[1].pressure}</Text>
              </View>

              {/* Heel */}
              <View style={[styles.sensorPoint, styles.heelPosition]}>
                <View style={[styles.sensorDot, { backgroundColor: getStatusColor(mockData.footSensors[0].status) }]} />
                <Text style={styles.sensorLabel}>Heel</Text>
                <Text style={styles.sensorValue}>{mockData.footSensors[0].pressure}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pressure History */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Pressure History</Text>
          <View style={styles.historyChart}>
            {pressureHistory.length > 0 ? (
              pressureHistory.map((point, index) => (
                <View key={index} style={styles.historyPoint}>
                  <View style={[styles.historyBar, {
                    // Scale height relative to the max pressure in history for better visualization
                    height: `${(point.pressure / (Math.max(...pressureHistory.map(p => p.pressure)) || 1000)) * 80 + 20}%`, // Ensure min height
                    backgroundColor: getStatusColor(getPressureStatus(point.pressure))
                  }]} />
                  <Text style={styles.historyTime}>{point.time}</Text>
                  <Text style={styles.historyValue}>{point.pressure.toFixed(0)}</Text>
                </View>
              ))
            ) : (
              <Text>No history available.</Text>
            )}
          </View>
        </View>

        {/* Sensor Status List (Still using mockData for sensor details) */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Sensor Details (Mock Data)</Text>
          {mockData.footSensors.map((sensor) => (
            <View key={sensor.id} style={styles.sensorCard}>
              <View style={styles.sensorInfo}>
                <View style={[styles.sensorStatusDot, { backgroundColor: getStatusColor(sensor.status) }]} />
                <Text style={styles.sensorName}>{sensor.name}</Text>
              </View>
              <View style={styles.sensorReading}>
                <Text style={styles.sensorPressure}>{sensor.pressure} hPa</Text>
                <Text style={[styles.sensorStatus, { color: getStatusColor(sensor.status) }]}>
                  {sensor.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
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
  title: {
    fontSize: 24,
    // fontFamily: 'Roboto-Bold', // Ensure you have this font loaded
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  currentPressureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pressureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  pressureTitle: {
    fontSize: 18,
    // fontFamily: 'Roboto-Medium', // Ensure you have this font loaded
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  pressureDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  pressureValue: {
    fontSize: 48,
    // fontFamily: 'Roboto-Bold', // Ensure you have this font loaded
    fontWeight: 'bold',
    color: '#2196F3',
  },
  pressureUnit: {
    fontSize: 20,
    // fontFamily: 'Roboto-Regular', // Ensure you have this font loaded
    fontWeight: 'normal',
    color: '#666',
    marginLeft: 8,
  },
  pressureStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    // fontFamily: 'Roboto-Medium', // Ensure you have this font loaded
    fontWeight: '500',
  },
  lastUpdate: {
    fontSize: 12,
    // fontFamily: 'Roboto-Regular', // Ensure you have this font loaded
    fontWeight: 'normal',
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 10,
    textAlign: 'center',
  },
  rangeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  rangeTitle: {
    fontSize: 16,
    // fontFamily: 'Roboto-Medium', // Ensure you have this font loaded
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  rangeText: {
    fontSize: 14,
    // fontFamily: 'Roboto-Regular', // Ensure you have this font loaded
    fontWeight: 'normal',
    color: '#666',
    marginBottom: 12,
  },
  rangeBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    position: 'relative',
  },
  rangeBackground: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  currentMarker: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    // fontFamily: 'Roboto-Bold', // Ensure you have this font loaded
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  footMapContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  footShape: {
    width: 200,
    height: 300,
    backgroundColor: '#F0F0F0',
    borderRadius: 100,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  footLabel: {
    position: 'absolute',
    top: -30,
    left: '50%',
    transform: [{ translateX: -35 }],
    fontSize: 16,
    // fontFamily: 'Roboto-Medium', // Ensure you have this font loaded
    fontWeight: '500',
    color: '#333',
  },
  sensorPoint: {
    position: 'absolute',
    alignItems: 'center',
  },
  toesPosition: {
    top: 20,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  ballPosition: {
    top: 80,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  archPosition: {
    top: 150,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  heelPosition: {
    top: 220,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  sensorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sensorLabel: {
    fontSize: 10,
    // fontFamily: 'Roboto-Medium', // Ensure you have this font loaded
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  sensorValue: {
    fontSize: 12,
    // fontFamily: 'Roboto-Bold', // Ensure you have this font loaded
    fontWeight: 'bold',
    color: '#666',
  },
  historyChart: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  historyPoint: {
    alignItems: 'center',
    flex: 1,
  },
  historyBar: {
    width: 20,
    backgroundColor: '#2196F3',
    borderRadius: 2,
    marginBottom: 8,
    minHeight: 5,
  },
  historyTime: {
    fontSize: 10,
    // fontFamily: 'Roboto-Regular', // Ensure you have this font loaded
    fontWeight: 'normal',
    color: '#666',
    marginBottom: 2,
  },
  historyValue: {
    fontSize: 10,
    // fontFamily: 'Roboto-Bold', // Ensure you have this font loaded
    fontWeight: 'bold',
    color: '#333',
  },
  sensorCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  sensorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sensorStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  sensorName: {
    fontSize: 16,
    // fontFamily: 'Roboto-Medium', // Ensure you have this font loaded
    fontWeight: '500',
    color: '#333',
  },
  sensorReading: {
    alignItems: 'flex-end',
  },
  sensorPressure: {
    fontSize: 16,
    // fontFamily: 'Roboto-Bold', // Ensure you have this font loaded
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  sensorStatus: {
    fontSize: 12,
    // fontFamily: 'Roboto-Medium', // Ensure you have this font loaded
    fontWeight: '500',
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
  },
});