// File: src/hooks/useSecurity.js
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getSettings } from '../utils/storage';

global.activeFlow = 'NORMAL'; 

export const useSecurity = () => {
  const navigation = useNavigation();
  const appState = useRef(AppState.currentState);
  const bgTime = useRef(0);
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      
      if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
        bgTime.current = Date.now();
        setIsBlurred(true);
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        setIsBlurred(false);
        const timeInBackground = Date.now() - bgTime.current;

        // 🧠 UNIFIED SECURE SESSION MANAGER
        if (global.activeFlow === 'OTP_FLOW' || global.activeFlow === 'IMPORT_FLOW') {
          // Rule: Max 2 minutes allowed in background for secure flows
          if (timeInBackground < 120000) { 
            console.log(`🔓 Context: ${global.activeFlow} -> Bypass Auto-Lock`);
            appState.current = nextAppState;
            return; // 🛑 STRICT BYPASS
          } else {
            console.log(`🔒 Context: ${global.activeFlow} -> Session Expired`);
            global.activeFlow = 'NORMAL'; 
          }
        }

        // 🔒 NORMAL AUTO-LOCK LOGIC
        if (bgTime.current > 0) {
          const settings = await getSettings();
          let lockTimeMs = 60000; 
          
          if (settings.autoLockTimer === '30 sec') lockTimeMs = 30000;
          if (settings.autoLockTimer === '5 min') lockTimeMs = 300000;
          if (settings.autoLockTimer === '10 min') lockTimeMs = 600000;

          if (settings.lockOnExit) lockTimeMs = 0; 

          if (timeInBackground >= lockTimeMs) {
            bgTime.current = 0; 
            navigation.replace('Lock'); 
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [navigation]);

  return { isBlurred };
};
