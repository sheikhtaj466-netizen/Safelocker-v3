// File: src/screens/FormScreen.js
import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Keyboard, Modal, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import CryptoJS from 'crypto-js';

if (!CryptoJS.lib.WordArray.random_polyfilled) {
  CryptoJS.lib.WordArray.random = function (nBytes) {
    const words = [];
    for (let i = 0; i < nBytes; i += 4) { words.push((Math.random() * 0x100000000) | 0); }
    return CryptoJS.lib.WordArray.create(words, nBytes);
  };
  CryptoJS.lib.WordArray.random_polyfilled = true;
}

import { getVaultData, saveVaultData, logActivity, getCustomTypes } from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

const BP_COLORS = {
  primary: '#6C5CE7', primaryGradient: ['#6C5CE7', '#8B7CFF'], disabledBtn: '#D1D5DB', textMain: '#1A1A1A', textSub: '#8A8A8A', inputBg: '#F7F8FC', inputBorder: '#E5E7EB'
};

const TYPE_SCHEMAS = {
  'Login': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. Google, Instagram', autoCapitalize: 'words' },
    { key: 'username', label: 'Username/Email', placeholder: 'Enter email or username' },
    { key: 'password', label: 'Password', placeholder: 'Enter password', isSecure: true, autoCapitalize: 'none' },
    { key: 'twoFactor', label: '2FA Backup Codes', placeholder: 'Enter numerical backup codes', autoCapitalize: 'none' },
    { key: 'url', label: 'Website (Optional)', placeholder: 'https://...', autoCapitalize: 'none' },
    { key: 'notes', label: 'Notes', placeholder: 'Add any extra details...', multiline: true, bigArea: true }
  ],
  'Card': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. SBI Platinum Debit Card', autoCapitalize: 'words' },
    { key: 'cardHolder', label: 'Card Holder Name', placeholder: 'Name on card', autoCapitalize: 'words' },
    { key: 'cardNumber', label: 'Card Number', placeholder: '1234 5678 9012 3456' },
    { key: 'Card PIN', label: 'Card PIN', placeholder: '****', isSecure: true, maxLength: 6 },
    { key: 'expiry', label: 'Expiry Date (MM/YY)', placeholder: 'MM/YY', maxLength: 5 },
    { key: 'cvv', label: 'CVV', placeholder: '***', isSecure: true, maxLength: 4 },
    { key: 'bankName', label: 'Issuing Bank', placeholder: 'e.g. HDFC Bank', autoCapitalize: 'words' },
    { key: 'notes', label: 'Notes', placeholder: 'PIN or other details...', multiline: true, bigArea: true }
  ],
  'Bank': [ 
    { key: 'title', label: 'Title *', placeholder: 'e.g. HDFC Savings Account', autoCapitalize: 'words' },
    { key: 'accHolder', label: 'Account Holder Name', placeholder: 'Enter full name', autoCapitalize: 'words' },
    { key: 'accNumber', label: 'Account Number', placeholder: 'Enter account number', isSecure: true },
    { key: 'ifsc', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234', autoCapitalize: 'characters', maxLength: 11 }, 
    { key: 'bankName', label: 'Bank Name', placeholder: 'Enter bank name', autoCapitalize: 'words' },
    { key: 'branch', label: 'Branch Name (Optional)', placeholder: 'e.g. Ramagundam', autoCapitalize: 'words' },
    { key: 'upi', label: 'UPI ID (Optional)', placeholder: 'name@bank', autoCapitalize: 'none' },
    { key: 'notes', label: 'Notes', placeholder: 'Extra details...', multiline: true, bigArea: true }
  ],
  'Wi-Fi': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. Home WiFi', autoCapitalize: 'words' },
    { key: 'ssid', label: 'Network Name (SSID)', placeholder: 'Network name', autoCapitalize: 'none' },
    { key: 'password', label: 'Password', placeholder: 'Enter WiFi password', isSecure: true, autoCapitalize: 'none' },
    { key: 'security', label: 'Security Type (Optional)', placeholder: 'e.g. WPA2', autoCapitalize: 'characters' },
    { key: 'notes', label: 'Notes', placeholder: 'Router Admin panel details...', multiline: true, bigArea: true }
  ]
};

