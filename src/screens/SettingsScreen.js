// File: src/screens/SettingsScreen.js
import React, { useState, useCallback, useRef, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Modal, TextInput, ActivityIndicator, Platform, Animated, Pressable,
  KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import * as ScreenCapture from 'expo-screen-capture';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import Svg, { Circle } from 'react-native-svg';

import { ThemeContext } from '../ThemeContext'; 

import { 
  getSettings, updateSetting, getRecoveryEmail, getMasterPin, saveMasterPin, 
  getRecoveryCode, saveRecoveryCode, getFakePin, saveFakePin, getEmailVerified, clearAllData,
  getSessionMode, getCurrentDeviceId, getSecurityState, updateSecurityState, clearSecurityState, logActivity,
  getLockProfile, saveLockProfile, getColorHistory, saveColorHistory
} from '../utils/storage';
import { exportBackup, pickAndAnalyzeBackup, processImportDecryption, processEmailDeviceDecryption } from '../utils/backup';
import { sendPremiumTestMail } from '../utils/mailService'; 
import CryptoJS from 'crypto-js';
import PremiumPasskeyModal from '../components/PremiumPasskeyModal';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev';
const BP_COLORS = { primary: '#6C5CE7', danger: '#EF4444', success: '#00C853', textMain: '#111827', textSub: '#6B7280' };

const SOFT_COLORS = [
  { name: 'Soft Purple', hex: '#E9E5FF', text: '#6C4EFF' }, { name: 'Soft Blue', hex: '#E3F2FD', text: '#1E88E5' },
  { name: 'Soft Green', hex: '#E6F7EC', text: '#16A34A' }, { name: 'Soft Pink', hex: '#FCE7F3', text: '#DB2777' },
  { name: 'Soft Yellow', hex: '#FFF7CC', text: '#CA8A04' }, { name: 'Soft Teal', hex: '#E0F7F4', text: '#0D9488' }
];

const GRADIENT_COLORS = [
  { name: 'Sunset Glow', hex: '#F97316', colors: ['#EC4899', '#F97316'] }, { name: 'Ocean Flow', hex: '#00BFA6', colors: ['#06B6D4', '#0D9488'] },
  { name: 'Midnight Depth', hex: '#6366F1', colors: ['#6366F1', '#6C4EFF'] }, { name: 'Forest Fresh', hex: '#22C55E', colors: ['#84CC16', '#16A34A'] }
];

const EXTENDED_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#9F1239', '#7F1D1D', '#7C2D12', '#713F12', '#3F6212', '#14532D', '#064E3B',
  '#164E63', '#0C4A6E', '#1E3A8A', '#312E81', '#4C1D95', '#701A75', '#831843', '#0F172A', '#334155', '#64748B', '#94A3B8', '#CBD5E1'
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function SettingsScreen({ navigation }) {
  const { isDark, toggleTheme, accentName, changeAccentColor, themeColors } = useContext(ThemeContext);
  const primaryColor = themeColors?.primary || '#12C7B2'; 
  const insets = useSafeAreaInsets(); 

  const [settings, setSettings] = useState(null); 
  const [emailStatus, setEmailStatus] = useState('unverified');
  const [fakePinStatus, setFakePinStatus] = useState('unverified');
  const [isLimited, setIsLimited] = useState(false);
  const [lockProfileState, setLockProfileState] = useState('BIO_OR_PIN');

  const [securityScore, setSecurityScore] = useState(0);
  const [showAllPrivacy, setShowAllPrivacy] = useState(false);
  const strokeDashoffset = useRef(new Animated.Value(2 * Math.PI * 24)).current; 
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const [showPasskeyAuth, setShowPasskeyAuth] = useState(false);
  const [passkeyAction, setPasskeyAction] = useState('DISABLE_SEC');
  const passkeySuccessRef = useRef(null);
  const passkeyFallbackRef = useRef(null);

  const [breakdownModal, setBreakdownModal] = useState(false); 
  const [colorPickerModal, setColorPickerModal] = useState(false);
  const [livePreviewColor, setLivePreviewColor] = useState(themeColors.primary);
  const [livePreviewName, setLivePreviewName] = useState(accentName);
  const [recentColors, setRecentColors] = useState([]);
  const [autoColorMode, setAutoColorMode] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customHex, setCustomHex] = useState(themeColors.primary); 

  // 🚀 SENIOR DEV FIX: PIN Modals States restored perfectly
  const [pinModal, setPinModal] = useState(false);
  const [pinStep, setPinStep] = useState(1);
  const [tempPins, setTempPins] = useState({ current: '', new: '', confirm: '' });
  const [pinErrorMsg, setPinErrorMsg] = useState('');
  const pinInputRef = useRef(null);

  const [fakePinActionModal, setFakePinActionModal] = useState(false);
  const [fakePinModal, setFakePinModal] = useState(false);
  const [fakePinStep, setFakePinStep] = useState(1);
  const [tempFakePins, setTempFakePins] = useState({ new: '', confirm: '' });
  const [fakePinErrorMsg, setFakePinErrorMsg] = useState('');
  const fakePinInputRef = useRef(null);

  const [recoveryModal, setRecoveryModal] = useState(false);
  const [createRecoveryModal, setCreateRecoveryModal] = useState(false);
  const [customRecoveryCode, setCustomRecoveryCode] = useState('');
  const [recoveryCodeState, setRecoveryCodeState] = useState('');
  
  const [timerModal, setTimerModal] = useState(false);
  const [lockProfileModal, setLockProfileModal] = useState(false);
  const timerOptions = ['30 sec', '1 min', '2 min', '5 min', '10 min'];

  const [importModal, setImportModal] = useState(false);
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [showEmailRequiredModal, setShowEmailRequiredModal] = useState(false); 
  const [exportModal, setExportModal] = useState(false); 
  const [isExporting, setIsExporting] = useState(false); 
  const [pendingAction, setPendingAction] = useState(null); 
  const [backupFileObj, setBackupFileObj] = useState(null);
  const [importKey, setImportKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzerStepText, setAnalyzerStepText] = useState('Checking backup...');
  
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [emailRecoveryModal, setEmailRecoveryModal] = useState(false);
  const [recoveryEmailInput, setRecoveryEmailInput] = useState('');
  const [recoveryOtpInput, setRecoveryOtpInput] = useState('');
  const [emailRecoveryStep, setEmailRecoveryStep] = useState(1); 
  const [isEmailRecovering, setIsEmailRecovering] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0); 
  
  const [rawEmail, setRawEmail] = useState(''); 
  const [maskedEmail, setMaskedEmail] = useState(''); 
  const [isTestingMail, setIsTestingMail] = useState(false); 

  const [securityState, setSecurityState] = useState({ attemptCount: 0, blockUntil: 0 });
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);
  
  const [smartErrorVisible, setSmartErrorVisible] = useState(false);
  const [smartErrorMessage, setSmartErrorMessage] = useState('');
  const [smartErrorTitle, setSmartErrorTitle] = useState('Error');
  const [smartErrorOptions, setSmartErrorOptions] = useState({ targetModal: null, isLockout: false, isMissingHash: false });
  
  const errorScale = useRef(new Animated.Value(0.9)).current;
  const lockWasOnRef = useRef(false);

  const [toast, setToast] = useState({ visible: false, message: '', icon: 'info', color: primaryColor });
  const toastAnim = useRef(new Animated.Value(-50)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const [resetStep, setResetStep] = useState(0); 
  const [resetOtpInput, setResetOtpInput] = useState('');
  const [isWiping, setIsWiping] = useState(false);
  const [wipeStatusText, setWipeStatusText] = useState('');
  const [resetOtpCooldown, setResetOtpCooldown] = useState(0);
  
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  const resetOtpInputRef = useRef(null);
  const emailOtpInputRef = useRef(null);

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
    }, 3500); 
  };

  const showSmartError = (title, message, options = { targetModal: null, isLockout: false, isMissingHash: false }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (options.targetModal === 'PIN') setPinModal(false);
    if (options.targetModal === 'FAKE_PIN') setFakePinModal(false);
    if (options.targetModal === 'CREATE_RECOVERY') setCreateRecoveryModal(false);
    if (options.targetModal === 'IMPORT') setImportModal(false);
    if (options.targetModal === 'EMAIL_OTP') setEmailRecoveryModal(false);

    setSmartErrorTitle(title);
    setSmartErrorMessage(message);
    setSmartErrorOptions(options);
    setSmartErrorVisible(true);
    Animated.spring(errorScale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
  };

  const closeSmartError = () => {
    Animated.timing(errorScale, { toValue: 0.8, duration: 150, useNativeDriver: true }).start(() => {
      setSmartErrorVisible(false);
      errorScale.setValue(0.9);
      const modal = smartErrorOptions.targetModal;
      if (modal === 'PIN') setTimeout(() => setPinModal(true), 150);
      if (modal === 'FAKE_PIN') setTimeout(() => setFakePinModal(true), 150);
      if (modal === 'CREATE_RECOVERY') setTimeout(() => setCreateRecoveryModal(true), 150);
      if (modal === 'IMPORT') setTimeout(() => setImportModal(true), 150);
      if (modal === 'EMAIL_OTP') setTimeout(() => setEmailRecoveryModal(true), 150);
    });
  };

  const triggerPasskey = (actionType, onSuccess, onFallback) => {
    setPasskeyAction(actionType);
    passkeySuccessRef.current = onSuccess;
    passkeyFallbackRef.current = onFallback;
    setShowPasskeyAuth(true);
  };

  useFocusEffect(useCallback(() => { loadAllData(); global.activeFlow = 'NORMAL'; global.ignoreAppLock = false; }, []));
  useEffect(() => { return () => { restoreLockStateSafe(); }; }, []);
  useEffect(() => { let interval; if (otpCooldown > 0) interval = setInterval(() => { setOtpCooldown((prev) => prev - 1); }, 1000); return () => clearInterval(interval); }, [otpCooldown]);
  
  useEffect(() => {
    let interval;
    if (resetOtpCooldown > 0) interval = setInterval(() => setResetOtpCooldown(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [resetOtpCooldown]);

  useEffect(() => { setLivePreviewColor(themeColors.primary); }, [themeColors.primary]);

  useEffect(() => {
    let interval;
    if (securityState.blockUntil > 0) {
      interval = setInterval(() => {
        const now = Date.now();
        const left = Math.ceil((securityState.blockUntil - now) / 1000);
        if (left <= 0) {
          clearInterval(interval); setLockoutTimeLeft(0); clearSecurityState().then(() => setSecurityState({ attemptCount: 0, blockUntil: 0 }));
          if(smartErrorVisible && smartErrorOptions.isLockout) closeSmartError();
        } else { setLockoutTimeLeft(left); }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [securityState.blockUntil, smartErrorVisible]);

  useEffect(() => {
    let score = 20; // Master PIN Setup (Base score +20%)
    
    if (settings?.passkeyEnabled) score += 20; 
    if (settings?.fakePinEnabled || fakePinStatus !== 'unverified') score += 10;
    if (emailStatus === 'verified') score += 20;
    if (recoveryCodeState) score += 20;
    if (settings?.blockScreenshots) score += 10;

    if (score > 100) score = 100;
    setSecurityScore(score);
    
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    
    Animated.spring(strokeDashoffset, {
      toValue: offset,
      friction: 8,
      tension: 40,
      useNativeDriver: false 
    }).start();
  }, [settings, emailStatus, fakePinStatus, recoveryCodeState]);


  const loadAllData = async () => {
    const s = await getSettings(); 
    const defaultSettings = { 
      passkeyEnabled: true, 
      blurRecents: true, 
      motionEffects: true, 
      autoLockTimer: '2 min',
      hidePasswords: false,
      blockScreenshots: false,
      autoBackupReset: true,
      backupChecksum: true
    };
    setSettings(s ? { ...defaultSettings, ...s } : defaultSettings);
    
    const mode = await getSessionMode(); setIsLimited(mode === 'LIMITED');
    const profile = await getLockProfile(); setLockProfileState(profile);
    if (s?.autoColorMode) setAutoColorMode(true);

    let email = await getRecoveryEmail();
    if (!email) email = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL');
    if (!email) email = await AsyncStorage.getItem('RECOVERY_EMAIL');

    let verifiedStr = await AsyncStorage.getItem('SAFEGALLERY_EMAIL_VERIFIED');
    if (!verifiedStr) verifiedStr = await AsyncStorage.getItem('EMAIL_VERIFIED');
    let isVerified = (verifiedStr === 'true');

    if (isVerified && email) {
      setEmailStatus('verified');
      email = email.replace(/['"]+/g, '').trim(); 
      setRawEmail(email); 
      const parts = email.split('@');
      if(parts.length === 2 && parts[0].length >= 2) {
        setMaskedEmail(`${parts[0].substring(0, 2)}••••@${parts[1]}`);
      } else {
        setMaskedEmail(email);
      }
    } 
    else if (email) setEmailStatus('pending'); 
    else setEmailStatus('unverified');
    
    const fPin = await getFakePin(); setFakePinStatus(fPin ? 'verified' : 'unverified');
    const secState = await getSecurityState(); setSecurityState(secState);
    const history = await getColorHistory(); setRecentColors(history);
    const code = await getRecoveryCode(); setRecoveryCodeState(code || '');

    if (s?.blockScreenshots) await ScreenCapture.preventScreenCaptureAsync(); else await ScreenCapture.allowScreenCaptureAsync();
  };

  const handleToggle = async (key, value) => {
    if (key === 'passkeyEnabled' && value === false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Mandatory Security", 
        "Passkey protection is highly recommended for enterprise-grade security. Disabling it leaves your vault vulnerable. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Disable Anyway", style: "destructive", onPress: async () => {
              setSettings(prev => ({ ...prev, [key]: value }));
              await updateSetting(key, value);
          }}
        ]
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, [key]: value }));
    await updateSetting(key, value);
    // 🔥 DARK MODE INSTANT FIX 🔥
    if (key === 'darkMode') {
      // Ye function tere ThemeContext ko turant update kar dega
      if (typeof toggleTheme === 'function') {
        toggleTheme(value); 
      }
    }

    if (key === 'blockScreenshots') {
       value ? await ScreenCapture.preventScreenCaptureAsync() : await ScreenCapture.allowScreenCaptureAsync();
       showToast(`Screenshots ${value ? 'Blocked' : 'Allowed'}`, value ? 'shield' : 'smartphone');
       await logActivity('Settings', 'Privacy Changed', `Block screenshots set to ${value}`, 'INFO');
    }
  };

  const handleTriggerTestMail = async () => {
    if (emailStatus !== 'verified' || !rawEmail) {
      showToast('No verified email found.', 'alert-triangle', '#EF4444');
      return;
    }

    setIsTestingMail(true);
    const result = await sendPremiumTestMail(rawEmail);
    setIsTestingMail(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Recovery mail operational. Mail sent!', 'send', '#10B981');
      await logActivity('Security', 'Mail Tested', 'Premium test mail sent successfully.', 'INFO');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast('Recovery mail test failed. Check Brevo status or linked email.', 'alert-circle', '#EF4444');
      await logActivity('Security', 'Mail Test Failed', 'Failed to dispatch premium test mail.', 'CRITICAL');
    }
  };

  const openColorPicker = () => { setLivePreviewColor(themeColors.primary); setLivePreviewName(accentName || 'Custom'); setCustomHex(themeColors.primary); setShowCustomPicker(false); setColorPickerModal(true); };
  
  const selectPreviewColor = (colorObj) => {
    Haptics.selectionAsync(); let finalColor = colorObj.hex;
    if (isDark && ['#FFF7CC', '#E9E5FF', '#E3F2FD', '#E6F7EC', '#FCE7F3'].includes(finalColor)) { finalColor = colorObj.text || finalColor; }
    setLivePreviewColor(finalColor); setLivePreviewName(colorObj.name); setCustomHex(finalColor); 
  };

  const handleSystemDefault = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setAutoColorMode(false); await handleToggle('autoColorMode', false);
    selectPreviewColor({ hex: '#6C5CE7', name: 'System Default' });
  };

  const handleHexInput = (text) => {
    let formatted = text.replace(/[^0-9A-Fa-f#]/g, '').toUpperCase();
    if (!formatted.startsWith('#')) formatted = '#' + formatted.replace(/#/g, '');
    if (formatted.length > 7) formatted = formatted.substring(0, 7);
    setCustomHex(formatted);
    if (formatted.length === 7 && /^#([0-9A-F]{6})$/i.test(formatted)) { selectPreviewColor({ hex: formatted, name: 'Custom HEX' }); }
  };

  const handleTimeBasedToggle = async (val) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setAutoColorMode(val); await handleToggle('autoColorMode', val);
    if (val) {
       const hr = new Date().getHours(); let newColor = '#6366F1'; let cName = 'Night Mode';
       if (hr >= 6 && hr < 12) { newColor = '#1E88E5'; cName = 'Morning Blue'; }
       else if (hr >= 12 && hr < 17) { newColor = '#0D9488'; cName = 'Afternoon Teal'; }
       else if (hr >= 17 && hr < 20) { newColor = '#F97316'; cName = 'Evening Orange'; }
       setLivePreviewColor(newColor); setLivePreviewName(cName); setCustomHex(newColor);
    }
  };

  const applySelectedTheme = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await changeAccentColor(livePreviewName, livePreviewColor);
      try {
        const newHistory = await saveColorHistory(livePreviewColor);
        if (newHistory) setRecentColors(newHistory);
      } catch (e) { console.log("History save skipped"); }
      setColorPickerModal(false);
      showToast(`Theme changed to ${livePreviewName}`, 'aperture', livePreviewColor);
    } catch (error) {
      setColorPickerModal(false);
    }
  };

  const handleLockProfileChange = async (mode) => {
    if (mode === 'BIO_OR_PIN' || mode === 'DUAL') {
      const hasHardware = await LocalAuthentication.hasHardwareAsync(); const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return showSmartError("Not Supported", "No Biometric hardware found on this device.");
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to verify setup', fallbackLabel: 'Use PIN' });
      if (!auth.success) return;
    }
    await saveLockProfile(mode); setLockProfileState(mode); setLockProfileModal(false);
    showToast('Security Profile Updated', 'shield');
    await logActivity('Security', 'Profile Updated', `Lock profile changed to ${mode}`, 'CRITICAL'); 
  };
  const getProfileDisplayName = (mode) => mode === 'PIN' ? 'PIN Only' : mode === 'DUAL' ? 'Dual Mode (PIN + Bio)' : 'Biometric or PIN';

  const handlePinChangeFlow = async () => {
    const actualPin = await getMasterPin();
    if (pinStep === 1) { 
      if (tempPins.current === actualPin) { setPinStep(2); setPinErrorMsg(''); } 
      else { setPinErrorMsg('Incorrect Current PIN!'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); setTempPins({...tempPins, current: ''}); }
    } 
    else if (pinStep === 2) { 
      if (tempPins.new.length === 4) { setPinStep(3); setPinErrorMsg(''); } 
      else { setPinErrorMsg('PIN must be 4 digits.'); } 
    } 
    else if (pinStep === 3) {
      if (tempPins.new === tempPins.confirm) {
        await saveMasterPin(tempPins.new); 
        showToast('Master PIN updated', 'key');
        await logActivity('Security', 'Master PIN Changed', `Master PIN was successfully updated.`, 'CRITICAL'); 
        setPinModal(false); setPinStep(1); setTempPins({ current: '', new: '', confirm: '' }); setPinErrorMsg('');
      } else { 
        setPinErrorMsg('PINs do not match.'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPinStep(2); setTempPins({ ...tempPins, confirm: '' }); 
      }
    }
  };

  const openFakePinMenu = () => fakePinStatus === 'verified' ? setFakePinActionModal(true) : setFakePinModal(true); 
  
  const handleFakePinFlow = async () => {
    if (fakePinStep === 1) {
      if (tempFakePins.new.length !== 4) return setFakePinErrorMsg("PIN must be 4 digits.");
      const actualPin = await getMasterPin(); 
      if (tempFakePins.new === actualPin) {
         setFakePinErrorMsg("Fake PIN cannot be the same as Master PIN!"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return;
      }
      setFakePinStep(2); setFakePinErrorMsg('');
    } else if (fakePinStep === 2) {
      if (tempFakePins.new === tempFakePins.confirm) {
        await saveFakePin(tempFakePins.new); 
        showToast('Decoy Mode Active', 'user-x');
        await logActivity('Security', 'Decoy PIN Created', `A fake PIN was created for Decoy Mode.`, 'CRITICAL'); 
        setFakePinStatus('verified'); setFakePinModal(false); setFakePinStep(1); setTempFakePins({ new: '', confirm: '' }); setFakePinErrorMsg('');
      } else { 
        setFakePinErrorMsg("PINs do not match."); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFakePinStep(1); setTempFakePins({ new: '', confirm: '' }); 
      }
    }
  };
  
  const disableFakePin = async () => { 
    await saveFakePin(''); setFakePinStatus('unverified'); setFakePinActionModal(false); 
    showToast('Decoy Mode Disabled', 'x-circle', '#EF4444');
    await logActivity('Security', 'Decoy Disabled', `Fake PIN was removed. Decoy mode disabled.`, 'CRITICAL'); 
  };

  const openRecoveryCode = async () => { let code = await getRecoveryCode(); if (!code) { setCustomRecoveryCode(''); setCreateRecoveryModal(true); } else { setRecoveryCodeState(code); setRecoveryModal(true); } };
  
  const saveCustomRecoveryCode = async () => {
    if (!/^\d{4,10}$/.test(customRecoveryCode)) return showSmartError("Invalid", "Recovery code must be 4 to 10 digits numeric.", {targetModal: 'CREATE_RECOVERY'});
    await saveRecoveryCode(customRecoveryCode); 
    await logActivity('Security', 'Recovery Code Saved', `Offline numeric recovery code was generated.`, 'CRITICAL'); 
    setCreateRecoveryModal(false); setRecoveryCodeState(customRecoveryCode); setRecoveryModal(true); 
  };
  const copyCode = async () => { 
    await Clipboard.setStringAsync(recoveryCodeState); 
    showToast('Code Copied Securely', 'copy'); 
    await logActivity('Security', 'Code Copied', `Recovery code was copied to clipboard.`, 'IMPORTANT'); 
  };

  const pauseAutoLock = async () => {
    global.activeFlow = 'OTP_FLOW';
    global.ignoreAppLock = true;
    global.isAuthenticating = true;
    const s = await getSettings();
    if (s?.lockOnExit) { await updateSetting('lockOnExit', false); lockWasOnRef.current = true; }
  };

  const restoreLockStateSafe = async () => { 
    if (lockWasOnRef.current) { await updateSetting('lockOnExit', true); const s = await getSettings(); setSettings(s); lockWasOnRef.current = false; } 
    global.activeFlow = 'NORMAL'; global.ignoreAppLock = false; global.isAuthenticating = false;
  };

  const handleExportPreCheck = async () => {
    if (isLimited) return showSmartError("Action Disabled", "Export is disabled in Limited Access Mode.");
    const isEmailVerified = await getEmailVerified(); if (!isEmailVerified) return setShowEmailRequiredModal(true);
    const s = await getSettings(); setPendingAction('EXPORT'); 
    if (s?.lockOnExit && !lockWasOnRef.current) setShowImportWarning(true); else setExportModal(true); 
  };

  const startSecureExport = async () => {
    const s = await getSettings();
    if (s?.passkeyEnabled !== false) {
      triggerPasskey('EXPORT', 
        async () => { setShowPasskeyAuth(false); await executeExportCore(); },
        async () => { setShowPasskeyAuth(false); await executeExportWithBiometricFallback(); }
      );
    } else { await executeExportWithBiometricFallback(); }
  };

  const executeExportWithBiometricFallback = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync(); const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) { 
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify identity to Export Secure Backup', fallbackLabel: 'Use PIN' }); 
        if (!auth.success) return; 
      }
      await executeExportCore();
    } catch(e) { setExportModal(false); showSmartError("Export Failed", "Something went wrong."); }
  };

  const executeExportCore = async () => {
    try {
      setIsExporting(true); global.activeFlow = 'IMPORT_FLOW'; 
      const result = await exportBackup("Created from Settings");
      setIsExporting(false); setExportModal(false); setTimeout(() => { global.activeFlow = 'NORMAL'; }, 1000);
      if (result.success) { 
        await updateSetting('lastExportDate', new Date().toISOString()); loadAllData(); showToast("Premium Backup Sent to Email!", "check-circle", primaryColor);
        await logActivity('Data', 'Manual Export', `Vault data securely exported and sent to email.`, 'IMPORTANT'); 
      } else if (!result.cancelled) { showSmartError("Export Failed", result.message); }
    } catch (e) { setIsExporting(false); setExportModal(false); global.activeFlow = 'NORMAL'; showSmartError("Export Failed", "Something went wrong."); }
  };

  const handleImportPreCheck = async () => { const s = await getSettings(); setPendingAction('IMPORT'); if (s?.lockOnExit && !lockWasOnRef.current) setShowImportWarning(true); else executeFilePick(); };
  
  const handleDisableAndContinueFlow = async () => { 
    await updateSetting('lockOnExit', false); const s = await getSettings(); setSettings(s); lockWasOnRef.current = true; setShowImportWarning(false); 
    if (pendingAction === 'EXPORT') setExportModal(true); else if (pendingAction === 'RESET') setResetStep(1); else executeFilePick();  
  };

  const executeFilePick = async () => {
    try {
      global.activeFlow = 'IMPORT_FLOW'; 
      setIsAnalyzing(true); 
      setAnalyzerStepText('Checking backup format...');
      
      const result = await pickAndAnalyzeBackup();
      
      if (result.success) { 
        setBackupFileObj(result.data); 
        setImportKey(''); 
        
        setAnalyzerStepText('Verifying identity flags...'); 
        await new Promise(resolve => setTimeout(resolve, 800)); // Sirf UX smooth dikhane ke liye
        
        setIsAnalyzing(false); 
        setImportModal(true); // 🔥 Ab ye bina kisi crash ke turant open hoga!
      } else { 
        setIsAnalyzing(false); 
        await restoreLockStateSafe(); 
        if (!result.cancelled) {
          showSmartError("Corrupted Backup", result.message || "Invalid file selected."); 
        }
      }
    } catch (error) {
      console.log("File Pick Error:", error);
      setIsAnalyzing(false); 
      await restoreLockStateSafe(); 
      showSmartError("Import Error", "Unable to open the file.");
    }
  };

  const executeDecryption = async () => {
    if (!importKey.trim()) return showSmartError("Missing Key", "Enter PIN or Recovery Code to decrypt.", {targetModal: 'IMPORT'});
    if (securityState.blockUntil > Date.now()) { setImportModal(false); return showSmartError("Security Temporarily Locked", "Too many failed attempts.\nTry again later or recover access now.", { isLockout: true }); }
    
    setIsImporting(true); 
    if (securityState.attemptCount === 3) await new Promise(r => setTimeout(r, 2000)); 
    if (securityState.attemptCount === 4) await new Promise(r => setTimeout(r, 5000));
    
    const result = await processImportDecryption(backupFileObj, importKey);
    setIsImporting(false);
    
    if (result.success) { 
      await clearSecurityState(); setSecurityState({ attemptCount: 0, blockUntil: 0 });
      setImportModal(false); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
      await logActivity('Data', 'Backup Imported', `Vault data restored from an external backup file.`, 'IMPORTANT'); 
      setShowRestartModal(true); 
    } else { 
      let newCount = securityState.attemptCount + 1; let blockTime = 0;
      if (newCount >= 5) { 
         blockTime = Date.now() + 15 * 60 * 1000; 
         await updateSecurityState(newCount, blockTime); 
         setSecurityState({ attemptCount: newCount, blockUntil: blockTime }); 
         setImportModal(false); 
         showSmartError("Security Temporarily Locked", "Too many failed attempts.\nTry again later or recover access now.", { isLockout: true }); 
      } else { 
         await updateSecurityState(newCount, 0); 
         setSecurityState({ attemptCount: newCount, blockUntil: 0 }); 
         showSmartError("Incorrect Key", `Wrong PIN or Recovery Code.\nAttempt ${newCount} of 5`, {targetModal: 'IMPORT'}); 
      }
    }
  };

  const startEmailRecovery = async () => {
    const hasHash = backupFileObj?.meta?.emailHash || backupFileObj?.meta?.email_hash || backupFileObj?.meta?.recovery_enabled;
    
    if (!hasHash) { 
      setImportModal(false); 
      return showSmartError("Recovery Not Available", "This backup was created before email recovery was enabled.", { isMissingHash: true, targetModal: 'IMPORT' }); 
    }
    
    await pauseAutoLock();
    
    // 1. Purana popup band karo
    setImportModal(false);
    
    // 2. Data reset karo
    setEmailRecoveryStep(1);
    setRecoveryEmailInput('');
    setRecoveryOtpInput('');
    setOtpCooldown(0);
    
    // 🔥 3. Naya popup INSTANT kholo! (Bina kisi setTimeout ke)
    setEmailRecoveryModal(true);
  };

  const verifyEmailAndDeviceForRecovery = async () => {
    if (isEmailRecovering) return; if (otpCooldown > 0) return showToast(`Please wait ${otpCooldown} seconds`, 'clock', '#F59E0B');
    const cleanEmail = recoveryEmailInput.toLowerCase().trim(); if (!cleanEmail.includes('@')) return showSmartError('Invalid Email', 'Enter a valid email.', {targetModal: 'EMAIL_OTP'});
    const inputHash = CryptoJS.SHA256(cleanEmail).toString(); const storedHash = backupFileObj?.meta?.emailHash || backupFileObj?.meta?.email_hash;
    if (storedHash && inputHash !== storedHash) return showSmartError("Identity Mismatch", "The entered email does not match the identity linked to this backup.", {targetModal: 'EMAIL_OTP'});
    setIsEmailRecovering(true);
    try {
      const payload = { email: cleanEmail, otpType: 'RECOVERY' }; 
      // 🔥 RECOVERY OTP CACHE-BUSTER 🔥
      const res = await fetch(`${API_BASE_URL}/send-otp?t=${Date.now()}`, {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }, 
        body: JSON.stringify(payload) 
      });
      const data = await res.json();
      if (data.success) { setMaskedEmail(cleanEmail); setOtpCooldown(30); setTimeout(() => { setIsEmailRecovering(false); setEmailRecoveryStep(2); }, 800); } 
      else { setIsEmailRecovering(false); showSmartError("Error", data.message, {targetModal: 'EMAIL_OTP'}); }
    } catch (e) { setIsEmailRecovering(false); showSmartError("Network Error", 'Ensure backend is running.', {targetModal: 'EMAIL_OTP'}); }
  };

  const executeReKeyDecryption = async () => {
    if (recoveryOtpInput.length !== 6) return showSmartError("Invalid", 'Enter 6-digit OTP.', {targetModal: 'EMAIL_OTP'});
    setIsEmailRecovering(true);
    try {
      const res = await fetch(`${API_BASE_URL}/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: recoveryEmailInput.toLowerCase().trim(), otp: recoveryOtpInput }) });
      const data = await res.json();
      if (data.success) {
        const currentDeviceId = await getCurrentDeviceId(); const decryptResult = await processEmailDeviceDecryption(backupFileObj, recoveryEmailInput, currentDeviceId);
        setIsEmailRecovering(false);
        if (decryptResult.success) { 
          await clearSecurityState(); setSecurityState({ attemptCount: 0, blockUntil: 0 }); setEmailRecoveryModal(false); 
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); 
          await logActivity('Data', 'Email Import', `Vault data restored using secure Email OTP verification.`, 'IMPORTANT'); 
          setShowRestartModal(true); 
        } else {
          showSmartError("Decryption Failed", "We couldn't unlock your backup.", {targetModal: 'EMAIL_OTP'});
        }
      } else { setIsEmailRecovering(false); showSmartError("Error", data.message, {targetModal: 'EMAIL_OTP'}); }
    } catch (e) { setIsEmailRecovering(false); showSmartError("Error", 'Failed to verify OTP.', {targetModal: 'EMAIL_OTP'}); }
  };

  const triggerShake = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
    ]).start();
  };

  const handleResetPreCheck = async () => {
    const s = await getSettings(); setPendingAction('RESET');
    if (s?.lockOnExit && !lockWasOnRef.current) { setShowImportWarning(true); } else { setResetStep(1); }
  };

  const handleResetRequest = async () => {
    setResetStep(2); setWipeStatusText('Sending Secure OTP...'); 
    try {
      let email = await getRecoveryEmail();
      if (!email) { showToast("Email not found", "x-circle", "#EF4444"); return setResetStep(1); }
      // 🔥 CACHE-BUSTER & NO-CACHE HEADERS ADDED 🔥
      const response = await fetch(`${API_BASE_URL}/send-otp?t=${Date.now()}`, {
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }, 
        body: JSON.stringify({ 
          email: email.replace(/['"]+/g, '').trim(), 
          otpType: 'VAULT_WIPE' 
        }) 
      });
      const data = await response.json();
      if (data.success) { showToast("OTP Sent Successfully", "mail", "#3B82F6"); } else { showToast(data.message || "Failed to send OTP", "alert-triangle", "#F59E0B"); }
    } catch (error) { showToast("Network Error", "wifi-off", "#EF4444"); }
  };

  const initiatePremiumReset = async () => {
    if (emailStatus !== 'verified') { return showSmartError("Email Required", "You must link a recovery email before resetting to ensure a backup can be sent."); }
    await pauseAutoLock(); 
    const s = await getSettings();
    if (s?.passkeyEnabled !== false) {
      triggerPasskey('RESET', 
        async () => {
          setShowPasskeyAuth(false); setIsWiping(true); setWipeStatusText('Securing & Mailing backup...');
          try {
            const backupResult = await exportBackup("Auto-Wipe Backup", true); 
            if (!backupResult.success) throw new Error("Backup failed");
            setWipeStatusText('Erasing device data...'); await clearAllData();
            setIsWiping(false); setResetStep(3); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await logActivity('System', 'SYSTEM WIPE', `Vault was erased securely via Passkey auth.`, 'CRITICAL'); 
            Animated.spring(successAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }).start();
          } catch (e) { setIsWiping(false); showSmartError("Wipe Failed", "Something went wrong during the secure wipe process."); }
        },
        () => { setShowPasskeyAuth(false); handleResetRequest(); }
      );
    } else { handleResetRequest(); }
  };

  const executePremiumWipe = async () => {
    if (resetOtpInput.length !== 6) return triggerShake();
    setIsWiping(true); setWipeStatusText('Verifying OTP...');
    try {
      let email = await getRecoveryEmail();
      if (!email) email = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL'); email = email.replace(/['"]+/g, '').trim();
      const otpRes = await fetch(`${API_BASE_URL}/verify-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, otp: resetOtpInput }) });
      const otpData = await otpRes.json();
      if (!otpData.success) { setIsWiping(false); setResetOtpInput(''); return triggerShake(); }

      setWipeStatusText('Securing & Mailing backup...');
      const backupResult = await exportBackup("Auto-Wipe Backup", true); 
      if (!backupResult.success) throw new Error("Backup failed");

      setWipeStatusText('Final authorization...');
      const hasHardware = await LocalAuthentication.hasHardwareAsync(); const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm Fingerprint to DESTROY Vault', fallbackLabel: 'Use PIN' });
        if (!auth.success) { setIsWiping(false); return showToast("Wipe Cancelled", "x-circle", "#EF4444"); }
      }

      setWipeStatusText('Erasing device data...'); await clearAllData();
      setIsWiping(false); setResetStep(3); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await logActivity('System', 'SYSTEM WIPE', `Vault was completely erased and backed up via Email OTP.`, 'CRITICAL'); 
      Animated.spring(successAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }).start();
    } catch (e) { setIsWiping(false); showSmartError("Wipe Failed", "Something went wrong during the secure wipe process."); }
  };

  const SettingRow = ({ icon, title, subtitle, type = 'chevron', value, onPress, state, onToggle, theme = 'security', isLast, isDangerBox, disableInLimited = false, requiredBadge = false, isLoading = false }) => {
    // 🔥 SENIOR DEV FIX: Direct Connection to Accent Color 🔥
    const bgIconColor = primaryColor + '20'; // Premium light background (20% opacity)
    const iconColor = primaryColor;          // Direct connection to your Accent Color!
    const handlePress = () => {
      if (isLoading) return;
      if (isLimited && disableInLimited) {
        showToast("Disabled in Decoy Mode", "shield-off", themeColors.danger);
        return;
      }
      if (type === 'toggle' && onToggle) onToggle(!state); else if(onPress) onPress();
    };
    return (
      <TouchableOpacity 
        style={[styles.row, !isLast && { borderBottomColor: isDark ? '#334155' : '#F1F5F9', borderBottomWidth: 1 }, isDangerBox && [styles.dangerBox, isDark && { backgroundColor: '#3D2A2A', borderColor: '#FF4D4D' }], (isLimited && disableInLimited) && { opacity: 0.4 }]} 
        activeOpacity={(isLimited && disableInLimited) || type==='toggle' ? 1 : 0.7} 
        onPress={handlePress}
      >
        <View style={styles.rowLeft}>
          <View style={[styles.iconBox, { backgroundColor: bgIconColor }]}><Feather name={icon} size={22} color={iconColor} /></View>
          <View style={{ flex: 1, paddingRight: 10, justifyContent: 'center' }}>
            <Text style={[styles.rowTitle, { color: themeColors.textDark }, isDangerBox && { color: '#EF4444' }]} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={[styles.rowSub, { color: themeColors.textLight }]} numberOfLines={1}>{subtitle}</Text>}
          </View>
        </View>
        <View style={styles.rowRight}>
          {isLoading ? (
            <ActivityIndicator size="small" color={iconColor} />
          ) : (
            <>
              {requiredBadge && <View style={[styles.badge, { backgroundColor: '#10B981' + '20' }]}><Text style={[styles.badgeText, { color: '#10B981' }]}>Required</Text></View>}
              {value === 'verified' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#1C3A2D' : '#EAFBF3' }]}><Text style={[styles.badgeText, { color: '#2ECC71' }]}>Set</Text></View>}
              {value === 'unverified' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#3D2A2A' : '#FFEAEA' }]}><Text style={[styles.badgeText, { color: '#EF4444' }]}>Not set</Text></View>}
              {value === 'pending' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#3D311C' : '#FFF4EA' }]}><Text style={[styles.badgeText, { color: '#F39C12' }]}>Verify</Text></View>}
              {value === 'Active' && !requiredBadge && <View style={[styles.badge, { backgroundColor: isDark ? '#1C3A2D' : '#EAFBF3' }]}><Text style={[styles.badgeText, { color: '#2ECC71' }]}>Active</Text></View>}
              {typeof value === 'string' && !['verified','unverified','pending','Active'].includes(value) && <Text style={[styles.rowValue, { color: themeColors.textLight }]}>{value}</Text>}
              {type === 'chevron' && <Feather name="chevron-right" size={20} color={isDark ? '#475569' : '#CBD5E1'} />}
              {type === 'toggle' && <Switch trackColor={{ false: isDark ? "#3D3D5C" : "#E2E8F0", true: primaryColor + "80" }} thumbColor={state ? primaryColor : (isDark ? "#8A8FA3" : "#FFFFFF")} onValueChange={handlePress} value={!!state} disabled={isLimited && disableInLimited} style={{ transform: [{ scale: 0.9 }] }} />}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (!settings) return null;

  const headerOpacity = scrollY.interpolate({ inputRange: [140, 180], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View key={primaryColor} style={[styles.containerMain, { backgroundColor: isDark ? themeColors.background : '#F8FAFC' }]}>
      
      <Animated.View style={[styles.stickyHeader, { paddingTop: insets.top, opacity: headerOpacity, backgroundColor: isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)' }]}>
        <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={styles.stickyHeaderContent}>
           <Text style={[styles.stickyTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Settings</Text>
           <View style={[styles.miniScorePill, { backgroundColor: securityScore > 80 ? '#10B981' + '20' : '#F59E0B' + '20' }]}>
              <Text style={{color: securityScore > 80 ? '#10B981' : '#F59E0B', fontWeight: '800', fontSize: 12}}>{securityScore}% Secure</Text>
           </View>
        </View>
      </Animated.View>

      <Animated.ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60 }]} 
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <Text style={[styles.headerTitleMain, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Settings</Text>

        {/* 🚀 SENIOR DEV FIX: Clickable Hero Card & SVG Circle Integration */}
        <TouchableOpacity style={[styles.heroCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]} onPress={() => setBreakdownModal(true)}>
           <View style={styles.heroLeft}>
              <View style={{ width: 56, height: 56, justifyContent: 'center', alignItems: 'center' }}>
                 <Svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute' }}>
                   <Circle cx="28" cy="28" r="24" stroke={isDark ? '#334155' : '#E2E8F0'} strokeWidth="4" fill="none" />
                   <AnimatedCircle 
                     cx="28" cy="28" r="24" 
                     stroke={securityScore > 80 ? '#10B981' : '#F59E0B'} 
                     strokeWidth="4" 
                     fill="none" 
                     strokeDasharray={`${2 * Math.PI * 24}`} 
                     strokeDashoffset={strokeDashoffset} 
                     strokeLinecap="round" 
                     originX="28" originY="28" rotation="-90"
                   />
                 </Svg>
                 <Text style={[styles.scoreRingText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{securityScore}</Text>
              </View>
              <View style={styles.heroTextContainer}>
                 <Text style={[styles.heroScoreText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{securityScore}/100 Score</Text>
                 <Text style={[styles.heroSubText, { color: securityScore > 80 ? '#10B981' : '#F59E0B' }]}>{securityScore > 80 ? 'Strong protection enabled' : 'Action recommended'}</Text>
              </View>
           </View>
           <Feather name="chevron-right" size={20} color={isDark ? '#475569' : '#CBD5E1'} />
        </TouchableOpacity>

        {securityScore < 100 && (
          <View style={[styles.wizardCard, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
            <Text style={[styles.wizardTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Setup Completion</Text>
            <View style={styles.wizardProgressBg}>
               <Animated.View style={[styles.wizardProgressFill, { backgroundColor: primaryColor, width: `${securityScore}%` }]} />
            </View>
            <View style={styles.wizardStepsRow}>
               <View style={styles.wizardStep}><Feather name="check-circle" size={14} color="#10B981" /><Text style={[styles.wizardStepText, {color: '#10B981'}]}>Master PIN</Text></View>
               <View style={styles.wizardStep}><Feather name={emailStatus==='verified' ? "check-circle" : "circle"} size={14} color={emailStatus==='verified' ? "#10B981" : "#94A3B8"} /><Text style={[styles.wizardStepText, {color: emailStatus==='verified' ? '#10B981' : '#94A3B8'}]}>Email</Text></View>
               <View style={styles.wizardStep}><Feather name={recoveryCodeState ? "check-circle" : "circle"} size={14} color={recoveryCodeState ? "#10B981" : "#94A3B8"} /><Text style={[styles.wizardStepText, {color: recoveryCodeState ? '#10B981' : '#94A3B8'}]}>Code</Text></View>
               <View style={styles.wizardStep}><Feather name={settings.passkeyEnabled ? "check-circle" : "circle"} size={14} color={settings.passkeyEnabled ? "#10B981" : "#94A3B8"} /><Text style={[styles.wizardStepText, {color: settings.passkeyEnabled ? '#10B981' : '#94A3B8'}]}>Passkey</Text></View>
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>SECURITY CONTROLS</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow disableInLimited theme="security" icon="shield" title="App Lock Profile" value={getProfileDisplayName(lockProfileState)} onPress={() => setLockProfileModal(true)} />
          <SettingRow disableInLimited theme="security" icon="key" title="Change Master PIN" onPress={() => setPinModal(true)} />
          <SettingRow disableInLimited theme="security" icon="file-text" title="Recovery Code" onPress={openRecoveryCode} />
          
          <SettingRow theme="security" icon="smartphone" title="Passkey Authentication" subtitle="Mandatory for highest security" type="toggle" state={settings.passkeyEnabled} onToggle={(v) => handleToggle('passkeyEnabled', v)} />
          <SettingRow theme="security" icon="settings" title="Manage Passkeys" onPress={() => navigation.navigate('PasskeyManagement')} />

          <SettingRow disableInLimited theme="security" icon="user-x" title="Fake PIN (Decoy)" value={fakePinStatus} onPress={openFakePinMenu} />
          <SettingRow disableInLimited theme="security" icon="activity" title="Activity Log" onPress={() => navigation.navigate('ActivityLog')} isLast />
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>RECOVERY IDENTITY</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow disableInLimited theme="email" icon="mail" title="Update Email" value={emailStatus} onPress={() => {   if (settings?.passkeyEnabled !== false) {     triggerPasskey('EMAIL_CHANGE',        () => { setShowPasskeyAuth(false); navigation.navigate('EmailSetup'); },        () => { setShowPasskeyAuth(false); navigation.navigate('EmailSetup'); }     );   } else { navigation.navigate('EmailSetup'); } }} />
          <SettingRow disableInLimited theme="email" icon="check-circle" title="Enable Email Recovery" requiredBadge isLast={emailStatus !== 'verified'} />
          {emailStatus === 'verified' && (
            <>
              <SettingRow disableInLimited theme="email" icon="send" title="Test Recovery Mail" onPress={handleTriggerTestMail} isLoading={isTestingMail} />
              <SettingRow disableInLimited theme="email" icon="inbox" title="Backup Destination Mail" subtitle={maskedEmail} type="none" />
              <SettingRow disableInLimited theme="email" icon="alert-triangle" title="Emergency Wipe Mail" subtitle={maskedEmail} type="none" isLast />
            </>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>PRIVACY</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow theme="privacy" icon="eye-off" title="Hide passwords by default" type="toggle" state={settings.hidePasswords} onToggle={(v) => handleToggle('hidePasswords', v)} />
          <SettingRow theme="privacy" icon="smartphone" title="Block screenshots" type="toggle" state={settings.blockScreenshots} onToggle={(v) => handleToggle('blockScreenshots', v)} isLast={!showAllPrivacy} />
          {showAllPrivacy && (
            <>
              <SettingRow theme="privacy" icon="layers" title="Blur app in recents" type="toggle" state={settings.blurRecents || true} onToggle={(v) => handleToggle('blurRecents', v)} />
              <SettingRow theme="privacy" icon="clipboard" title="Clipboard auto-clear" type="toggle" state={settings.clipboardClear || true} onToggle={(v) => handleToggle('clipboardClear', v)} />
              <SettingRow theme="privacy" icon="bell-off" title="Hide sensitive notifications" type="toggle" state={settings.hideNotifs || true} onToggle={(v) => handleToggle('hideNotifs', v)} isLast />
            </>
          )}
          <TouchableOpacity style={[styles.expandBtn, { borderTopColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={() => setShowAllPrivacy(!showAllPrivacy)}>
             <Text style={[styles.expandBtnText, { color: primaryColor }]}>{showAllPrivacy ? 'Show less' : 'Show 3 more'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>DATA & BACKUP</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow disableInLimited theme="data" icon="upload-cloud" title="Export secure backup" onPress={handleExportPreCheck} />
          <SettingRow disableInLimited theme="data" icon="download-cloud" title="Import secure backup" onPress={handleImportPreCheck} />
          <SettingRow disableInLimited theme="data" icon="refresh-cw" title="Auto backup on reset" type="toggle" state={settings.autoBackupReset || true} onToggle={(v) => handleToggle('autoBackupReset', v)} />
          <SettingRow disableInLimited theme="data" icon="check-square" title="Backup verification checksum" type="toggle" state={settings.backupChecksum || true} onToggle={(v) => handleToggle('backupChecksum', v)} />
          <View style={{flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14}}><Text style={{color: themeColors.textDark, fontWeight: '600'}}>Last backup</Text><Text style={{color: themeColors.textLight, fontSize: 13}}>{settings?.lastExportDate ? new Date(settings.lastExportDate).toLocaleString() : 'Never'}</Text></View>
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>APPEARANCE & DEVICE</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow theme="appearance" icon="moon" title="Dark mode" type="toggle" state={isDark} onToggle={(v) => handleToggle('darkMode', v)} />
          <SettingRow theme="appearance" icon="aperture" title="Accent color" subtitle={accentName || 'System Default'} onPress={openColorPicker} />
          <SettingRow theme="appearance" icon="wind" title="Motion effects" type="toggle" state={true} />
          <SettingRow theme="about" icon="user" title="Developer" onPress={() => navigation.navigate('Developer')} isLast />
        </View>

        <Text style={[styles.sectionTitle, { color: themeColors.textLight }]}>SESSION & DANGER ZONE</Text>
        <View style={[styles.card, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
          <SettingRow theme="security" icon="lock" title="Lock App Now" onPress={async () => { await logActivity('Security', 'Manual Lock', 'User manually locked the app', 'INFO'); navigation.replace('Lock'); }} />
          <SettingRow theme="security" icon="clock" title="Auto-lock timer" value={settings.autoLockTimer} onPress={() => setTimerModal(true)} isLast />
        </View>

        <TouchableOpacity 
          style={[styles.dangerCard, { backgroundColor: isDark ? '#2D1616' : '#FEF2F2' }]} 
          onPress={handleResetPreCheck}
        >
          <Feather name="trash-2" size={24} color="#EF4444" style={{marginRight: 16}} />
          <View>
             <Text style={{color: '#EF4444', fontSize: 18, fontWeight: '800'}}>Reset & Wipe Vault</Text>
             <Text style={{color: isDark ? '#FCA5A5' : '#B91C1C', fontSize: 13, marginTop: 2}}>Permanently destroy all local data</Text>
          </View>
        </TouchableOpacity>

      </Animated.ScrollView>
      <PremiumPasskeyModal 
        visible={showPasskeyAuth}
        actionType={passkeyAction}
        isDark={isDark}
        themeColors={themeColors}
        onSuccess={() => { if(passkeySuccessRef.current) passkeySuccessRef.current(); }}
        onFallback={() => { if(passkeyFallbackRef.current) passkeyFallbackRef.current(); }}
        onCancel={() => setShowPasskeyAuth(false)}
      />

      <Modal visible={breakdownModal} animationType="slide" transparent={true}>
        <BlurView intensity={20} tint="dark" style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card, width: '100%' }]}>
            <View style={{alignItems: 'center', marginBottom: 16}}>
              <Feather name="pie-chart" size={40} color={primaryColor} />
            </View>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Security Breakdown</Text>
                <Text style={{fontSize: 12, color: '#888', marginTop: 6, textAlign: 'center'}}>
      Tap any item to improve your security
    </Text>
                {/* 1. Master PIN Setup */}
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => setPinModal(true), 400); }}>
                  <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Master PIN Setup</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
<Text style={{fontSize: 13, fontWeight: '600', color: '#16A34A', marginRight: 6}}>Secured</Text>
<Feather name="check" size={16} color="#16A34A" />
                  </View>
                </TouchableOpacity>

                {/* 2. Set Passkey (🔥 SMART NAVIGATION ADDED) */}
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => { settings?.passkeyEnabled ? navigation.navigate('PasskeyManagement') : triggerPasskey('REGISTER', null, null) }, 400); }}>
                    <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Set Passkey</Text>
  <View style={{flexDirection: 'row', alignItems: 'center'}}>
<Text style={{fontSize: 13, fontWeight: '600', color: (settings?.passkeyEnabled === true || settings?.passkeyEnabled === 'true') ? '#16A34A' : primaryColor, marginRight: 6}}>
  {(settings?.passkeyEnabled === true || settings?.passkeyEnabled === 'true') ? 'Secured' : 'Set now'}
</Text>
<Feather name={(settings?.passkeyEnabled === true || settings?.passkeyEnabled === 'true') ? "check" : "chevron-right"} size={16} color={(settings?.passkeyEnabled === true || settings?.passkeyEnabled === 'true') ? '#16A34A' : primaryColor} />
                  </View>
                </TouchableOpacity>

                {/* 3. Decoy Mode Active */}
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => { (settings?.fakePinEnabled || fakePinStatus !== 'unverified') ? Alert.alert('Already Set', 'Decoy mode is already configured and active.') : setFakePinModal(true) }, 400); }}>
                    <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Decoy Mode Active</Text>
  <View style={{flexDirection: 'row', alignItems: 'center'}}>
<Text style={{fontSize: 13, fontWeight: '600', color: fakePinStatus === 'verified' ? '#16A34A' : primaryColor, marginRight: 6}}>
  {fakePinStatus === 'verified' ? 'Secured' : 'Set now'}
</Text>
<Feather name={fakePinStatus === 'verified' ? "check" : "chevron-right"} size={16} color={fakePinStatus === 'verified' ? '#16A34A' : primaryColor} />
                  </View>
                </TouchableOpacity>

                {/* 4. Email Linked (🔥 PASSKEY LOCK & SMART NAVIGATION) */}
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { 
                  setBreakdownModal(false); 
                  setTimeout(() => { 
                    // Passkey trigger karo, agar success hua toh RecoveryEmail page pe jao
                    triggerPasskey('VERIFY', () => navigation.navigate('EmailSetup'), null);
                  }, 400); 
                }}>
                    <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Email Linked</Text>
  <View style={{flexDirection: 'row', alignItems: 'center'}}>
<Text style={{fontSize: 13, fontWeight: '600', color: emailStatus === 'verified' ? '#16A34A' : primaryColor, marginRight: 6}}>
  {emailStatus === 'verified' ? 'Secured' : 'Set now'}
</Text>
<Feather name={emailStatus === 'verified' ? "check" : "chevron-right"} size={16} color={emailStatus === 'verified' ? '#16A34A' : primaryColor} />
                  </View>
                </TouchableOpacity>

                {/* 5. Recovery Code (🔥 NEW STATE VARIABLE FIXED) */}
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: themeColors.inputBg}} onPress={() => { setBreakdownModal(false); setTimeout(() => { recoveryCodeState ? Alert.alert('Already Set', 'Recovery code is already configured and saved securely.') : setCreateRecoveryModal(true) }, 400); }}>
                    <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Recovery Code</Text>
  <View style={{flexDirection: 'row', alignItems: 'center'}}>
<Text style={{fontSize: 13, fontWeight: '600', color: recoveryCodeState ? '#16A34A' : primaryColor, marginRight: 6}}>
  {recoveryCodeState ? 'Secured' : 'Set now'}
</Text>
<Feather name={recoveryCodeState ? "check" : "chevron-right"} size={16} color={recoveryCodeState ? '#16A34A' : primaryColor} />
                  </View>
                </TouchableOpacity>

                {/* 6. Block Screenshots */}
                <TouchableOpacity style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, marginBottom: 10}} onPress={() => { setBreakdownModal(false); setTimeout(() => handleToggle('blockScreenshots', !settings?.blockScreenshots), 400); }}>
                    <Text style={{fontSize: 15, color: themeColors.textDark, fontWeight: '500'}}>Block Screenshots</Text>
  <View style={{flexDirection: 'row', alignItems: 'center'}}>
<Text style={{fontSize: 13, fontWeight: '600', color: settings?.blockScreenshots ? '#16A34A' : primaryColor, marginRight: 6}}>
  {settings?.blockScreenshots ? 'Secured' : 'Set now'}
</Text>
<Feather name={settings?.blockScreenshots ? "check" : "chevron-right"} size={16} color={settings?.blockScreenshots ? '#16A34A' : primaryColor} />
                  </View>
                </TouchableOpacity>

    <Text style={{fontSize: 12, color: '#777', textAlign: 'center', marginBottom: 12}}>
      {securityScore === 100 ? 'Your vault is fully secured 🛡️' : 'Your vault is partially secured ⚠️'}
    </Text>

    <TouchableOpacity style={[styles.deviceActionBtn, { backgroundColor: primaryColor, marginTop: 10 }]} onPress={() => setBreakdownModal(false)}>
        <Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>Got it</Text>
    </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      <Animated.View style={[styles.toastContainer, { top: insets.top + 50, opacity: toastOpacity, transform: [{ translateY: toastAnim }] }]} pointerEvents="none">
        <View style={[styles.toast, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          <Feather name={toast.icon} size={18} color={toast.color} style={{ marginRight: 8 }} />
          <Text style={[styles.toastText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{toast.message}</Text>
        </View>
      </Animated.View>

      <Modal visible={showRestartModal} transparent animationType="fade">
        <View style={styles.alertOverlayBg}>
          <View style={[styles.premiumModal, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
            <View style={[styles.pulseCircle, { borderColor: primaryColor + '40', backgroundColor: primaryColor + '10' }]}>
              <View style={[styles.iconCircle, { backgroundColor: primaryColor }]}>
                <Feather name="refresh-cw" size={36} color="#FFF" />
              </View>
            </View>
            <Text style={[styles.alertTitle, { color: themeColors.textDark }]}>Restore Complete! 🎉</Text>
            <Text style={[styles.alertMessage, { color: themeColors.textLight }]}>Your vault data has been successfully decrypted. The app will now automatically restart to sync your data securely.</Text>
            
            <TouchableOpacity style={{ width: '100%', height: 60, borderRadius: 16, overflow: 'hidden' }} activeOpacity={0.8} onPress={async () => {
                 setShowRestartModal(false);
                 await updateSetting('lockOnExit', true); 
                 navigation.reset({ index: 0, routes: [{ name: 'Lock' }] });
            }}>
              <LinearGradient colors={[primaryColor, primaryColor + 'DD']} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 }}>Restart & Sync</Text>
                <Feather name="lock" size={20} color="#FFF" style={{ marginLeft: 8 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={colorPickerModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlayBottom}>
          <View style={[styles.colorBottomSheet, { backgroundColor: themeColors.card }]}>
            <View style={styles.colorHeader}>
              <View>
                <Text style={[styles.colorModalTitle, { color: themeColors.textDark }]}>Accent Color</Text>
                <Text style={[styles.colorModalSub, { color: themeColors.textLight }]}>Customize your app theme</Text>
              </View>
              <TouchableOpacity onPress={() => setColorPickerModal(false)} style={styles.colorCloseBtn}>
                <Feather name="x" size={24} color={themeColors.textDark} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
              <View style={[styles.smartFeaturesBox, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB' }]}>
                <TouchableOpacity style={styles.smartFeatureRow} onPress={handleSystemDefault}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={[styles.smartIconBox, { backgroundColor: isDark ? '#3D3D5C' : '#EEF2FF' }]}><Feather name="smartphone" size={20} color={themeColors.primary} /></View>
                    <View style={{flex: 1}}>
                      <Text style={[styles.smartFeatureText, { color: themeColors.textDark }]}>System Default (Adaptive)</Text>
                      <Text style={{fontSize: 12, color: themeColors.textLight, marginTop: 2}}>Restore original smooth app color.</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <View style={[styles.dividerLine, { backgroundColor: isDark ? '#333333' : '#E5E7EB' }]} />

                <View style={{flexDirection: 'row', alignItems: 'center', paddingVertical: 10}}>
                  <View style={[styles.smartIconBox, { backgroundColor: isDark ? '#3D3D5C' : '#EEF2FF' }]}><Feather name="clock" size={20} color={livePreviewColor} /></View>
                  <View style={{flex: 1}}>
                    <Text style={[styles.smartFeatureText, { color: themeColors.textDark }]}>Auto Time-Based Colors</Text>
                    <Text style={{fontSize: 12, color: themeColors.textLight, marginTop: 2}}>Adapts color based on time of day.</Text>
                  </View>
                  <Switch trackColor={{ false: '#DADDE7', true: livePreviewColor + '80' }} thumbColor={autoColorMode ? livePreviewColor : '#FFFFFF'} value={autoColorMode} onValueChange={handleTimeBasedToggle} style={{ transform: [{ scale: 0.9 }] }} />
                </View>
              </View>

              {recentColors.length > 0 && !showCustomPicker && (
                <View style={styles.colorSection}>
                  <Text style={[styles.colorSectionTitle, { color: themeColors.textLight }]}>RECENT COLORS</Text>
                  <View style={styles.colorHistoryRow}>
                    {recentColors.map((hx, idx) => (
                      <Pressable key={idx} style={({pressed}) => [styles.historyChip, { backgroundColor: hx }, pressed && { transform: [{ scale: 0.9 }] }]} onPress={() => selectPreviewColor({ hex: hx, name: 'Custom' })} />
                    ))}
                  </View>
                </View>
              )}

              {!showCustomPicker ? (
                <>
                  <View style={styles.colorSection}>
                    <Text style={[styles.colorSectionTitle, { color: themeColors.textLight }]}>SOFT UI COLORS</Text>
                    <View style={[styles.colorGrid, { paddingHorizontal: 0 }]}>
                      {SOFT_COLORS.map((c) => {
                        const isSelected = livePreviewColor === c.hex || livePreviewColor === c.text;
                        return (
                          <Pressable key={c.name} style={({pressed}) => [styles.softColorBlock, { backgroundColor: c.hex }, isSelected && { borderColor: c.text, borderWidth: 2 }, pressed && { transform: [{ scale: 0.94 }] }]} onPress={() => selectPreviewColor({ hex: c.hex, text: c.text, name: c.name })}>
                             <Text style={{color: c.text, fontWeight: '700', fontSize: 14}}>{c.name.split(' ')[1]}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.colorSection}>
                    <Text style={[styles.colorSectionTitle, { color: themeColors.textLight }]}>PREMIUM GRADIENTS</Text>
                    <View style={styles.gradientGrid}>
                      {GRADIENT_COLORS.map((g) => {
                        const isSelected = livePreviewName === g.name;
                        return (
                          <Pressable key={g.name} style={({pressed}) => [styles.gradientBlock, pressed && { transform: [{ scale: 0.95 }] }]} onPress={() => selectPreviewColor({ hex: g.hex, name: g.name })}>
                            <LinearGradient colors={g.colors} start={{x:0, y:0}} end={{x:1, y:1}} style={styles.gradientFill}>
                               {isSelected && <Feather name="check-circle" size={24} color="#FFFFFF" style={{position: 'absolute', right: 12, top: 12}} />}
                               <Text style={styles.gradientText}>{g.name}</Text>
                               <Text style={styles.gradientSubText}>{g.colors[0]} → {g.colors[1]}</Text>
                            </LinearGradient>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.customPickerBtn, { borderColor: themeColors.separator }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCustomPicker(true); }}>
                     <Feather name="aperture" size={18} color={themeColors.textDark} />
                     <Text style={{color: themeColors.textDark, fontWeight: '700', marginLeft: 8}}>Open Custom Color Palette</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.colorSection}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                    <Text style={[styles.colorSectionTitle, { color: themeColors.textLight, marginBottom: 0 }]}>CUSTOM HEX CODE</Text>
                    <TouchableOpacity onPress={() => setShowCustomPicker(false)}><Text style={{color: themeColors.primary, fontWeight: '700', fontSize: 13}}>Back to Presets</Text></TouchableOpacity>
                  </View>
                  <View style={[styles.hexInputWrapper, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6' }]}>
                    <View style={[styles.hexPreviewDot, { backgroundColor: livePreviewColor }]} />
                    <TextInput style={[styles.hexInput, { color: themeColors.textDark }]} value={customHex} onChangeText={handleHexInput} placeholder="#HEXCODE" placeholderTextColor={themeColors.textLight} maxLength={7} autoCapitalize="characters" />
                  </View>
                  <Text style={[styles.colorSectionTitle, { color: themeColors.textLight, marginTop: 24, marginBottom: 12 }]}>EXTENDED PALETTE</Text>
                  <View style={styles.spectrumGrid}>
                    {EXTENDED_PALETTE.map((hx, idx) => {
                      const isSelected = livePreviewColor === hx;
                      return (
                        <View key={idx} style={styles.spectrumBlockWrapper}>
                          <Pressable style={({pressed}) => [styles.spectrumBlock, { backgroundColor: hx }, isSelected && styles.spectrumBlockSelected, pressed && { transform: [{ scale: 0.85 }] }]} onPress={() => { selectPreviewColor({ hex: hx, name: 'Custom' }); setCustomHex(hx); }}>
                            {isSelected && <Feather name="check" size={16} color="#FFFFFF" style={{textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2, textShadowOffset: {width: 0, height: 1}}} />}
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>
            <View style={styles.stickyApplyBox}>
              <TouchableOpacity style={[styles.applyThemeBtn, { backgroundColor: livePreviewColor }]} onPress={applySelectedTheme}>
                <Text style={styles.applyThemeText}>Apply Theme</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isAnalyzing && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' }]}>
          <View style={[styles.analyzerBox, { backgroundColor: themeColors.card }]}>
            <ActivityIndicator size="large" color={themeColors.primary} style={{marginBottom: 16}} />
            <Text style={[styles.analyzerTitle, { color: themeColors.textDark }]}>Backup Analyzer</Text>
            <Text style={[styles.analyzerSub, { color: themeColors.textLight }]}>{analyzerStepText}</Text>
          </View>
        </View>
      )}
      
<ChangeMasterPinModal visible={pinModal} onClose={() => setPinModal(false)} isDark={isDark} themeColors={themeColors} onSaveSuccess={() => { setPinModal(false); showToast('Master PIN updated', 'key'); }} />

<SetupFakePinModal visible={fakePinModal} onClose={() => setFakePinModal(false)} isDark={isDark} themeColors={themeColors} onSaveSuccess={() => { setFakePinModal(false); setFakePinStatus('verified'); showToast('Decoy Mode Active', 'user-x'); }} />

      <Modal visible={lockProfileModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{alignItems: 'center', marginBottom: 12}}><Feather name="shield" size={32} color={themeColors.primary} /></View>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>App Lock Profile</Text>
            <Text style={styles.modalSub}>Select your preferred security level.</Text>
            <TouchableOpacity style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => handleLockProfileChange('BIO_OR_PIN')}>
              <Text style={[styles.timerOptText, { color: themeColors.textDark }, lockProfileState === 'BIO_OR_PIN' && {color: themeColors.primary, fontWeight: '700'}]}>Biometric or PIN (Default)</Text>
              {lockProfileState === 'BIO_OR_PIN' && <Feather name="check-circle" size={18} color={themeColors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => handleLockProfileChange('PIN')}>
              <Text style={[styles.timerOptText, { color: themeColors.textDark }, lockProfileState === 'PIN' && {color: themeColors.primary, fontWeight: '700'}]}>PIN Only</Text>
              {lockProfileState === 'PIN' && <Feather name="check-circle" size={18} color={themeColors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => handleLockProfileChange('DUAL')}>
              <View>
                 <Text style={[styles.timerOptText, { color: themeColors.textDark }, lockProfileState === 'DUAL' && {color: themeColors.primary, fontWeight: '700'}]}>Dual Mode (High Security)</Text>
                 <Text style={{fontSize: 12, color: themeColors.textLight, marginTop: 4}}>Requires both PIN and Fingerprint.</Text>
              </View>
              {lockProfileState === 'DUAL' && <Feather name="check-circle" size={18} color={themeColors.primary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLockProfileModal(false)} style={{marginTop: 20, alignItems: 'center'}}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {importModal && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <View style={[styles.modalContent, { backgroundColor: themeColors.card, width: '100%' }]}>
                <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="unlock" size={40} color={themeColors.primary} /></View>
                <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Decrypt Backup</Text>
                
                <View style={{backgroundColor: themeColors.inputBg, padding: 12, borderRadius: 12, marginBottom: 20, width: '100%'}}>
                  <Text style={{fontSize: 12, color: themeColors.textLight, marginBottom: 4}}>BACKUP DETAILS</Text>
                  <Text style={{fontSize: 14, color: themeColors.textDark, fontWeight: 'bold'}}>Version: {backupFileObj?.version || 'v4 (Legacy)'}</Text>
                  <Text style={{fontSize: 14, color: themeColors.iconColor.appearance, fontWeight: 'bold', marginTop: 4}}>Hint: {backupFileObj?.meta?.hint || 'No hint'}</Text>
                </View>

                <Text style={{fontSize: 14, color: themeColors.textLight, marginBottom: 12, textAlign: 'center'}}>Enter Master PIN or Recovery Code.</Text>
                <TextInput style={[styles.modalInput, { fontSize: 18, letterSpacing: 2, backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textDark }]} keyboardType="numeric" placeholder="PIN or Code" placeholderTextColor={themeColors.textLight} value={importKey} onChangeText={setImportKey} />
                
                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%', gap: 10}}>
                  <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={async () => { setImportModal(false); setImportKey(''); await restoreLockStateSafe(); }}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={executeDecryption} disabled={isImporting}><Text style={{color: '#FFF', fontWeight: 'bold'}}>{isImporting ? "Decrypting..." : "Restore Data"}</Text></TouchableOpacity>
                </View>
                <TouchableOpacity 
                  style={{marginTop: 20, padding: 10}} 
                  onPress={() => {
                    setImportModal(false); // Pehle is Decrypt dabbe ko band karo
                    setTimeout(() => {
                      startEmailRecovery(); // Thode pause ke baad Email Recovery kholo
                    }, 400);
                  }}
                >
                  <Text style={{color: themeColors.primary, fontWeight: '700', fontSize: 14}}>Forgot both? Recover via Email</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}
      {/* 🔥 UNBLOCKABLE EMAIL RECOVERY OVERLAY 🔥 */}
      {emailRecoveryModal && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[StyleSheet.absoluteFill, { zIndex: 10000, elevation: 10000, backgroundColor: 'rgba(0,0,0,0.8)' }]}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
              <View style={[styles.modalContent, { backgroundColor: themeColors.card, width: '100%' }]}>
                <View style={{alignItems: 'center', marginBottom: 16}}>
                  <Feather name="mail" size={40} color={themeColors.primary} />
                </View>
                <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Email Recovery</Text>

                {emailRecoveryStep === 1 ? (
                  <>
                    <Text style={{fontSize: 14, color: themeColors.textLight, marginBottom: 20, textAlign: 'center'}}>
                      A 6-digit OTP will be sent to your registered email address.
                    </Text>
                    <TextInput 
                      style={[styles.modalInput, { backgroundColor: themeColors.inputBg, color: themeColors.textDark, marginBottom: 15 }]} 
                      placeholder="Enter Registered Email" 
                      placeholderTextColor={themeColors.textLight}
                      value={recoveryEmailInput}
                      onChangeText={setRecoveryEmailInput}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10}}>
                      <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => setEmailRecoveryModal(false)}>
                        <Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={verifyEmailAndDeviceForRecovery} disabled={isEmailRecovering}>
                        <Text style={{color: '#FFF', fontWeight: 'bold'}}>{isEmailRecovering ? "Sending..." : "Send OTP"}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={{fontSize: 14, color: themeColors.textLight, marginBottom: 20, textAlign: 'center'}}>
                      Enter the 6-digit OTP sent to your email.
                    </Text>
                    <TextInput 
                      style={[styles.modalInput, { backgroundColor: themeColors.inputBg, color: themeColors.textDark, fontSize: 18, letterSpacing: 2, textAlign: 'center', marginBottom: 15 }]} 
                      placeholder="------" 
                      placeholderTextColor={themeColors.textLight}
                      value={recoveryOtpInput}
                      onChangeText={setRecoveryOtpInput}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10}}>
                      <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => setEmailRecoveryStep(1)}>
                        <Text style={{color: themeColors.textLight, fontWeight: '600'}}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={executeReKeyDecryption} disabled={isEmailRecovering || recoveryOtpInput.length < 6}>
                        <Text style={{color: '#FFF', fontWeight: 'bold'}}>{isEmailRecovering ? "Verifying..." : "Verify & Restore"}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      <Modal visible={timerModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Auto-lock Timer</Text>
            <Text style={styles.modalSub}>Select inactivity time before vault locks.</Text>
            {timerOptions.map(opt => (
              <TouchableOpacity key={opt} style={[styles.timerOptBtn, { borderBottomColor: themeColors.separator }]} onPress={() => { handleToggle('autoLockTimer', opt); setTimerModal(false); }}>
                <Text style={[styles.timerOptText, { color: themeColors.textDark }, settings?.autoLockTimer === opt && {color: themeColors.primary, fontWeight: '700'}]}>{opt}</Text>
                {settings?.autoLockTimer === opt && <Feather name="check-circle" size={18} color={themeColors.primary} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setTimerModal(false)} style={{marginTop: 20, alignItems: 'center'}}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PremiumPasskeyModal 
        visible={showPasskeyAuth}
        actionType={passkeyAction}
        isDark={isDark}
        themeColors={themeColors}
        onSuccess={() => { if(passkeySuccessRef.current) passkeySuccessRef.current(); }}
        onFallback={() => { if(passkeyFallbackRef.current) passkeyFallbackRef.current(); }}
        onCancel={() => setShowPasskeyAuth(false)}
      />

      <Modal visible={fakePinActionModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Fake PIN</Text>
            <Text style={styles.modalSub}>Decoy mode is currently active.</Text>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', width: '100%', height: 60, borderBottomWidth: 1, borderBottomColor: themeColors.separator }} onPress={() => { setFakePinActionModal(false); setFakePinModal(true); }}>
              <Feather name="edit-2" size={24} color={themeColors.primary} style={{ marginRight: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.textDark }}>Change Fake PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', width: '100%', height: 60 }} onPress={disableFakePin}>
              <Feather name="x-circle" size={24} color={themeColors.danger} style={{ marginRight: 16 }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: themeColors.danger }}>Disable Fake PIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ width: '100%', height: 50, backgroundColor: themeColors.inputBg, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 16 }} onPress={() => setFakePinActionModal(false)}>
              <Text style={{ color: themeColors.textLight, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showEmailRequiredModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.iconBg.email, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}>
              <Feather name="mail" size={32} color={themeColors.iconColor.email} />
            </View>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Email Required</Text>
            <Text style={[styles.modalSub, {textAlign: 'center'}]}>To ensure your data can be recovered, please link your email before exporting a backup.</Text>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: themeColors.primary, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12}} onPress={() => { setShowEmailRequiredModal(false); navigation.navigate('EmailSetup'); }}>
              <Text style={{color: '#FFF', fontSize: 15, fontWeight: 'bold'}}>Link Email Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: 'transparent', borderRadius: 14, justifyContent: 'center', alignItems: 'center'}} onPress={() => setShowEmailRequiredModal(false)}>
              <Text style={{color: themeColors.textLight, fontSize: 15, fontWeight: '700'}}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={createRecoveryModal} animationType="slide" transparent={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
            <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
              <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="shield" size={40} color={themeColors.primary} /></View>
              <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Set Recovery Code</Text>
              <Text style={[styles.modalSub, {textAlign: 'center'}]}>Enter a 4–10 digit numeric code. This will help recover your vault if you forget your PIN.</Text>
              <TextInput style={[styles.modalInput, { fontSize: 24, letterSpacing: 5, backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.textDark }]} keyboardType="numeric" maxLength={10} placeholder=" • • • • " placeholderTextColor={themeColors.textLight} value={customRecoveryCode} onChangeText={setCustomRecoveryCode} />
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%', gap: 10}}>
                <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={() => setCreateRecoveryModal(false)}>
                  <Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={saveCustomRecoveryCode}>
                  <Text style={{color: '#FFF', fontWeight: 'bold'}}>Save Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={recoveryModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="shield" size={40} color={themeColors.primary} /></View>
            <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Recovery Code</Text>
            <Text style={[styles.modalSub, {textAlign: 'center', color: themeColors.iconColor.appearance, fontWeight: 'bold'}]}>IMPORTANT: Do not forget this. Save it offline securely.</Text>
            <View style={[styles.codeBox, { borderColor: themeColors.primary, backgroundColor: themeColors.inputBg }]}><Text style={[styles.codeText, { color: themeColors.primary }]}>{recoveryCodeState}</Text></View>
            <TouchableOpacity style={[styles.copyBtnFull, { backgroundColor: themeColors.primary }]} onPress={copyCode}><Feather name="copy" size={18} color="#FFF" style={{marginRight: 8}} /><Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 16}}>I have saved this securely</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setRecoveryModal(false)} style={{marginTop: 16, alignItems: 'center'}}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showImportWarning} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.iconBg.appearance, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}><Feather name="alert-triangle" size={32} color={themeColors.iconColor.appearance} /></View>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Secure Session Required</Text>
            <Text style={[styles.modalSub, {textAlign: 'center'}]}>This action requires uninterrupted access. Auto-lock may interrupt the process.</Text>
            <View style={{flexDirection: 'row', backgroundColor: themeColors.inputBg, padding: 12, borderRadius: 12, marginBottom: 24, width: '100%', alignItems: 'flex-start'}}>
              <Feather name="info" size={14} color={themeColors.textLight} />
              <Text style={{fontSize: 12, color: themeColors.textLight, marginLeft: 8, flex: 1, lineHeight: 18}}>Lock will be restored automatically after the process completes.</Text>
            </View>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: themeColors.primary, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 12}} onPress={handleDisableAndContinueFlow}><Text style={{color: '#FFF', fontSize: 15, fontWeight: 'bold'}}>Disable Lock & Continue</Text></TouchableOpacity>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: 'transparent', borderRadius: 14, justifyContent: 'center', alignItems: 'center'}} onPress={() => setShowImportWarning(false)}><Text style={{color: themeColors.textLight, fontSize: 15, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={exportModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{width: 64, height: 64, borderRadius: 32, backgroundColor: themeColors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16}}><Feather name="upload-cloud" size={32} color={themeColors.primary} /></View>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Export Secure Backup</Text>
            <Text style={[styles.modalSub, {textAlign: 'center'}]}>You are about to export an encrypted copy of your vault. Your data is protected, but anyone with your PIN can access it.</Text>
            <View style={{backgroundColor: themeColors.inputBg, padding: 14, borderRadius: 12, marginBottom: 24, width: '100%'}}>
              <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 6}}><Feather name="shield" size={14} color={themeColors.iconColor.data} /><Text style={{fontSize: 13, color: themeColors.textDark, marginLeft: 8, fontWeight: '600'}}>AES-256-GCM + Key Wrap</Text></View>
              <View style={{flexDirection: 'row', alignItems: 'center'}}><Feather name="clock" size={14} color={themeColors.iconColor.appearance} /><Text style={{fontSize: 13, color: themeColors.textLight, marginLeft: 8, fontWeight: '500'}}>Last Export: {settings?.lastExportDate ? new Date(settings.lastExportDate).toLocaleString() : 'Never'}</Text></View>
            </View>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: themeColors.primary, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12}} onPress={startSecureExport} disabled={isExporting}>
              {isExporting ? <ActivityIndicator color="#FFF" /> : <Feather name="lock" size={16} color="#FFF" style={{marginRight: 8}} />}<Text style={{color: '#FFF', fontSize: 15, fontWeight: 'bold'}}>{isExporting ? "Encrypting Data..." : "Authenticate & Export"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{width: '100%', height: 50, backgroundColor: 'transparent', borderRadius: 14, justifyContent: 'center', alignItems: 'center'}} onPress={() => !isExporting && setExportModal(false)} disabled={isExporting}><Text style={{color: themeColors.textLight, fontSize: 15, fontWeight: '700'}}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 🚀 SENIOR DEV FIX: Smart Error Modal injected correctly here */}
      <Modal visible={smartErrorVisible} transparent animationType="fade">
        <View style={styles.alertOverlayBg}>
          <Animated.View style={[styles.smartErrorCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', transform: [{scale: errorScale}] }]}>
            <View style={[styles.errorIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Feather name={smartErrorOptions.isLockout ? "clock" : "alert-triangle"} size={32} color="#EF4444" />
            </View>
            <Text style={[styles.errorTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{smartErrorTitle}</Text>
            <Text style={[styles.errorDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>{smartErrorMessage}</Text>
            
            {smartErrorOptions.isLockout && lockoutTimeLeft > 0 && (
              <Text style={[styles.timerTextDisplay, { color: '#EF4444' }]}>Try again in {formatLockoutTimer(lockoutTimeLeft)}</Text>
            )}

            <View style={styles.errorActions}>
              {!smartErrorOptions.isLockout && (
                <TouchableOpacity style={styles.errorBtnPrimary} onPress={closeSmartError}>
                  <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.errorBtnPrimaryGradient}>
                    <Text style={styles.errorBtnTryText}>Try Again</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              
              {smartErrorOptions.isLockout && lockoutTimeLeft <= 0 && (
                <TouchableOpacity style={styles.errorBtnPrimary} onPress={closeSmartError}>
                  <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.errorBtnPrimaryGradient}>
                    <Text style={styles.errorBtnTryText}>Continue</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {smartErrorOptions.targetModal === 'IMPORT' && !smartErrorOptions.isMissingHash && (
                 <TouchableOpacity style={styles.errorBtnTrySecondary} onPress={() => { closeSmartError(); setTimeout(startEmailRecovery, 300); }}>
                   <Text style={styles.errorBtnTryTextSecondary}>Recover via Email</Text>
                 </TouchableOpacity>
              )}
              
              <TouchableOpacity style={{marginTop: 10}} onPress={async () => {
                 setSmartErrorVisible(false);
                 setImportModal(false);
                 setEmailRecoveryModal(false);
                 await restoreLockStateSafe();
              }}>
                <Text style={{color: themeColors.textLight, fontWeight: '700'}}>Cancel Import</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* 1. WARNING MODAL */}
      <Modal visible={resetStep === 1} transparent animationType="fade">
        <View style={styles.alertOverlayBg}>
          <View style={[styles.premiumResetModalCompact, { backgroundColor: themeColors.card }]}>
            <View style={styles.resetHeaderRow}>
              <View style={[styles.dangerIconSmall, { backgroundColor: '#FEE2E2' }]}><Feather name="alert-triangle" size={24} color="#EF4444" /></View>
              <View style={{ flex: 1 }}><Text style={[styles.resetModalTitleCompact, { color: themeColors.textDark }]}>Vault Reset</Text><Text style={[styles.resetModalDescCompact, { color: themeColors.textLight }]}>Permanently wipes your vault.</Text></View>
            </View>
            
            <View style={{ backgroundColor: themeColors.inputBg, padding: 12, borderRadius: 14, marginBottom: 20 }}>
              <Text style={{ fontSize: 13, color: themeColors.textDark, fontWeight: '600', marginBottom: 4 }}>Security Protocol:</Text>
              <Text style={{ fontSize: 13, color: themeColors.textLight, lineHeight: 18 }}>A secure backup will be emailed to you before deletion. OTP verification required.</Text>
            </View>

            <View style={styles.resetBtnRow}>
              <TouchableOpacity style={[styles.resetBtnCancelHalf, { backgroundColor: themeColors.inputBg }]} onPress={() => { setResetStep(0); setShowImportWarning(false); }}><Text style={{ color: themeColors.textLight, fontSize: 15, fontWeight: '700' }}>Abort</Text></TouchableOpacity>
              <TouchableOpacity style={styles.resetBtnActionHalf} onPress={initiatePremiumReset}><Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>Continue</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. OTP AUTHORIZATION MODAL */}
      <Modal visible={resetStep === 2} transparent animationType="slide" onShow={() => setTimeout(() => resetOtpInputRef.current?.focus(), 200)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.alertOverlayBg}>
            <View style={[styles.premiumResetModalCompact, { backgroundColor: themeColors.card }]}>
              
              {isWiping ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}><ActivityIndicator size="large" color="#EF4444" /><Text style={{ marginTop: 20, fontSize: 16, fontWeight: '700', color: themeColors.textDark }}>{wipeStatusText}</Text></View>
              ) : (
                <>
                  <View style={styles.resetHeaderRow}>
                    <View style={[styles.dangerIconSmall, { backgroundColor: '#DBEAFE' }]}><Feather name="shield" size={24} color={themeColors.primary} /></View>
                    <View style={{ flex: 1 }}><Text style={[styles.resetModalTitleCompact, { color: themeColors.textDark }]}>Authorize Wipe</Text><Text style={[styles.resetModalDescCompact, { color: themeColors.textLight }]}>OTP sent to: {maskedEmail}</Text></View>
                  </View>

                  <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 20 }}><Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>Backup will be emailed before wipe</Text></View>

                  <Animated.View style={{ width: '100%', transform: [{ translateX: shakeAnim }] }}>
                    <Pressable style={styles.otpContainer} onPress={() => resetOtpInputRef.current?.focus()}>
                      <View style={[styles.otpPressableArea, { pointerEvents: 'none' }]}>
                        {[0, 1, 2, 3, 4, 5].map((index) => (
                          <View key={index} style={[styles.otpDigitBoxCompact, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: resetOtpInput.length === index ? '#EF4444' : 'transparent' }]}><Text style={[styles.otpDigitText, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }]}>{resetOtpInput[index] || ''}</Text></View>
                        ))}
                      </View>
                      <TextInput ref={resetOtpInputRef} style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} keyboardType="number-pad" maxLength={6} value={resetOtpInput} onChangeText={setResetOtpInput} caretHidden={true} />
                    </Pressable>
                  </Animated.View>

                  <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 8 }}>
                    <TouchableOpacity disabled={resetOtpCooldown > 0} onPress={handleResetRequest} style={{ marginBottom: 8 }}><Text style={{ fontSize: 14, color: resetOtpCooldown > 0 ? themeColors.textLight : themeColors.primary, fontWeight: '700' }}>{resetOtpCooldown > 0 ? `Resend code in ${resetOtpCooldown}s` : 'Resend Code'}</Text></TouchableOpacity>
                    <View style={{ flexDirection: 'row', alignItems: 'center', opacity: 0.6 }}><Feather name="info" size={12} color={themeColors.textLight} style={{ marginRight: 6 }} /><Text style={{ fontSize: 11, color: themeColors.textLight, fontWeight: '500', letterSpacing: 0.2 }}>Not in your inbox? Please check your spam folder.</Text></View>
                  </View>

                  <View style={styles.resetBtnRow}>
                    <TouchableOpacity style={[styles.resetBtnCancelHalf, { backgroundColor: themeColors.inputBg }]} onPress={async () => { setResetStep(0); setResetOtpInput(''); await restoreLockStateSafe(); }}><Text style={{ color: themeColors.textLight, fontSize: 15, fontWeight: '700' }}>Abort</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.resetBtnActionHalf, { backgroundColor: resetOtpInput.length === 6 ? '#EF4444' : '#FCA5A5' }]} disabled={resetOtpInput.length !== 6} onPress={executePremiumWipe}><Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>Wipe Out</Text></TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* 3. SUCCESS MODAL */}
      <Modal visible={resetStep === 3} transparent animationType="fade">
        <View style={styles.alertOverlayBg}>
          <View style={[styles.premiumResetModalCompact, { backgroundColor: themeColors.card, alignItems: 'center', paddingVertical: 32 }]}>
            <Animated.View style={[styles.dangerIconCircle, { backgroundColor: '#D1FAE5', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', transform: [{ scale: successAnim }] }]}><Feather name="check-circle" size={32} color="#10B981" /></Animated.View>
            <Text style={[styles.resetModalTitleCompact, { color: themeColors.textDark, textAlign: 'center', marginTop: 16 }]}>Vault Reset Complete</Text>
            <Text style={[styles.resetModalDescCompact, { color: themeColors.textLight, textAlign: 'center', marginTop: 8, marginBottom: 24, paddingHorizontal: 10 }]}>Your encrypted backup was safely delivered to your recovery email.</Text>
            <TouchableOpacity style={[styles.resetBtnActionHalf, { width: '100%', backgroundColor: themeColors.primary }]} onPress={async () => { await restoreLockStateSafe(); navigation.reset({ index: 0, routes: [{ name: 'Lock' }] }); }}><Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Reinitialize Vault</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}
// 🚀 SENIOR DEV FIX: Isolated PIN Component (No Typing Lag)
const ChangeMasterPinModal = ({ visible, onClose, isDark, themeColors, onSaveSuccess }) => {
  const [pinStep, setPinStep] = useState(1);
  const [tempPins, setTempPins] = useState({ current: '', new: '', confirm: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const pinInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setPinStep(1); setTempPins({ current: '', new: '', confirm: '' }); setErrorMsg('');
      setTimeout(() => pinInputRef.current?.focus(), 300);
    }
  }, [visible]);

  const handleNext = async () => {
    const actualPin = await getMasterPin();
    if (pinStep === 1) { 
      if (tempPins.current === actualPin) { setPinStep(2); setErrorMsg(''); } 
      else { setErrorMsg('Incorrect Current PIN!'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); setTempPins({...tempPins, current: ''}); }
    } 
    else if (pinStep === 2) { 
      if (tempPins.new.length === 4) { setPinStep(3); setErrorMsg(''); } 
      else { setErrorMsg('PIN must be 4 digits.'); } 
    } 
    else if (pinStep === 3) {
      if (tempPins.new === tempPins.confirm) {
        await saveMasterPin(tempPins.new);
        onSaveSuccess();
      } else { 
        setErrorMsg('PINs do not match.'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setPinStep(2); setTempPins({ ...tempPins, confirm: '' }); 
      }
    }
  };

  if(!visible) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="key" size={32} color={themeColors.primary} /></View>
            <Text style={[styles.modalTitle, { color: themeColors.textDark }]}>Change Master PIN</Text>
            <Text style={styles.modalSub}>{pinStep === 1 ? 'Enter CURRENT PIN' : pinStep === 2 ? 'Create NEW 4-digit PIN' : 'Confirm NEW PIN'}</Text>
            <Pressable style={styles.otpContainer} onPress={() => pinInputRef.current?.focus()}>
              <View style={[styles.otpPressableArea, { pointerEvents: 'none' }]}>
                {[0, 1, 2, 3].map((index) => {
                  const val = pinStep === 1 ? tempPins.current : pinStep === 2 ? tempPins.new : tempPins.confirm;
                  return (
                    <View key={index} style={[styles.otpDigitBoxCompact, { flex: 1, height: 64, marginHorizontal: 4, backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: errorMsg ? '#EF4444' : (val.length === index ? themeColors.primary : 'transparent'), borderWidth: 1.5 }]}>
                      <Text style={{ fontSize: 24, color: isDark ? '#FFF' : '#111827' }}>{val[index] ? '●' : ''}</Text>
                    </View>
                  );
                })}
              </View>
              <TextInput ref={pinInputRef} style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} keyboardType="number-pad" maxLength={4} value={pinStep === 1 ? tempPins.current : pinStep === 2 ? tempPins.new : tempPins.confirm} onChangeText={(val) => { setTempPins({ ...tempPins, [pinStep === 1 ? 'current' : pinStep === 2 ? 'new' : 'confirm']: val }); setErrorMsg(''); }} caretHidden={true} />
            </Pressable>
            {errorMsg ? <Text style={{color: '#EF4444', fontWeight: '700', marginBottom: 12}}>{errorMsg}</Text> : null}
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%', gap: 10}}>
              <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={onClose}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={handleNext}><Text style={{color: '#FFF', fontWeight: 'bold'}}>Next</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
// 🚀 SENIOR DEV FIX: Isolated Fake PIN Component (No Typing Lag)
const SetupFakePinModal = ({ visible, onClose, isDark, themeColors, onSaveSuccess }) => {
  const [fakePinStep, setFakePinStep] = useState(1);
  const [tempFakePins, setTempFakePins] = useState({ new: '', confirm: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const fakePinInputRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setFakePinStep(1); setTempFakePins({ new: '', confirm: '' }); setErrorMsg('');
      setTimeout(() => fakePinInputRef.current?.focus(), 300);
    }
  }, [visible]);

  const handleNext = async () => {
    if (fakePinStep === 1) {
      if (tempFakePins.new.length !== 4) return setErrorMsg("PIN must be 4 digits.");
      const actualPin = await getMasterPin(); 
      if (tempFakePins.new === actualPin) {
        setErrorMsg("Fake PIN cannot be same as Master PIN!"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return;
      }
      setFakePinStep(2); setErrorMsg('');
    } else if (fakePinStep === 2) {
      if (tempFakePins.new === tempFakePins.confirm) {
        await saveFakePin(tempFakePins.new); 
        onSaveSuccess();
      } else { 
        setErrorMsg("PINs do not match."); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFakePinStep(1); setTempFakePins({ new: '', confirm: '' }); 
      }
    }
  };

  if(!visible) return null;
  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayCenter}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={{alignItems: 'center', marginBottom: 16}}><Feather name="user-x" size={32} color={themeColors.primary} /></View>
            <Text style={[styles.modalTitle, {textAlign: 'center', color: themeColors.textDark }]}>Setup Fake PIN</Text>
            <Text style={[styles.modalSub, {textAlign: 'center'}]}>{fakePinStep === 1 ? 'Create a 4-digit Fake PIN for Decoy Mode.' : 'Confirm your Fake PIN.'}</Text>
            <Pressable style={styles.otpContainer} onPress={() => fakePinInputRef.current?.focus()}>
              <View style={[styles.otpPressableArea, { pointerEvents: 'none' }]}>
                {[0, 1, 2, 3].map((index) => {
                  const val = fakePinStep === 1 ? tempFakePins.new : tempFakePins.confirm;
                  return (
                    <View key={index} style={[styles.otpDigitBoxCompact, { flex: 1, height: 64, marginHorizontal: 4, backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: errorMsg ? '#EF4444' : (val.length === index ? themeColors.primary : 'transparent'), borderWidth: 1.5 }]}>
                      <Text style={{ fontSize: 24, color: isDark ? '#FFF' : '#111827' }}>{val[index] ? '●' : ''}</Text>
                    </View>
                  );
                })}
              </View>
              <TextInput ref={fakePinInputRef} style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} keyboardType="number-pad" maxLength={4} value={fakePinStep === 1 ? tempFakePins.new : tempFakePins.confirm} onChangeText={(val) => { setTempFakePins({ ...tempFakePins, [fakePinStep === 1 ? 'new' : 'confirm']: val }); setErrorMsg(''); }} caretHidden={true} />
            </Pressable>
            {errorMsg ? <Text style={{color: '#EF4444', fontWeight: '700', marginBottom: 12}}>{errorMsg}</Text> : null}
            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, width: '100%', gap: 10}}>
              <TouchableOpacity style={[styles.modalBtnCancel, { backgroundColor: themeColors.inputBg }]} onPress={onClose}><Text style={{color: themeColors.textLight, fontWeight: '600'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnAction, { backgroundColor: themeColors.primary }]} onPress={handleNext}><Text style={{color: '#FFF', fontWeight: 'bold'}}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  containerMain: { flex: 1, width: '100%', height: '100%' }, 
  scrollContent: { paddingBottom: 80 }, 
  headerTitleMain: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 20 },
  
  heroCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 104, marginHorizontal: 20, borderRadius: 28, paddingHorizontal: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 30, elevation: 5, marginBottom: 24 },
  heroLeft: { flexDirection: 'row', alignItems: 'center' },
  scoreRingText: { fontSize: 16, fontWeight: '800' },
  heroTextContainer: { marginLeft: 16 },
  heroScoreText: { fontSize: 20, fontWeight: '800' },
  heroSubText: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  
  wizardCard: { marginHorizontal: 20, borderRadius: 24, padding: 20, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 20, elevation: 3, marginBottom: 24 },
  wizardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12 },
  wizardProgressBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', marginBottom: 16, overflow: 'hidden' },
  wizardProgressFill: { height: '100%', borderRadius: 3 },
  wizardStepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wizardStep: { alignItems: 'center' },
  wizardStepText: { fontSize: 10, fontWeight: '700', marginTop: 6 },

  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: 12, marginBottom: 12, marginLeft: 24 },
  card: { width: '90%', alignSelf: 'center', borderRadius: 24, paddingVertical: 4, marginBottom: 28, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 24, elevation: 2 },
  dangerCard: { width: '90%', alignSelf: 'center', borderRadius: 24, paddingVertical: 20, paddingHorizontal: 24, marginBottom: 140, marginTop: 32, flexDirection: 'row', alignItems: 'center' },
  expandBtn: { paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(150,150,150,0.1)' },
  expandBtnText: { fontSize: 13, fontWeight: '700' },
  
  row: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  rowTitle: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  rowSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14, marginRight: 8, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  dangerBox: { backgroundColor: '#FFF1F1', borderRadius: 16, paddingHorizontal: 16, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#FFD6D6' },
  
  smartToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  smartToggleText: { fontSize: 15, fontWeight: '600' },

  stickyHeader: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 100 : 90, zIndex: 100 },
  stickyHeaderContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, paddingBottom: 14 },
  stickyTitle: { fontSize: 20, fontWeight: '800' },
  miniScorePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99 },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', borderRadius: 28, padding: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
  modalSub: { fontSize: 15, marginBottom: 24, lineHeight: 22, textAlign: 'center', color: '#6B7280' },
  modalInput: { height: 60, borderRadius: 16, fontSize: 24, fontWeight: 'bold', letterSpacing: 10, marginBottom: 24, borderWidth: 1, width: '100%', textAlign: 'center' },
  modalBtnCancel: { flex: 1, height: 54, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  modalBtnAction: { flex: 1, height: 54, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  codeBox: { borderStyle: 'dashed', borderWidth: 2, padding: 20, borderRadius: 20, alignItems: 'center', marginBottom: 24, width: '100%' },
  codeText: { fontSize: 20, fontWeight: '800', letterSpacing: 4 },
  copyBtnFull: { width: '100%', height: 58, borderRadius: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  timerOptBtn: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, width: '100%' },
  timerOptText: { fontSize: 16, fontWeight: '600' },
  
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  deviceActionBtn: { width: '100%', height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

  smartErrorCard: { width: '100%', borderRadius: 28, padding: 28, alignItems: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
  errorIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  errorTitle: { fontSize: 22, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  errorDesc: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  timerTextDisplay: { fontSize: 14, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  errorActions: { width: '100%', flexDirection: 'column', alignItems: 'center', gap: 14 },
  errorBtnTry: { width: '100%', height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  errorBtnPrimary: { width: '100%', height: 54, borderRadius: 16 },
  errorBtnPrimaryGradient: { flex: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  errorBtnTryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  errorBtnTrySecondary: { width: '100%', height: 54, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  errorBtnTryTextSecondary: { color: '#4B5563', fontSize: 16, fontWeight: '700' },

  otpContainer: { width: '100%', marginBottom: 24, alignItems: 'center' },
  otpPressableArea: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8 },
  otpDigitBox: { flex: 1, aspectRatio: 0.8, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  otpDigitBoxCompact: { flex: 1, aspectRatio: 0.85, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  otpDigitText: { fontSize: 22, fontWeight: '800' },

  premiumModal: { width: '100%', borderRadius: 32, padding: 32, alignItems: 'center', elevation: 20, overflow: 'hidden' },
  pulseCircle: { width: 100, height: 100, borderRadius: 50, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  alertTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  alertMessage: { fontSize: 15, textAlign: 'center', fontWeight: '500', marginBottom: 32, lineHeight: 22 },

  analyzerBox: { width: 240, padding: 28, borderRadius: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, elevation: 12 },
  analyzerTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  analyzerSub: { fontSize: 14, textAlign: 'center', fontWeight: '500' },

  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  colorBottomSheet: { width: '100%', height: '88%', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 24, elevation: 20 },
  colorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  colorModalTitle: { fontSize: 26, fontWeight: '800', marginBottom: 6 },
  colorModalSub: { fontSize: 15, fontWeight: '600' },
  colorCloseBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  
  smartFeaturesBox: { marginBottom: 28, borderRadius: 20, padding: 14 },
  smartFeatureRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  smartIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  smartFeatureText: { fontSize: 16, fontWeight: '700' },
  dividerLine: { width: '100%', height: 1, marginVertical: 6 },

  colorSection: { marginBottom: 32 },
  colorSectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.5, marginBottom: 16, marginLeft: 4 },
  colorHistoryRow: { flexDirection: 'row', gap: 14 },
  historyChip: { width: 52, height: 52, borderRadius: 26, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  softColorBlock: { width: '48%', height: 76, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  gradientGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  gradientBlock: { width: '48%', height: 100, borderRadius: 20, overflow: 'hidden' },
  gradientFill: { flex: 1, justifyContent: 'flex-end', padding: 14 },
  gradientText: { color: '#FFF', fontSize: 15, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 3, marginBottom: 4 },
  gradientSubText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },

  hexInputWrapper: { flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: 18, paddingHorizontal: 18, marginBottom: 12 },
  hexPreviewDot: { width: 28, height: 28, borderRadius: 14, marginRight: 14, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  hexInput: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: 1.5 },

  spectrumGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  spectrumBlockWrapper: { width: '16.666%', padding: 6 }, 
  spectrumBlock: { width: '100%', aspectRatio: 1, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  spectrumBlockSelected: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },

  customPickerBtn: { width: '100%', height: 60, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 12 },

  stickyApplyBox: { position: 'absolute', bottom: 24, left: 24, right: 24 },
  applyThemeBtn: { width: '100%', height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:8}, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 },
  applyThemeText: { color: '#FFF', fontSize: 18, fontWeight: '800' },

  toastContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  toast: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  toastText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },

  alertOverlayBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  
  premiumResetModalCompact: { width: '96%', borderRadius: 28, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  resetHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  dangerIconSmall: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  dangerIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  resetModalTitleCompact: { fontSize: 22, fontWeight: '800' },
  resetModalDescCompact: { fontSize: 13, marginTop: 2 },
  resetBtnRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  resetBtnActionHalf: { flex: 1, height: 56, borderRadius: 16, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  resetBtnCancelHalf: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }
});
