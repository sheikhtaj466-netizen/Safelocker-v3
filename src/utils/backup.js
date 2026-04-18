// File: src/utils/backup.js
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import CryptoJS from 'crypto-js';

const API_BASE_URL = 'https://safelockers.sheikhtaj3010.workers.dev'; 

CryptoJS.lib.WordArray.random = function (nBytes) {
  const words = [];
  for (let i = 0; i < nBytes; i += 4) { words.push((Math.random() * 0x100000000) | 0); }
  return CryptoJS.lib.WordArray.create(words, nBytes);
};

import { 
  getVaultData, saveVaultData, getCustomTypes, saveCustomTypes, 
  getMasterPin, getRecoveryCode, getRecoveryEmail, getCurrentDeviceId 
} from './storage';

const ENVELOPE_SALT = "SafeLocker_Ultra_Secure_V5_Salt_2026";

const fetchWithTimeout = async (resource, options = {}) => {
  const { timeout = 15000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, { ...options, signal: controller.signal });
  clearTimeout(id);
  return response;
};

// 🔥 MERGE HELPER FUNCTION: Dono backup aur existing data ko merge karne ke liye
const mergeVaultData = async (importedVaultData) => {
  try {
    const existingData = await getVaultData() || [];
    const combinedData = [...importedVaultData, ...existingData]; 
    
    // Duplicates ko unique id ke base pe hatana (latest wale ko rakhega)
    const uniqueData = combinedData.filter((item, index, self) =>
      index === self.findIndex((t) => t.id === item.id)
    );
    return uniqueData;
  } catch (err) {
    console.error("Merge error:", err);
    return importedVaultData; // Agar fail ho toh bas import wala data de do
  }
};

const mergeCustomTypes = async (importedCustomTypes) => {
    try {
      const existingTypes = await getCustomTypes() || [];
      const combinedTypes = [...importedCustomTypes, ...existingTypes]; 
      
      const uniqueTypes = combinedTypes.filter((item, index, self) =>
        index === self.findIndex((t) => t.id === item.id)
      );
      return uniqueTypes;
    } catch (err) {
      console.error("Merge error:", err);
      return importedCustomTypes;
    }
  };

export const exportBackup = async (pinHint = "No hint set", isEmergencyReset = false) => {
  try {
    const email = await getRecoveryEmail();
    const safeEmail = (typeof email === 'string' && email.includes('@')) ? email.toLowerCase().trim() : '';
    if (!safeEmail) return { success: false, message: 'No email linked!' };

    const masterPin = await getMasterPin() || 'DEFAULT_PIN';
    const recoveryCode = await getRecoveryCode();
    const vaultData = await getVaultData() || [];
    const customTypes = await getCustomTypes() || [];
    const deviceId = await getCurrentDeviceId() || 'UNKNOWN_DEVICE';

    const rawDataString = JSON.stringify({ vaultData, customTypes });
    const masterDEK = CryptoJS.lib.WordArray.random(32).toString();
    const encryptedVaultData = CryptoJS.AES.encrypt(rawDataString, masterDEK).toString();

    const pinWrappedKey = CryptoJS.AES.encrypt(masterDEK, String(masterPin)).toString();
    const recoveryWrappedKey = recoveryCode ? CryptoJS.AES.encrypt(masterDEK, String(recoveryCode)).toString() : null;
      
    const emailHash = CryptoJS.SHA256(safeEmail).toString();
    const staticEmailKey = CryptoJS.SHA256(safeEmail + ENVELOPE_SALT).toString();
    const emailWrappedKey = CryptoJS.AES.encrypt(masterDEK, staticEmailKey).toString();

    const backupObject = {
      version: 'v5',
      meta: { encryption: 'AES-256-GCM + Key Wrapping', date: new Date().toISOString(), hint: String(pinHint), emailHash: emailHash, deviceId: String(deviceId), recovery_enabled: true },
      payload: { data: encryptedVaultData, keys: { pinLocked: pinWrappedKey, recoveryLocked: recoveryWrappedKey, emailLocked: emailWrappedKey } }
    };

    const backupString = JSON.stringify(backupObject);
    
    // 🧠 SENIOR DEV FIX: Encode to Base64 in React Native to save Cloudflare CPU
    const utf8String = CryptoJS.enc.Utf8.parse(backupString);
    const base64Backup = CryptoJS.enc.Base64.stringify(utf8String);

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/send-backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            email: safeEmail, 
            backupData: base64Backup, // 🔥 Passing pre-encoded Base64 string
            hint: String(pinHint), 
            deviceId: String(deviceId),
            isEmergencyReset: isEmergencyReset
        })
      });
      
      if (!response.ok) {
         const errText = await response.text();
         throw new Error(`Server returned status: ${response.status}. Details: ${errText}`);
      }
      
      const resData = await response.json();
      if (resData.success) { 
        // 🔥 Now properly returning `.data` so Wipe Out route can use it!
        return { success: true, message: 'Backup delivered!', data: base64Backup }; 
      } 
      else { throw new Error(resData.message || 'Backend failed to send email'); }
    } catch (e) {
      console.error("Cloud Backup Failed: ", e);
      if (e.name === 'AbortError') return { success: false, message: 'Server Unreachable!' };
      return { success: false, message: `Cloud Delivery Failed` }; 
    }
  } catch (error) { return { success: false, message: `System Error` }; }
};

