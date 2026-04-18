// File: src/screens/EntryDetailScreen.js
import React, { useState, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Platform, Pressable, Animated, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';

import { ThemeContext } from '../ThemeContext';
import { getVaultData, saveVaultData, logActivity } from '../utils/storage';

const SECURE_KEYS = ['password', 'pin', 'cvv', 'twoFactor', 'backupCodes', 'secret'];
const IGNORE_KEYS = ['id', 'title', 'type', 'createdAt', 'updatedAt'];

const formatLabel = (key) => {
  const labels = {
    username: 'Username / Email',
    password: 'Password',
    url: 'Website / URL',
    notes: 'Notes',
    cardNumber: 'Card Number',
    expiry: 'Expiry Date',
    cvv: 'CVV',
    pin: 'PIN',
    accHolder: 'Account Holder',
    accNumber: 'Account Number',
    ifsc: 'IFSC Code',
    bankName: 'Bank Name',
    ssid: 'WiFi Name (SSID)',
    twoFactor: '2FA Secret'
  };
  if (labels[key]) return labels[key];
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').trim();
};

export default function EntryDetailScreen({ route, navigation }) {
  const { entry } = route.params;
  const { isDark, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#12C7B2'; // 🔥 Smart Accent Sync
  
  const [visibleFields, setVisibleFields] = useState({});

  // 🔥 SMART TOAST SYSTEM STATE
  const [toast, setToast] = useState({ visible: false, message: '', icon: 'info', color: primaryColor });
  const toastAnim = useRef(new Animated.Value(-50)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // 🔥 CUSTOM PREMIUM ALERT STATE
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', actionText: '', actionStyle: 'primary', onConfirm: null });

  // TOAST ENGINE
  const showToast = (message, icon = 'check-circle', color = primaryColor) => {
    setToast({ visible: true, message, icon, color });
    Animated.parallel([
      Animated.spring(toastAnim, { toValue: 0, damping: 14, useNativeDriver: true }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastAnim, { toValue: -50, duration: 200, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start(() => setToast(prev => ({ ...prev, visible: false })));
    }, 2500);
  };

  // CUSTOM ALERT ENGINE
  const showCustomAlert = (title, message, actionText, actionStyle, onConfirm) => {
    setAlertConfig({ visible: true, title, message, actionText, actionStyle, onConfirm });
  };
  const hideCustomAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  // 🔥 THE SECURITY GATEKEEPER
  const requireAuth = async (onSuccess) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify identity to access secure data',
          fallbackLabel: 'Use PIN',
          disableDeviceFallback: false, 
        });
        
        if (auth.success) {
          onSuccess();
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          showToast('Authentication failed', 'alert-circle', '#EF4444');
        }
      } else {
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify identity' });
        if (auth.success) onSuccess();
      }
    } catch (error) {
      showToast('Authentication Error', 'alert-circle', '#EF4444');
    }
  };

  const toggleVisibility = (key) => {
    if (visibleFields[key]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setVisibleFields(prev => ({ ...prev, [key]: false }));
    } else {
      requireAuth(async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVisibleFields(prev => ({ ...prev, [key]: true }));
        await logActivity('Vault', 'SECURE_VIEWED', `Viewed secure field in ${entry.title}.`, 'IMPORTANT');
      });
    }
  };

  const copyToClipboard = async (key, value, isSecure, label) => {
    if (!value) return;

    const executeCopy = async () => {
      await Clipboard.setStringAsync(String(value));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(`${label} copied securely`, 'copy', primaryColor); // 🔥 Premium Toast Triggered
      
      if (isSecure) {
        await logActivity('Security', 'SECURE_COPIED', `Copied sensitive field from ${entry.title}.`, 'CRITICAL');
      }
    };

    if (isSecure && !visibleFields[key]) {
      requireAuth(executeCopy);
    } else {
      executeCopy();
    }
  };

  // 🔥 REPLACED NATIVE ALERT WITH CUSTOM VIP MODAL
  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showCustomAlert(
      "Delete Entry",
      `Are you sure you want to permanently delete "${entry.title}"? This action cannot be undone.`,
      "Delete", 
      "destructive",
      () => {
         hideCustomAlert();
         requireAuth(async () => {
           let data = await getVaultData();
           data = data.filter(e => e.id !== entry.id);
           await saveVaultData(data);
           await logActivity('Vault', 'ENTRY_DELETED', `Deleted vault entry: ${entry.title}.`, 'IMPORTANT');
           Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
           navigation.goBack();
         });
      }
    );
  };

  const getIconData = (type) => {
    switch(type) {
      case 'Login': return { name: 'log-in', color: '#3B82F6', bg: isDark ? '#1E3A8A' : '#EFF6FF' };
      case 'Card': return { name: 'credit-card', color: '#F59E0B', bg: isDark ? '#451A03' : '#FFFBEB' };
      case 'Bank': return { name: 'briefcase', color: '#0D9488', bg: isDark ? '#134E4A' : '#CCFBF1' };
      case 'Notes': return { name: 'file-text', color: '#8B5CF6', bg: isDark ? '#2E1065' : '#F2EEFF' };
      case 'Wi-Fi': return { name: 'wifi', color: '#06B6D4', bg: isDark ? '#083344' : '#ECFEFF' };
      case 'Mail': return { name: 'mail', color: '#F43F5E', bg: isDark ? '#31111D' : '#FFE4E6' };
      default: return { name: 'shield', color: primaryColor, bg: `${primaryColor}20` }; 
    }
  };

  const iconInfo = getIconData(entry.type);
  const displayFields = Object.keys(entry).filter(key => 
    !IGNORE_KEYS.includes(key) && entry[key] && String(entry[key]).trim() !== ''
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB' }]}>
      
      {/* 🔥 SMART FLOATING TOAST TOGGLE */}
      <Animated.View style={[styles.toastContainer, { opacity: toastOpacity, transform: [{ translateY: toastAnim }] }]}>
        <View style={[styles.toast, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <Feather name={toast.icon} size={18} color={toast.color} style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{toast.message}</Text>
        </View>
      </Animated.View>

      {/* HEADER */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : '#FFF', borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }, pressed && {transform: [{scale: 0.95}]}]}>
          <Feather name="arrow-left" size={22} color={isDark ? '#F8FAFC' : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#111827' }]}>Details</Text>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Form', { type: entry.type, editEntry: entry }); }} style={({pressed}) => [styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : '#FFF', borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }, pressed && {transform: [{scale: 0.95}]}]}>
          <Feather name="edit-2" size={20} color={isDark ? '#F8FAFC' : '#111827'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* TOP PROFILE INFO */}
        <View style={styles.topProfile}>
          <View style={[styles.mainIconBox, { backgroundColor: iconInfo.bg }]}>
            <Feather name={iconInfo.name} size={36} color={iconInfo.color} />
          </View>
          <Text style={[styles.mainTitle, { color: isDark ? '#F8FAFC' : '#111827' }]}>{entry.title}</Text>
          <Text style={[styles.subTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>{entry.type.toUpperCase()} ACCOUNT</Text>
        </View>

        {/* FIELDS CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#EEF1F5' }]}>
          {displayFields.map((key, index) => {
            const isSecure = SECURE_KEYS.includes(key);
            const isVisible = visibleFields[key];
            const value = entry[key];
            const label = formatLabel(key);
            const isLast = index === displayFields.length - 1;

            return (
              <View key={key} style={[styles.fieldRow, !isLast && { borderBottomColor: isDark ? '#334155' : '#EEF1F5', borderBottomWidth: 1 }]}>
                <View style={styles.fieldInfo}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{label}</Text>
                  <Text style={[styles.fieldValue, { color: isDark ? '#F8FAFC' : '#111827' }]} selectable={!isSecure || isVisible}>
                    {isSecure && !isVisible ? '••••••••••••' : value}
                  </Text>
                </View>
                
                <View style={styles.actionRow}>
                  {isSecure && (
                    <TouchableOpacity onPress={() => toggleVisibility(key)} style={[styles.actionBtn, { backgroundColor: `${primaryColor}15` }]}>
                      <Feather name={isVisible ? "eye-off" : "eye"} size={20} color={primaryColor} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => copyToClipboard(key, value, isSecure, label)} style={[styles.actionBtn, { backgroundColor: `${primaryColor}15` }]}>
                    <Feather name="copy" size={20} color={primaryColor} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* BOTTOM METADATA & DELETE */}
        <Text style={[styles.dateText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
          Added on {new Date(entry.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>

        <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: isDark ? '#450A0A' : '#FEF2F2' }]} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Entry</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* 🔥 CUSTOM PREMIUM ALERT MODAL */}
      <Modal visible={alertConfig.visible} transparent animationType="fade" onRequestClose={hideCustomAlert}>
        <View style={styles.alertOverlayBg}>
          <View style={[styles.customAlertBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={[styles.alertIconBox, { backgroundColor: alertConfig.actionStyle === 'destructive' ? '#FEE2E2' : `${primaryColor}20` }]}>
              <Feather name={alertConfig.actionStyle === 'destructive' ? "alert-triangle" : "info"} size={28} color={alertConfig.actionStyle === 'destructive' ? "#EF4444" : primaryColor} />
            </View>
            <Text style={[styles.alertTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{alertConfig.title}</Text>
            <Text style={[styles.alertMessage, { color: isDark ? '#94A3B8' : '#64748B' }]}>{alertConfig.message}</Text>
            <View style={styles.alertBtnRow}>
              <TouchableOpacity style={[styles.alertBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={hideCustomAlert}>
                <Text style={[styles.alertBtnText, { color: isDark ? '#F8FAFC' : '#475569' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.alertBtn, { backgroundColor: alertConfig.actionStyle === 'destructive' ? '#EF4444' : primaryColor }]} onPress={alertConfig.onConfirm}>
                <Text style={[styles.alertBtnText, { color: '#FFFFFF' }]}>{alertConfig.actionText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 60 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 20 },
  
  topProfile: { alignItems: 'center', marginBottom: 30 },
  mainIconBox: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  mainTitle: { fontSize: 28, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  subTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5 },
  
  card: { borderRadius: 24, paddingHorizontal: 20, shadowColor: 'rgba(15,23,42,0.04)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20, elevation: 4, borderWidth: 1, marginBottom: 24 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18 },
  fieldInfo: { flex: 1, paddingRight: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  fieldValue: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  
  actionRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  dateText: { textAlign: 'center', fontSize: 13, fontWeight: '600', marginBottom: 24 },
  
  deleteBtn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  deleteBtnText: { color: '#EF4444', fontSize: 16, fontWeight: '800' },

  // 🔥 Smart Animated Toast
  toastContainer: { position: 'absolute', left: 0, right: 0, top: 50, alignItems: 'center', zIndex: 999 },
  toast: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  toastText: { fontSize: 14, fontWeight: '700' },

  // 🔥 Custom Alert Modal
  alertOverlayBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  customAlertBox: { width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  alertIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  alertMessage: { fontSize: 15, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  alertBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  alertBtn: { flex: 1, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  alertBtnText: { fontSize: 16, fontWeight: '700' }
});
