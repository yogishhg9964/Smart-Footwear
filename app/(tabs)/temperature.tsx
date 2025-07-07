import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Thermometer, TrendingUp, TrendingDown, Activity, RefreshCw, AlertCircle, CheckCircle,AlertTriangle } from 'lucide-react-native'; // Added AlertCircle, CheckCircle

// Import your ThingSpeak service and GpsData model
import { fetchGpsData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';

export default function TemperatureScreen() {
  const [currentTemperature, setCurrentTemperature] = useState<number | null>(null);
  const [temperatureTrend, setTemperatureTrend] = useState<'up' | 'down' | 'stable'>('stable');
  const [lastUpdate, setLastUpdate] = useState<string>('N/A');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [temperatureHistory, setTemperatureHistory] = useState<{ time: string; temperature: number; }[]>([]);
  const [gpsData, setGpsData] = useState<GpsData | null>(null);

  // Existing Implementation: Define temperature thresholds for status and color coding
  // DO NOT CHANGE THESE VALUES if they are your existing thresholds
  const TEMPERATURE_THRESHOLDS = {
    normal: { min: 35.0, max: 37.5 }, // Example: Normal body temperature
    warning: { min: 37.6, max: 38.5 }, // Example: Low-grade fever
    critical: { min: 38.6 },           // Example: High fever
    low: { max: 34.9 }                 // Example: Hypothermia risk
  };

  // Existing Implementation: Function to determine temperature status (low, normal, warning, critical, unknown)
  // DO NOT CHANGE THIS LOGIC if it is your existing status determination
  const getTemperatureStatus = useCallback((temperature: number | null) => {
    if (temperature === null) return 'unknown';
    if (temperature < TEMPERATURE_THRESHOLDS.low.max) return 'low';
    if (temperature >= TEMPERATURE_THRESHOLDS.critical.min) return 'critical';
    if (temperature >= TEMPERATURE_THRESHOLDS.warning.min && temperature <= TEMPERATURE_THRESHOLDS.warning.max) return 'warning';
    if (temperature >= TEMPERATURE_THRESHOLDS.normal.min && temperature <= TEMPERATURE_THRESHOLDS.normal.max) return 'normal';
    return 'unknown'; // Fallback for values outside defined ranges
  }, []);

  // Existing Implementation: Function to get color based on status
  // DO NOT CHANGE THIS LOGIC if it is your existing color mapping
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'critical': return '#F44336'; // Red
      case 'warning': return '#FF9800';  // Orange
      case 'low': return '#2196F3';      // Blue
      case 'normal': return '#4CAF50';   // Green
      default: return '#9E9E9E';         // Gray for unknown
    }
  }, []);

  // Existing Implementation: Function to get trend icon (logic already provided in previous update)
  const getTrendIcon = useCallback(() => {
    switch (temperatureTrend) {
      case 'up': return <TrendingUp size={16} color="#F44336" />;
      case 'down': return <TrendingDown size={16} color="#2196F3" />;
      default: return <Activity size={16} color="#4CAF50" />;
    }
  }, [temperatureTrend]);

  // Main data fetching function - Fetches real-time data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data: GpsData = await fetchGpsData();
      setGpsData(data); // Store the full GPS data

      if (data && data.temperature !== undefined && data.temperature !== null) {
        const newTemperature = data.temperature;
        setCurrentTemperature(newTemperature);
        setLastUpdate(new Date(data.createdAt).toLocaleTimeString());

        setTemperatureHistory(prevHistory => {
          const newHistoryPoint = {
            time: new Date(data.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            temperature: newTemperature
          };

          if (prevHistory.length > 0) {
            const lastRecordedTemperature = prevHistory[prevHistory.length - 1].temperature;
            if (newTemperature > lastRecordedTemperature) {
              setTemperatureTrend('up');
            } else if (newTemperature < lastRecordedTemperature) {
              setTemperatureTrend('down');
            } else {
              setTemperatureTrend('stable');
            }
          } else {
            setTemperatureTrend('stable');
          }

          const updatedHistory = [...prevHistory, newHistoryPoint];
          return updatedHistory.slice(Math.max(0, updatedHistory.length - 6));
        });

        setError(null);
      } else {
        setError('Temperature data not available.');
        setCurrentTemperature(null);
        setTemperatureTrend('stable');
      }
    } catch (err) {
      setError('Failed to fetch temperature data.');
      console.error("Error fetching temperature data:", err);
      setCurrentTemperature(null);
      setTemperatureTrend('stable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Helper to determine the position of the marker on the range bar
  const getMarkerLeftPosition = useCallback((): `${number}%` => {
    if (currentTemperature === null) return '0%';

    // Define an overall min/max for the bar for visual scaling if needed, e.g., from 30 to 42
    const overallMin = 30.0;
    const overallMax = 42.0;

    const clampedTemperature = Math.max(overallMin, Math.min(overallMax, currentTemperature));
    const percentage = ((clampedTemperature - overallMin) / (overallMax - overallMin)) * 100;
    return `${percentage}%`;
  }, [currentTemperature]);

  // Existing Mock Sensor Data (if you had multiple temperature sensors) - Preserved
  const mockSensorData = [
    { id: 1, name: 'Core Sensor', temperature: 37.0, status: 'normal' }, // Placeholder values
    { id: 2, name: 'Skin Sensor', temperature: 35.5, status: 'normal' },
    { id: 3, name: 'Ambient Sensor', temperature: 25.0, status: 'normal' },
  ];

    const mockData = {
    currentTemp: 36.8,
    normalRange: { min: 36.0, max: 37.5 },
    trend: 'stable',
    status: 'normal',
    history: [
      { time: '10:00', temp: 36.5 },
      { time: '10:30', temp: 36.7 },
      { time: '11:00', temp: 36.8 },
      { time: '11:30', temp: 36.9 },
      { time: '12:00', temp: 36.8 },
      { time: '12:30', temp: 36.7 },
      { time: '13:00', temp: 36.8 },
    ],
    alerts: [
      {
        id: 1,
        type: 'temperature_spike',
        message: 'Temperature slightly elevated',
        time: '2 hours ago',
        severity: 'low'
      },
    ],
    recommendations: [
      'Keep feet dry and clean',
      'Monitor for signs of infection',
      'Stay hydrated',
      'Contact healthcare provider if temperature exceeds 38°C',
    ],
  };

  // Logic for Health Recommendations / Temperature Alerts - NEW SECTION
  // This uses the real-time 'currentTemperature' and 'getTemperatureStatus'
  const getHealthRecommendation = useCallback(() => {
    const status = getTemperatureStatus(currentTemperature);
    switch (status) {
      case 'normal':
        return {
          icon: <CheckCircle size={20} color="#4CAF50" />,
          text: "Temperature is normal. Maintain comfortable environment.",
          color: "#4CAF50"
        };
      case 'warning':
        return {
          icon: <AlertCircle size={20} color="#FF9800" />,
          text: "Slightly elevated temperature. Monitor closely, ensure hydration.",
          color: "#FF9800"
        };
      case 'critical':
        return {
          icon: <AlertCircle size={20} color="#F44336" />,
          text: "High temperature detected! Seek medical attention if symptoms persist.",
          color: "#F44336"
        };
      case 'low':
        return {
          icon: <AlertCircle size={20} color="#2196F3" />,
          text: "Low temperature detected. Ensure warmth and monitor for hypothermia symptoms.",
          color: "#2196F3"
        };
      default:
        return {
          icon: <AlertCircle size={20} color="#9E9E9E" />,
          text: "Temperature status unknown. Data may be unavailable.",
          color: "#9E9E9E"
        };
    }
  }, [currentTemperature, getTemperatureStatus]);


  if (loading && currentTemperature === null && error === null) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading temperature data...</Text>
      </View>
    );
  }

  const recommendation = getHealthRecommendation(); // Get recommendation based on current status

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Temperature Monitoring</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchData}>
            <RefreshCw size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Current Temperature Display */}
        <View style={styles.currentTemperatureCard}>
          <View style={styles.temperatureHeader}>
            <Thermometer size={24} color="#F44336" />
            <Text style={styles.temperatureTitle}>Current Temperature</Text>
            {getTrendIcon()}
          </View>

          <View style={styles.temperatureDisplay}>
            <Text style={styles.temperatureValue}>
              {currentTemperature !== null ? currentTemperature.toFixed(1) :
               gpsData?.temperature !== undefined ? gpsData.temperature.toFixed(1) : 'N/A'}
            </Text>
            <Text style={styles.temperatureUnit}>°C</Text>
          </View>

          <View style={styles.temperatureStatus}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(getTemperatureStatus(currentTemperature)) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(getTemperatureStatus(currentTemperature)) }]}>
              {getTemperatureStatus(currentTemperature).toUpperCase()}
            </Text>
          </View>

          <Text style={styles.lastUpdate}>Updated {lastUpdate}</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {mockData.alerts.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Temperature Alerts</Text>
            {mockData.alerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <AlertTriangle size={20} color="#FF9800" />
                  <Text style={styles.alertTitle}>Temperature Alert</Text>
                  <Text style={styles.alertTime}>{alert.time}</Text>
                </View>
                <Text style={[styles.recommendationText, { color: recommendation.color }]}>
            {recommendation.text}
          </Text>
              </View>
            ))}
          </View>
        )}
        {/* Temperature Range Info (Normal Temperature Range display) */}
        <View style={styles.rangeCard}>
          <Text style={styles.rangeTitle}>Temperature Zones</Text>
          <View style={styles.tempRangeLabels}>
            {/* These labels directly reflect your TEMPERATURE_THRESHOLDS logic */}
            <Text style={[styles.tempRangeLabel, { color: getStatusColor('low') }]}>Low ({`<${TEMPERATURE_THRESHOLDS.low.max.toFixed(1)}`})</Text>
            <Text style={[styles.tempRangeLabel, { color: getStatusColor('normal') }]}>Normal ({`${TEMPERATURE_THRESHOLDS.normal.min.toFixed(1)}-${TEMPERATURE_THRESHOLDS.normal.max.toFixed(1)}`})</Text>
            <Text style={[styles.tempRangeLabel, { color: getStatusColor('warning') }]}>Warning ({`${TEMPERATURE_THRESHOLDS.warning.min.toFixed(1)}-${TEMPERATURE_THRESHOLDS.warning.max.toFixed(1)}`})</Text>
            <Text style={[styles.tempRangeLabel, { color: getStatusColor('critical') }]}>Crit. ({`>${TEMPERATURE_THRESHOLDS.critical.min.toFixed(1)}`})</Text>
          </View>
          <View style={styles.rangeBar}>
            {/* Background sections for different temperature zones - visually representing your normal range */}
            <View style={[styles.rangeSegment, { backgroundColor: getStatusColor('low'), flex: 1, left: '0%' }]} />
            <View style={[styles.rangeSegment, { backgroundColor: getStatusColor('normal'), flex: 1, left: '25%' }]} />
            <View style={[styles.rangeSegment, { backgroundColor: getStatusColor('warning'), flex: 1, left: '50%' }]} />
            <View style={[styles.rangeSegment, { backgroundColor: getStatusColor('critical'), flex: 1, left: '75%' }]} />

            <View style={[styles.currentMarker, {
              left: getMarkerLeftPosition()
            }]} />
          </View>
        </View>

        {/* Temperature History */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Temperature History</Text>
          <View style={styles.historyChart}>
            {temperatureHistory.length > 0 ? (
              temperatureHistory.map((point, index) => (
                <View key={index} style={styles.historyPoint}>
                  <View style={[styles.historyBar, {
                    // Scale height relative to a common max temperature (e.g., 40°C)
                    height: `${(point.temperature / 40) * 80 + 20}%`,
                    backgroundColor: getStatusColor(getTemperatureStatus(point.temperature))
                  }]} />
                  <Text style={styles.historyTime}>{point.time}</Text>
                  <Text style={styles.historyValue}>{point.temperature.toFixed(1)}</Text>
                </View>
              ))
            ) : (
              <Text>No history available.</Text>
            )}
          </View>
        </View>

        {/* Sensor Details (Mock Data) - Preserved */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Temperature Sensor Details (Mock Data)</Text>
          {mockSensorData.map((sensor) => (
            <View key={sensor.id} style={styles.sensorCard}>
              <View style={styles.sensorInfo}>
                <View style={[styles.sensorStatusDot, { backgroundColor: getStatusColor(sensor.status) }]} />
                <Text style={styles.sensorName}>{sensor.name}</Text>
              </View>
              <View style={styles.sensorReading}>
                <Text style={styles.sensorTemperature}>{sensor.temperature} °C</Text>
                <Text style={[styles.sensorStatus, { color: getStatusColor(sensor.status) }]}>
                  {sensor.status.toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
        </View>
<View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Normal Temperature Range</Text>
          <Text style={styles.infoText}>
            {mockData.normalRange.min}°C - {mockData.normalRange.max}°C
          </Text>
          <Text style={styles.infoSubtext}>
            Foot temperature may vary slightly from core body temperature
          </Text>
        </View>
<View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Health Recommendations</Text>
          <View style={styles.recommendationsCard}>
            {mockData.recommendations.map((recommendation, index) => (
              <View key={index} style={styles.recommendationItem}>
                <View style={styles.recommendationDot} />
                <Text style={styles.recommendationText}>{recommendation}</Text>
              </View>
            ))}
          </View>
        </View>
<View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Export Temperature Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
            <Text style={styles.secondaryButtonText}>Set Temperature Alerts</Text>
          </TouchableOpacity>
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
    fontWeight: 'bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  currentTemperatureCard: {
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
  temperatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  temperatureTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  temperatureDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  temperatureValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#F44336', // Red for temperature
  },
  temperatureUnit: {
    fontSize: 20,
    fontWeight: 'normal',
    color: '#666',
    marginLeft: 8,
  },
  temperatureStatus: {
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
    fontWeight: '500',
  },
  lastUpdate: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 10,
    textAlign: 'center',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    marginLeft: 10, // Adjust for icon
  },
  // Health Recommendation Card Styles
  healthRecommendationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 16,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  // Temperature Range Card Styles
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
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  tempRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 5,
  },
  tempRangeLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  rangeBar: {
    height: 10,
    backgroundColor: '#E0E0E0',
    borderRadius: 5,
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row', // This helps align the segments
  },
  rangeSegment: {
    height: '100%',
    // No 'position: absolute' and 'left' needed here if using flex: 1 for equal distribution
    // They are using flex: 1 and are inside a flexDirection: 'row' container
  },
  currentMarker: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 1,
    marginLeft: -8, // Center the marker on the calculated 'left' position
  },
  // History Chart Styles
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
    borderRadius: 2,
    marginBottom: 8,
    minHeight: 5,
  },
  historyTime: {
    fontSize: 10,
    fontWeight: 'normal',
    color: '#666',
    marginBottom: 2,
  },
  historyValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
  },
  // Sensor Card Styles
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
    fontWeight: '500',
    color: '#333',
  },
  sensorReading: {
    alignItems: 'flex-end',
  },
  sensorTemperature: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  sensorStatus: {
    fontSize: 12,
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
    alertCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  alertTime: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  alertMessage: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#333',
  },
  infoCard: {
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
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  recommendationsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recommendationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2196F3',
    marginTop: 8,
    marginRight: 12,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#333',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 8,
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
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
  },
    secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    color: '#2196F3',
  },
});