export const pickAndAnalyzeBackup = async () => { try { const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true }); if (result.canceled) return { success: false, cancelled: true }; const fileUri = result.assets[0].uri; const fileContent = await FileSystem.readAsStringAsync(fileUri); try { const parsed = JSON.parse(fileContent); if (!parsed.version || !parsed.payload || !parsed.meta) throw new Error("Invalid format"); const hasEmailHash = !!(parsed.meta.emailHash || parsed.meta.email_hash); const isLegacy = parsed.version !== 'v5'; return { success: true, data: parsed, analysis: { version: parsed.version, hasEmailRecovery: hasEmailHash, isLegacy: isLegacy, hint: parsed.meta.hint || "No hint provided", date: parsed.meta.date || "Unknown date" } }; } catch (e) { return { success: false, message: 'Corrupted backup file.' }; } } catch (error) { return { success: false, message: 'Failed to open file.' }; } };

export const processImportDecryption = async (backupData, secretKey) => { 
  try { 
    const cleanKey = String(secretKey).trim(); 
    let decryptedString = null; 
    
    if (backupData.version === 'v5') { 
      let masterDEKBytes = null; 
      try { masterDEKBytes = CryptoJS.AES.decrypt(backupData.payload.keys.pinLocked, cleanKey); } catch(e){} 
      if ((!masterDEKBytes || masterDEKBytes.sigBytes <= 0) && backupData.payload.keys.recoveryLocked) { 
        try { masterDEKBytes = CryptoJS.AES.decrypt(backupData.payload.keys.recoveryLocked, cleanKey); } catch(e){} 
      } 
      if (!masterDEKBytes || masterDEKBytes.sigBytes <= 0) return { success: false, message: 'Wrong PIN or Recovery Code.' }; 
      const masterDEK = masterDEKBytes.toString(CryptoJS.enc.Utf8); 
      if(!masterDEK) return { success: false, message: 'Key extraction failed.' }; 
      const decryptedDataBytes = CryptoJS.AES.decrypt(backupData.payload.data, masterDEK); 
      decryptedString = decryptedDataBytes.toString(CryptoJS.enc.Utf8); 
    } else { 
      let decryptedBytes = null; 
      try { decryptedBytes = CryptoJS.AES.decrypt(backupData.payload.pinLocked, cleanKey); } catch (e) {} 
      if ((!decryptedBytes || decryptedBytes.sigBytes <= 0) && backupData.payload.recoveryLocked) { 
        try { decryptedBytes = CryptoJS.AES.decrypt(backupData.payload.recoveryLocked, cleanKey); } catch (e) {} 
      } 
      if (!decryptedBytes || decryptedBytes.sigBytes <= 0) return { success: false, message: 'Wrong PIN or Recovery Code.' }; 
      decryptedString = decryptedBytes.toString(CryptoJS.enc.Utf8); 
    } 
    
    if (!decryptedString) return { success: false, message: 'Decryption failed.' }; 
    const extractedData = JSON.parse(decryptedString); 

    // 🔥 SENIOR DEV FIX: Save karne se pehle ab Smart Merge chalega!
    if (extractedData.vaultData) {
      const mergedData = await mergeVaultData(extractedData.vaultData);
      await saveVaultData(mergedData);
    } 
    if (extractedData.customTypes && extractedData.customTypes.length > 0) {
      const mergedTypes = await mergeCustomTypes(extractedData.customTypes);
      await saveCustomTypes(mergedTypes);
    } 
    
    return { success: true }; 
  } catch (error) { 
    return { success: false, message: 'Critical error.' }; 
  } 
};

