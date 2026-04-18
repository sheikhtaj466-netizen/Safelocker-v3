// File: src/screens/PreferredActionsScreen.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Modal, Animated, Easing, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../ThemeContext';

export default function PreferredActionsScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#12C7B2';

  const [preferences, setPreferences] = useState({
    forgotPin: true,
    resetApp: true, // Locked
    changeEmail: true,
    backupRestore: true,
    recoveryReveal: true,
    disableSecurity: true,
    dataExport: true,
  });

  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const presetScaleAnim = useRef(new Animated.Value(0.92)).current;
  const presetFadeAnim = useRef(new Animated.Value(0)).current;

  // 🚀 Load Preferences
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const savedPrefs = await AsyncStorage.getItem('PASSKEY_PREFS');
        if (savedPrefs) setPreferences(JSON.parse(savedPrefs));
      } catch (e) { console.log('Error loading prefs'); }
    };
    loadPrefs();
  }, []);

  const savePrefs = async (newPrefs) => {
    setPreferences(newPrefs);
    await AsyncStorage.setItem('PASSKEY_PREFS', JSON.stringify(newPrefs));
  };

  const handleToggle = (key, value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === 'resetApp') {
      // 🧨 Locked action: Cannot turn off without extreme verification (mocked as locked)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return; 
    }
    savePrefs({ ...preferences, [key]: value });
  };

  const applyPreset = (presetType) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    let newPrefs = { ...preferences };
    
    if (presetType === 'MAXIMUM') {
      newPrefs = { forgotPin: true, resetApp: true, changeEmail: true, backupRestore: true, recoveryReveal: true, disableSecurity: true, dataExport: true };
    } else if (presetType === 'BALANCED') {
      newPrefs = { forgotPin: true, resetApp: true, changeEmail: true, backupRestore: true, recoveryReveal: true, disableSecurity: false, dataExport: false };
    } else if (presetType === 'FAST') {
      newPrefs = { forgotPin: true, resetApp: true, changeEmail: true, backupRestore: false, recoveryReveal: false, disableSecurity: false, dataExport: false };
    }
    
    savePrefs(newPrefs);
    closePresetsModal();
  };

  const openPresetsModal = () => {
    setShowPresetsModal(true);
    Animated.parallel([
      Animated.spring(presetScaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
      Animated.timing(presetFadeAnim, { toValue: 1, duration: 220, useNativeDriver: true })
    ]).start();
  };

  const closePresetsModal = () => {
    Animated.timing(presetFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShowPresetsModal(false);
      presetScaleAnim.setValue(0.92);
    });
  };

  const ActionRow = ({ id, icon, title, subtitle, isLocked }) => {
    const isON = preferences[id];
    return (
      <TouchableOpacity 
        activeOpacity={isLocked ? 1 : 0.7}
        onPress={() => !isLocked && handleToggle(id, !isON)}
        style={[styles.actionRow, { borderBottomColor: isDark ? '#334155' : '#F1F5F9' }]}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconBox, { backgroundColor: isON ? primaryColor + '15' : (isDark ? '#334155' : '#F1F5F9') }]}>
            <Feather name={icon} size={22} color={isON ? primaryColor : (isDark ? '#94A3B8' : '#64748B')} />
          </View>
          <View style={styles.textContainer}>
            <Text style={[styles.rowTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{title} {isLocked && <Feather name="lock" size={12} color="#EF4444" />}</Text>
            <Text style={[styles.rowSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={2}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.rowRight}>
          <Switch 
            trackColor={{ false: isDark ? "#3D3D5C" : "#E2E8F0", true: primaryColor + "80" }} 
            thumbColor={isON ? primaryColor : (isDark ? "#8A8FA3" : "#FFFFFF")} 
            onValueChange={(val) => handleToggle(id, val)} 
            value={isON} 
            disabled={isLocked}
            style={{ transform: [{ scale: 0.9 }] }} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#F8FAFC' }]}>
      
      {/* 🔝 HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={isDark ? '#F8FAFC' : '#0F172A'} />
        </TouchableOpacity>
        <View style={{flex: 1}}>
          <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Preferred Actions</Text>
          <Text style={[styles.headerSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>Choose where passkey should be required</Text>
        </View>
        <TouchableOpacity style={[styles.presetsBtn, { backgroundColor: primaryColor + '15' }]} onPress={openPresetsModal}>
          <Feather name="zap" size={18} color={primaryColor} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.mainCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          
          <ActionRow id="resetApp" icon="alert-triangle" title="Reset App / Wipe" subtitle="Emergency vault destruction" isLocked={true} />
          <ActionRow id="forgotPin" icon="key" title="Forgot Master PIN" subtitle="Use passkey before email or code recovery" />
          <ActionRow id="changeEmail" icon="mail" title="Change Recovery Email" subtitle="Protect linked recovery identity changes" />
          <ActionRow id="backupRestore" icon="download-cloud" title="Backup Restore" subtitle="Require passkey before importing backup files" />
          <ActionRow id="recoveryReveal" icon="eye-off" title="Recovery Code Reveal" subtitle="Prevent unauthorized viewing of backup code" />
          <ActionRow id="disableSecurity" icon="shield-off" title="Disable Security Features" subtitle="Screenshot block, decoy pin, auto-lock off" />
          <ActionRow id="dataExport" icon="upload-cloud" title="Sensitive Data Export" subtitle="Export hidden photos or encrypted backups" />

        </View>
      </ScrollView>

      {/* 🪄 SMART PRESETS POPUP */}
      <Modal visible={showPresetsModal} transparent animationType="none" onRequestClose={closePresetsModal}>
        <BlurView intensity={isDark ? 40 : 15} tint={isDark ? "dark" : "light"} style={styles.modalOverlay}>
          <Animated.View style={[styles.modalCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', transform: [{ scale: presetScaleAnim }], opacity: presetFadeAnim }]}>
            
            <View style={[styles.modalHeaderIcon, { backgroundColor: primaryColor + '15' }]}>
              <Feather name="zap" size={28} color={primaryColor} />
            </View>
            <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Quick Presets</Text>
            <Text style={[styles.modalSub, { color: isDark ? '#94A3B8' : '#64748B' }]}>Instantly configure passkey security levels.</Text>

            <TouchableOpacity style={[styles.presetOption, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: primaryColor }]} onPress={() => applyPreset('BALANCED')}>
              <View style={styles.presetIcon}><Feather name="shield" size={20} color={primaryColor} /></View>
              <View style={{flex: 1}}><Text style={[styles.presetTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Balanced (Recommended)</Text><Text style={styles.presetDesc}>High security, smooth workflow.</Text></View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.presetOption, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: '#10B981' }]} onPress={() => applyPreset('MAXIMUM')}>
              <View style={styles.presetIcon}><Feather name="lock" size={20} color="#10B981" /></View>
              <View style={{flex: 1}}><Text style={[styles.presetTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Maximum Security</Text><Text style={styles.presetDesc}>Passkey required for everything.</Text></View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.presetOption, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: '#F59E0B' }]} onPress={() => applyPreset('FAST')}>
              <View style={styles.presetIcon}><Feather name="wind" size={20} color="#F59E0B" /></View>
              <View style={{flex: 1}}><Text style={[styles.presetTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Fast Workflow</Text><Text style={styles.presetDesc}>Only triggers on wipe & email change.</Text></View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} onPress={closePresetsModal}>
              <Text style={[styles.cancelBtnText, { color: isDark ? '#F8FAFC' : '#475569' }]}>Cancel</Text>
            </TouchableOpacity>

          </Animated.View>
        </BlurView>
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
  presetsBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 10 },
  mainCard: { width: '100%', borderRadius: 28, paddingVertical: 8, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 4 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 78, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  textContainer: { flex: 1, justifyContent: 'center' },
  rowTitle: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  rowSubtitle: { fontSize: 13, lineHeight: 18 },
  rowRight: { justifyContent: 'center', alignItems: 'flex-end' },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { width: '100%', maxWidth: 400, borderRadius: 32, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.25, shadowRadius: 30, elevation: 20 },
  modalHeaderIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  modalSub: { fontSize: 15, textAlign: 'center', marginBottom: 24 },
  presetOption: { flexDirection: 'row', alignItems: 'center', width: '100%', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1.5 },
  presetIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)', marginRight: 14 },
  presetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  presetDesc: { fontSize: 13, color: '#64748B' },
  cancelBtn: { width: '100%', height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  cancelBtnText: { fontSize: 16, fontWeight: '700' }
});
