import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Thermometer, TrendingUp, TrendingDown, Activity, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { fetchGpsData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';

export default function TemperatureScreen() {
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
    }, 15000); // fetch every 15 seconds (ThingSpeak minimum limit)
    return () => clearInterval(interval);
  }, []);

  const mockData = {
    currentTemp: 36.8,
    normalRange: { min: 36.0, max: 37.5 },
    trend: 'stable',
    lastUpdate: gpsData ? new Date(gpsData.createdAt).toLocaleTimeString() : '1 minute ago',
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

  const getTemperatureStatus = (temp: number) => {
    if (temp >= 38.0) return 'fever';
    if (temp > mockData.normalRange.max) return 'high';
    if (temp < mockData.normalRange.min) return 'low';
    return 'normal';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fever': return '#D32F2F';
      case 'high': return '#F44336';
      case 'low': return '#2196F3';
      default: return '#4CAF50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'fever':
      case 'high':
        return <AlertTriangle size={16} color={getStatusColor(status)} />;
      default:
        return <Activity size={16} color={getStatusColor(status)} />;
    }
  };

  const getTrendIcon = () => {
    switch (mockData.trend) {
      case 'up': return <TrendingUp size={16} color="#F44336" />;
      case 'down': return <TrendingDown size={16} color="#2196F3" />;
      default: return <Activity size={16} color="#4CAF50" />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.title}>Temperature Monitoring</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={getData}>
            <RefreshCw size={20} color="#666" />
          </TouchableOpacity>
        </View>

        
        <View style={styles.currentTempCard}>
          <View style={styles.tempHeader}>
            <Thermometer size={24} color="#F44336" />
            <Text style={styles.tempTitle}>Foot Temperature</Text>
            {getTrendIcon()}
          </View>
          
          <View style={styles.tempDisplay}>
            <Text style={styles.tempValue}>{mockData.currentTemp.toFixed(1)}</Text>
            <Text style={styles.tempUnit}>°C</Text>
          </View>
          
          <View style={styles.tempStatus}>
            {getStatusIcon(mockData.status)}
            <Text style={[styles.statusText, { color: getStatusColor(mockData.status) }]}>
              {mockData.status.toUpperCase()}
            </Text>
          </View>
          
          <Text style={styles.lastUpdate}>Updated {mockData.lastUpdate}</Text>
        </View>

        <View style={styles.gaugeCard}>
          <Text style={styles.gaugeTitle}>Temperature Range</Text>
          <View style={styles.gaugeContainer}>
            <View style={styles.gaugeBar}>
              <View style={styles.coldZone} />
              <View style={styles.normalZone} />
              <View style={styles.hotZone} />
              <View style={styles.feverZone} />
            </View>
            <View style={[styles.tempMarker, { 
              left: `${Math.min(Math.max(((mockData.currentTemp - 35) / 5) * 100, 0), 100)}%` 
            }]} />
            <View style={styles.gaugeLabels}>
              <Text style={styles.gaugeLabel}>35°C</Text>
              <Text style={styles.gaugeLabel}>37°C</Text>
              <Text style={styles.gaugeLabel}>39°C</Text>
              <Text style={styles.gaugeLabel}>40°C</Text>
            </View>
          </View>
        </View>

        
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Temperature History</Text>
          <View style={styles.chartCard}>
            <View style={styles.chart}>
              {mockData.history.map((point, index) => (
                <View key={index} style={styles.chartPoint}>
                  <View style={[styles.chartBar, { 
                    height: `${((point.temp - 35) / 5) * 100}%`,
                    backgroundColor: getStatusColor(getTemperatureStatus(point.temp))
                  }]} />
                  <Text style={styles.chartTime}>{point.time}</Text>
                  <Text style={styles.chartValue}>{point.temp.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          </View>
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
                <Text style={styles.alertMessage}>{alert.message}</Text>
              </View>
            ))}
          </View>
        )}

       
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
    fontFamily: 'Roboto-Bold',
    color: '#333',
  },
  refreshButton: {
    padding: 8,
  },
  currentTempCard: {
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
  tempHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  tempTitle: {
    fontSize: 18,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginLeft: 8,
    marginRight: 8,
  },
  tempDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  tempValue: {
    fontSize: 48,
    fontFamily: 'Roboto-Bold',
    color: '#F44336',
  },
  tempUnit: {
    fontSize: 20,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginLeft: 8,
  },
  tempStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    marginLeft: 8,
  },
  lastUpdate: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  gaugeCard: {
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
  gaugeTitle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginBottom: 16,
  },
  gaugeContainer: {
    position: 'relative',
  },
  gaugeBar: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  coldZone: {
    flex: 2,
    backgroundColor: '#2196F3',
  },
  normalZone: {
    flex: 2,
    backgroundColor: '#4CAF50',
  },
  hotZone: {
    flex: 2,
    backgroundColor: '#FF9800',
  },
  feverZone: {
    flex: 1,
    backgroundColor: '#F44336',
  },
  tempMarker: {
    position: 'absolute',
    top: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  gaugeLabel: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 12,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  chartPoint: {
    alignItems: 'center',
    flex: 1,
  },
  chartBar: {
    width: 16,
    backgroundColor: '#2196F3',
    borderRadius: 2,
    marginBottom: 8,
    minHeight: 20,
  },
  chartTime: {
    fontSize: 10,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginBottom: 2,
  },
  chartValue: {
    fontSize: 10,
    fontFamily: 'Roboto-Bold',
    color: '#333',
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
