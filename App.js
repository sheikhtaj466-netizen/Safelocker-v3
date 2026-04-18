// File: App.js
import 'react-native-gesture-handler'; // 🚀 STRICT RULE: Ye hamesha line 1 pe hona chahiye!
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeProvider } from './src/ThemeContext';
import { getSettings } from './src/utils/storage';

import LockScreen from './src/screens/LockScreen';
import MainDashboard from './src/screens/MainDashboard';
import FormScreen from './src/screens/FormScreen'; 
import EntryDetailScreen from './src/screens/EntryDetailScreen'; 
import SelectTypeScreen from './src/screens/SelectTypeScreen'; 
import EmailSetupScreen from './src/screens/EmailSetupScreen';
import ActivityLogScreen from './src/screens/ActivityLogScreen';
import DeveloperScreen from './src/screens/DeveloperScreen';
import CreateTypeScreen from './src/screens/CreateTypeScreen';
import PreferredActionsScreen from './src/screens/PreferredActionsScreen';
import PasskeyManagementScreen from './src/screens/PasskeyManagementScreen';

const Stack = createNativeStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function App() {
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef(null);
  
  // 🚀 SENIOR DEV FIX: Global Blur State
  const [appIsInactive, setAppIsInactive] = useState(false);
  const [blurEnabled, setBlurEnabled] = useState(true);

  useEffect(() => {
    const checkBlurSettings = async () => {
      const s = await getSettings();
      if (s && s.blurRecents !== undefined) {
        setBlurEnabled(s.blurRecents);
      }
    };
    checkBlurSettings();

    const subscription = AppState.addEventListener('change', async nextAppState => {
      // Blur Logic
      if (nextAppState.match(/inactive|background/)) {
        setAppIsInactive(true);
      } else {
        setAppIsInactive(false);
        checkBlurSettings(); // Re-check when coming to foreground
      }

      // Auto Lock Logic
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTime.current) {
          const timeAwaySeconds = (Date.now() - backgroundTime.current) / 1000;
          
          const settings = await getSettings();
          let timeLimit = 120; // 🚀 SENIOR DEV FIX: Default is now 2 minutes (120 seconds)
          
          if (settings?.autoLockTimer === '30 sec') timeLimit = 30;
          if (settings?.autoLockTimer === '1 min') timeLimit = 60;
          if (settings?.autoLockTimer === '2 min') timeLimit = 120;
          if (settings?.autoLockTimer === '5 min') timeLimit = 300;
          if (settings?.autoLockTimer === '10 min') timeLimit = 600;

          if (timeAwaySeconds >= timeLimit) {
            if (navigationRef.isReady()) {
              const currentRoute = navigationRef.getCurrentRoute();
              if (currentRoute && currentRoute.name !== 'Lock') {
                navigationRef.reset({ index: 0, routes: [{ name: 'Lock' }] });
              }
            }
          }
        }
      } 
      else if (nextAppState.match(/inactive|background/)) {
        backgroundTime.current = Date.now();
      }
      
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator 
              initialRouteName="Lock" 
              screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
            >
              <Stack.Screen name="Lock" component={LockScreen} />
              <Stack.Screen name="MainDashboard" component={MainDashboard} />
              <Stack.Screen name="SelectType" component={SelectTypeScreen} />
              <Stack.Screen name="CreateType" component={CreateTypeScreen} />
              <Stack.Screen name="Form" component={FormScreen} />
              <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
              <Stack.Screen name="EmailSetup" component={EmailSetupScreen} />
              <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
              <Stack.Screen name="Developer" component={DeveloperScreen} />
              <Stack.Screen name="PreferredActions" component={PreferredActionsScreen} />
              <Stack.Screen name="PasskeyManagement" component={PasskeyManagementScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>

      {/* 🚀 SENIOR DEV FIX: Global Blur Overlay for Recents */}
      {appIsInactive && blurEnabled && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <BlurView intensity={100} tint="dark" style={StyleSheet.absoluteFill} />
        </View>
      )}
    </GestureHandlerRootView>
  );
}
