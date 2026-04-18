// File: src/screens/LockScreen.js
import React, { useState, useEffect, useRef, useContext } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, 
  Modal, Animated, ActivityIndicator, Alert, AppState, TextInput, Pressable, TouchableOpacity, Platform, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons'; 
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { 
  getMasterPin, setSessionMode, updateSetting, getRecoveryEmail, 
  getRecoveryCode, saveMasterPin, getFakePin, getLockProfile, logActivity, getSettings 
} from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

import PremiumPasskeyModal from '../components/PremiumPasskeyModal';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev'; 

const fetchWithRetry = async (url, options = {}, retries = 3) => {
  const customHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); 

      const response = await fetch(url, { 
        ...options, 
        headers: customHeaders,
        signal: controller.signal 
      });
      
      clearTimeout(timeoutId); 
      return response; 
    } catch (error) {
      if (i === retries - 1) {
        throw new Error("Server timeout or unreachable. Please try again.");
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};

export default function LockScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets(); 
  const primaryColor = themeColors?.primary || '#6C5CE7';

  const [pin, setPin] = useState('');
  const [savedPin, setSavedPin] = useState(null); 
  const [fakePinState, setFakePinState] = useState(null); 
  const [lockProfile, setLockProfile] = useState('BIO_OR_PIN'); 
  const [isPasskeyEnabled, setIsPasskeyEnabled] = useState(false); // 🚀 SENIOR DEV FIX: Global Passkey State
  
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [setupStep, setSetupStep] = useState(1); 
  const [tempSetupPin, setTempSetupPin] = useState('');

  const [isError, setIsError] = useState(false);
  const [dynamicSubtitle, setDynamicSubtitle] = useState("Enter PIN to unlock");
  const [attempts, setAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [appState, setAppState] = useState(AppState.currentState);
  
  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState('OPTIONS'); 
  const [isRecoveryLoading, setIsRecoveryLoading] = useState(false);
  const [isRecoveryError, setIsRecoveryError] = useState(false);

  const [savedEmail, setSavedEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpInput, setOtpInput] = useState('');
  
  const [savedCode, setSavedCode] = useState(null);
  const [codeInput, setCodeInput] = useState('');
  
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resetStep, setResetStep] = useState(1);

  const [mandatoryEmailModal, setMandatoryEmailModal] = useState(false);
  const [pendingVaultMode, setPendingVaultMode] = useState('FULL');

  const [showPasskeyAuth, setShowPasskeyAuth] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const recoveryShakeAnim = useRef(new Animated.Value(0)).current;
  const recoveryScaleAnim = useRef(new Animated.Value(0.8)).current; 
  const heroScaleAnim = useRef(new Animated.Value(0.7)).current; 
  const heroFadeAnim = useRef(new Animated.Value(0)).current;
  const dotScales = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const idleTimer = useRef(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', async () => { 
      await loadInitialSetup(); 
      if (mandatoryEmailModal) {
        checkAndProceed(pendingVaultMode);
      }
    });
    return unsubscribe;
  }, [navigation, mandatoryEmailModal, pendingVaultMode]);

  useEffect(() => {
    loadInitialSetup();
    Animated.parallel([
      Animated.spring(heroScaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(heroFadeAnim, { toValue: 1, duration: 240, useNativeDriver: true })
    ]).start();

    const subscription = AppState.addEventListener('change', nextAppState => setAppState(nextAppState));
    return () => { subscription.remove(); clearTimeout(idleTimer.current); };
  }, []);

  useEffect(() => {
    let interval;
    if (otpCooldown > 0) { interval = setInterval(() => setOtpCooldown((prev) => prev - 1), 1000); }
    return () => clearInterval(interval);
  }, [otpCooldown]);

  useEffect(() => {
    dotScales.forEach((anim, index) => {
      Animated.sequence([
        Animated.timing(anim, { toValue: index < pin.length ? 1.2 : 0, duration: 60, useNativeDriver: true }),
        Animated.spring(anim, { toValue: index < pin.length ? 1 : 0, speed: 20, bounciness: 12, useNativeDriver: true })
      ]).start();
    });
  }, [pin]);

  useEffect(() => {
    let interval;
    if (lockoutTimer > 0) { interval = setInterval(() => setLockoutTimer(prev => prev - 1), 1000); }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  useEffect(() => {
    if (recoveryStep === 'EMAIL_OTP' && otpInput.length === 6 && !isRecoveryLoading) {
      handleVerifyOtp();
    }
  }, [otpInput]);

  useEffect(() => {
    if (recoveryStep === 'CODE_ENTRY' && savedCode && codeInput.length > 5 && !isRecoveryLoading) {
      const cleanInput = codeInput.replace(/[^0-9]/ig, '');
      const cleanSaved = savedCode.replace(/[^0-9]/ig, '');
      if (cleanInput === cleanSaved && cleanInput.length === cleanSaved.length) {
        handleRecoveryCodeSubmit();
      }
    }
  }, [codeInput]);

  const loadInitialSetup = async () => {
    const fPin = await getFakePin(); setFakePinState(fPin);
    const profile = await getLockProfile(); setLockProfile(profile);
    const code = await getRecoveryCode(); setSavedCode(code);
    const s = await getSettings(); setIsPasskeyEnabled(s?.passkeyEnabled || false);
    
    let e = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL');
    if (!e) e = await AsyncStorage.getItem('RECOVERY_EMAIL');

    if (e) {
      setSavedEmail(e);
      const parts = e.split('@');
      if (parts.length === 2) setMaskedEmail(`${parts[0].substring(0, 2)}***@${parts[1]}`);
    } else setSavedEmail('');

    const p = await getMasterPin();
    if (p) {
      setSavedPin(p); setIsFirstTime(false);
      setDynamicSubtitle("Enter PIN to unlock");
      if (profile === 'BIO_OR_PIN' && !mandatoryEmailModal) {
        setTimeout(() => triggerBiometric(true), 800);
      }
    } else {
      setSavedPin(null); setIsFirstTime(true); setSetupStep(1); setTempSetupPin(''); setPin('');
    }
  };

  const checkAndProceed = async (mode) => {
    setPendingVaultMode(mode);
    let currentEmail = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL');
    if (!currentEmail) currentEmail = await AsyncStorage.getItem('RECOVERY_EMAIL');

    if (!currentEmail || currentEmail.trim() === '') {
      setMandatoryEmailModal(true); 
    } else {
      setMandatoryEmailModal(false);
      unlockVault(mode);
    }
  };

  const handleGoToEmailSetup = () => {
    setMandatoryEmailModal(false);
    navigation.navigate('EmailSetup', { isFromOnboarding: true });
  };

  const unlockVault = async (mode) => {
    clearTimeout(idleTimer.current);
    await updateSetting('lastUnlocked', `Today • ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);
    await setSessionMode(mode); 
    await logActivity('Auth', 'VAULT_UNLOCKED', `Vault successfully accessed in ${mode === 'LIMITED' ? 'Decoy' : 'Full'} Mode.`, 'WORKFLOW');
    navigation.replace('MainDashboard'); 
  };

  const triggerMainShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const triggerRecoveryShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setIsRecoveryError(true);
    Animated.sequence([
      Animated.timing(recoveryShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(recoveryShakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(recoveryShakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(recoveryShakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start(() => setIsRecoveryError(false));
  };

  const resetIdleTimer = () => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => { if (pin.length > 0) setPin(''); }, 6000);
  };

  const handleKeyPress = async (num) => {
    if (lockoutTimer > 0) { triggerMainShake(); return; }
    if (pin.length === 0 && !isError) { if (attempts < 3) setDynamicSubtitle("Enter PIN to unlock"); }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetIdleTimer();
    
    if (pin.length < 4) {
      const newPinValue = pin + num;
      setPin(newPinValue);
      setIsError(false); 
      if (newPinValue.length === 4) {
        if (isFirstTime) handleSetupFlow(newPinValue); else verifyPin(newPinValue);
      }
    }
  };

  const handleSetupFlow = async (enteredPin) => {
    if (setupStep === 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTempSetupPin(enteredPin);
      setTimeout(() => { setPin(''); setSetupStep(2); }, 300);
    } else if (setupStep === 2) {
      if (enteredPin === tempSetupPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await saveMasterPin(enteredPin); setSavedPin(enteredPin); setIsFirstTime(false);
        await logActivity('Auth', 'MASTER_PIN_CREATED', 'Initial Master PIN created.', 'IMPORTANT');
        checkAndProceed('FULL');
      } else {
        setIsError(true); triggerMainShake(); setDynamicSubtitle('PINs do not match');
        setTimeout(() => { setPin(''); setTempSetupPin(''); setSetupStep(1); setIsError(false); setDynamicSubtitle("Create 4-digit Master PIN"); }, 1000);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setPin(pin.slice(0, -1)); setIsError(false); resetIdleTimer();
    }
  };

  const clearAllPin = () => { 
    if (pin.length > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
      setPin(''); setIsError(false); 
    }
  };

  const verifyPin = async (enteredPin) => {
    if (enteredPin === savedPin) {
      if (lockProfile === 'DUAL') await executeDualBiometric('FULL');
      else {
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setAttempts(0); 
         checkAndProceed('FULL'); 
      }
    } else if (fakePinState && enteredPin === fakePinState) {
      if (lockProfile === 'DUAL') await executeDualBiometric('LIMITED');
      else {
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setAttempts(0); 
         await logActivity('Auth', 'DECOY_MODE_ACCESS', 'Decoy Vault accessed via Fake PIN.', 'CRITICAL'); 
         await unlockVault('LIMITED');
      }
    } else {
      setIsError(true); triggerMainShake();
      const newAttempts = attempts + 1; setAttempts(newAttempts);
      if (newAttempts >= 5) setDynamicSubtitle("Take a breath. Try again.");
      else if (newAttempts >= 3) setDynamicSubtitle("Still not right.");
      else setDynamicSubtitle("Enter PIN to unlock");
      
      await logActivity('Auth', 'FAILED_UNLOCK_ATTEMPT', `Invalid PIN attempt (${newAttempts}/5).`, 'CRITICAL');
      
      if (newAttempts >= 10) {
        setLockoutTimer(120);
      } else if (newAttempts >= 5) {
        setLockoutTimer(30); 
      }
      setTimeout(() => { setPin(''); setIsError(false); }, 800); 
    }
  };

  const executeDualBiometric = async (sessionMode) => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Dual Security: Verify Biometric to proceed', fallbackLabel: 'Use PIN', disableDeviceFallback: true });
        if (auth.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setAttempts(0);
          if(sessionMode === 'LIMITED') await unlockVault(sessionMode);
          else checkAndProceed(sessionMode); 
        } else {
          setIsError(true); triggerMainShake(); setDynamicSubtitle("Biometric failed");
          await logActivity('Auth', 'BIOMETRIC_FAILED', 'Dual verification biometric check failed.', 'CRITICAL');
          setTimeout(() => { setPin(''); setIsError(false); setDynamicSubtitle("Enter PIN to unlock"); }, 1500);
        }
      } else {
        if(sessionMode === 'LIMITED') await unlockVault(sessionMode);
        else checkAndProceed(sessionMode);
      }
    } catch(e) { setPin(''); }
  };

  const triggerBiometric = async (isAutoTrigger = false) => {
    if (isFirstTime || mandatoryEmailModal) return; 
    if (!isAutoTrigger && lockProfile === 'PIN') return; 
    if (!isAutoTrigger && lockProfile === 'DUAL') return Alert.alert('Dual Mode Active', 'Please enter your Master PIN first.');

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Secure Vault', fallbackLabel: 'Use PIN', disableDeviceFallback: true });
        if (auth.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          checkAndProceed('FULL'); 
        } else if (!isAutoTrigger) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logActivity('Auth', 'BIOMETRIC_FAILED', 'Primary biometric unlock failed or cancelled.', 'CRITICAL');
        }
      }
    } catch (e) {}
  };

  // 🚀 SENIOR DEV FIX: Centralized Recovery Menu
  const openRecoveryModal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecoveryStep('OPTIONS');
    setRecoveryModalVisible(true);
    Animated.spring(recoveryScaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  };

  const handlePasskeySuccess = () => {
    setShowPasskeyAuth(false);
    setRecoveryModalVisible(true);
    setRecoveryStep('RESET_PIN');
    Animated.spring(recoveryScaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  };

  const handlePasskeyFallback = () => {
    // If Passkey fails or user clicks "Other Methods", simply close Passkey and return to Options Menu
    setShowPasskeyAuth(false);
    setRecoveryModalVisible(true);
  };

  const closeRecoveryModal = () => {
    Keyboard.dismiss();
    Animated.timing(recoveryScaleAnim, { toValue: 0.8, duration: 150, useNativeDriver: true }).start(() => {
      setRecoveryModalVisible(false);
      setRecoveryStep('OPTIONS'); setOtpInput(''); setCodeInput(''); setNewPin(''); setConfirmNewPin(''); setResetStep(1);
    });
  };

  const triggerEmailRecoveryFlow = async () => {
    if (!savedEmail || savedEmail === '') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("No Email Linked", "You haven't set up a recovery email. Please use a Recovery Code."); return;
    }
    setIsRecoveryLoading(true);
    try {
      const payload = { email: savedEmail.toLowerCase().trim(), otpType: 'RECOVER_PIN' };
      const res = await fetchWithRetry(`${API_BASE_URL}/send-otp`, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      setIsRecoveryLoading(false);
      if (data.success) {
        setOtpCooldown(60); setRecoveryStep('EMAIL_OTP');
      } else { Alert.alert("Failed", data.message || "Could not send OTP."); }
    } catch (error) {
      setIsRecoveryLoading(false); Alert.alert("Network Error", error.message);
    }
  };

  const handleVerifyOtp = async () => {
    Keyboard.dismiss();
    setIsRecoveryLoading(true);
    try {
      const payload = { email: savedEmail.toLowerCase().trim(), otp: otpInput };
      const res = await fetchWithRetry(`${API_BASE_URL}/verify-otp`, { method: 'POST', body: JSON.stringify(payload) });
      const data = await res.json();
      setIsRecoveryLoading(false);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setRecoveryStep('RESET_PIN');
      } else {
        setOtpInput(''); triggerRecoveryShake();
        await logActivity('Auth', 'FAILED_RECOVERY_ATTEMPT', 'Invalid OTP entered during email recovery.', 'CRITICAL');
      }
    } catch (error) { setIsRecoveryLoading(false); setOtpInput(''); triggerRecoveryShake(); }
  };

  const handleRecoveryCodeSubmit = async () => {
    Keyboard.dismiss();
    const cleanInput = codeInput.replace(/[^0-9]/g, ''); 
    const cleanSaved = savedCode ? savedCode.replace(/[^0-9]/g, '') : '';

    if (cleanInput === cleanSaved && cleanSaved !== '') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setRecoveryStep('RESET_PIN'); 
    } else {
      setCodeInput(''); triggerRecoveryShake();
      await logActivity('Auth', 'FAILED_UNLOCK_ATTEMPT', `Invalid Recovery Code attempt.`, 'CRITICAL');
    }
  };

  const saveNewMasterPin = async () => {
    if (resetStep === 1) {
      if (newPin.length === 4) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setResetStep(2); } 
      else { triggerRecoveryShake(); }
    } else {
      if (confirmNewPin.length < 4) return;
      if (newPin === confirmNewPin) {
        setIsRecoveryLoading(true);
        try {
          await saveMasterPin(newPin); 
          setTimeout(async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsRecoveryLoading(false); setSavedPin(newPin); closeRecoveryModal();
            await logActivity('Auth', 'PIN_RESET_RECOVERY', 'Master PIN was reset successfully via Recovery.', 'CRITICAL');
            Alert.alert("Vault Secured ✅", "Your new Master PIN has been securely saved. You can now unlock your vault.");
          }, 800);
        } catch (error) { setIsRecoveryLoading(false); Alert.alert("Encryption Error", "Failed to secure PIN."); }
      } else { triggerRecoveryShake(); setConfirmNewPin(''); setResetStep(1); }
    }
  };

  const KeypadButton = ({ num, onPress, icon, onLongPress }) => (
    <Pressable 
      onPress={onPress} onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.padButton, 
        { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }, 
        pressed && { backgroundColor: isDark ? '#2C2C2E' : '#F3F4F6' } 
      ]}
    >
      {icon ? icon : <Text style={[styles.padButtonText, { color: isDark ? '#FFF' : '#111827' }]}>{num}</Text>}
    </Pressable>
  );

  return (
    <View style={styles.containerMain}>
      <LinearGradient colors={themeColors.background} style={styles.container}>
        <SafeAreaView style={styles.safeAreaFlex}>
          <View style={styles.mainContent}>
            <View style={[styles.topBlock, { marginTop: insets.top + 28 }]}>
              <Animated.View style={[styles.heroContainer, { backgroundColor: themeColors.primaryLight, transform: [{ scale: heroScaleAnim }], opacity: heroFadeAnim }]}>
                <Feather name={isFirstTime ? "shield" : "lock"} size={32} color={primaryColor} />
              </Animated.View>
              <Text style={[styles.appName, { color: isDark ? '#FFF' : '#111827' }]}>SafeLocker</Text>
              <Text style={[styles.subtitle, { color: themeColors.textLight }]}>{isFirstTime ? (setupStep === 1 ? "Create 4-digit Master PIN" : "Confirm Master PIN") : dynamicSubtitle}</Text>
            </View>

            <Animated.View style={[styles.pinDisplayContainer, { transform: [{ translateX: shakeAnim }] }]}>
              {lockoutTimer > 0 ? (
                <View style={[styles.lockoutBox, { backgroundColor: isDark ? '#3D2A2A' : '#FFF1F1' }]}><Feather name="alert-triangle" size={14} color={themeColors.danger} /><Text style={[styles.lockoutText, { color: themeColors.danger }]}>Try again in {lockoutTimer}s</Text></View>
              ) : isError ? (
                <Text style={[styles.errorText, { color: themeColors.danger }]}>{isFirstTime ? 'PINs do not match' : 'Incorrect PIN'}</Text>
              ) : (
                <View style={styles.dotsContainer}>
                  {[0, 1, 2, 3].map(i => (
                    <View key={i} style={[styles.dotBase, { borderColor: isDark ? '#333' : '#D1D5DB' }, pin.length > i && { borderColor: primaryColor }]}>
                      <Animated.View style={[styles.dotFilled, { backgroundColor: primaryColor, transform: [{ scale: dotScales[i] }] }]} />
                    </View>
                  ))}
                </View>
              )}
            </Animated.View>

            <View style={styles.forgotPinWrapper}>
              {!isFirstTime && (
                <Pressable onPress={openRecoveryModal} style={({ pressed }) => [pressed && { transform: [{ scale: 0.96 }], opacity: 0.8 }]}>
                  <Text style={[styles.forgotPinText, { color: primaryColor }]}>Forgot PIN?</Text>
                </Pressable>
              )}
            </View>

            <View style={{flex: 1}} /> 

            <View style={styles.keypadWrapper}>
              {[[1,2,3], [4,5,6], [7,8,9]].map((row, i) => (
                <View key={i} style={styles.padRow}>
                  {row.map(num => <KeypadButton key={num} num={num.toString()} onPress={() => handleKeyPress(num.toString())} />)}
                </View>
              ))}
              <View style={styles.padRow}>
                {isFirstTime ? ( <View style={styles.emptyButtonSpace} /> ) : (
                  <KeypadButton onPress={() => triggerBiometric(false)} icon={<MaterialIcons name="fingerprint" size={30} color={lockProfile === 'BIO_OR_PIN' ? primaryColor : themeColors.textLight} />} />
                )}
                <KeypadButton num="0" onPress={() => handleKeyPress('0')} />
                <KeypadButton onPress={handleDelete} onLongPress={clearAllPin} icon={<Feather name="delete" size={24} color={themeColors.textDark} />} />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* GLOBAL PASSKEY MODAL INTEGRATION */}
      <PremiumPasskeyModal 
        visible={showPasskeyAuth}
        actionType="FORGOT_PIN"
        isDark={isDark}
        themeColors={themeColors}
        onSuccess={handlePasskeySuccess}
        onFallback={handlePasskeyFallback} 
        onCancel={() => setShowPasskeyAuth(false)}
      />

      <Modal visible={mandatoryEmailModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.onboardingCard, { backgroundColor: themeColors.card }]}>
            <View style={[styles.onboardingIconBox, { backgroundColor: themeColors.primaryLight }]}><Feather name="mail" size={32} color={primaryColor} /></View>
            <Text style={[styles.onboardingTitle, { color: themeColors.textDark }]}>Action Required</Text>
            <Text style={[styles.onboardingSub, { color: themeColors.textLight }]}>Adding a recovery email is mandatory to secure your vault.</Text>
            <TouchableOpacity style={[styles.onboardingBtnActionFull, { backgroundColor: primaryColor }]} onPress={handleGoToEmailSetup}>
              <Text style={styles.onboardingBtnTextAction}>Set up Email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={recoveryModalVisible} transparent animationType="fade" onRequestClose={closeRecoveryModal}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
            <Animated.View style={[styles.premiumRecoveryCard, { backgroundColor: themeColors.card, transform: [{ scale: recoveryScaleAnim }, { translateX: recoveryShakeAnim }] }]}>
              
              <View style={styles.recoveryHeader}>
                {recoveryStep !== 'OPTIONS' && (
                  <TouchableOpacity onPress={() => {setRecoveryStep('OPTIONS'); setOtpInput(''); setCodeInput(''); setIsRecoveryError(false);}} style={styles.recoveryBackBtn}>
                    <Feather name="arrow-left" size={24} color={themeColors.textDark} />
                  </TouchableOpacity>
                )}
                <Text style={[styles.recoveryHeaderTitle, { color: themeColors.textDark }]}>Recover Access</Text>
                <TouchableOpacity onPress={closeRecoveryModal} style={styles.recoveryCloseBtn}>
                  <Feather name="x" size={24} color={themeColors.textDark} />
                </TouchableOpacity>
              </View>

              {recoveryStep === 'OPTIONS' && (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View style={[styles.recoveryIconCircle, { backgroundColor: primaryColor + '15' }]}><Feather name="shield" size={30} color={primaryColor} /></View>
                  <Text style={[styles.recoverySubtitle, { color: themeColors.textLight }]}>Choose a secure method to verify your identity and restore access.</Text>
                                    <TouchableOpacity style={[styles.recoveryTile, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]} onPress={() => { setRecoveryModalVisible(false); setShowPasskeyAuth(true); }}>
                    <View style={styles.recoveryTileLeft}>
                      <View style={[styles.recoveryTileIconBox, { backgroundColor: '#F3E8FF' }]}><Feather name="fingerprint" size={22} color="#A855F7" /></View>
                      <View style={{flex: 1, marginRight: 10}}>
                        <Text style={[styles.recoveryTileText, { color: themeColors.textDark }]}>Passkey</Text>
                        <Text style={{ fontSize: 13, color: themeColors.textLight, marginTop: 2, fontWeight: '500' }}>Biometric secure auth</Text>
                      </View>
                    </View>
                    <View style={[styles.arrowBg, { backgroundColor: '#A855F7' + '15' }]}>
                      <Feather name="chevron-right" size={20} color="#A855F7" />
                    </View>
                  </TouchableOpacity>

                  {/* 🚀 SENIOR DEV FIX: Passkey Tile inside Options Menu */}
                  {isPasskeyEnabled && (
                    <TouchableOpacity style={[styles.recoveryTile, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]} onPress={() => { setRecoveryModalVisible(false); setShowPasskeyAuth(true); }}>
                      <View style={styles.recoveryTileLeft}>
                        <View style={[styles.recoveryTileIconBox, { backgroundColor: '#F3E8FF' }]}><Feather name="fingerprint" size={22} color="#A855F7" /></View>
                        <View style={{flex: 1, marginRight: 10}}>
                          <Text style={[styles.recoveryTileText, { color: themeColors.textDark }]}>Passkey</Text>
                          <Text style={{ fontSize: 13, color: themeColors.textLight, marginTop: 2, fontWeight: '500' }}>Biometric secure auth</Text>
                        </View>
                      </View>
                      <View style={[styles.arrowBg, { backgroundColor: '#A855F7' + '15' }]}>
                        <Feather name="chevron-right" size={20} color="#A855F7" />
                      </View>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={[styles.recoveryTile, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]} onPress={triggerEmailRecoveryFlow} disabled={isRecoveryLoading}>
                    <View style={styles.recoveryTileLeft}>
                      <View style={[styles.recoveryTileIconBox, { backgroundColor: '#EEF2FF' }]}><Feather name="mail" size={22} color="#3B82F6" /></View>
                      <View style={{flex: 1, marginRight: 10}}>
                        <Text style={[styles.recoveryTileText, { color: themeColors.textDark }]}>Email Recovery</Text>
                        <Text style={{ fontSize: 13, color: themeColors.textLight, marginTop: 2, fontWeight: '500' }}>{savedEmail ? `OTP to ${maskedEmail}` : 'Not setup'}</Text>
                      </View>
                    </View>
                    {isRecoveryLoading ? <ActivityIndicator color="#3B82F6" /> : (
                      <View style={[styles.arrowBg, { backgroundColor: '#3B82F6' + '15' }]}>
                        <Feather name="chevron-right" size={20} color="#3B82F6" />
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.recoveryTile, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: isDark ? themeColors.separator : '#E5E7EB' }]} onPress={() => setRecoveryStep('CODE_ENTRY')}>
                    <View style={styles.recoveryTileLeft}>
                      <View style={[styles.recoveryTileIconBox, { backgroundColor: '#ECFDF5' }]}><Feather name="key" size={22} color="#10B981" /></View>
                      <View style={{flex: 1, marginRight: 10}}>
                        <Text style={[styles.recoveryTileText, { color: themeColors.textDark }]}>Recovery Code</Text>
                        <Text style={{ fontSize: 13, color: themeColors.textLight, marginTop: 2, fontWeight: '500' }}>Use offline backup code</Text>
                      </View>
                    </View>
                    <View style={[styles.arrowBg, { backgroundColor: '#10B981' + '15' }]}>
                      <Feather name="chevron-right" size={20} color="#10B981" />
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {recoveryStep === 'EMAIL_OTP' && (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View style={[styles.recoveryIconCircle, { backgroundColor: '#EEF2FF' }]}><Feather name="mail" size={30} color="#3B82F6" /></View>
                  <Text style={[styles.recoverySubtitle, { color: themeColors.textLight }]}>Enter the 6-digit code sent to {maskedEmail}</Text>
                  
                  <View style={styles.otpContainer}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <View key={index} style={[styles.otpDigitBox, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', borderColor: isRecoveryError ? '#EF4444' : (otpInput.length === index ? '#3B82F6' : (isDark ? '#334155' : '#E5E7EB')), borderWidth: isRecoveryError || otpInput.length === index ? 2 : 1 }]}>
                        <Text style={[styles.otpDigitText, { color: isRecoveryError ? '#EF4444' : themeColors.textDark }]}>{otpInput[index] || ''}</Text>
                      </View>
                    ))}
                    <TextInput style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} keyboardType="number-pad" maxLength={6} value={otpInput} onChangeText={(v) => {setOtpInput(v.replace(/[^0-9]/g, '')); setIsRecoveryError(false);}} color="transparent" caretHidden autoFocus />
                  </View>

                  {isRecoveryLoading && <ActivityIndicator color="#3B82F6" style={{ marginTop: 10 }} />}
                  {isRecoveryError && <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700', marginTop: 10 }}>Incorrect OTP. Please try again.</Text>}
                </View>
              )}

              {recoveryStep === 'CODE_ENTRY' && (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View style={[styles.recoveryIconCircle, { backgroundColor: '#ECFDF5' }]}><Feather name="key" size={30} color="#10B981" /></View>
                  <Text style={[styles.recoverySubtitle, { color: themeColors.textLight }]}>Enter your offline numerical recovery code to unlock your vault.</Text>
                  
                  <TextInput 
                    style={[styles.recoveryInputText, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', color: isRecoveryError ? '#EF4444' : themeColors.textDark, borderColor: isRecoveryError ? '#EF4444' : (isDark ? themeColors.separator : '#E5E7EB'), borderWidth: isRecoveryError ? 2 : 1 }]} 
                    placeholder="• • • •" 
                    placeholderTextColor={themeColors.textLight} 
                    keyboardType="number-pad" 
                    maxLength={10} 
                    value={codeInput} 
                    onChangeText={(v) => {setCodeInput(v.replace(/[^0-9]/g, '')); setIsRecoveryError(false);}} 
                    autoFocus 
                  />
                  
                  {isRecoveryError && <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700', marginTop: -4, marginBottom: 12 }}>Invalid recovery code.</Text>}
                  
                  <TouchableOpacity style={[styles.recoveryActionBtn, { backgroundColor: '#10B981' }]} onPress={handleRecoveryCodeSubmit}>
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Verify Code</Text>
                  </TouchableOpacity>
                </View>
              )}

              {recoveryStep === 'RESET_PIN' && (
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <View style={[styles.recoveryIconCircle, { backgroundColor: '#ECFDF5' }]}><Feather name="check" size={30} color="#10B981" /></View>
                  <Text style={[styles.recoverySubtitle, { color: themeColors.textLight }]}>{resetStep === 1 ? 'Create a new 4-digit Master PIN.' : 'Confirm your new Master PIN.'}</Text>
                  
                  <TextInput 
                    style={[styles.recoveryInputText, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', color: isRecoveryError ? '#EF4444' : themeColors.textDark, borderColor: isRecoveryError ? '#EF4444' : (isDark ? themeColors.separator : '#E5E7EB'), letterSpacing: 16, textAlign: 'center', fontSize: 28, fontWeight: '900', borderWidth: isRecoveryError ? 2 : 1 }]} 
                    placeholder="••••" 
                    placeholderTextColor={themeColors.textLight} 
                    keyboardType="numeric" 
                    maxLength={4} 
                    value={resetStep === 1 ? newPin : confirmNewPin} 
                    onChangeText={(v) => {resetStep === 1 ? setNewPin(v.replace(/[^0-9]/g, '')) : setConfirmNewPin(v.replace(/[^0-9]/g, '')); setIsRecoveryError(false);}} 
                    autoFocus 
                  />

                  {isRecoveryError && <Text style={{ color: '#EF4444', fontSize: 14, fontWeight: '700', marginTop: -4, marginBottom: 12 }}>{resetStep === 1 ? 'PIN must be 4 digits.' : 'PINs do not match.'}</Text>}

                  <TouchableOpacity style={[styles.recoveryActionBtn, { backgroundColor: primaryColor }]} onPress={saveNewMasterPin} disabled={isRecoveryLoading}>
                    {isRecoveryLoading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>{resetStep === 1 ? 'Next' : 'Secure Vault'}</Text>}
                  </TouchableOpacity>
                </View>
              )}

            </Animated.View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {appState !== 'active' && (
        <BlurView intensity={100} style={StyleSheet.absoluteFill} tint={isDark ? "dark" : "light"}>
          <View style={{flex: 1, backgroundColor: isDark ? 'rgba(18,18,18,0.5)' : 'rgba(250,250,251,0.5)', justifyContent: 'center', alignItems: 'center'}}>
             <Feather name="shield" size={60} color={primaryColor} />
             <Text style={{marginTop: 10, fontSize: 18, fontWeight: 'bold', color: themeColors.textDark}}>Vault Protected</Text>
          </View>
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerMain: { flex: 1 }, container: { flex: 1 }, safeAreaFlex: { flex: 1 }, mainContent: { flex: 1, alignItems: 'center', paddingBottom: 24 },
  topBlock: { alignItems: 'center', width: '100%' }, heroContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' }, appName: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 16 }, subtitle: { fontSize: 14, marginTop: 6, fontWeight: '500' },
  pinDisplayContainer: { minHeight: 40, justifyContent: 'center', alignItems: 'center', marginTop: 24, marginBottom: 8 }, dotsContainer: { flexDirection: 'row', gap: 16 }, dotBase: { width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, backgroundColor: 'transparent' }, dotFilled: { width: 14, height: 14, borderRadius: 7, position: 'absolute' },
  errorText: { fontSize: 15, fontWeight: '700' }, lockoutBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24 }, lockoutText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  forgotPinWrapper: { marginTop: 20, minHeight: 40, justifyContent: 'center', alignItems: 'center' }, forgotPinText: { fontSize: 15, fontWeight: '700' },
  keypadWrapper: { alignItems: 'center', marginBottom: 12 }, padRow: { flexDirection: 'row', gap: 24, marginBottom: 16 }, padButton: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 }, padButtonText: { fontSize: 28, fontWeight: '400', fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-Light' : 'sans-serif-light' }, emptyButtonSpace: { width: 72, height: 72 },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }, onboardingCard: { width: '100%', borderRadius: 28, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }, onboardingIconBox: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }, onboardingTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12, textAlign: 'center' }, onboardingSub: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 }, onboardingBtnActionFull: { width: '100%', height: 52, justifyContent: 'center', alignItems: 'center', borderRadius: 16 }, onboardingBtnTextAction: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  premiumRecoveryCard: { width: '100%', borderRadius: 36, paddingHorizontal: 24, paddingVertical: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 30, elevation: 20 }, recoveryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', marginBottom: 28, position: 'relative' }, recoveryHeaderTitle: { fontSize: 20, fontWeight: '900' }, recoveryBackBtn: { position: 'absolute', left: 0, width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' }, recoveryCloseBtn: { position: 'absolute', right: 0, width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' }, recoveryIconCircle: { width: 76, height: 76, borderRadius: 38, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }, recoverySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 10, fontWeight: '500' },
  recoveryTile: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1 }, recoveryTileLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 }, recoveryTileIconBox: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 18 }, recoveryTileText: { fontSize: 18, fontWeight: '800' }, arrowBg: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10, marginBottom: 24 }, otpDigitBox: { flex: 1, aspectRatio: 0.8, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, otpDigitText: { fontSize: 26, fontWeight: '900' },
  recoveryInputText: { width: '100%', height: 64, borderRadius: 20, paddingHorizontal: 24, fontSize: 22, fontWeight: '800', marginBottom: 20, letterSpacing: 4, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', }, recoveryActionBtn: { width: '100%', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 8 }
});
