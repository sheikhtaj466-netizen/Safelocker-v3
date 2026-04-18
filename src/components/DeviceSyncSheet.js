// File: src/components/DeviceSyncSheet.js
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Switch, Animated, Platform, Pressable, Dimensions, Easing, TextInput, Alert, Keyboard
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { CameraView } from 'expo-camera'; 
import QRCode from 'react-native-qrcode-svg';
import Svg, { Circle } from 'react-native-svg';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function DeviceSyncSheet({ visible, onClose, isDark, themeColors, primaryColor, onCameraRequest }) {
  const [syncStep, setSyncStep] = useState('MENU'); // MENU, BACKUP, QR_HUB, AUTH, SUCCESS
  const [activeTab, setActiveTab] = useState('QR'); // 'SCAN' or 'QR' (Segmented Control)
  
  const [backupPrefs, setBackupPrefs] = useState({ photos: true, folders: true, notes: true });
  const [qrPayload, setQrPayload] = useState('');
  
  const [authCode, setAuthCode] = useState('------');
  const [timerLeft, setTimerLeft] = useState(45);
  const timerCircleAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const [enteredCode, setEnteredCode] = useState('');
  const authInputRef = useRef(null);

  // Animations & Setup
  useEffect(() => {
    if (visible) {
      setSyncStep('MENU');
      setActiveTab('QR');
      setEnteredCode('');
      Animated.spring(sheetAnim, { toValue: SCREEN_HEIGHT * 0.18, tension: 65, friction: 10, useNativeDriver: true }).start();
    } else {
      Animated.timing(sheetAnim, { toValue: SCREEN_HEIGHT, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  // 45s TOTP Timer Logic
  useEffect(() => {
    let interval;
    if (syncStep === 'QR_HUB' && activeTab === 'QR') {
      interval = setInterval(() => {
        setTimerLeft((prev) => {
          if (prev <= 1) { generateNewAuthCode(); return 45; }
          return prev - 1;
        });
      }, 1000);

      Animated.timing(timerCircleAnim, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: true }).start();
    } else {
      timerCircleAnim.setValue(0);
    }
    return () => clearInterval(interval);
  }, [syncStep, activeTab]);

  const generateNewAuthCode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthCode(Math.floor(100000 + Math.random() * 900000).toString());
    timerCircleAnim.setValue(0);
    Animated.timing(timerCircleAnim, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: true }).start();
  };

  const handleGeneratePayload = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const sessionId = "SYNC_SESS_" + Math.random().toString(36).substring(2, 10).toUpperCase();
    setQrPayload(JSON.stringify({ session_id: sessionId, payload_ptr: "cf_worker_" + sessionId, expiry: Date.now() + 120000 }));
    generateNewAuthCode();
    setTimerLeft(45);
    setSyncStep('QR_HUB');
    setActiveTab('QR');
  };

  const handleStartScan = async () => {
    const hasPermission = await onCameraRequest();
    if (hasPermission) {
      setSyncStep('QR_HUB');
      setActiveTab('SCAN');
    }
  };

  const handleScanSuccess = ({ data }) => {
    if(data.includes("session_id")) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSyncStep('AUTH');
      setTimeout(() => authInputRef.current?.focus(), 300);
    }
  };

  const verifyCode = (code) => {
    if(code.length === 6) {
      Keyboard.dismiss();
      setSyncStep('SUCCESS');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Trigger Mail Logic Here via prop in real app
    }
  };

  if (!visible) return null;

  const circumference = 2 * Math.PI * 14;
  const offset = timerCircleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, circumference] });

  return (
    <View style={StyleSheet.absoluteFill}>
       <Pressable style={styles.overlayBg} onPress={syncStep === 'MENU' ? onClose : null} />
       <Animated.View style={[styles.sheetContainer, { backgroundColor: isDark ? '#0F172A' : '#FFFFFF', transform: [{ translateY: sheetAnim }] }]}>
          
          <View style={styles.dragPillWrapper}><View style={styles.dragPill} /></View>
          
          <View style={styles.header}>
             {syncStep !== 'MENU' && syncStep !== 'SUCCESS' && (
                <TouchableOpacity style={styles.backBtn} onPress={() => syncStep === 'AUTH' ? setSyncStep('QR_HUB') : setSyncStep('MENU')}>
                   <Feather name="arrow-left" size={24} color={isDark ? '#FFF' : '#0F172A'} />
                </TouchableOpacity>
             )}
             <Text style={[styles.title, {color: isDark ? '#FFF' : '#0F172A'}]}>Device Sync</Text>
             <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Feather name="x" size={24} color={isDark ? '#FFF' : '#0F172A'} /></TouchableOpacity>
          </View>

          <ScrollView style={{flex: 1}} contentContainerStyle={{paddingHorizontal: 24, paddingBottom: 60}} showsVerticalScrollIndicator={false}>
             
             {/* 1. MENU */}
             {syncStep === 'MENU' && (
               <View>
                 <TouchableOpacity style={styles.menuRow} onPress={() => setSyncStep('BACKUP')}>
                    <View style={[styles.iconBox, {backgroundColor: primaryColor+'15'}]}><Feather name="maximize" size={22} color={primaryColor}/></View>
                    <View style={{flex: 1}}><Text style={[styles.menuTitle, {color: isDark?'#FFF':'#000'}]}>Link New Device</Text><Text style={styles.menuSub}>Generate Trust Key & Backup</Text></View>
                    <Feather name="chevron-right" size={20} color="#64748B" />
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.menuRow} onPress={handleStartScan}>
                    <View style={[styles.iconBox, {backgroundColor: isDark?'#334155':'#F1F5F9'}]}><Feather name="camera" size={22} color={isDark?'#E2E8F0':'#475569'}/></View>
                    <View style={{flex: 1}}><Text style={[styles.menuTitle, {color: isDark?'#FFF':'#000'}]}>Scan Code</Text><Text style={styles.menuSub}>Receive data on this device</Text></View>
                    <Feather name="chevron-right" size={20} color="#64748B" />
                 </TouchableOpacity>
                 <View style={[styles.divider, {backgroundColor: isDark?'#334155':'#E2E8F0'}]} />
                 <TouchableOpacity style={styles.menuRow}>
                    <View style={[styles.iconBox, {backgroundColor: 'transparent'}]}><Feather name="clock" size={22} color="#64748B"/></View>
                    <Text style={[styles.menuTitle, {color: isDark?'#FFF':'#000', flex: 1}]}>Recent Sync Sessions</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={styles.menuRow}>
                    <View style={[styles.iconBox, {backgroundColor: '#FEF2F2'}]}><Feather name="trash-2" size={22} color="#EF4444"/></View>
                    <Text style={[styles.menuTitle, {color: '#EF4444', flex: 1}]}>Revoke Linked Devices</Text>
                 </TouchableOpacity>
               </View>
             )}

             {/* 2. BACKUP PROMPT */}
             {syncStep === 'BACKUP' && (
               <View>
                 <View style={{alignItems: 'center', marginBottom: 24}}>
                    <View style={[styles.bigIconCircle, {backgroundColor: primaryColor+'15'}]}><Feather name="save" size={32} color={primaryColor}/></View>
                    <Text style={[styles.promptTitle, {color: isDark?'#FFF':'#000'}]}>Vault Transfer Backup</Text>
                    <Text style={styles.promptSub}>Backup recent entries before generating transfer payload?</Text>
                 </View>
                 <View style={[styles.backupCard, {backgroundColor: isDark ? themeColors.inputBg : '#F8FAFC'}]}>
                    <View style={styles.toggleRow}><Text style={[styles.toggleLabel, {color: isDark?'#FFF':'#000'}]}>Include Photos</Text><Switch trackColor={{true: primaryColor+'80'}} thumbColor={backupPrefs.photos?primaryColor:'#FFF'} value={backupPrefs.photos} onValueChange={v=>setBackupPrefs({...backupPrefs, photos:v})} /></View>
                    <View style={styles.toggleRow}><Text style={[styles.toggleLabel, {color: isDark?'#FFF':'#000'}]}>Include Folders</Text><Switch trackColor={{true: primaryColor+'80'}} thumbColor={backupPrefs.folders?primaryColor:'#FFF'} value={backupPrefs.folders} onValueChange={v=>setBackupPrefs({...backupPrefs, folders:v})} /></View>
                    <View style={[styles.toggleRow, {borderBottomWidth: 0}]}><Text style={[styles.toggleLabel, {color: isDark?'#FFF':'#000'}]}>Include Notes & Favs</Text><Switch trackColor={{true: primaryColor+'80'}} thumbColor={backupPrefs.notes?primaryColor:'#FFF'} value={backupPrefs.notes} onValueChange={v=>setBackupPrefs({...backupPrefs, notes:v})} /></View>
                 </View>
                 <View style={{flexDirection: 'row', gap: 12, marginTop: 12}}>
                    <TouchableOpacity style={[styles.btnHalf, {backgroundColor: isDark?'#334155':'#E2E8F0'}]} onPress={handleGeneratePayload}><Text style={{color: isDark?'#E2E8F0':'#475569', fontWeight: '700', fontSize: 16}}>Skip</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.btnHalf, {backgroundColor: primaryColor}]} onPress={handleGeneratePayload}><Text style={{color: '#FFF', fontWeight: '800', fontSize: 16}}>Backup & Continue</Text></TouchableOpacity>
                 </View>
               </View>
             )}

             {/* 3. QR HUB (Segmented Control) */}
             {syncStep === 'QR_HUB' && (
               <View style={{alignItems: 'center'}}>
                 <View style={[styles.segmentBg, {backgroundColor: isDark?'#1E293B':'#F1F5F9'}]}>
                    <TouchableOpacity style={[styles.segmentBtn, activeTab==='SCAN' && {backgroundColor: primaryColor}]} onPress={()=>setActiveTab('SCAN')}><Text style={[styles.segmentText, {color: activeTab==='SCAN'?'#FFF':(isDark?'#94A3B8':'#64748B')}]}>Scan Code</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentBtn, activeTab==='QR' && {backgroundColor: primaryColor}]} onPress={()=>setActiveTab('QR')}><Text style={[styles.segmentText, {color: activeTab==='QR'?'#FFF':(isDark?'#94A3B8':'#64748B')}]}>My QR Code</Text></TouchableOpacity>
                 </View>

                 {activeTab === 'QR' ? (
                   <>
                     <View style={styles.qrCard}>
                        <Text style={styles.qrTitle}>Your Trust Key</Text>
                        <Text style={styles.qrSub}>Scan this from your new phone</Text>
                        <View style={styles.qrWrapper}><QRCode value={qrPayload || "empty"} size={200} color="#0F172A" backgroundColor="#FFF" /></View>
                     </View>
                     <View style={[styles.authCard, {backgroundColor: isDark ? themeColors.inputBg : '#F8FAFC'}]}>
                        <View>
                           <Text style={styles.authLabel}>AUTHENTICATION CODE</Text>
                           <Text style={[styles.authCode, {color: isDark?'#FFF':'#000'}]}>{authCode.substring(0,3)} {authCode.substring(3,6)}</Text>
                        </View>
                        <View style={styles.timerRing}>
                           <Svg width="40" height="40" viewBox="0 0 36 36">
                             <Circle cx="18" cy="18" r="14" stroke={isDark?'#334155':'#E2E8F0'} strokeWidth="3" fill="none" />
                             <AnimatedCircle cx="18" cy="18" r="14" stroke={primaryColor} strokeWidth="3" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 18 18)" />
                           </Svg>
                           <Text style={[styles.timerText, {color: isDark?'#FFF':'#000'}]}>{timerLeft}</Text>
                        </View>
                     </View>
                   </>
                 ) : (
                   <View style={styles.scanWrapper}>
                      <CameraView style={StyleSheet.absoluteFillObject} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={handleScanSuccess} />
                      <View style={styles.scanOverlay}>
                         <View style={styles.scanBox} />
                         <Text style={styles.scanTextOverlay}>Point at old device's Trust Key</Text>
                      </View>
                   </View>
                 )}
               </View>
             )}

             {/* 4. AUTHENTICATION */}
             {syncStep === 'AUTH' && (
               <View style={{alignItems: 'center', paddingTop: 20}}>
                  <View style={[styles.bigIconCircle, {backgroundColor: primaryColor+'15', marginBottom: 20}]}><Feather name="lock" size={32} color={primaryColor}/></View>
                  <Text style={[styles.promptTitle, {color: isDark?'#FFF':'#000'}]}>Enter Authentication</Text>
                  <Text style={styles.promptSub}>Check your old device for the 6-digit code.</Text>
                  
                  <Pressable style={styles.otpContainer} onPress={() => authInputRef.current?.focus()}>
                    <View style={styles.otpRow}>
                      {[0, 1, 2, 3, 4, 5].map((idx) => (
                        <View key={idx} style={[styles.otpBox, { backgroundColor: isDark ? themeColors.inputBg : '#F9FAFB', borderColor: enteredCode.length === idx ? primaryColor : 'transparent' }]}>
                          <Text style={[styles.otpText, { color: isDark ? '#FFF' : '#0F172A' }]}>{enteredCode[idx] || ''}</Text>
                        </View>
                      ))}
                    </View>
                    <TextInput 
                      ref={authInputRef} style={[StyleSheet.absoluteFillObject, { opacity: 0 }]} 
                      keyboardType="number-pad" maxLength={6} value={enteredCode} 
                      onChangeText={(val) => { const num = val.replace(/[^0-9]/g, ''); setEnteredCode(num); verifyCode(num); }} 
                      caretHidden={true} 
                    />
                  </Pressable>
               </View>
             )}

             {/* 5. SUCCESS */}
             {syncStep === 'SUCCESS' && (
               <View style={{alignItems: 'center', paddingVertical: 40}}>
                  <View style={[styles.bigIconCircle, {backgroundColor: '#10B98120', width: 80, height: 80, borderRadius: 40}]}><Feather name="check-circle" size={40} color="#10B981"/></View>
                  <Text style={[styles.promptTitle, {color: isDark?'#FFF':'#000', fontSize: 24, marginTop: 20}]}>Transfer Successful</Text>
                  <Text style={[styles.promptSub, {marginBottom: 30}]}>Vault data and passkey trust have been securely migrated.</Text>
                  <TouchableOpacity style={[styles.btnFull, {backgroundColor: primaryColor}]} onPress={onClose}><Text style={{color: '#FFF', fontWeight: '800', fontSize: 16}}>Finish Setup</Text></TouchableOpacity>
               </View>
             )}
          </ScrollView>
       </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_HEIGHT * 0.82, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, elevation: 24 },
  dragPillWrapper: { alignItems: 'center', marginBottom: 16 },
  dragPill: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#CBD5E1' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, paddingHorizontal: 24 },
  title: { fontSize: 20, fontWeight: '800' },
  closeBtn: { position: 'absolute', right: 24 },
  backBtn: { position: 'absolute', left: 24 },
  
  menuRow: { flexDirection: 'row', alignItems: 'center', height: 78, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  iconBox: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  menuTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  menuSub: { fontSize: 13, color: '#64748B' },
  divider: { width: '100%', height: 1, marginVertical: 8 },

  bigIconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  promptTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  promptSub: { fontSize: 15, color: '#64748B', textAlign: 'center', paddingHorizontal: 10 },
  
  backupCard: { width: '100%', borderRadius: 24, padding: 16, marginTop: 24, marginBottom: 24 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)' },
  toggleLabel: { fontSize: 15, fontWeight: '600' },
  btnHalf: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnFull: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

  segmentBg: { flexDirection: 'row', width: '100%', borderRadius: 12, padding: 4, marginBottom: 24 },
  segmentBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  segmentText: { fontWeight: '800', fontSize: 14 },

  qrCard: { width: 280, height: 280, backgroundColor: '#FFF', borderRadius: 22, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 },
  qrTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  qrSub: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  qrWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  authCard: { width: '100%', height: 64, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  authLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 1, marginBottom: 2 },
  authCode: { fontSize: 24, fontWeight: '900', letterSpacing: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  timerRing: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  timerText: { position: 'absolute', fontSize: 12, fontWeight: '800' },

  scanWrapper: { width: '100%', height: 340, borderRadius: 24, overflow: 'hidden' },
  scanOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanBox: { width: 200, height: 200, borderWidth: 2, borderColor: '#10B981', borderStyle: 'dashed', borderRadius: 20 },
  scanTextOverlay: { color: '#FFF', fontWeight: '700', marginTop: 20 },

  otpContainer: { width: '100%', marginTop: 30, alignItems: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10 },
  otpBox: { width: 46, height: 56, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  otpText: { fontSize: 24, fontWeight: '800' }
});
