// File: src/utils/storage.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEYS = {
  VAULT_DATA: 'VAULT_DATA', DECOY_VAULT_DATA: 'DECOY_VAULT_DATA',
  MASTER_PIN: 'MASTER_PIN', SETTINGS: 'SETTINGS',
  RECOVERY_EMAIL: 'RECOVERY_EMAIL', EMAIL_VERIFIED: 'EMAIL_VERIFIED', 
  RECOVERY_CODE: 'RECOVERY_CODE', SESSION_MODE: 'SESSION_MODE',
  CUSTOM_TYPES: 'CUSTOM_VAULT_TYPES', FAKE_PIN: 'FAKE_PIN', 
  DEVICE_ID: 'DEVICE_ID', SECURITY_STATE: 'SECURITY_STATE',
  ACTIVITY_LOGS: 'ACTIVITY_LOGS', LOCK_PROFILE: 'LOCK_PROFILE',
  CLOUD_ACCOUNT: 'CLOUD_ACCOUNT', CLOUD_CONFIG: 'CLOUD_CONFIG',
  COLOR_HISTORY: 'COLOR_HISTORY', DAILY_OPENS: 'DAILY_OPENS', DAILY_DATE: 'DAILY_DATE'
};

export const getVaultData = async () => { 
  try { 
    const mode = await getSessionMode(); 
    const isDecoy = mode === 'LIMITED'; 
    const targetKey = isDecoy ? KEYS.DECOY_VAULT_DATA : KEYS.VAULT_DATA; 
    const dataStr = await AsyncStorage.getItem(targetKey); 
    let data = dataStr ? JSON.parse(dataStr) : []; 

    // 🔥 SMART PREMIUM DECOY GENERATOR
    // Agar decoy mode open hua hai aur data empty hai, toh dummy realistic data daal do
    if (isDecoy && data.length === 0) {
      const dummyDate = new Date().toISOString();
      const decoyData = [
        { id: `decoy_${Date.now()}_1`, type: 'Login', title: 'Facebook', username: 'shanna_fb_22', password: 'Password@123', url: 'facebook.com', date: dummyDate },
        { id: `decoy_${Date.now()}_2`, type: 'Login', title: 'Netflix', username: 'movie_time99@gmail.com', password: 'chilltime456', url: 'netflix.com', date: dummyDate },
        { id: `decoy_${Date.now()}_3`, type: 'Note', title: 'Home WiFi', notes: 'Network: Netgear_5G\nPassword: adminpassword00\n\nGuest Network:\nPass: guest1234', date: dummyDate },
        { id: `decoy_${Date.now()}_4`, type: 'Note', title: 'Gym Locker', notes: 'Locker number 42.\nCombo is 14-22-38', date: dummyDate }
      ];
      await AsyncStorage.setItem(KEYS.DECOY_VAULT_DATA, JSON.stringify(decoyData));
      data = decoyData;
    }
    
    return data; 
  } catch (error) { return []; } 
};

export const saveVaultData = async (data) => { try { const mode = await getSessionMode(); const targetKey = mode === 'LIMITED' ? KEYS.DECOY_VAULT_DATA : KEYS.VAULT_DATA; await AsyncStorage.setItem(targetKey, JSON.stringify(data)); return true; } catch (error) { return false; } };

export const getMasterPin = async () => await AsyncStorage.getItem(KEYS.MASTER_PIN);
export const saveMasterPin = async (pin) => await AsyncStorage.setItem(KEYS.MASTER_PIN, pin);

export const getSettings = async () => { 
  try { 
    const data = await AsyncStorage.getItem(KEYS.SETTINGS); 
    let parsed = data ? JSON.parse(data) : {}; 
    
    // 🚀 SENIOR DEV FIX: Strict 2 Min Auto-Lock & Optional Lock on Exit
    // Agar autoLockTimer set nahi hai, toh strict 2 min assign karo
    if (!parsed.autoLockTimer) parsed.autoLockTimer = '2 min'; 
    
    // Lock on Exit ab mandatory nahi hai, default false rahega (user apni marzi se ON karega)
    if (parsed.lockOnExit === undefined) parsed.lockOnExit = false;
    
    return parsed;
  } catch (error) { 
    return { autoLockTimer: '2 min', lockOnExit: false }; 
  } 
};

