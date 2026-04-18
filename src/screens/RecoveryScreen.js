// File: src/screens/RecoveryScreen.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, TextInput, 
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Pressable, Keyboard
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { ThemeContext } from '../ThemeContext';
import { 
  getRecoveryEmail, getEmailVerified, getRecoveryCode, 
  saveMasterPin, clearAllData, getCurrentDeviceId, getTrustedDeviceId 
} from '../utils/storage';
import { exportBackup } from '../utils/backup';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev';

// 🔥 GLITCH-FREE PREMIUM OTP BOX (Same as Settings)
const SmartInputBox = ({ value, setValue, inputRef, isDark, themeColors, isError, length = 6, isCode = false }) => (
  <View style={styles.otpContainer}>
    <Pressable style={styles.otpPressableArea} onPress={() => { inputRef.current?.focus(); }}>
      {Array.from({ length }).map((_, index) => {
        const isActive = value.length === index;
        const isFilled = value.length > index;
        return (
          <View key={index} style={[styles.otpDigitBox, { 
            backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', 
            borderColor: isError ? '#EF4444' : (isActive ? themeColors.primary : (isFilled ? themeColors.primary + '50' : (isDark ? '#334155' : '#E5E7EB'))),
            borderWidth: isError || isActive ? 2 : 1.5,
            width: isCode ? `${100/length - 2}%` : undefined, // Adjust width dynamically if it's a 10-digit code
            aspectRatio: isCode ? undefined : 0.85,
            height: isCode ? 50 : undefined
          }]}>
            <Text style={[styles.otpDigitText, { color: isError ? '#EF4444' : (isDark ? '#FFF' : '#111827'), fontSize: isCode ? 20 : 24 }]}>
              {value[index] || ''}
            </Text>
          </View>
        );
      })}
    </Pressable>
    {/* Magic hidden input to fix double number / ghost cursor glitch */}
    <TextInput 
      ref={inputRef} style={styles.hiddenInput} 
      keyboardType={isCode ? "default" : "number-pad"} 
      autoCapitalize={isCode ? "characters" : "none"}
      maxLength={length} value={value} onChangeText={setValue} 
      caretHidden={true} autoCorrect={false} blurOnSubmit={false}
    />
  </View>
);

