import { notificationService, NotificationAlert, AlertLevel } from './NotificationService';
import { GpsData } from '../models/GpsData';

export interface DangerZone {
  id: number;
  latitude: number;
  longitude: number;
  radius: number;
  category?: string;
  name?: string;
  color?: string;
}

export interface AlertConditions {
  temperatureThresholds: {
    normal: { min: number; max: number };
    warning: { min: number; max: number };
    critical: { min: number };
    low: { max: number };
  };
  pressureThresholds: {
    normal: { min: number; max: number };
    warning: { min: number; max: number };
    critical: { max: number; min: number };
  };
  dataStaleThreshold: number; // milliseconds
  dangerZoneDistances: {
    critical: number; // 0-50m
    warning: number;  // 51-100m
    info: number;     // 101-200m
  };
}

class AlertManager {
  private activeAlerts: Map<string, NotificationAlert> = new Map();
  private previousAlerts: Map<string, NotificationAlert> = new Map();
  
  private conditions: AlertConditions = {
    temperatureThresholds: {
      normal: { min: 35.0, max: 37.5 },
      warning: { min: 37.6, max: 38.5 },
      critical: { min: 38.6 },
      low: { max: 34.9 }
    },
    pressureThresholds: {
      normal: { min: 800, max: 1050 },
      warning: { min: 750, max: 1100 },
      critical: { max: 749, min: 1101 }
    },
    dataStaleThreshold: 5 * 60 * 1000, // 5 minutes
    dangerZoneDistances: {
      critical: 50,
      warning: 100,
      info: 200
    }
  };

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private getTemperatureStatus(temperature: number | null | undefined): { status: string; level: AlertLevel | null } {
    if (temperature === null || temperature === undefined) return { status: 'unknown', level: null };
    
    if (temperature < this.conditions.temperatureThresholds.low.max) {
      return { status: 'low', level: 'info' };
    }
    if (temperature >= this.conditions.temperatureThresholds.critical.min) {
      return { status: 'critical', level: 'critical' };
    }
    if (temperature >= this.conditions.temperatureThresholds.warning.min && 
        temperature <= this.conditions.temperatureThresholds.warning.max) {
      return { status: 'warning', level: 'warning' };
    }
    if (temperature >= this.conditions.temperatureThresholds.normal.min && 
        temperature <= this.conditions.temperatureThresholds.normal.max) {
      return { status: 'normal', level: null };
    }
    return { status: 'unknown', level: null };
  }

  private getPressureStatus(pressure: number | null | undefined): { status: string; level: AlertLevel | null } {
    // Pressure alerts are disabled - always return normal status
    return { status: 'normal', level: null };
  }

  private checkDangerZones(latitude: number, longitude: number, zones: DangerZone[]): {
    status: string;
    distance: number;
    level: AlertLevel | null;
    closestZone: DangerZone | null;
  } {
    if (zones.length === 0) {
      return { status: 'Safe (No Danger Zones)', distance: 0, level: null, closestZone: null };
    }

    let closestZone: DangerZone | null = null;
    let closestDistance = Infinity;
    let alertLevel: AlertLevel | null = null;
    let status = 'Safe';

    for (const zone of zones) {
      const distance = this.calculateDistance(latitude, longitude, zone.latitude, zone.longitude);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestZone = zone;
      }

      // Check if inside danger zone
      if (distance <= zone.radius) {
        const zoneName = zone.name || `Zone ${zone.id}`;
        status = `⚠️ INSIDE ${zoneName.toUpperCase()}`;
        alertLevel = 'critical';
        break;
      }
      // Check proximity levels
      else if (distance <= zone.radius + this.conditions.dangerZoneDistances.critical) {
        if (!status.includes('INSIDE')) {
          const zoneName = zone.name || `Zone ${zone.id}`;
          status = `🚨 CRITICAL PROXIMITY to ${zoneName}`;
          alertLevel = 'critical';
        }
      }
      else if (distance <= zone.radius + this.conditions.dangerZoneDistances.warning) {
        if (!status.includes('INSIDE') && !status.includes('CRITICAL')) {
          const zoneName = zone.name || `Zone ${zone.id}`;
          status = `⚠️ APPROACHING ${zoneName.toUpperCase()}`;
          alertLevel = 'warning';
        }
      }
      else if (distance <= zone.radius + this.conditions.dangerZoneDistances.info) {
        if (!status.includes('INSIDE') && !status.includes('CRITICAL') && !status.includes('APPROACHING')) {
          const zoneName = zone.name || `Zone ${zone.id}`;
          status = `ℹ️ NEAR ${zoneName}`;
          alertLevel = 'info';
        }
      }
    }

