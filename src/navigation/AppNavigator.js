// File: src/navigation/AppNavigator.js
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { getSettings } from '../utils/storage'; // 🔥 Settings lane ke liye

import LockScreen from '../screens/LockScreen';
import VaultScreen from '../screens/VaultScreen';
import SelectTypeScreen from '../screens/SelectTypeScreen';
import FormScreen from '../screens/FormScreen';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import CreateTypeScreen from '../screens/CreateTypeScreen';
import GeneratorScreen from '../screens/GeneratorScreen'; 
import SettingsScreen from '../screens/SettingsScreen';   
import DeveloperScreen from '../screens/DeveloperScreen'; 
import EmailSetupScreen from '../screens/EmailSetupScreen'; 
import RecoveryScreen from '../screens/RecoveryScreen'; 

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 🚀 BOTTOM NAVIGATION BAR & LIFECYCLE LOGIC
function MainTabs({ navigation }) {
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef(null);

  // 🔥 LIFECYCLE HOOK: Background / Foreground Track karega
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      const settings = await getSettings(); // Real-time settings fetch karega

      // 1. Jab App Background me jayega (Minimize hogi)
      if (appState.current.match(/active/) && nextAppState === 'background') {
        backgroundTime.current = Date.now(); // Time note kar liya
        
        if (settings.lockOnExit) {
          navigation.replace('Lock'); // Turant Lock kar do!
        }
      }

      // 2. Jab App wapas Foreground me aayegi (Wapas open hogi)
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (backgroundTime.current && !settings.lockOnExit) {
          
          const timeAway = Date.now() - backgroundTime.current;
          const minutesAway = timeAway / 60000; // Milliseconds to Minutes
          
          let limit = Infinity; // Default
          if (settings.autoLockTimer === '30 sec') limit = 0.5;
          if (settings.autoLockTimer === '1 min') limit = 1;
          if (settings.autoLockTimer === '5 min') limit = 5;

          // Agar set kiye gaye time se zyada bahar tha, toh lock kar do
          if (minutesAway >= limit) {
            navigation.replace('Lock');
          }
        }
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove(); // Memory leak roko
    };
  }, [navigation]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Vault') iconName = 'shield';
          else if (route.name === 'Generator') iconName = 'key';
          else if (route.name === 'Settings') iconName = 'settings';
          return <Feather name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#8A8FA3',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }
      })}
    >
      <Tab.Screen name="Vault" component={VaultScreen} />
      <Tab.Screen name="Generator" component={GeneratorScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

// 🚀 MAIN APP STACK
export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Lock" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Lock" component={LockScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
      <Stack.Screen name="SelectType" component={SelectTypeScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Form" component={FormScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} options={{ animation: 'slide_from_right' }} /> 
      <Stack.Screen name="CreateType" component={CreateTypeScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Developer" component={DeveloperScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="EmailSetup" component={EmailSetupScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="Recovery" component={RecoveryScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}
