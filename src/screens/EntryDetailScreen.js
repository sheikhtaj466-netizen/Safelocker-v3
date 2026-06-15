// File: src/screens/EntryDetailScreen.js
import React, { useState, useContext, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator 
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

const DetailField = ({ label, value, isSecure, isDark, themeColors, isLast }) => {
  const [revealed, setRevealed] = useState(!isSecure);

  const copyToClip = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", `${label} copied to clipboard!`);
    await logActivity('Security', 'SECURE_COPIED', `User copied ${label} from vault details.`, 'WORKFLOW');
  };

  if (!value || value.trim() === '') return null;

  return (
    <View style={[styles.fieldContainer, !isLast && { borderBottomColor: isDark ? themeColors.separator : '#F3F4F6', borderBottomWidth: 1 }]}>
      <Text style={[styles.fieldLabel, { color: isDark ? themeColors.textLight : '#8A8A8E' }]}>{label}</Text>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldValue, { color: isDark ? themeColors.textDark : '#1C1C1E' }]}>
          {revealed ? value : '••••••••••••'}
        </Text>
        <View style={styles.actionRow}>
          {isSecure && (
            <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRevealed(!revealed); }} style={[styles.iconBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              <Feather name={revealed ? "eye-off" : "eye"} size={18} color={themeColors.primary} />
            </TouchableOpacity>
          )}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSchema = async () => {
      if (!TYPE_SCHEMAS[entry?.type]) {
        const customTypes = await getCustomTypes();
        const foundType = customTypes?.find(t => t.name === entry?.type);
        if (foundType) {
          const newSchema = {};
          foundType.fields.forEach(f => {
            newSchema[f.id] = { label: f.label, isSecure: false };
          });
          setDynamicSchema(newSchema);
        } else {
          setDynamicSchema({}); 
        }
      }
      setLoading(false);
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
      "Are you sure you want to delete this secure entry? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const currentData = await getVaultData();
            const newData = currentData.filter(item => item.id !== entry.id);
            const success = await saveVaultData(newData);
            
            if (success) {
              await logActivity('Vault', 'ENTRY_DELETED', `Vault entry '${entry.title}' was deleted.`, 'CRITICAL');
              navigation.goBack();
            } else {
              Alert.alert("Error", "Failed to delete entry.");
            }
          }
        }
      ]
    );
  };

  const ignoredKeys = ['id', 'type', 'title', 'date', 'createdAt', 'updatedAt', 'customFields'];
  const renderKeys = Object.keys(entry).filter(key => !ignoredKeys.includes(key) && entry[key] !== '');
  const totalFields = renderKeys.length + (entry.customFields ? entry.customFields.length : 0);
  let currentFieldIndex = 0;

  // 🕒 Format Date Elegantly
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#F2F2F7', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#F2F2F7' }]}>
      
      {/* 🔝 MINIMALIST HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.roundBtn, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <Feather name="arrow-left" size={22} color={isDark ? themeColors.textDark : '#1C1C1E'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : '#1C1C1E' }]}>Details</Text>
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate('Form', { type: entry.type, editEntry: entry });
          }} 
          style={[styles.roundBtn, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}
        >
          <Feather name="edit-2" size={20} color={isDark ? themeColors.textDark : '#1C1C1E'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.titleSection}>
          <Text style={[styles.mainTitle, { color: isDark ? themeColors.textDark : '#1C1C1E' }]}>{entry.title}</Text>
          <View style={[styles.badgeContainer, { backgroundColor: themeColors.primary + '15' }]}>
             <Text style={[styles.typeBadge, { color: themeColors.primary }]}>{entry.type.toUpperCase()} ACCOUNT</Text>
          </View>
        </View>

        {/* 📦 ULTRA-SMART PREMIUM CARD */}
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', borderColor: isDark ? themeColors.separator : 'transparent' }]}>
          
          {renderKeys.map((key) => {
            currentFieldIndex++;
            const fieldDef = dynamicSchema[key] || { 
              label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), 
              isSecure: false 
            };

            return (
              <DetailField 
                key={key} 
                label={fieldDef.label} 
                value={entry[key]} 
                isSecure={fieldDef.isSecure} 
                isDark={isDark} 
                themeColors={themeColors}
                isLast={currentFieldIndex === totalFields}
              />
            );
          })}

          {entry.customFields && entry.customFields.map((cf, index) => {
            currentFieldIndex++;
            return (
              <DetailField 
                key={cf.id || `custom_${index}`} 
                label={cf.label || `Custom Field ${index + 1}`} 
                value={cf.value} 
                isSecure={false} 
                isDark={isDark} 
                themeColors={themeColors}
                isLast={currentFieldIndex === totalFields} 
              />
            );
          })}
        </View>

        {/* 🛡️ PREMIUM METADATA FOOTER (Date moved here) */}
        {entry.date && (
          <View style={styles.metadataContainer}>
            <Feather name="shield" size={14} color={isDark ? '#8A8A8E' : '#A1A1AA'} style={{ marginRight: 6 }} />
            <Text style={[styles.metadataText, { color: isDark ? '#8A8A8E' : '#A1A1AA' }]}>
              Secured • Last updated {formatDate(entry.date)}
            </Text>
          </View>
        )}

        {/* 🚨 PREMIUM DELETE BUTTON */}
        <TouchableOpacity 
          onPress={handleDelete} 
          activeOpacity={0.7}
          style={[styles.deleteBtn, { 
            backgroundColor: isDark ? 'rgba(255, 59, 48, 0.1)' : '#FFF0F0', 
            borderColor: isDark ? 'rgba(255, 59, 48, 0.2)' : '#FFE4E4' 
          }]}
        >
          <Feather name="trash-2" size={18} color="#FF3B30" style={{ marginRight: 8 }} />
          <Text style={styles.deleteBtnText}>Delete Entry</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  roundBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: 0.3 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  titleSection: { alignItems: 'center', marginBottom: 28, marginTop: 10 },
  mainTitle: { fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  badgeContainer: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  typeBadge: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  
  card: { borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 16, elevation: 3, marginBottom: 24 },
  
  fieldContainer: { paddingVertical: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.3 },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldValue: { flex: 1, fontSize: 17, fontWeight: '600', marginRight: 16, letterSpacing: 0.2 },
  
  actionRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  
  metadataContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 30 },
  metadataText: { fontSize: 12, fontWeight: '500', letterSpacing: 0.3 },

  deleteBtn: { flexDirection: 'row', paddingVertical: 16, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginBottom: 20 },
  deleteBtnText: { color: '#FF3B30', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }
});