export const updateSetting = async (key, value) => { try { const settings = await getSettings(); settings[key] = value; await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)); return true; } catch (error) { return false; } };

export const getRecoveryEmail = async () => { let email = await AsyncStorage.getItem('SAFEGALLERY_RECOVERY_EMAIL'); if (!email) email = await AsyncStorage.getItem(KEYS.RECOVERY_EMAIL); return email; };
export const getEmailVerified = async () => { let verified = await AsyncStorage.getItem('SAFEGALLERY_EMAIL_VERIFIED'); if (!verified) verified = await AsyncStorage.getItem(KEYS.EMAIL_VERIFIED); return verified === 'true'; };

export const getRecoveryCode = async () => await AsyncStorage.getItem(KEYS.RECOVERY_CODE);
export const saveRecoveryCode = async (code) => await AsyncStorage.setItem(KEYS.RECOVERY_CODE, code);

export const getFakePin = async () => await AsyncStorage.getItem(KEYS.FAKE_PIN);
export const saveFakePin = async (pin) => await AsyncStorage.setItem(KEYS.FAKE_PIN, pin);

export const getSessionMode = async () => await AsyncStorage.getItem(KEYS.SESSION_MODE);
export const setSessionMode = async (mode) => { if (mode) await AsyncStorage.setItem(KEYS.SESSION_MODE, mode); else await AsyncStorage.removeItem(KEYS.SESSION_MODE); };

export const getCustomTypes = async () => { try { const data = await AsyncStorage.getItem(KEYS.CUSTOM_TYPES); return data ? JSON.parse(data) : []; } catch (error) { return []; } };
export const saveCustomType = async (newType) => { try { const existing = await getCustomTypes(); const updated = [...existing, newType]; await AsyncStorage.setItem(KEYS.CUSTOM_TYPES, JSON.stringify(updated)); return true; } catch (error) { throw error; } };
export const saveCustomTypes = async (typesArray) => { try { await AsyncStorage.setItem(KEYS.CUSTOM_TYPES, JSON.stringify(typesArray)); return true; } catch (error) { return false; } };

export const getSecurityState = async () => { try { const data = await AsyncStorage.getItem(KEYS.SECURITY_STATE); return data ? JSON.parse(data) : { attemptCount: 0, blockUntil: 0 }; } catch (error) { return { attemptCount: 0, blockUntil: 0 }; } };
export const updateSecurityState = async (attemptCount, blockUntil = 0) => { try { await AsyncStorage.setItem(KEYS.SECURITY_STATE, JSON.stringify({ attemptCount, blockUntil })); return true; } catch (error) { return false; } };
export const clearSecurityState = async () => { try { await AsyncStorage.removeItem(KEYS.SECURITY_STATE); return true; } catch (error) { return false; } };

// 🧠 UNIVERSAL APP-WIDE ACTIVITY LOGGER
export const logActivity = async (moduleName, actionTitle, detailsText = "System event recorded.", severityLvl = "NORMAL") => {
  try {
    const newEvent = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      module: moduleName || 'System',       
      action: actionTitle || 'Action',      
      details: detailsText,                 
      severity: severityLvl,                
      timestamp: new Date().toISOString(),
      device: Platform.OS
    };

    const existingLogsStr = await AsyncStorage.getItem(KEYS.ACTIVITY_LOGS);
    let logs = existingLogsStr ? JSON.parse(existingLogsStr) : [];
    
    logs.unshift(newEvent);
    if (logs.length > 300) logs = logs.slice(0, 300);
    
    await AsyncStorage.setItem(KEYS.ACTIVITY_LOGS, JSON.stringify(logs));
    return true;
  } catch (error) {
    return false;
  }
};

export const getActivityLogs = async () => { try { const logs = await AsyncStorage.getItem(KEYS.ACTIVITY_LOGS); return logs ? JSON.parse(logs) : []; } catch (error) { return []; } };

