// File: src/navigation/AppNavigator.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LockScreen from '../screens/LockScreen';
import MainDashboard from '../screens/MainDashboard'; 
import VaultScreen from '../screens/VaultScreen';
import FilesScreen from '../screens/FilesScreen'; 
import ScanScreen from '../screens/ScanScreen'; 
import ToolsScreen from '../screens/ToolsScreen'; 
import SelectTypeScreen from '../screens/SelectTypeScreen';
import FormScreen from '../screens/FormScreen';
import EntryDetailScreen from '../screens/EntryDetailScreen';
import CreateTypeScreen from '../screens/CreateTypeScreen';
import SettingsScreen from '../screens/SettingsScreen';   
import DeveloperScreen from '../screens/DeveloperScreen'; 
import EmailSetupScreen from '../screens/EmailSetupScreen'; 
import RecoveryScreen from '../screens/RecoveryScreen'; 
import ActivityLogScreen from '../screens/ActivityLogScreen';
import PreferredActionsScreen from '../screens/PreferredActionsScreen';

const Stack = createNativeStackNavigator();

// 🚀 ULTRA-SMOOTH, LAG-FREE CONFIGURATION
// Humne yahan se custom timings aur heavy presentation modes nikal diye hain
const screenConfig = {
  headerShown: false,
  gestureEnabled: true, // Swiping back enabled
  animation: 'default', // Uses pure Native OS smooth animation (Zero lag)
};

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Lock" screenOptions={screenConfig}>
      {/* Auth & Main Screens */}
      <Stack.Screen name="Lock" component={LockScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="MainDashboard" component={MainDashboard} options={{ animation: 'fade' }} />
      
      {/* Primary Features */}
      <Stack.Screen name="Vault" component={VaultScreen} />
      <Stack.Screen name="FilesScreen" component={FilesScreen} />
      <Stack.Screen name="ScanScreen" component={ScanScreen} />
      <Stack.Screen name="ToolsScreen" component={ToolsScreen} />
      
      {/* 🚀 FIXED: Removed heavy modal animations that cause lag on back press */}
      {/* Ab ye screens natural aur smooth tareeqe se open aur close hongi */}
      <Stack.Screen name="SelectType" component={SelectTypeScreen} />
      <Stack.Screen name="Form" component={FormScreen} />
      <Stack.Screen name="EntryDetail" component={EntryDetailScreen} />
      <Stack.Screen name="CreateType" component={CreateTypeScreen} />
      
      {/* Settings & Configs */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Developer" component={DeveloperScreen} />
      <Stack.Screen name="EmailSetup" component={EmailSetupScreen} />
      <Stack.Screen name="Recovery" component={RecoveryScreen} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
      <Stack.Screen name="PreferredActions" component={PreferredActionsScreen} />
    </Stack.Navigator>
  );
}
