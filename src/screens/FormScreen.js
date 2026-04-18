// File: src/screens/FormScreen.js
import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Alert, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';

import { getVaultData, saveVaultData, logActivity } from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

const BP_COLORS = {
  primary: '#6C5CE7',
  primaryGradient: ['#6C5CE7', '#8B7CFF'],
  disabledBtn: '#D1D5DB',
  textMain: '#1A1A1A',
  textSub: '#8A8A8A',
  inputBg: '#F7F8FC',
  inputBorder: '#E5E7EB',
  errorBorder: '#FF4D4F'
};

// 🧠 ULTIMATE DYNAMIC FIELD SCHEMA (FIXED KEYS)
const TYPE_SCHEMAS = {
  'Login': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. Google, HDFC Bank' },
    { key: 'username', label: 'Username / Email', placeholder: 'Enter username', autoCapitalize: 'none' },
    { key: 'password', label: 'Password', placeholder: 'Enter password', isSecure: true },
    { key: 'twoFactor', label: '2FA Secret (Optional)', placeholder: 'Paste 2FA key' },
    { key: 'url', label: 'Website URL', placeholder: 'https://...', autoCapitalize: 'none' },
    { key: 'notes', label: 'Notes', placeholder: 'Add any extra details...', multiline: true, bigArea: true }
  ],
  'Card': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. SBI Platinum Debit Card' },
    { key: 'cardHolder', label: 'Card Holder Name', placeholder: 'Name on card' },
    { key: 'cardNumber', label: 'Card Number', placeholder: '1234 5678 9012 3456', keyboardType: 'number-pad' },
    { key: 'expiry', label: 'Expiry Date', placeholder: 'MM/YY' },
    { key: 'cvv', label: 'CVV', placeholder: '***', isSecure: true, keyboardType: 'number-pad', maxLength: 4 },
    { key: 'bankName', label: 'Bank Name', placeholder: 'e.g. HDFC Bank' },
    { key: 'notes', label: 'Notes', placeholder: 'PIN or other details...', multiline: true, bigArea: true }
  ],
  'Bank': [ 
    { key: 'title', label: 'Title *', placeholder: 'e.g. HDFC Savings Account' },
    { key: 'accHolder', label: 'Account Holder Name', placeholder: 'Enter full name' },
    { key: 'accNumber', label: 'Account Number', placeholder: 'Enter account number', keyboardType: 'number-pad', isSecure: true },
    { key: 'ifsc', label: 'IFSC Code', placeholder: 'e.g. HDFC0001234', autoCapitalize: 'characters', maxLength: 11 }, 
    { key: 'bankName', label: 'Bank Name', placeholder: 'Enter bank name' },
    { key: 'branch', label: 'Branch Name (Optional)', placeholder: 'e.g. Ramagundam' },
    { key: 'upi', label: 'UPI ID (Optional)', placeholder: 'name@bank', autoCapitalize: 'none' },
    { key: 'notes', label: 'Notes', placeholder: 'Extra details...', multiline: true, bigArea: true }
  ],
  'Wi-Fi': [
    { key: 'title', label: 'Title *', placeholder: 'e.g. Home WiFi' },
    { key: 'ssid', label: 'WiFi Name (SSID)', placeholder: 'Network name' },
    { key: 'password', label: 'Password', placeholder: 'Enter WiFi password', isSecure: true },
    { key: 'security', label: 'Security Type', placeholder: 'e.g. WPA2' },
    { key: 'notes', label: 'Notes', placeholder: 'Router Admin panel details...', multiline: true, bigArea: true }
  ],
  'Notes': [ 
    { key: 'title', label: 'Title *', placeholder: 'e.g. Secret Recipe, Journal' },
    { key: 'notes', label: 'Secure Note', placeholder: 'Type your secret text here...', multiline: true, bigArea: true } 
  ],
  'Mail': [ 
    { key: 'title', label: 'Title *', placeholder: 'e.g. Gmail Account' },
    { key: 'email', label: 'Email Address', placeholder: 'example@gmail.com', autoCapitalize: 'none' },
    { key: 'password', label: 'Password', placeholder: 'Enter password', isSecure: true },
    { key: 'recoveryEmail', label: 'Recovery Email (Optional)', placeholder: 'recovery@gmail.com', autoCapitalize: 'none' },
    { key: 'backupCodes', label: 'Backup Codes (Optional)', placeholder: 'Paste your 8-digit codes here', multiline: true, bigArea: true },
    { key: 'notes', label: 'Notes', placeholder: 'Extra info...', multiline: true, bigArea: true }
  ]
};

