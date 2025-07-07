import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Download, Filter, TrendingUp, MapPin, Thermometer, Gauge, RefreshCw } from 'lucide-react-native';
import { fetchHistoricalData } from '../../services/ThingSpeakService';
import { GpsData } from '../../models/GpsData';

interface DailyData {
  date: string;
  dayName: string;
  temperature: { min: number; max: number; avg: number } | null;
  pressure: { min: number; max: number; avg: number } | null;
  safeZoneStatus: 'inside' | 'outside';
  alerts: number;
  dataPoints: number;
}

export default function HistoryScreen() {
  const [historicalData, setHistoricalData] = useState<GpsData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const mockData = {
    dateRange: 'Last 7 Days',
    summary: {
      totalSteps: 8542,
      avgTemp: 36.7,
      avgPressure: 847,
      alertsCount: 3,
      safeZoneTime: '85%',
    },
    dailyData: [
      {
        date: '2024-01-20',
        dayName: 'Today',
        steps: 1245,
        temperature: { min: 36.2, max: 37.1, avg: 36.8 },
        pressure: { min: 820, max: 890, avg: 855 },
        safeZoneStatus: 'inside',
        alerts: 0,
      },
      {
        date: '2024-01-19',
        dayName: 'Yesterday',
        steps: 1890,
        temperature: { min: 36.1, max: 36.9, avg: 36.6 },
        pressure: { min: 810, max: 875, avg: 842 },
        safeZoneStatus: 'inside',
        alerts: 1,
      },
      {
        date: '2024-01-18',
        dayName: 'Thu',
        steps: 2156,
        temperature: { min: 36.3, max: 37.2, avg: 36.8 },
        pressure: { min: 825, max: 885, avg: 850 },
        safeZoneStatus: 'outside',
        alerts: 2,
      },
      {
        date: '2024-01-17',
        dayName: 'Wed',
        steps: 987,
        temperature: { min: 36.0, max: 36.8, avg: 36.5 },
        pressure: { min: 805, max: 860, avg: 835 },
        safeZoneStatus: 'inside',
        alerts: 0,
      },
      {
        date: '2024-01-16',
        dayName: 'Tue',
        steps: 1456,
        temperature: { min: 36.2, max: 37.0, avg: 36.7 },
        pressure: { min: 815, max: 880, avg: 845 },
        safeZoneStatus: 'inside',
        alerts: 0,
      },
    ],
    weeklyTrends: {
      temperatureTrend: 'stable',
      pressureTrend: 'increasing',
      activityTrend: 'decreasing',
    },
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return '#4CAF50';
      case 'decreasing': return '#F44336';
      default: return '#FF9800';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp size={16} color={getTrendColor(trend)} />;
      case 'decreasing': return <TrendingUp size={16} color={getTrendColor(trend)} style={{ transform: [{ rotate: '180deg' }] }} />;
      default: return <TrendingUp size={16} color={getTrendColor(trend)} style={{ transform: [{ rotate: '90deg' }] }} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>History & Analytics</Text>
            <Text style={styles.subtitle}>{mockData.dateRange}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton}>
              <Filter size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Calendar size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{mockData.summary.totalSteps.toLocaleString()}</Text>
              <Text style={styles.summaryLabel}>Total Steps</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{mockData.summary.avgTemp}°C</Text>
              <Text style={styles.summaryLabel}>Avg Temperature</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{mockData.summary.avgPressure}</Text>
              <Text style={styles.summaryLabel}>Avg Pressure</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{mockData.summary.safeZoneTime}</Text>
              <Text style={styles.summaryLabel}>Safe Zone Time</Text>
            </View>
          </View>
        </View>

        {/* Weekly Trends */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Weekly Trends</Text>
          <View style={styles.trendsCard}>
            <View style={styles.trendItem}>
              <Thermometer size={20} color="#F44336" />
              <Text style={styles.trendLabel}>Temperature</Text>
              {getTrendIcon(mockData.weeklyTrends.temperatureTrend)}
              <Text style={[styles.trendValue, { color: getTrendColor(mockData.weeklyTrends.temperatureTrend) }]}>
                {mockData.weeklyTrends.temperatureTrend}
              </Text>
            </View>
            
            <View style={styles.trendItem}>
              <Gauge size={20} color="#FF9800" />
              <Text style={styles.trendLabel}>Pressure</Text>
              {getTrendIcon(mockData.weeklyTrends.pressureTrend)}
              <Text style={[styles.trendValue, { color: getTrendColor(mockData.weeklyTrends.pressureTrend) }]}>
                {mockData.weeklyTrends.pressureTrend}
              </Text>
            </View>
            
            <View style={styles.trendItem}>
              <MapPin size={20} color="#2196F3" />
              <Text style={styles.trendLabel}>Activity</Text>
              {getTrendIcon(mockData.weeklyTrends.activityTrend)}
              <Text style={[styles.trendValue, { color: getTrendColor(mockData.weeklyTrends.activityTrend) }]}>
                {mockData.weeklyTrends.activityTrend}
              </Text>
            </View>
          </View>
        </View>

        {/* Daily History */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Daily History</Text>
          {mockData.dailyData.map((day, index) => (
            <View key={day.date} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View>
                  <Text style={styles.dayName}>{day.dayName}</Text>
                  <Text style={styles.dayDate}>{new Date(day.date).toLocaleDateString()}</Text>
                </View>
                <View style={styles.dayStatus}>
                  <View style={[styles.statusDot, { 
                    backgroundColor: day.safeZoneStatus === 'inside' ? '#4CAF50' : '#F44336' 
                  }]} />
                  <Text style={styles.statusText}>
                    {day.safeZoneStatus === 'inside' ? 'Safe Zone' : 'Outside Zone'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.dayMetrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Steps</Text>
                  <Text style={styles.metricValue}>{day.steps.toLocaleString()}</Text>
                </View>
                
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Temperature</Text>
                  <Text style={styles.metricValue}>{day.temperature.avg}°C</Text>
                  <Text style={styles.metricRange}>
                    {day.temperature.min}° - {day.temperature.max}°
                  </Text>
                </View>
                
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Pressure</Text>
                  <Text style={styles.metricValue}>{day.pressure.avg}</Text>
                  <Text style={styles.metricRange}>
                    {day.pressure.min} - {day.pressure.max}
                  </Text>
                </View>
              </View>
              
              {day.alerts > 0 && (
                <View style={styles.alertsIndicator}>
                  <Text style={styles.alertsText}>
                    {day.alerts} alert{day.alerts > 1 ? 's' : ''} generated
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Export Options */}
        <View style={styles.exportContainer}>
          <Text style={styles.sectionTitle}>Export Data</Text>
          <View style={styles.exportButtons}>
            <TouchableOpacity style={styles.exportButton}>
              <Download size={20} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>Export PDF Report</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.exportButton, styles.secondaryExportButton]}>
              <Download size={20} color="#2196F3" />
              <Text style={styles.secondaryExportButtonText}>Export CSV Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Insights */}
        <View style={styles.insightsContainer}>
          <Text style={styles.sectionTitle}>Health Insights</Text>
          <View style={styles.insightsCard}>
            <Text style={styles.insightText}>
              📊 Your average temperature has remained stable this week, indicating good foot health.
            </Text>
            <Text style={styles.insightText}>
              🏃‍♂️ Activity levels have decreased by 15% compared to last week. Consider increasing daily movement.
            </Text>
            <Text style={styles.insightText}>
              🛡️ You've spent 85% of your time within the safe zone, which is excellent for monitoring.
            </Text>
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
  title: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    textAlign: 'center',
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
  trendsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  trendLabel: {
    fontSize: 16,
    fontFamily: 'Roboto-Regular',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  trendValue: {
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  dayCard: {
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
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayName: {
    fontSize: 18,
    fontFamily: 'Roboto-Medium',
    color: '#333',
  },
  dayDate: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 2,
  },
  dayStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#666',
  },
  dayMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 2,
  },
  metricRange: {
    fontSize: 10,
    fontFamily: 'Roboto-Regular',
    color: '#999',
  },
  alertsIndicator: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FF9800',
  },
  alertsText: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#F57C00',
  },
  exportContainer: {
    marginBottom: 24,
  },
  exportButtons: {
    flexDirection: 'row',
  },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
  },
  exportButtonText: {
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  secondaryExportButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  secondaryExportButtonText: {
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    color: '#2196F3',
    marginLeft: 8,
  },
  insightsContainer: {
    marginBottom: 24,
  },
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  insightText: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#333',
    lineHeight: 20,
    marginBottom: 12,
  },
});