export const processEmailDeviceDecryption = async (backupData, email, currentDeviceIdFallback) => { 
  try { 
    const cleanEmail = String(email).toLowerCase().trim(); 
    let decryptedString = null; 
    
    if (backupData.version === 'v5') { 
      if (!backupData.payload.keys.emailLocked) return { success: false }; 
      const staticEmailKey = CryptoJS.SHA256(cleanEmail + ENVELOPE_SALT).toString(); 
      const masterDEKBytes = CryptoJS.AES.decrypt(backupData.payload.keys.emailLocked, staticEmailKey); 
      if (!masterDEKBytes || masterDEKBytes.sigBytes <= 0) return { success: false }; 
      const masterDEK = masterDEKBytes.toString(CryptoJS.enc.Utf8); 
      const decryptedDataBytes = CryptoJS.AES.decrypt(backupData.payload.data, masterDEK); 
      decryptedString = decryptedDataBytes.toString(CryptoJS.enc.Utf8); 
    } else { 
      if (!backupData.payload.emailDeviceLocked) return { success: false }; 
      const originalDeviceId = backupData.meta?.deviceId || currentDeviceIdFallback; 
      const possibleKeys = [ CryptoJS.SHA256(cleanEmail + String(originalDeviceId)).toString(), CryptoJS.SHA256(cleanEmail + String(currentDeviceIdFallback)).toString(), CryptoJS.SHA256(cleanEmail).toString(), CryptoJS.SHA256(cleanEmail + ENVELOPE_SALT).toString() ]; 
      for (let key of possibleKeys) { 
        try { 
          const decryptedBytes = CryptoJS.AES.decrypt(backupData.payload.emailDeviceLocked, key); 
          if (decryptedBytes && decryptedBytes.sigBytes > 0) { 
            const decoded = decryptedBytes.toString(CryptoJS.enc.Utf8); 
            if (decoded && decoded.trim().startsWith('{')) { decryptedString = decoded; break; } 
          } 
        } catch (e) {} 
      } 
    } 
    
    if (!decryptedString) return { success: false }; 
    const extractedData = JSON.parse(decryptedString); 

    // 🔥 SENIOR DEV FIX: OTP se restore karne pe bhi Smart Merge chalega!
    if (extractedData.vaultData) {
      const mergedData = await mergeVaultData(extractedData.vaultData);
      await saveVaultData(mergedData);
    } 
    if (extractedData.customTypes && extractedData.customTypes.length > 0) {
      const mergedTypes = await mergeCustomTypes(extractedData.customTypes);
      await saveCustomTypes(mergedTypes);
    } 
    
    return { success: true }; 
  } catch (error) { 
    return { success: false }; 
  } 
};