// 🔥 SMART ADAPTIVE INPUT COMPONENT
const SmartInput = ({ field, value, onChangeText, focusedField, setFocusedField, isDark, themeColors }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isFocused = focusedField === field.key;

  const copyToClipboard = async () => {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", `${field.label.replace(' *', '')} copied to clipboard!`);
    
    // 🚀 SENIOR DEV FIX: Smart Log - Track exact field copied
    await logActivity('Security', 'SECURE_COPIED', `User securely copied ${field.label.replace(' *', '')} from a form entry.`, 'WORKFLOW');
  };

  // Smart intercept for IFSC to force uppercase
  const handleTextChange = (text) => {
    if (field.key === 'ifsc') {
      onChangeText(field.key, text.toUpperCase());
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
        field.multiline && { height: field.bigArea ? 140 : 100, alignItems: 'flex-start', paddingTop: 14 } // 🔥 Smart Height for Notes
      ]}>
        <TextInput 
          style={[styles.input, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }, field.multiline && { textAlignVertical: 'top', marginTop: Platform.OS === 'ios' ? 0 : -4 }]} 
          placeholder={field.placeholder} 
          placeholderTextColor="#9CA3AF" 
          value={value} 
          onChangeText={handleTextChange} 
          secureTextEntry={field.isSecure && !showPassword}
          multiline={field.multiline}
          maxLength={field.maxLength}
          keyboardType={field.keyboardType || 'default'}
          autoCapitalize={field.autoCapitalize || 'sentences'}
          onFocus={() => {
            Haptics.selectionAsync();
            setFocusedField(field.key);
          }}
          onBlur={() => setFocusedField(null)}
        />
        
        <View style={styles.actionIconsRow}>
          {field.isSecure && (
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconBtn}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          {value ? (
            <TouchableOpacity onPress={copyToClipboard} style={styles.iconBtn}>
              <Feather name="copy" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

      </View>
    </View>
  );
};

export default function FormScreen({ route, navigation }) {
  const { themeColors, isDark } = useContext(ThemeContext);
  
  // 🧩 Extract Type and Custom Fields passed from SelectTypeScreen
  const { type = 'Login', editEntry = null, customFields = null } = route.params || {};

  // 🧠 Decide which schema to use (Default vs Custom)
  let schema = TYPE_SCHEMAS[type];
  if (!schema) {
    // If custom type, build schema dynamically
    schema = [
      { key: 'title', label: 'Title *', placeholder: `e.g. ${type} Account` },
      ...(customFields || []).map(cf => ({ key: cf.id, label: cf.label, placeholder: cf.placeholder }))
    ];
  }

  const [formData, setFormData] = useState({});
  const [focusedField, setFocusedField] = useState(null);
  const [saveState, setSaveState] = useState('idle'); 

  // Validation: Only Title is strictly required for now
  const isFormValid = formData['title']?.trim().length > 0; 

  useEffect(() => {
    if (editEntry) {
      setFormData(editEntry); 
    }
  }, [editEntry]);

  const handleChange = (key, text) => {
    setFormData(prev => ({ ...prev, [key]: text }));
  };

  const handleSave = async () => {
    if (!isFormValid || saveState !== 'idle') return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaveState('loading');
    Keyboard.dismiss(); // 🔥 Smart feature: Keyboard automatically band hoga save pe

    try {
      const existingData = await getVaultData();
      let updatedData = [];

      if (editEntry) {
        updatedData = existingData.map(item => 
          item.id === editEntry.id 
            ? { ...item, ...formData, updatedAt: new Date().toISOString() } 
            : item
        );
      } else {
        const newEntry = {
          id: Date.now().toString(),
          type, 
          ...formData, 
          createdAt: new Date().toISOString()
        };
        updatedData = [newEntry, ...existingData];
      }
      
      const success = await saveVaultData(updatedData);
      
      if (success) {
        // 🚀 SENIOR DEV FIX: Smart Log - Track Form Changes dynamically!
        await logActivity('Vault', editEntry ? 'ENTRY_EDITED' : 'ENTRY_CREATED', `Vault entry '${formData.title}' was securely ${editEntry ? 'updated' : 'saved'}.`, 'WORKFLOW');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaveState('success');
        setTimeout(() => {
          navigation.goBack(); 
        }, 600); 
      } else {
        setSaveState('idle');
        Alert.alert('Error', 'Failed to save entry.');
      }
    } catch (error) {
      setSaveState('idle');
      Alert.alert('Error', 'Something went wrong while saving.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#FFFFFF' }]}>
      
      {/* 🔝 STRICT HEADER FIX */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.backBtn, { backgroundColor: isDark ? themeColors.card : '#F3F4F8' }, pressed && {opacity: 0.7}]}>
          <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : BP_COLORS.textMain} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }]}>{editEntry ? 'Edit' : 'Add'} {type}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* 🔥 SMART KEYBOARD ENGINE WRAPPER */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled" // 🔥 Direct tap on save works without closing keyboard
        >
          
          <View style={{ marginTop: 20 }}>
            {/* 🧩 DYNAMIC FIELD RENDERER */}
            {schema.map(field => (
              <SmartInput 
                key={field.key}
                field={field} 
                value={formData[field.key] || ''} 
                onChangeText={handleChange} 
                focusedField={focusedField} 
                setFocusedField={setFocusedField} 
                isDark={isDark} 
                themeColors={themeColors} 
              />
            ))}
          </View>

          {/* 🔥 STRICT SMART SAVE BUTTON */}
          <Pressable 
            disabled={!isFormValid || saveState !== 'idle'}
            activeOpacity={0.8} 
            onPress={handleSave} 
            style={({ pressed }) => [styles.btnWrapper, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            {isFormValid ? (
              <LinearGradient colors={saveState === 'success' ? ['#2ECC71', '#27AE60'] : themeColors.primaryGradient} style={styles.primaryBtn}>
                {saveState === 'loading' ? (
                  <ActivityIndicator color="#FFF" />
                ) : saveState === 'success' ? (
                  <Text style={styles.primaryBtnText}>✔ Saved</Text>
                ) : (
                  <Text style={styles.primaryBtnText}>Save Entry</Text>
                )}
              </LinearGradient>
            ) : (
              <View style={[styles.primaryBtn, { backgroundColor: isDark ? themeColors.inputBg : BP_COLORS.disabledBtn, elevation: 0, shadowOpacity: 0 }]}>
                <Text style={[styles.primaryBtnText, { color: isDark ? themeColors.textLight : '#FFFFFF' }]}>Save Entry</Text>
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
  // 🔧 EXACT HEADER SPACING
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  
  // 🔥 THE MAGIC FIX: MASSIVE PADDING BOTTOM
  scrollContent: { paddingHorizontal: 16, paddingBottom: 200 }, 
  
  // 📐 SPACING SYSTEM
  inputGroup: { marginBottom: 12 }, 
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  
  inputWrapper: { 
    flexDirection: 'row', alignItems: 'center', 
    height: 52, borderRadius: 14, 
    paddingHorizontal: 14, 
    borderWidth: 1.5 
  },
  input: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },
  
  actionIconsRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4, marginLeft: 6 },

  btnWrapper: { marginTop: 20 }, 
  primaryBtn: { 
    height: 52, borderRadius: 14, 
    justifyContent: 'center', alignItems: 'center', 
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
