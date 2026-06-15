// File: src/screens/EntryDetailScreen.js
import React, { useState, useContext, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { ThemeContext } from '../ThemeContext';
import { getVaultData, saveVaultData, logActivity, getCustomTypes } from '../utils/storage';

const TYPE_SCHEMAS = {
  'Login': { username: { label: 'Username / Email' }, password: { label: 'Password', isSecure: true }, twoFactor: { label: '2FA Secret' }, url: { label: 'Website' }, notes: { label: 'Notes' } },
  'Card': { cardHolder: { label: 'Card Holder Name' }, cardNumber: { label: 'Card Number' }, 'Card PIN': { label: 'Card PIN', isSecure: true }, expiry: { label: 'Expiry Date' }, cvv: { label: 'CVV', isSecure: true }, bankName: { label: 'Issuing Bank' }, notes: { label: 'Notes' } },
  'Bank': { accHolder: { label: 'Account Holder Name' }, accNumber: { label: 'Account Number', isSecure: true }, ifsc: { label: 'IFSC Code' }, bankName: { label: 'Bank Name' }, branch: { label: 'Branch Name' }, upi: { label: 'UPI ID' }, notes: { label: 'Notes' } },
  'Wi-Fi': { ssid: { label: 'Network Name (SSID)' }, password: { label: 'Password', isSecure: true }, security: { label: 'Security Type' }, notes: { label: 'Notes' } },
  'Notes': { notes: { label: 'Secure Note' } },
  'Mail': { email: { label: 'Email Address' }, password: { label: 'Password', isSecure: true }, twoFactor: { label: '2FA Secret' }, recoveryEmail: { label: 'Recovery Email' }, backupCodes: { label: 'Backup Codes' }, notes: { label: 'Notes' } }
};

const DetailField = ({ label, value, isSecure, isDark, themeColors, isLast, showToast }) => {
  const [revealed, setRevealed] = useState(!isSecure);

  // 🔥 SMART FEATURE: Detect if field is a Website/URL (Even in Custom Fields!)
  const lowerLabel = (label || '').toLowerCase();
  const isUrl = lowerLabel.includes('website') || lowerLabel.includes('url') || lowerLabel.includes('link') || String(value).startsWith('http');

  const copyToClip = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(String(value));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(`${label} copied securely`);
    await logActivity('Security', 'SECURE_COPIED', `User copied ${label} from vault details.`, 'WORKFLOW');
  };

  const openLink = async () => {
    let targetUrl = value;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    const supported = await Linking.canOpenURL(targetUrl);
    if (supported) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await Linking.openURL(targetUrl);
    } else {
      showToast("Invalid URL format");
    }
  };

  if (!value || String(value).trim() === '') return null;

  return (
    <View style={[styles.fieldContainer, !isLast && { borderBottomColor: isDark ? themeColors.separator : '#F3F4F6', borderBottomWidth: 1 }]}>
      <Text style={[styles.fieldLabel, { color: isDark ? themeColors.textLight : '#8A8A8E' }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldValue, { color: isDark ? themeColors.textDark : '#1C1C1E' }]}>
          {revealed ? value : '••••••••••••'}
        </Text>
        <View style={styles.actionRow}>
          
          {/* External Link Button */}
          {isUrl && (
            <TouchableOpacity onPress={openLink} style={[styles.iconBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <Feather name="external-link" size={18} color={themeColors.primary} />
            </TouchableOpacity>
          )}

          {/* Secure Reveal Button */}
          {isSecure && (
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRevealed(!revealed); }} style={[styles.iconBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <Feather name={revealed ? "eye-off" : "eye"} size={18} color={themeColors.primary} />
            </TouchableOpacity>
          )}

          {/* Copy Button */}
          <TouchableOpacity onPress={copyToClip} style={[styles.iconBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
            <Feather name="copy" size={18} color={themeColors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default function EntryDetailScreen({ route, navigation }) {
  const { themeColors, isDark } = useContext(ThemeContext);
  const { entry } = route.params;

  const [dynamicSchema, setDynamicSchema] = useState(TYPE_SCHEMAS[entry?.type] || null);

  // 🚀 PREMIUM MINIMALIST TOAST STATE (Replaces ugly Alert)
  const toastTranslateY = useRef(new Animated.Value(100)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (msg) => {
    setToastMessage(msg);
    Animated.parallel([
      Animated.spring(toastTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastTranslateY, { toValue: 100, duration: 250, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
      ]).start();
    }, 2000);
  };

  useEffect(() => {
    const loadSchema = async () => {
      if (!TYPE_SCHEMAS[entry?.type]) {
        const customTypes = await getCustomTypes();
        const foundType = customTypes?.find(t => t.name === entry?.type);
        if (foundType) {
          const newSchema = {};
          foundType.fields.forEach(f => { newSchema[f.id] = { label: f.label, isSecure: false }; });
          setDynamicSchema(newSchema);
        } else { setDynamicSchema({}); }
      }
    };
    if (entry) loadSchema();
  }, [entry]);

  if (!entry) {
    navigation.goBack();
    return null;
  }

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to permanently delete this?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            const currentData = await getVaultData();
            const newData = currentData.filter(item => item.id !== entry.id);
            await saveVaultData(newData);
            navigation.goBack();
          }
        }
      ]
    );
  };

  const ignoredKeys = ['id', 'type', 'title', 'date', 'createdAt', 'updatedAt', 'customFields'];
  const renderKeys = Object.keys(entry).filter(key => !ignoredKeys.includes(key) && entry[key] !== '');
  const totalFields = renderKeys.length + (entry.customFields ? entry.customFields.length : 0);
  let currentFieldIndex = 0;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#F2F2F7' }]}>
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.roundBtn, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : '#1C1C1E'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : '#1C1C1E' }]}>Details</Text>
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Form', { type: entry.type, editEntry: entry });
          }} 
          style={[styles.roundBtn, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}
        >
          <Feather name="edit-2" size={18} color={isDark ? themeColors.textDark : '#1C1C1E'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.titleSection}>
          <Text style={[styles.mainTitle, { color: isDark ? themeColors.textDark : '#1C1C1E' }]}>{entry.title}</Text>
          <View style={[styles.badgeContainer, { backgroundColor: themeColors.primary + '15' }]}>
             <Text style={[styles.typeBadge, { color: themeColors.primary }]}>{entry.type.toUpperCase()} ACCOUNT</Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? themeColors.separator : 'transparent' }]}>
          
          {dynamicSchema && renderKeys.map((key) => {
            currentFieldIndex++;
            const fieldDef = dynamicSchema[key] || { 
              label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), 
              isSecure: false 
            };

            return (
              <DetailField 
                key={key} label={fieldDef.label} value={entry[key]} 
                isSecure={fieldDef.isSecure} isDark={isDark} themeColors={themeColors}
                isLast={currentFieldIndex === totalFields} showToast={triggerToast}
              />
            );
          })}

          {entry.customFields && entry.customFields.map((cf, index) => {
            currentFieldIndex++;
            return (
              <DetailField 
                key={cf.id || `custom_${index}`} label={cf.label || `Field ${index + 1}`} value={cf.value} 
                isSecure={false} isDark={isDark} themeColors={themeColors}
                isLast={currentFieldIndex === totalFields} showToast={triggerToast}
              />
            );
          })}
        </View>

        {entry.date && (
          <View style={styles.metadataContainer}>
            <Feather name="shield" size={14} color={isDark ? '#8A8A8E' : '#A1A1AA'} style={{ marginRight: 6 }} />
            <Text style={[styles.metadataText, { color: isDark ? '#8A8A8E' : '#A1A1AA' }]}>
              Secured • Last updated {formatDate(entry.date)}
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={handleDelete} activeOpacity={0.7} style={[styles.deleteBtn, { backgroundColor: isDark ? 'rgba(255, 59, 48, 0.1)' : '#FFF0F0' }]}>
          <Feather name="trash-2" size={18} color="#FF3B30" style={{ marginRight: 8 }} />
          <Text style={styles.deleteBtnText}>Delete Entry</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* 🚀 SMART BOTTOM TOAST (Replaces Alert Popup) */}
      <Animated.View style={[styles.premiumToast, { transform: [{ translateY: toastTranslateY }], opacity: toastOpacity }]} pointerEvents="none">
        <Feather name="check-circle" size={18} color="#10B981" style={{ marginRight: 10 }} />
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  titleSection: { alignItems: 'center', marginBottom: 24, marginTop: 10 },
  mainTitle: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  badgeContainer: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  typeBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  
  card: { borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 3, marginBottom: 24 },
  
  fieldContainer: { paddingVertical: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldValue: { flex: 1, fontSize: 16, fontWeight: '600', marginRight: 16 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  metadataContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  metadataText: { fontSize: 12, fontWeight: '500', letterSpacing: 0.3 },

  deleteBtn: { flexDirection: 'row', paddingVertical: 16, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  deleteBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // 🔥 TOAST STYLE
  premiumToast: { position: 'absolute', bottom: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 15 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '700' }
});
