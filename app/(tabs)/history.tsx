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
  // Fetch historical data
  const fetchData = async () => {
    try {
      setError(null);
      const data = await fetchHistoricalData(168); // Get last 168 data points (about 7 days if data every hour)
      setHistoricalData(data);
      console.log(`Fetched ${data.length} historical data points`);
    } catch (err) {
      setError('Failed to fetch historical data');
      console.error('Error fetching historical data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Process historical data into daily summaries
  const processDailyData = (): DailyData[] => {
    if (historicalData.length === 0) return [];

    const dailyGroups: { [key: string]: GpsData[] } = {};

    // Group data by date
    historicalData.forEach(item => {
      const date = new Date(item.createdAt).toDateString();
      if (!dailyGroups[date]) {
        dailyGroups[date] = [];
      }
      dailyGroups[date].push(item);
    });

    // Convert to daily summaries
    const dailyData: DailyData[] = Object.entries(dailyGroups)
      .map(([dateStr, dayData]) => {
        const date = new Date(dateStr);
        const temperatures = dayData.filter(d => d.temperature !== undefined).map(d => d.temperature!);
        const pressures = dayData.filter(d => d.pressure !== undefined).map(d => d.pressure!);
        const insideCount = dayData.filter(d => d.status === 'inside').length;

        return {
          date: date.toISOString().split('T')[0],
          dayName: getDayName(date),
          temperature: temperatures.length > 0 ? {
            min: Math.min(...temperatures),
            max: Math.max(...temperatures),
            avg: temperatures.reduce((a, b) => a + b, 0) / temperatures.length
          } : null,
          pressure: pressures.length > 0 ? {
            min: Math.min(...pressures),
            max: Math.max(...pressures),
            avg: pressures.reduce((a, b) => a + b, 0) / pressures.length
          } : null,
          safeZoneStatus: insideCount > dayData.length / 2 ? 'inside' : 'outside',
          alerts: dayData.filter(d => d.status === 'outside').length,
          dataPoints: dayData.length
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 7); // Last 7 days

    return dailyData;
  };

  const getDayName = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Calculate summary statistics
  const calculateSummary = () => {
    if (historicalData.length === 0) {
      return {
        avgTemp: 0,
        avgPressure: 0,
        alertsCount: 0,
        safeZoneTime: '0%',
        dataPoints: 0
      };
    }

    const temperatures = historicalData.filter(d => d.temperature !== undefined).map(d => d.temperature!);
    const pressures = historicalData.filter(d => d.pressure !== undefined).map(d => d.pressure!);
    const insideCount = historicalData.filter(d => d.status === 'inside').length;
    const outsideCount = historicalData.filter(d => d.status === 'outside').length;

    return {
      avgTemp: temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : 0,
      avgPressure: pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : 0,
      alertsCount: outsideCount,
      safeZoneTime: historicalData.length > 0 ? `${Math.round((insideCount / historicalData.length) * 100)}%` : '0%',
      dataPoints: historicalData.length
    };
  };

  const dailyData = processDailyData();
  const summary = calculateSummary();

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading historical data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>History & Analytics</Text>
            <Text style={styles.subtitle}>
              {historicalData.length > 0 ? `Last ${Math.ceil(historicalData.length / 24)} days` : 'No data available'}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.headerButton} onPress={onRefresh}>
              <RefreshCw size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Filter size={20} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton}>
              <Calendar size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.dataPoints}</Text>
              <Text style={styles.summaryLabel}>Data Points</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {summary.avgTemp > 0 ? `${summary.avgTemp.toFixed(1)}°C` : 'N/A'}
              </Text>
              <Text style={styles.summaryLabel}>Avg Temperature</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {summary.avgPressure > 0 ? summary.avgPressure.toFixed(0) : 'N/A'}
              </Text>
              <Text style={styles.summaryLabel}>Avg Pressure (FSR)</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{summary.safeZoneTime}</Text>
              <Text style={styles.summaryLabel}>Safe Zone Time</Text>
            </View>
          </View>
        </View>

        {/* Data Status */}
        {historicalData.length === 0 && !loading && (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No historical data available</Text>
            <Text style={styles.noDataSubtext}>Data will appear here once sensor readings are collected</Text>
          </View>
        )}
        {/* Daily History */}
        {dailyData.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Daily History</Text>
            {dailyData.map((day, index) => (
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
                    <Text style={styles.metricLabel}>Data Points</Text>
                    <Text style={styles.metricValue}>{day.dataPoints}</Text>
                  </View>

                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Temperature</Text>
                    {day.temperature ? (
                      <>
                        <Text style={styles.metricValue}>{day.temperature.avg.toFixed(1)}°C</Text>
                        <Text style={styles.metricRange}>
                          {day.temperature.min.toFixed(1)}° - {day.temperature.max.toFixed(1)}°
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.metricValue}>N/A</Text>
                    )}
                  </View>

                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Pressure</Text>
                    {day.pressure ? (
                      <>
                        <Text style={styles.metricValue}>{day.pressure.avg.toFixed(0)}</Text>
                        <Text style={styles.metricRange}>
                          {day.pressure.min.toFixed(0)} - {day.pressure.max.toFixed(0)}
                        </Text>
                      </>
                    ) : (
                      <Text style={styles.metricValue}>N/A</Text>
                    )}
                  </View>
                </View>

                <View style={styles.dayFooter}>
                  <Text style={styles.alertsText}>
                    {day.alerts} alert{day.alerts !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
        {/* Insights */}
        {historicalData.length > 0 && (
          <View style={styles.insightsContainer}>
            <Text style={styles.sectionTitle}>Data Insights</Text>
            <View style={styles.insightsCard}>
              <Text style={styles.insightText}>
                📊 Collected {summary.dataPoints} data points from your smart footwear sensors.
              </Text>
              {summary.avgTemp > 0 && (
                <Text style={styles.insightText}>
                  🌡️ Average temperature: {summary.avgTemp.toFixed(1)}°C - {summary.avgTemp > 37 ? 'Monitor for elevated readings' : 'Within normal range'}.
                </Text>
              )}
              {summary.avgPressure > 0 && (
                <Text style={styles.insightText}>
                  ⚖️ Average pressure: {summary.avgPressure.toFixed(0)} FSR - Monitoring foot pressure distribution.
                </Text>
              )}
              <Text style={styles.insightText}>
                🛡️ Safe zone compliance: {summary.safeZoneTime} - {parseInt(summary.safeZoneTime) > 80 ? 'Excellent monitoring coverage' : 'Consider staying within monitored areas more often'}.
              </Text>
            </View>
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Roboto-Regular',
    color: '#666',
    marginTop: 16,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#D32F2F',
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#D32F2F',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryButtonText: {
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
  },
  noDataContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#666',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#999',
    textAlign: 'center',
  },
  dayFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  alertsText: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
});