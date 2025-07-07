import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertType = 'danger_zone' | 'temperature' | 'pressure' | 'location' | 'data_stale';

export interface NotificationAlert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  message: string;
  timestamp: Date;
  distance?: number;
  value?: number;
  threshold?: number;
}

export interface NotificationConfig {
  enableHaptics: boolean;
  enableAudio: boolean;
  enableVisual: boolean;
  criticalAlertCooldown: number; // milliseconds
  warningAlertCooldown: number; // milliseconds
}

class NotificationService {
  private config: NotificationConfig = {
    enableHaptics: true,
    enableAudio: true,
    enableVisual: true,
    criticalAlertCooldown: 5000, // 5 seconds
    warningAlertCooldown: 10000, // 10 seconds
  };

  private lastAlertTimes: Map<string, number> = new Map();
  private audioSounds: Map<string, Audio.Sound> = new Map();
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Set audio mode for alerts
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Pre-load audio files (using system sounds for now)
      // In a real app, you would load custom audio files from assets
      this.isInitialized = true;
      console.log('NotificationService initialized');
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
    }
  }

  private async playSystemSound(soundType: 'critical' | 'warning' | 'info') {
    if (!this.config.enableAudio) return;

    try {
      // Use system sounds for different alert levels
      switch (soundType) {
        case 'critical':
          // Play a critical alert sound (you can replace with custom audio file)
          await Audio.Sound.createAsync(
            { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
            { shouldPlay: true, volume: 1.0 }
          );
          break;
        case 'warning':
          // Play a warning sound
          await Audio.Sound.createAsync(
            { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-04.wav' },
            { shouldPlay: true, volume: 0.7 }
          );
          break;
        case 'info':
          // Play a subtle notification sound
          await Audio.Sound.createAsync(
            { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-01.wav' },
            { shouldPlay: true, volume: 0.5 }
          );
          break;
      }
    } catch (error) {
      console.log('Audio playback not available:', error);
    }
  }

  private async triggerHapticFeedback(level: AlertLevel, distance?: number) {
    if (!this.config.enableHaptics) return;

    try {
      switch (level) {
        case 'critical':
          // Strong vibration for critical alerts (inside danger zone)
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          // For very close danger zones, add additional vibrations for maximum intensity
          if (distance !== undefined && distance <= 50) {
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 600);
          }
          break;
        case 'warning':
          // Medium vibration for warnings (approaching danger zone)
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (distance !== undefined && distance <= 100) {
            setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 300);
          }
          break;
        case 'info':
          // Light vibration for info (near danger zone)
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
      }
      console.log(`Haptic feedback triggered for ${level} alert at ${distance}m`);
    } catch (error) {
      console.log('Haptic feedback not available:', error);
    }
  }

  private shouldTriggerAlert(alertId: string, level: AlertLevel): boolean {
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(alertId) || 0;
    
    const cooldown = level === 'critical' 
      ? this.config.criticalAlertCooldown 
      : this.config.warningAlertCooldown;

    if (now - lastAlertTime < cooldown) {
      return false;
    }

    this.lastAlertTimes.set(alertId, now);
    return true;
  }

  async triggerAlert(alert: NotificationAlert): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cooldown to prevent spam
    if (!this.shouldTriggerAlert(alert.id, alert.level)) {
      return;
    }

    console.log(`Triggering ${alert.level} alert:`, alert.message);

    // Trigger haptic feedback
    await this.triggerHapticFeedback(alert.level, alert.distance);

    // Play audio alert
    await this.playSystemSound(alert.level);

    // For critical alerts, show system alert dialog
    if (alert.level === 'critical' && this.config.enableVisual) {
      Alert.alert(
        '🚨 CRITICAL ALERT',
        alert.message,
        [{ text: 'OK', style: 'default' }],
        { cancelable: false }
      );
    }
  }

  getDangerZoneAlertLevel(distance: number): AlertLevel {
    if (distance <= 50) return 'critical';
    if (distance <= 100) return 'warning';
    if (distance <= 200) return 'info';
    return 'info'; // Default for distances > 200m
  }

  getAlertIntensity(distance: number): 'maximum' | 'high' | 'medium' | 'low' {
    if (distance <= 50) return 'maximum';
    if (distance <= 100) return 'high';
    if (distance <= 200) return 'medium';
    return 'low';
  }

  updateConfig(newConfig: Partial<NotificationConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  clearAlertCooldowns() {
    this.lastAlertTimes.clear();
  }

  async cleanup() {
    // Clean up audio resources
    for (const [key, sound] of this.audioSounds) {
      try {
        await sound.unloadAsync();
      } catch (error) {
        console.log(`Failed to unload sound ${key}:`, error);
      }
    }
    this.audioSounds.clear();
  }
}

export const notificationService = new NotificationService();