// 🧠 UNIVERSAL SMART ENGINE
const getSmartKeyboardType = (label) => {
  const l = (label || '').toLowerCase();
  if (l.includes('pin') || l.includes('cvv') || l.includes('mobile') || l.includes('number') || l.includes('phone') || l.includes('date') || l.includes('dob') || l.includes('2fa') || l.includes('code') || l.includes('account')) return 'numeric';
  if (l.includes('email')) return 'email-address';
  if (l.includes('website') || l.includes('url') || l.includes('link')) return 'url';
  return 'default';
};

const formatSmartDOB = (text) => {
  let cleaned = text.replace(/[^0-9]/g, ''); 
  if (cleaned.length > 2) {
    let day = cleaned.substring(0, 2);
    let month = cleaned.substring(2, 4);
    let year = cleaned.substring(4, 8);
    if (parseInt(day) > 31) day = '31';
    if (cleaned.length >= 4 && parseInt(month) > 12) month = '12';
    cleaned = day + (month.length ? '/' + month : '') + (year.length ? '/' + year : '');
  }
  return cleaned;
};

const checkIsDob = (label, key = '') => {
  const l = (label || '').toLowerCase();
  const k = (key || '').toLowerCase();
  return l.includes('date of birth') || l.includes('dob') || k === 'dob';
};