export default function RecoveryScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#6C5CE7';
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState('OPTIONS'); 
  const [loading, setLoading] = useState(false);
  
  const [savedEmail, setSavedEmail] = useState(null);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [savedCode, setSavedCode] = useState(null);
  const [isTrustedDevice, setIsTrustedDevice] = useState(true); 

  const [otp, setOtp] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const [isError, setIsError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const otpInputRef = useRef(null);
  const codeInputRef = useRef(null);

  useEffect(() => { loadRecoveryMethods(); }, []);

  const loadRecoveryMethods = async () => {
    const email = await getRecoveryEmail();
    const verified = await getEmailVerified();
    const code = await getRecoveryCode();
    
    const currentId = await getCurrentDeviceId();
    const trustedId = await getTrustedDeviceId();
    setIsTrustedDevice(currentId === trustedId);

    setSavedEmail(email);
    setIsEmailVerified(verified);
    setSavedCode(code);
  };

  const triggerErrorShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setIsError(true);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start(() => setIsError(false)); // Reset error state after shake
  };

  // 🔥 AUTO-DETECT OTP
  useEffect(() => {
    if (step === 'EMAIL_OTP' && otp.length === 6 && !loading) {
      handleVerifyOTP();
    }
  }, [otp]);

  // 🔥 AUTO-DETECT RECOVERY CODE
  useEffect(() => {
    if (step === 'CODE_ENTRY' && inputCode.length >= 8 && inputCode.length <= 10 && !loading) {
        // We trigger manual check only when they hit submit OR if it perfectly matches length
        if(savedCode && inputCode.length === savedCode.replace(/[^A-Z0-9]/ig, '').length) {
            handleVerifyCode();
        }
    }
  }, [inputCode]);

  const handleSendOTP = async () => {
    if (!isEmailVerified || !savedEmail) return Alert.alert("Not Available", "You haven't verified a recovery email.");
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/send-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: savedEmail, otpType: 'VERIFY_EMAIL' })
      });
      const data = await res.json();
      setLoading(false);
      
      if (data.success) {
        setStep('EMAIL_OTP');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => otpInputRef.current?.focus(), 500); // Auto focus
      } else {
        Alert.alert('Error', data.message);
      }
    } catch (e) {
      setLoading(false);
      Alert.alert('Network Error', 'Ensure backend is running.');
    }
  };

  const handleVerifyOTP = async () => {
    Keyboard.dismiss();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: savedEmail, otp })
      });
      const data = await res.json();
      setLoading(false);
      
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep('NEW_PIN'); 
      } else {
        setOtp('');
        triggerErrorShake();
        setTimeout(() => otpInputRef.current?.focus(), 500); // Re-focus on error
      }
    } catch (e) {
      setLoading(false);
      setOtp('');
      triggerErrorShake();
    }
  };

  const handleVerifyCode = () => {
    if (!inputCode.trim()) return;
    const cleanInput = inputCode.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    const cleanSaved = savedCode ? savedCode.replace(/[^A-Z0-9]/ig, '').toUpperCase() : '';

    if (cleanInput === cleanSaved && cleanSaved !== '') {
      Keyboard.dismiss();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('NEW_PIN');
    } else {
      setInputCode('');
      triggerErrorShake();
      setTimeout(() => codeInputRef.current?.focus(), 500);
    }
  };

  const handleSafeReset = () => {
    Alert.alert(
      "Vault Reset & Safe Exit",
      "This will export an encrypted snapshot of your data, then WIPE the app.\n\nYou can restore this data later if you remember your old PIN.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Export & Wipe", 
          style: "destructive",
          onPress: async () => {
            const backupResult = await exportBackup(); 
            if (backupResult.success) {
              await clearAllData();
              Alert.alert("App Reset", "Data exported and app wiped clean.");
              navigation.replace('Lock');
            } else {
              Alert.alert("Error", "Failed to create snapshot. Reset aborted to protect data.");
            }
          }
        }
      ]
    );
  };

  const handleSetNewPin = async () => {
    if (newPin.length !== 4) return;
    if (confirmPin.length !== 4) return;

    if (newPin !== confirmPin) {
       triggerErrorShake();
       setNewPin(''); setConfirmPin('');
       return Alert.alert("Error", "PINs do not match.");
    }
    
    await saveMasterPin(newPin);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success ✅", "Master PIN has been reset successfully!");
    navigation.replace('MainDashboard');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#121212' : '#FAFAFB' }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? 40 : 20 }]}>
        <TouchableOpacity onPress={() => step === 'OPTIONS' ? navigation.goBack() : setStep('OPTIONS')} style={[styles.backBtn, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]}>
          <Feather name="arrow-left" size={24} color={isDark ? '#FFF' : '#111827'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#FFF' : '#111827' }]}>Account Recovery</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* 🔥 TRUSTED DEVICE BANNER */}
      {step === 'OPTIONS' && (
        <View style={[styles.trustBanner, { backgroundColor: isTrustedDevice ? themeColors.iconBg.security : themeColors.iconBg.danger, borderBottomColor: isTrustedDevice ? themeColors.primary + '30' : themeColors.danger + '30' }]}>
          <Feather name={isTrustedDevice ? "smartphone" : "alert-triangle"} size={18} color={isTrustedDevice ? themeColors.primary : themeColors.danger} />
          <Text style={[styles.trustText, { color: isTrustedDevice ? themeColors.primary : themeColors.danger }]}>
            {isTrustedDevice ? "Trusted Device Detected" : "UNTRUSTED DEVICE: Extra verification required"}
          </Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {step === 'OPTIONS' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: themeColors.primaryLight }]}><Feather name="shield" size={40} color={primaryColor} /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Forgot Master PIN?</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Choose a secure method to verify your identity and restore access to your vault.</Text>

              {/* EMAIL OTP */}
              <TouchableOpacity 
                style={[styles.optionCard, { backgroundColor: themeColors.card, borderColor: isDark ? themeColors.separator : '#F3F4F6' }, !isEmailVerified && { opacity: 0.6 }]} 
                activeOpacity={0.7} 
                onPress={handleSendOTP}
              >
                <View style={[styles.optionIcon, { backgroundColor: themeColors.iconBg.email }]}><Feather name="mail" size={24} color={themeColors.iconColor.email} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: themeColors.textDark }]}>Email Recovery</Text>
                  <Text style={[styles.optionSub, { color: themeColors.textLight }]}>{isEmailVerified ? `Send OTP to ${savedEmail.replace(/(.{2})(.*)(?=@)/, "$1***")}` : 'Not setup'}</Text>
                </View>
                <Feather name="chevron-right" size={20} color={themeColors.textLight} />
              </TouchableOpacity>

              {/* OFFLINE CODE */}
              <TouchableOpacity 
                style={[styles.optionCard, { backgroundColor: themeColors.card, borderColor: isDark ? themeColors.separator : '#F3F4F6' }, !isTrustedDevice && { opacity: 0.4, borderColor: themeColors.danger }]} 
                activeOpacity={!isTrustedDevice ? 1 : 0.7} 
                onPress={() => {
                  if (!isTrustedDevice) {
                    Alert.alert("Blocked 🚫", "Offline Recovery Code is disabled on new/untrusted devices to prevent cloning attacks. Please use Email Recovery.");
                  } else {
                    setStep('CODE_ENTRY');
                    setTimeout(() => codeInputRef.current?.focus(), 500);
                  }
                }}
              >
                <View style={[styles.optionIcon, { backgroundColor: themeColors.iconBg.security }]}><Feather name="key" size={24} color={themeColors.iconColor.security} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionTitle, { color: themeColors.textDark }]}>Use Recovery Code</Text>
                  <Text style={[styles.optionSub, { color: themeColors.textLight }]}>
                    {!isTrustedDevice ? 'Disabled on untrusted device' : 'Enter your 10-digit offline key'}
                  </Text>
                </View>
                {!isTrustedDevice ? <Feather name="lock" size={20} color={themeColors.danger} /> : <Feather name="chevron-right" size={20} color={themeColors.textLight} />}
              </TouchableOpacity>

              <View style={{ marginTop: 40, alignItems: 'center' }}>
                <Text style={{ color: themeColors.textLight, fontSize: 13, marginBottom: 12 }}>Lost all recovery access?</Text>
                <TouchableOpacity onPress={handleSafeReset}>
                  <Text style={{ color: themeColors.danger, fontWeight: '700', fontSize: 15 }}>Safe Reset Vault</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 🔥 SMART AUTO-DETECT OTP ENTRY */}
          {step === 'EMAIL_OTP' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: themeColors.iconBg.email }]}><Feather name="mail" size={40} color={themeColors.iconColor.email} /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Enter OTP</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>We've sent a 6-digit code to your registered email.</Text>
              
              <Animated.View style={{ width: '100%', transform: [{ translateX: shakeAnim }] }}>
                <SmartInputBox value={otp} setValue={setOtp} inputRef={otpInputRef} isDark={isDark} themeColors={themeColors} isError={isError} length={6} />
              </Animated.View>

              {loading && <ActivityIndicator color={primaryColor} style={{ marginTop: 20 }} />}
              {isError && <Text style={{ color: '#EF4444', fontWeight: 'bold', marginTop: 10 }}>Incorrect OTP, try again.</Text>}
            </View>
          )}

          {/* 🔥 SMART AUTO-DETECT CODE ENTRY */}
          {step === 'CODE_ENTRY' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: themeColors.iconBg.security }]}><Feather name="key" size={40} color={themeColors.iconColor.security} /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Recovery Code</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Enter the offline recovery code generated during setup.</Text>
              
              <Animated.View style={{ width: '100%', transform: [{ translateX: shakeAnim }] }}>
                 {/* Adjust length based on your standard code size (usually 6 to 10) */}
                 <SmartInputBox value={inputCode} setValue={setInputCode} inputRef={codeInputRef} isDark={isDark} themeColors={themeColors} isError={isError} length={10} isCode={true} />
              </Animated.View>

              <TouchableOpacity style={[styles.btn, { backgroundColor: primaryColor }]} onPress={handleVerifyCode}>
                 <Text style={styles.btnText}>Unlock Vault</Text>
              </TouchableOpacity>
              {isError && <Text style={{ color: '#EF4444', fontWeight: 'bold', marginTop: 10 }}>Incorrect Code, check spelling.</Text>}
            </View>
          )}

          {/* 🔥 NEW PIN CREATION */}
          {step === 'NEW_PIN' && (
            <View style={styles.content}>
              <View style={[styles.iconCircle, { backgroundColor: '#EAFBF3' }]}><Feather name="check" size={40} color="#2ECC71" /></View>
              <Text style={[styles.title, { color: isDark ? '#FFF' : '#111827' }]}>Identity Verified</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>Create a new 4-digit Master PIN to secure your vault.</Text>
              
              <Animated.View style={{ width: '100%', transform: [{ translateX: shakeAnim }] }}>
                <TextInput 
                  style={[styles.input, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6', color: isDark ? '#FFF' : '#111827', borderColor: isError ? '#EF4444' : (isDark ? themeColors.separator : '#E5E7EB') }]} 
                  value={newPin} onChangeText={(v) => { setNewPin(v); setIsError(false); }} 
                  keyboardType="number-pad" maxLength={4} placeholder="New PIN" placeholderTextColor={themeColors.textLight} secureTextEntry autoFocus 
                />
                <TextInput 
                  style={[styles.input, { marginTop: 16, backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6', color: isDark ? '#FFF' : '#111827', borderColor: isError ? '#EF4444' : (isDark ? themeColors.separator : '#E5E7EB') }]} 
                  value={confirmPin} onChangeText={(v) => { setConfirmPin(v); setIsError(false); }} 
                  keyboardType="number-pad" maxLength={4} placeholder="Confirm PIN" placeholderTextColor={themeColors.textLight} secureTextEntry 
                />
              </Animated.View>

              <TouchableOpacity style={[styles.btn, { backgroundColor: primaryColor, marginTop: 24 }]} onPress={handleSetNewPin} disabled={newPin.length < 4 || confirmPin.length < 4}>
                <Text style={styles.btnText}>Save New PIN</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  
  trustBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  trustText: { fontSize: 13, fontWeight: '700', marginLeft: 8, letterSpacing: 0.5 },

  content: { paddingHorizontal: 24, paddingTop: 20, alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  
  optionCard: { width: '100%', flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3, borderWidth: 1 },
  optionIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  optionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  optionSub: { fontSize: 13, fontWeight: '500' },
  
  input: { width: '100%', height: 60, borderRadius: 16, paddingHorizontal: 20, borderWidth: 1.5, letterSpacing: 10, textAlign: 'center', fontSize: 24, fontWeight: 'bold' },
  btn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // 🔥 NEW GLITCH-FREE OTP STYLES
  otpContainer: { width: '100%', marginBottom: 10, alignItems: 'center' },
  otpPressableArea: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8 },
  otpDigitBox: { flex: 1, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  otpDigitText: { fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