export const getLockProfile = async () => { try { const profile = await AsyncStorage.getItem(KEYS.LOCK_PROFILE); return profile || 'BIO_OR_PIN'; } catch (error) { return 'BIO_OR_PIN'; } };
export const saveLockProfile = async (profileMode) => { try { await AsyncStorage.setItem(KEYS.LOCK_PROFILE, profileMode); return true; } catch (error) { return false; } };

export const getCloudAccount = async () => await AsyncStorage.getItem(KEYS.CLOUD_ACCOUNT);
export const setCloudAccount = async (email) => { if (email) await AsyncStorage.setItem(KEYS.CLOUD_ACCOUNT, email); else await AsyncStorage.removeItem(KEYS.CLOUD_ACCOUNT); };
export const getCloudConfig = async () => { try { const data = await AsyncStorage.getItem(KEYS.CLOUD_CONFIG); return data ? JSON.parse(data) : { lastDate: null, status: 'None', fileId: null, autoBackup: 'Off' }; } catch (e) { return { lastDate: null, status: 'None', fileId: null, autoBackup: 'Off' }; } };
export const updateCloudConfig = async (updates) => { try { const current = await getCloudConfig(); await AsyncStorage.setItem(KEYS.CLOUD_CONFIG, JSON.stringify({ ...current, ...updates })); return true; } catch (e) { return false; } };

export const getColorHistory = async () => { try { const data = await AsyncStorage.getItem(KEYS.COLOR_HISTORY); return data ? JSON.parse(data) : []; } catch (e) { return []; } };
export const saveColorHistory = async (colorHex) => { try { let history = await getColorHistory(); history = [colorHex, ...history.filter(c => c !== colorHex)].slice(0, 5); await AsyncStorage.setItem(KEYS.COLOR_HISTORY, JSON.stringify(history)); return history; } catch (e) { return []; } };

export const trackDailyOpens = async () => { try { const today = new Date().toDateString(); const savedDate = await AsyncStorage.getItem(KEYS.DAILY_DATE); let opens = parseInt(await AsyncStorage.getItem(KEYS.DAILY_OPENS) || '0'); if (savedDate !== today) { opens = 1; await AsyncStorage.setItem(KEYS.DAILY_DATE, today); } else { opens += 1; } await AsyncStorage.setItem(KEYS.DAILY_OPENS, opens.toString()); return opens; } catch (e) { return 1; } };

export const clearAllData = async () => { 
  try { 
    await AsyncStorage.clear(); 
    const newDeviceId = `DEV_${Date.now()}_${Platform.OS}`; 
    await AsyncStorage.setItem(KEYS.DEVICE_ID, newDeviceId); 
    
    // 🚀 SENIOR DEV FIX: Push proper default settings back after wipe (2 min & lockOnExit false)
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ autoLockTimer: '2 min', lockOnExit: false, darkMode: false, accentColor: 'Purple' })); 
    await AsyncStorage.setItem(KEYS.LOCK_PROFILE, 'BIO_OR_PIN'); 
    
    await logActivity("System", "SYSTEM_WIPE", "App memory was completely wiped.", "CRITICAL"); 
    return true; 
  } catch (error) { return false; } 
};

export const getCurrentDeviceId = async () => { let id = await AsyncStorage.getItem(KEYS.DEVICE_ID); if (!id) { id = `DEV_${Date.now()}_${Platform.OS}`; await AsyncStorage.setItem(KEYS.DEVICE_ID, id); } return id; };

export const REFRESH_FLAG_KEY = 'SAFEGALLERY_NEEDS_REFRESH';

export const restartApp = async () => {
  try {
    await AsyncStorage.setItem(REFRESH_FLAG_KEY, 'true');
    if (Platform.OS === 'android') {
      import('react-native').then(({ BackHandler }) => {
        BackHandler.exitApp();
      });
    } else {
      return { success: false, message: 'On iOS, please close and reopen the app manually to sync.' };
    }
  } catch (e) {
    console.error('Restart failed', e);
  }
};
