import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { 
  User, 
  Shield, 
  Bell, 
  Palette, 
  Info, 
  LogOut, 
  ChevronRight,
  MapPin,
  Thermometer,
  Gauge,
  Smartphone
} from 'lucide-react-native';

export default function SettingsScreen() {
  const [notifications, setNotifications] = useState(true);
  const [locationServices, setLocationServices] = useState(true);
  const [temperatureAlerts, setTemperatureAlerts] = useState(true);
  const [pressureAlerts, setPressureAlerts] = useState(true);

  const settingsData = {
    user: {
      name: 'John Doe',
      email: 'john.doe@example.com',
    },
    safeZone: {
      radius: 0.5, // km
      center: 'Home',
    },
  };

  const SettingsItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    rightElement,
    showChevron = true 
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    showChevron?: boolean;
  }) => (
    <TouchableOpacity style={styles.settingsItem} onPress={onPress}>
      <View style={styles.settingsItemLeft}>
        <View style={styles.settingsIcon}>
          {icon}
        </View>
        <View style={styles.settingsContent}>
          <Text style={styles.settingsTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.settingsItemRight}>
        {rightElement}
        {showChevron && !rightElement && (
          <ChevronRight size={20} color="#666" />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* User Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <User size={32} color="#FFFFFF" />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{settingsData.user.name}</Text>
              <Text style={styles.profileEmail}>{settingsData.user.email}</Text>
            </View>
            <TouchableOpacity style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safe Zone Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safe Zone</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon={<MapPin size={20} color="#2196F3" />}
              title="Safe Zone Radius"
              subtitle={`${settingsData.safeZone.radius} km from ${settingsData.safeZone.center}`}
              onPress={() => {}}
            />
            <SettingsItem
              icon={<Shield size={20} color="#4CAF50" />}
              title="Safe Zone Center"
              subtitle="Set your primary location"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon={<Bell size={20} color="#FF9800" />}
              title="Push Notifications"
              subtitle="Enable app notifications"
              rightElement={
                <Switch
                  value={notifications}
                  onValueChange={setNotifications}
                  trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
                  thumbColor={notifications ? '#FFFFFF' : '#FFFFFF'}
                />
              }
              showChevron={false}
            />
            <SettingsItem
              icon={<Thermometer size={20} color="#F44336" />}
              title="Temperature Alerts"
              subtitle="Alert when temperature is abnormal"
              rightElement={
                <Switch
                  value={temperatureAlerts}
                  onValueChange={setTemperatureAlerts}
                  trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
                  thumbColor={temperatureAlerts ? '#FFFFFF' : '#FFFFFF'}
                />
              }
              showChevron={false}
            />
            <SettingsItem
              icon={<Gauge size={20} color="#FF9800" />}
              title="Pressure Alerts"
              subtitle="Alert when pressure is abnormal"
              rightElement={
                <Switch
                  value={pressureAlerts}
                  onValueChange={setPressureAlerts}
                  trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
                  thumbColor={pressureAlerts ? '#FFFFFF' : '#FFFFFF'}
                />
              }
              showChevron={false}
            />
          </View>
        </View>

        {/* Device Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon={<MapPin size={20} color="#2196F3" />}
              title="Location Services"
              subtitle={locationServices ? "Enabled" : "Disabled"}
              rightElement={
                <Switch
                  value={locationServices}
                  onValueChange={setLocationServices}
                  trackColor={{ false: '#E0E0E0', true: '#2196F3' }}
                  thumbColor={locationServices ? '#FFFFFF' : '#FFFFFF'}
                />
              }
              showChevron={false}
            />
            <SettingsItem
              icon={<Smartphone size={20} color="#666" />}
              title="Sensor Calibration"
              subtitle="Calibrate pressure and temperature sensors"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon={<Palette size={20} color="#9C27B0" />}
              title="Theme"
              subtitle="Light mode"
              onPress={() => {}}
            />
            <SettingsItem
              icon={<Info size={20} color="#2196F3" />}
              title="About"
              subtitle="Version 1.0.0"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingsCard}>
            <SettingsItem
              icon={<LogOut size={20} color="#F44336" />}
              title="Sign Out"
              subtitle="Sign out of your account"
              onPress={() => {}}
              showChevron={false}
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Sentinel Sole v1.0.0</Text>
          <Text style={styles.appInfoText}>Protect Every Step</Text>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Roboto-Bold',
    color: '#333',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 12,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: 'Roboto-Bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontFamily: 'Roboto-Medium',
    color: '#FFFFFF',
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingsContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
    color: '#333',
    marginBottom: 2,
  },
  settingsSubtitle: {
    fontSize: 14,
    fontFamily: 'Roboto-Regular',
    color: '#666',
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appInfo: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  appInfoText: {
    fontSize: 12,
    fontFamily: 'Roboto-Regular',
    color: '#999',
    marginBottom: 4,
  },
});