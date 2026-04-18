// File: src/components/NumericPasskeyModal.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Modal, 
  TextInput, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Alert, Pressable, Keyboard
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev';

export default function NumericPasskeyModal({ visible, onClose, isDark, themeColors, primaryColor, onSaveSuccess }) {
  // UI States: 'LOADING', 'SAVED', 'OTP_CHECK', 'SETUP'
  const [uiState, setUiState] = useState('LOADING');
  const [savedPin, setSavedPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);
  
  // OTP States
  const [userEmail, setUserEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef(null);
  const otpRef = useRef(null);
  
  // Animation
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentScale = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if(visible) {
      loadInitialData();
    }
  }, [visible]);

  const loadInitialData = async () => {
    setUiState('LOADING');
    setNewPin('');
    setOtpInput('');
    setIsPinVisible(false);
    
    // Get Email for OTP (Pre-requisite for changing PIN)
    let email = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL');
    if(!email) email = await AsyncStorage.getItem('RECOVERY_EMAIL');
    setUserEmail(email || '');

    // Get PIN
    const pin = await AsyncStorage.getItem('CUSTOM_PASSKEY_PIN');
    if(pin && pin.length >= 4) {
      setSavedPin(pin);
      transitionToState('SAVED');
    } else {
      transitionToState('SETUP');
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  };

  const transitionToState = (newState) => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(contentScale, { toValue: 0.95, duration: 150, useNativeDriver: true })
    ]).start(() => {
      setUiState(newState);
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(contentScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true })
      ]).start();
    });
  };

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  // 🔥 Strict Numeric Filter (Blocks all alphabets)
  const handleTextChange = (text) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setNewPin(numericValue);
  };

  // --- OTP & Change Logic ---
  const initiateChangePasskey = async () => {
    if (!userEmail) {
      Alert.alert("Action Required", "Please link a Recovery Email in Settings before you can change your passkey.");
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/send-otp`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.toLowerCase().trim(), otpType: 'VERIFY_EMAIL' }) 
      });
      const data = await res.json();
      setIsLoading(false);
      
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        transitionToState('OTP_CHECK');
        setTimeout(() => otpRef.current?.focus(), 400);
      } else {
        Alert.alert('Error', data.message || 'Failed to send OTP.');
      }
    } catch (e) {
      setIsLoading(false);
      Alert.alert('Network Error', "Could not connect to server.");
    }
  };

  const verifyOtpAndProceed = async () => {
    if (otpInput.length !== 6) { triggerShake(); return; }
    Keyboard.dismiss();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, { 
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail.toLowerCase().trim(), otp: otpInput }) 
      });
      const data = await res.json();
      setIsLoading(false);
      
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        transitionToState('SETUP');
        setTimeout(() => inputRef.current?.focus(), 400);
      } else {
        triggerShake();
        setOtpInput('');
        setTimeout(() => otpRef.current?.focus(), 300);
      }
    } catch (e) {
      setIsLoading(false);
      Alert.alert('Error', "Failed to verify OTP.");
    }
  };

  const handleFinalSave = async () => {
    if(newPin.length < 4) { triggerShake(); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    await AsyncStorage.setItem('CUSTOM_PASSKEY_PIN', newPin);
    setSavedPin(newPin); // Update local state for success view
    onSaveSuccess(newPin); // Update parent UI
    transitionToState('SAVED'); // Show success confirmation instead of closing instantly
  };

  const maskEmailSmart = (emailText) => {
    if (!emailText || !emailText.includes('@')) return emailText;
    const [name, domain] = emailText.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}****${name.slice(-2)}@${domain}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <Animated.View style={[
          styles.card, 
          { 
            backgroundColor: isDark ? themeColors.card : '#FFFFFF',
            opacity: contentOpacity,
            transform: [{ scale: contentScale }, { translateX: shakeAnim }]
          }
        ]}>
          
          {/* Top Right Close Button (Visible when not loading and not in explicit setup step) */}
          {uiState !== 'LOADING' && uiState !== 'SETUP' && (
            <TouchableOpacity style={styles.closeXBtn} onPress={onClose}>
              <Feather name="x" size={24} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          )}

          {uiState === 'LOADING' && (
             <View style={{paddingVertical: 60, alignItems: 'center'}}>
                <ActivityIndicator size="large" color={primaryColor} />
             </View>
          )}

          {/* 🚀 PREMIUM SUCCESS CONFIRMATION FLOW (Replaces Offline Warning) */}
          {uiState === 'SAVED' && (
            <>
              <View style={[styles.iconBox, { backgroundColor: '#10B98115' }]}>
                <Feather name="check-circle" size={36} color="#10B981" />
              </View>
              
              <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A', textAlign: 'center', marginBottom: 8 }]}>
                Passkey backup PIN saved
              </Text>
              
              <Text style={[styles.sub, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 28, paddingHorizontal: 10 }]}>
                Use this PIN for Passkey approvals when biometric is unavailable.
              </Text>
              
              <View style={[styles.dashedBox, { borderColor: primaryColor, backgroundColor: primaryColor + '08' }]}>
                <Text style={[styles.dashedText, { color: primaryColor }]}>
                   {savedPin}
                </Text>
              </View>

              <TouchableOpacity style={[styles.btnActionFull, { backgroundColor: primaryColor }]} onPress={onClose}>
                <Text style={styles.btnActionText}>Done</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btnOutlineFull} onPress={initiateChangePasskey} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color={primaryColor} /> : <Text style={[styles.btnOutlineText, {color: primaryColor}]}>Edit PIN</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* 📧 OTP CHECK FOR EDITING PIN */}
          {uiState === 'OTP_CHECK' && (
            <>
              <View style={[styles.iconBox, { backgroundColor: '#3B82F615' }]}>
                <Feather name="mail" size={32} color="#3B82F6" />
              </View>
              
              <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A', textAlign: 'center' }]}>Security Check</Text>
              <Text style={[styles.sub, { color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center' }]}>
                Enter the 6-digit OTP sent to {maskEmailSmart(userEmail)} to authorize changes.
              </Text>
              
              <Pressable style={styles.otpContainer} onPress={() => otpRef.current?.focus()}>
                <View style={styles.otpBoxesRow}>
                  {[0, 1, 2, 3, 4, 5].map((index) => {
                    const isActive = otpInput.length === index;
                    return (
                      <View key={index} style={[styles.otpBox, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: isActive ? '#3B82F6' : 'transparent' }]}>
                        <Text style={[styles.otpText, { color: isDark ? '#FFF' : '#0F172A' }]}>{otpInput[index] || ''}</Text>
                      </View>
                    );
                  })}
                </View>
                <TextInput 
                  ref={otpRef} style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} 
                  keyboardType="phone-pad" 
                  maxLength={6} value={otpInput} onChangeText={(v) => setOtpInput(v.replace(/[^0-9]/g, ''))} caretHidden={true} 
                />
              </Pressable>

              <TouchableOpacity style={[styles.btnActionFull, { backgroundColor: otpInput.length === 6 ? '#3B82F6' : '#3B82F680' }]} onPress={verifyOtpAndProceed} disabled={isLoading || otpInput.length !== 6}>
                {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnActionText}>Verify OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {/* 🔢 SETUP NUMERIC PIN UI */}
          {uiState === 'SETUP' && (
            <>
              <View style={[styles.iconBox, { backgroundColor: primaryColor + '15' }]}>
                <Feather name="hash" size={32} color={primaryColor} />
              </View>
              
              <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A', textAlign: 'center' }]}>Numeric Passkey</Text>
              <Text style={[styles.sub, { color: isDark ? '#94A3B8' : '#64748B', textAlign: 'center' }]}>
                Set a 4–6 digit backup PIN for Passkey approvals.
              </Text>
              
              <View style={[styles.singleInputWrapper, { borderColor: isDark ? themeColors.separator : '#E5E7EB', backgroundColor: isDark ? themeColors.inputBg : '#FFF' }]}>
                <TextInput 
                  ref={inputRef}
                  style={[styles.singleInputText, { color: isDark ? '#FFF' : '#000' }]} 
                  keyboardType="phone-pad" 
                  returnKeyType="done"
                  maxLength={6} 
                  placeholder="...." 
                  placeholderTextColor="#94A3B8" 
                  value={newPin} 
                  onChangeText={handleTextChange} 
                  secureTextEntry={!isPinVisible} 
                />
              </View>

              <TouchableOpacity style={styles.eyeToggle} onPress={() => setIsPinVisible(!isPinVisible)}>
                 <Feather name={isPinVisible ? "eye-off" : "eye"} size={16} color="#64748B" />
                 <Text style={styles.eyeToggleText}>
                   {isPinVisible ? "Hide PIN" : "Show PIN for 1 sec"}
                 </Text>
              </TouchableOpacity>

              <View style={styles.rowButtons}>
                <TouchableOpacity style={styles.btnCancelHalf} onPress={onClose}>
                  <Text style={[styles.btnCancelText, { color: isDark ? '#94A3B8' : '#475569' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnSaveHalf, { backgroundColor: primaryColor }]} onPress={handleFinalSave}>
                  <Text style={styles.btnSaveText}>Save Code</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, borderRadius: 32, padding: 28, paddingTop: 36, alignItems: 'center', position: 'relative' },
  closeXBtn: { position: 'absolute', top: 20, right: 20, padding: 8, zIndex: 10 },
  iconBox: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  
  // Text Styles
  title: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  sub: { fontSize: 14, marginBottom: 24, lineHeight: 20 },
  
  // Single Pill Input (Setup)
  singleInputWrapper: { width: '100%', height: 68, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden' },
  singleInputText: { width: '100%', height: '100%', textAlign: 'center', fontSize: 26, fontWeight: '800', letterSpacing: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  eyeToggle: { flexDirection: 'row', alignItems: 'center', marginBottom: 32 },
  eyeToggleText: { color: '#64748B', fontWeight: '700', marginLeft: 8, fontSize: 13 },
  
  // OTP 6-Box (Change Flow)
  otpContainer: { width: '100%', marginBottom: 32, alignItems: 'center' },
  otpBoxesRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8 },
  otpBox: { flex: 1, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  otpText: { fontSize: 22, fontWeight: '900' },

  // Dashed Box (Saved View)
  dashedBox: { width: '100%', height: 76, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  dashedText: { fontSize: 32, fontWeight: '900', letterSpacing: 8, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  
  // Buttons
  rowButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', gap: 12 },
  btnCancelHalf: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  btnSaveHalf: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnSaveText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  btnCancelText: { fontWeight: '700', fontSize: 16 },

  btnActionFull: { width: '100%', height: 58, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  btnActionText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  btnOutlineFull: { width: '100%', height: 50, justifyContent: 'center', alignItems: 'center' },
  btnOutlineText: { fontWeight: '800', fontSize: 15 }
});