    if (status === 'Safe' && closestZone) {
      const zoneName = closestZone.name || `Zone ${closestZone.id}`;
      status = `✅ Safe (${zoneName}: ${(closestDistance/1000).toFixed(1)}km away)`;
    }

    return { status, distance: closestDistance, level: alertLevel, closestZone };
  }

  async processAlerts(
    gpsData: GpsData | null,
    dangerZones: DangerZone[],
    deviceLocation: { latitude: number; longitude: number } | null
  ): Promise<NotificationAlert[]> {
    const newAlerts: NotificationAlert[] = [];
    const now = new Date();

    // Store previous alerts for comparison
    this.previousAlerts = new Map(this.activeAlerts);
    this.activeAlerts.clear();

    // Determine current location
    let currentLocation = null;
    if (gpsData && gpsData.latitude !== 0 && gpsData.longitude !== 0) {
      currentLocation = { latitude: gpsData.latitude, longitude: gpsData.longitude };
    } else if (deviceLocation) {
      currentLocation = deviceLocation;
    }

    // 1. Danger Zone Alerts
    if (currentLocation) {
      const dangerZoneResult = this.checkDangerZones(
        currentLocation.latitude, 
        currentLocation.longitude, 
        dangerZones
      );

      if (dangerZoneResult.level) {
        const alert: NotificationAlert = {
          id: 'danger_zone',
          type: 'danger_zone',
          level: dangerZoneResult.level,
          message: dangerZoneResult.status,
          timestamp: now,
          distance: dangerZoneResult.distance
        };
        
        newAlerts.push(alert);
        this.activeAlerts.set(alert.id, alert);

        // Trigger notification if this is a new alert or level changed
        const previousAlert = this.previousAlerts.get('danger_zone');
        if (!previousAlert || previousAlert.level !== alert.level) {
          await notificationService.triggerAlert(alert);
        }
      }
    }

    // 2. Temperature Alerts
    if (gpsData?.temperature !== undefined) {
      const tempResult = this.getTemperatureStatus(gpsData.temperature);
      if (tempResult.level) {
        const alert: NotificationAlert = {
          id: 'temperature',
          type: 'temperature',
          level: tempResult.level,
          message: `🌡️ ${tempResult.level.toUpperCase()}: Foot temperature ${gpsData.temperature.toFixed(1)}°C`,
          timestamp: now,
          value: gpsData.temperature,
          threshold: tempResult.status === 'critical' ? this.conditions.temperatureThresholds.critical.min : 
                    tempResult.status === 'low' ? this.conditions.temperatureThresholds.low.max : undefined
        };
        
        newAlerts.push(alert);
        this.activeAlerts.set(alert.id, alert);

        // Trigger notification for new temperature alerts
        const previousAlert = this.previousAlerts.get('temperature');
        if (!previousAlert || previousAlert.level !== alert.level) {
          await notificationService.triggerAlert(alert);
        }
      }
    }

    // 3. Pressure Alerts - DISABLED
    // Pressure alerts have been disabled per user request

    // 4. GPS/Location Alerts - DISABLED
    // Location source alerts have been disabled per user request

    // 5. Data Staleness Alerts
    if (gpsData && (now.getTime() - new Date(gpsData.createdAt).getTime()) > this.conditions.dataStaleThreshold) {
      const alert: NotificationAlert = {
        id: 'data_stale',
        type: 'data_stale',
        level: 'warning',
        message: '⏰ WARNING: Sensor data is outdated',
        timestamp: now
      };
      
      newAlerts.push(alert);
      this.activeAlerts.set(alert.id, alert);

      // Trigger notification for stale data
      const previousAlert = this.previousAlerts.get('data_stale');
      if (!previousAlert) {
        await notificationService.triggerAlert(alert);
      }
    }

    // Sort alerts by priority
    newAlerts.sort((a, b) => {
      const levelOrder = { 'critical': 3, 'warning': 2, 'info': 1 };
      return (levelOrder[b.level] || 0) - (levelOrder[a.level] || 0);
    });

    return newAlerts;
  }

  getActiveAlerts(): NotificationAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  clearAllAlerts() {
    this.activeAlerts.clear();
    this.previousAlerts.clear();
    notificationService.clearAlertCooldowns();
  }

  updateConditions(newConditions: Partial<AlertConditions>) {
    this.conditions = { ...this.conditions, ...newConditions };
  }
}

export const alertManager = new AlertManager();