const SmartInput = ({ field, value, onChangeText, focusedField, setFocusedField, isDark, themeColors }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isFocused = focusedField === field.key;
  
  const isDobField = checkIsDob(field.label, field.key);
  const kType = field.keyboardType || getSmartKeyboardType(field.label);

  const handleTextChange = (text) => {
    if (isDobField) {
      onChangeText(field.key, formatSmartDOB(text));
    } else if (field.key === 'ifsc') {
      onChangeText(field.key, text.toUpperCase());
    } else if (field.key === 'expiry') {
       let cleaned = text.replace(/[^0-9]/g, '');
       if (cleaned.length >= 3) { cleaned = cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4); }
       onChangeText(field.key, cleaned);
    } else {
      onChangeText(field.key, text);
    }
  };

  return (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: isDark ? themeColors.textLight : BP_COLORS.textSub }]}>{field.label}</Text>
      <View style={[
        styles.inputWrapper, 
        { backgroundColor: isDark ? themeColors.inputBg : BP_COLORS.inputBg, borderColor: isDark ? themeColors.inputBorder : 'transparent' },
        isFocused && { borderColor: themeColors.primary, borderWidth: 1.5, backgroundColor: isDark ? themeColors.card : '#FFFFFF' },
        field.multiline && { height: field.bigArea ? 140 : 100, alignItems: 'flex-start', paddingTop: 14 }
      ]}>
        <TextInput 
          style={[styles.input, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }, field.multiline && { textAlignVertical: 'top', marginTop: Platform.OS === 'ios' ? 0 : -4 }]} 
          placeholder={isDobField ? "DD/MM/YYYY" : field.placeholder} 
          placeholderTextColor="#9CA3AF" 
          value={value} 
          onChangeText={handleTextChange} 
          secureTextEntry={field.isSecure && !showPassword}
          multiline={field.multiline}
          maxLength={isDobField ? 10 : field.maxLength} 
          keyboardType={kType}
          autoCapitalize={field.autoCapitalize || 'sentences'}
          onFocus={() => { Haptics.selectionAsync(); setFocusedField(field.key); }}
          onBlur={() => setFocusedField(null)}
        />
        
        {field.isSecure && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconBtn}>
            <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default function FormScreen({ route, navigation }) {
  const { themeColors, isDark } = useContext(ThemeContext);
  const { type = 'Login', editEntry = null, customFields: routeCustomFields = null } = route.params || {};

  const [schema, setSchema] = useState(TYPE_SCHEMAS[type] || []);
  const [formData, setFormData] = useState({});
  const [focusedField, setFocusedField] = useState(null);
  const [saveState, setSaveState] = useState('idle'); 
  const [customFields, setCustomFields] = useState(editEntry?.customFields || routeCustomFields || []);

  const successScale = useRef(new Animated.Value(0.5)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fetchCustomSchema = async () => {
      if (!TYPE_SCHEMAS[type]) {
        const customTypes = await getCustomTypes();
        const foundType = customTypes?.find(t => t.name === type);
        if (foundType) {
          const generatedSchema = [
            { key: 'title', label: 'Title *', placeholder: `e.g. ${type} Account`, autoCapitalize: 'words' },
            ...foundType.fields.map(f => ({ key: f.id, label: f.label, placeholder: f.placeholder }))
          ];
          setSchema(generatedSchema);
        }
      }
    };
    fetchCustomSchema();
    if (editEntry) setFormData(editEntry); 
  }, [editEntry, type]);

  const isFormValid = formData['title']?.trim().length > 0;

  const addCustomField = () => {
    if (customFields.length < 3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCustomFields([...customFields, { id: Date.now().toString(), label: '', value: '' }]);
    }
  };

  const removeCustomField = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCustomFields(customFields.filter(cf => cf.id !== id));
  };

  const updateCustomField = (id, key, text) => {
    setCustomFields(customFields.map(cf => {
      if (cf.id === id) {
        // Apply Smart DOB formatting instantly to custom field values
        if (key === 'value' && checkIsDob(cf.label)) {
          return { ...cf, [key]: formatSmartDOB(text) };
        }
        return { ...cf, [key]: text };
      }
      return cf;
    }));
  };

  const handleChange = (key, text) => {
    setFormData(prev => ({ ...prev, [key]: text }));
  };

  const showPremiumSuccess = () => {
    setSaveState('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      Animated.timing(successOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.timing(successOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
         navigation.reset({ index: 0, routes: [{ name: 'MainDashboard' }] });
      });
    }, 700);
  };

  const handleSave = async () => {
    if (!isFormValid || saveState !== 'idle') return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaveState('loading');
    Keyboard.dismiss(); 

    try {
      const existingData = await getVaultData();
      if (existingData === null) {
         setSaveState('idle'); 
         Alert.alert('Security Alert', 'Unable to load vault securely.');
         return;
      }

      const safeFormData = {};
      schema.forEach(field => { safeFormData[field.key] = formData[field.key] ? String(formData[field.key]).trim() : ""; });

      const title = safeFormData.title || formData.title || "Untitled";
      const username = safeFormData.username || safeFormData.email || formData.email || "";
      const password = safeFormData.password || safeFormData['Card PIN'] || formData.password || "";
      const url = safeFormData.url || formData.url || "";
      
      let finalNotes = safeFormData.notes || formData.notes || "";
      if (finalNotes.includes("--- Additional Details ---")) { 
          finalNotes = finalNotes.split("--- Additional Details ---")[0].trim(); 
      }

      const entryId = editEntry ? String(editEntry.id) : (Date.now().toString() + Math.random().toString(36).substring(2, 7));
      const validCustomFields = customFields.filter(cf => cf.label.trim() !== '' || cf.value.trim() !== '');

      const newEntryData = {
        ...(editEntry || {}), 
        id: entryId, type: String(type), title, username, password, url, notes: finalNotes, date: new Date().toISOString(), 
        customFields: validCustomFields,
        ...safeFormData 
      };

      let updatedData = [];
      if (editEntry) {
        updatedData = existingData.map(item => String(item.id) === String(editEntry.id) ? newEntryData : item);
      } else {
        updatedData = [newEntryData, ...existingData];
      }
      
      const success = await saveVaultData(updatedData);
      
      if (success) {
        await logActivity('Vault', editEntry ? 'ENTRY_EDITED' : 'ENTRY_CREATED', `Vault entry '${title}' was securely ${editEntry ? 'updated' : 'saved'}.`, 'WORKFLOW');
        showPremiumSuccess(); 
      } else {
        setSaveState('idle'); Alert.alert('Error', 'App failed to encrypt and save entry.');
      }
    } catch (error) {
      console.log("Form Save Error:", error);
      setSaveState('idle'); Alert.alert('System Error', 'Something went wrong while saving the secure data.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#FFFFFF' }]}>
      
      {saveState === 'success' && (
        <Modal transparent animationType="none" visible={true}>
          <BlurView intensity={50} tint="dark" style={styles.premiumSuccessOverlay}>
            <Animated.View style={[styles.successCard, { backgroundColor: themeColors.card, transform: [{ scale: successScale }], opacity: successOpacity }]}>
              <View style={styles.successIconBox}><Feather name="check" size={40} color="#10B981" /></View>
              <Text style={[styles.successTitle, { color: themeColors.textDark }]}>Secured & Saved</Text>
              <Text style={[styles.successSub, { color: themeColors.textLight }]}>Your entry has been securely encrypted in the vault.</Text>
            </Animated.View>
          </BlurView>
        </Modal>
      )}

      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.backBtn, { backgroundColor: isDark ? themeColors.card : '#F3F4F8' }, pressed && {opacity: 0.7}]}>
          <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : BP_COLORS.textMain} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }]}>{editEntry ? 'Edit' : 'Add'} {type}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <View style={{ marginTop: 20 }}>
            {schema.map(field => (
              <SmartInput 
                key={field.key} field={field} value={formData[field.key] || ''} 
                onChangeText={handleChange} focusedField={focusedField} 
                setFocusedField={setFocusedField} isDark={isDark} themeColors={themeColors} 
              />
            ))}
          </View>

          {/* 🔥 CUSTOM FIELDS WITH SMART BEHAVIOR */}
          {customFields.map((cf, index) => {
            const isCfDob = checkIsDob(cf.label);
            return (
              <View key={cf.id} style={{ marginBottom: 16, backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: isDark ? themeColors.separator : '#E5E7EB' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: themeColors.primary, letterSpacing: 1 }}>EXTRA FIELD {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeCustomField(cf.id)} style={{ padding: 4, marginRight: -4, marginTop: -4 }}>
                    <Feather name="minus-circle" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={[styles.inputWrapper, styles.input, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', marginBottom: 10, height: 48, borderColor: isDark ? themeColors.inputBorder : '#E5E7EB', color: isDark ? themeColors.textDark : '#111827' }]}
                  placeholder="Field Name (e.g. Website, Mobile, DOB)"
                  placeholderTextColor="#9CA3AF"
                  value={cf.label}
                  onChangeText={(text) => updateCustomField(cf.id, 'label', text)}
                />
                
                <TextInput
                  style={[styles.inputWrapper, styles.input, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', height: 48, borderColor: isDark ? themeColors.inputBorder : '#E5E7EB', color: isDark ? themeColors.textDark : '#111827' }]}
                  placeholder={isCfDob ? "DD/MM/YYYY" : "Field Value"}
                  placeholderTextColor="#9CA3AF"
                  value={cf.value}
                  maxLength={isCfDob ? 10 : undefined}
                  keyboardType={getSmartKeyboardType(cf.label)}
                  onChangeText={(text) => updateCustomField(cf.id, 'value', text)}
                />
              </View>
            );
          })}

          {customFields.length < 3 && (
            <TouchableOpacity onPress={addCustomField} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingVertical: 8 }}>
              <Feather name="plus-circle" size={18} color={themeColors.primary} style={{ marginRight: 8 }} />
              <Text style={{ color: themeColors.primary, fontWeight: '700', fontSize: 15 }}>Add Extra Custom Field</Text>
            </TouchableOpacity>
          )}

          <Pressable 
            disabled={!isFormValid || saveState !== 'idle'} activeOpacity={0.9} onPress={handleSave} 
            style={({ pressed }) => [styles.btnWrapper, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            {isFormValid ? (
              <LinearGradient colors={themeColors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
                {saveState === 'loading' ? <ActivityIndicator color="#FFF" /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Feather name="lock" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
                    <Text style={styles.primaryBtnText}>Save Securely</Text>
                  </View>
                )}
              </LinearGradient>
            ) : (
              <View style={[styles.primaryBtn, { backgroundColor: isDark ? themeColors.inputBg : BP_COLORS.disabledBtn, elevation: 0, shadowOpacity: 0 }]}>
                <Text style={[styles.primaryBtnText, { color: isDark ? themeColors.textLight : '#FFFFFF' }]}>Save Securely</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 200 }, 
  inputGroup: { marginBottom: 12 }, 
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },
  iconBtn: { padding: 4, marginLeft: 6 },
  
  btnWrapper: { marginTop: 30, marginBottom: 20 }, 
  primaryBtn: { height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#6C5CE7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },

  premiumSuccessOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)' },
  successCard: { width: 200, padding: 24, borderRadius: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  successIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  successSub: { fontSize: 13, textAlign: 'center', fontWeight: '500' }
});
