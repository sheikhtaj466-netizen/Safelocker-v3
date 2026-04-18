// File: src/screens/PasskeyManagementScreen.js
import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeContext } from '../ThemeContext';
import NumericPasskeyModal from '../components/NumericPasskeyModal';

export default function PasskeyManagementScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#6C5CE7';

  // Core Passkey States
  const [customPin, setCustomPin] = useState('');
  const [autoFallback, setAutoFallback] = useState(true);
  const [mailAlerts, setMailAlerts] = useState(true);
  const [reauthTimeout, setReauthTimeout] = useState('60 sec'); // Default 60 sec
  
  // UI States
  const [showCustomPinModal, setShowCustomPinModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  
  const timeoutOptions = ['Always ask', '30 sec', '60 sec', '5 min'];

  // 🔥 Architecture Rule: Passkey is ONLY active if Numeric is set.
  const isPasskeyFullyActive = customPin.length >= 4; 

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const pin = await AsyncStorage.getItem('CUSTOM_PASSKEY_PIN');
        if(pin) setCustomPin(pin);
        
        const timer = await AsyncStorage.getItem('PASSKEY_REAUTH_TIMER');
        if(timer) setReauthTimeout(timer);

        const fallback = await AsyncStorage.getItem('PASSKEY_AUTO_FALLBACK');
        if(fallback !== null) setAutoFallback(JSON.parse(fallback));

        const alerts = await AsyncStorage.getItem('PASSKEY_MAIL_ALERTS');
        if(alerts !== null) setMailAlerts(JSON.parse(alerts));
      } catch (error) {
        console.error("Error loading passkey settings:", error);
      }
    };
    loadSettings();
  }, []);

  const handleTimeoutChange = async (val) => {
    Haptics.selectionAsync();
    setReauthTimeout(val);
    await AsyncStorage.setItem('PASSKEY_REAUTH_TIMER', val);
    setShowTimeoutModal(false);
  };

  const handleAutoFallbackToggle = async (val) => {
    Haptics.selectionAsync();
    setAutoFallback(val);
    await AsyncStorage.setItem('PASSKEY_AUTO_FALLBACK', JSON.stringify(val));
  };

  const handleMailAlertsToggle = async (val) => {
    Haptics.selectionAsync();
    setMailAlerts(val);
    await AsyncStorage.setItem('PASSKEY_MAIL_ALERTS', JSON.stringify(val));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background[0] : '#F8FAFC' }]}>
      
      {/* App Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Management</Text>
          <Text style={[styles.headerSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>Trusted devices & key settings</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* 🔥 Dynamic Security Health Card */}
        <LinearGradient colors={isDark ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F1F5F9']} style={[styles.healthCard, { borderColor: isPasskeyFullyActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)' }]}>
          <View style={styles.healthHeader}>
            <View style={[styles.healthIconBox, { backgroundColor: isPasskeyFullyActive ? '#10B98120' : '#F59E0B20' }]}>
              <Feather name={isPasskeyFullyActive ? "shield" : "alert-triangle"} size={24} color={isPasskeyFullyActive ? "#10B981" : "#F59E0B"} />
            </View>
            <View style={[styles.healthBadge, { backgroundColor: isPasskeyFullyActive ? '#10B981' : '#F59E0B' }]}>
              <Text style={styles.healthBadgeText}>{isPasskeyFullyActive ? 'Active' : 'Setup Required'}</Text>
            </View>
          </View>
          <Text style={[styles.healthTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            {isPasskeyFullyActive ? 'Passkey is Secure' : 'Incomplete Setup'}
          </Text>
          <Text style={styles.healthSub}>
            {isPasskeyFullyActive 
              ? 'Local biometric and numeric fallback are active and protecting sensitive actions.' 
              : 'You must set a Numeric Fallback PIN to fully enable Passkey protection.'}
          </Text>
        </LinearGradient>

        {/* CORE SECURITY CONTROLS */}
        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>AUTHORIZATION SETTINGS</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          
          <TouchableOpacity style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => setShowCustomPinModal(true)}>
            <View style={styles.rowLeft}>
              <View style={[styles.settingsIconBox, { backgroundColor: primaryColor + '15' }]}><Feather name="hash" size={20} color={primaryColor} /></View>
              <View>
                <Text style={[styles.rowTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Numeric Fallback PIN</Text>
                <Text style={styles.rowSub}>Required if Biometric fails</Text>
              </View>
            </View>
            <View style={[styles.recBadge, { backgroundColor: customPin ? '#10B98115' : '#F59E0B15' }]}>
                <Text style={{color: customPin ? '#10B981' : '#F59E0B', fontSize: 10, fontWeight: '800'}}>{customPin ? 'ACTIVE' : 'SETUP'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => setShowTimeoutModal(true)}>
            <View style={styles.rowLeft}>
              <View style={[styles.settingsIconBox, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}><Feather name="clock" size={20} color={isDark ? '#E2E8F0' : '#475569'} /></View>
              <View>
                <Text style={[styles.rowTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Re-auth Timeout</Text>
                <Text style={styles.rowSub}>Remember passkey for {reauthTimeout}</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#475569' : '#CBD5E1'} />
          </TouchableOpacity>

          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.settingsIconBox, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}><Feather name="shield-off" size={20} color={isDark ? '#E2E8F0' : '#475569'} /></View>
              <View>
                <Text style={[styles.rowTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Auto Fallback to OTP</Text>
                <Text style={styles.rowSub}>If biometric fails 3 times</Text>
              </View>
            </View>
            <Switch 
              trackColor={{ false: isDark ? "#3D3D5C" : "#E2E8F0", true: primaryColor + "80" }} 
              thumbColor={autoFallback ? primaryColor : (isDark ? "#8A8FA3" : "#FFFFFF")} 
              onValueChange={handleAutoFallbackToggle} 
              value={autoFallback} 
              style={{ transform: [{ scale: 0.9 }] }} 
            />
          </View>
        </View>

        {/* LOGS & ALERTS */}
        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>MONITORING & ALERTS</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          
          <TouchableOpacity style={[styles.settingsRow, { borderBottomColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => navigation.navigate('ActivityLog')}>
            <View style={styles.rowLeft}>
              <View style={[styles.settingsIconBox, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}><Feather name="list" size={20} color={isDark ? '#E2E8F0' : '#475569'} /></View>
              <View>
                <Text style={[styles.rowTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Passkey Security Logs</Text>
                <Text style={styles.rowSub}>Track all auth approvals & failures</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={isDark ? '#475569' : '#CBD5E1'} />
          </TouchableOpacity>

          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <View style={[styles.settingsIconBox, { backgroundColor: '#F59E0B15' }]}><Feather name="mail" size={20} color="#F59E0B" /></View>
              <View>
                <Text style={[styles.rowTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Critical Mail Alerts</Text>
                <Text style={styles.rowSub}>Instant email on passkey changes</Text>
              </View>
            </View>
            <Switch 
              trackColor={{ false: isDark ? "#3D3D5C" : "#E2E8F0", true: "#F59E0B80" }} 
              thumbColor={mailAlerts ? "#F59E0B" : (isDark ? "#8A8FA3" : "#FFFFFF")} 
              onValueChange={handleMailAlertsToggle} 
              value={mailAlerts} 
              style={{ transform: [{ scale: 0.9 }] }} 
            />
          </View>
        </View>

      </ScrollView>

      {/* COMPONENT INTEGRATION */}
      {showCustomPinModal && (
        <NumericPasskeyModal 
          visible={showCustomPinModal} 
          onClose={() => setShowCustomPinModal(false)}
          isDark={isDark}
          themeColors={themeColors}
          primaryColor={primaryColor}
          onSaveSuccess={async (newPin) => {
            // 1. Update Local Screen State
            setCustomPin(newPin);
            setShowCustomPinModal(false);

            // 🔥 2. SENIOR DEV FIX: Global Settings update karo taaki VaultScreen ka popup bhag jaye! 🔥
            try {
              const settingsStr = await AsyncStorage.getItem('settings');
              let existingSettings = {};
              if (settingsStr) { existingSettings = JSON.parse(settingsStr); }
              
              const updatedSettings = {
                ...existingSettings,
                passkeyEnabled: true  // Isko true karte hi VaultScreen shant ho jayega
              };
              
              await AsyncStorage.setItem('settings', JSON.stringify(updatedSettings));
              
              // Optional: Navigation wapas Vault me bhej do (Agar auto-back karna hai toh)
              // navigation.goBack(); 
              
            } catch (error) {
              console.log("Error updating global settings for Passkey: ", error);
            }
          }}
        />
      )}

      {/* TIMEOUT SELECTION MODAL */}
      <Modal visible={showTimeoutModal} transparent animationType="fade">
        <View style={styles.overlayCenter}>
          <View style={[styles.timeoutCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
            <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 16 }]}>Re-auth Timeout</Text>
            <Text style={{fontSize: 14, color: '#64748B', marginBottom: 20, textAlign: 'center'}}>
              Skip passkey verification for subsequent critical actions within this timeframe.
            </Text>
            
            {timeoutOptions.map((opt) => (
              <TouchableOpacity key={opt} style={[styles.timeoutRow, { borderBottomColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => handleTimeoutChange(opt)}>
                <Text style={[styles.timeoutText, { color: isDark ? '#FFF' : '#000' }, reauthTimeout === opt && {color: primaryColor, fontWeight: '800'}]}>{opt}</Text>
                {reauthTimeout === opt && <Feather name="check-circle" size={20} color={primaryColor} />}
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={{marginTop: 20, padding: 10}} onPress={() => setShowTimeoutModal(false)}>
              <Text style={{color: '#64748B', fontWeight: '700', fontSize: 16}}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start', marginRight: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  
  healthCard: { width: '100%', borderRadius: 28, padding: 24, marginBottom: 24, elevation: 5, borderWidth: 1 },
  healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  healthIconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  healthBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },
  healthBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  healthTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  healthSub: { fontSize: 14, color: '#64748B', lineHeight: 20 },
  
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 12, marginLeft: 8 },
  card: { width: '100%', borderRadius: 28, paddingVertical: 8, marginBottom: 28 },
  
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingsIconBox: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  rowTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  rowSub: { fontSize: 12, color: '#64748B' },
  recBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },

  overlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  timeoutCard: { width: '100%', maxWidth: 360, borderRadius: 28, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800' },
  timeoutRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1 },
  timeoutText: { fontSize: 16, fontWeight: '600' }
});
