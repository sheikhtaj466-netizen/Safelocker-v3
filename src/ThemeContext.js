// File: src/ThemeContext.js
import React, { createContext, useState, useEffect } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ThemeContext = createContext();

export const ACCENT_COLORS = {
  Purple: '#6C5CE7', Blue: '#4A90E2', Teal: '#00BFA6', 
  Green: '#22C55E', Orange: '#F97316', Red: '#EF4444'
};

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');
  const [accentName, setAccentName] = useState('Purple');
  const [accentHex, setAccentHex] = useState('#6C5CE7'); 

  useEffect(() => { 
    loadTheme(); 
    
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      AsyncStorage.getItem('DARK_MODE').then(savedDark => {
        if (savedDark === null) {
          setIsDark(colorScheme === 'dark');
        }
      });
    });
    return () => subscription.remove();
  }, []);

  const loadTheme = async () => {
    try {
      const savedDark = await AsyncStorage.getItem('DARK_MODE');
      if (savedDark !== null) {
        setIsDark(savedDark === 'true');
      } else {
        setIsDark(systemScheme === 'dark');
      }
      
      const savedAccentName = await AsyncStorage.getItem('ACCENT_NAME');
      const savedAccentHex = await AsyncStorage.getItem('ACCENT_HEX');
      if (savedAccentName) setAccentName(savedAccentName);
      if (savedAccentHex) setAccentHex(savedAccentHex);
    } catch (e) {
      console.log("Error loading theme", e);
    }
  };

  const toggleTheme = async (value) => {
    setIsDark(value);
    await AsyncStorage.setItem('DARK_MODE', value ? 'true' : 'false');
  };

  const changeAccentColor = async (name, hex) => {
    try {
      const safeName = name || 'Purple';
      const safeHex = hex || '#6C5CE7';
      setAccentName(safeName); 
      setAccentHex(safeHex);
      await AsyncStorage.setItem('ACCENT_NAME', safeName);
      await AsyncStorage.setItem('ACCENT_HEX', safeHex);
    } catch (e) {
      console.log("Error saving accent color", e);
    }
  };

  const primaryColor = accentHex || '#6C5CE7';
  const primaryLight = primaryColor + '20'; 
  const primaryGradient = [primaryColor, primaryColor + 'CC']; 

  const themeColors = {
    background: isDark ? ['#121212', '#121212'] : ['#FAFAFB', '#FAFAFB'],
    card: isDark ? '#1E1E1E' : '#FFFFFF',
    textDark: isDark ? '#FFFFFF' : '#111827',
    textLight: isDark ? '#9CA3AF' : '#6B7280',
    primary: primaryColor,
    primaryLight: primaryLight,
    primaryGradient: primaryGradient,
    separator: isDark ? '#333333' : '#F3F4F6',
    inputBg: isDark ? '#2C2C2E' : '#F9FAFB',
    inputBorder: isDark ? '#3D3D3D' : '#E5E7EB',
    danger: '#EF4444',
    success: '#00C853',
    iconBg: { 
      default: primaryLight, 
      danger: isDark ? '#3D2A2A' : '#FEE2E2',
      security: isDark ? '#3D2A2A' : '#FEE2E2', 
      email: isDark ? '#1E3A8A' : '#DBEAFE',    
      privacy: isDark ? '#312E81' : '#E0E7FF',  
      data: isDark ? '#064E3B' : '#D1FAE5',     
      appearance: isDark ? '#4C1D95' : '#F3E8FF',
      about: isDark ? '#374151' : '#F3F4F6'     
    },
    iconColor: { 
      default: primaryColor, 
      danger: '#EF4444',
      security: '#EF4444', 
      email: '#3B82F6',    
      privacy: '#6366F1',  
      data: '#10B981',     
      appearance: '#8B5CF6',
      about: '#6B7280'     
    }
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, accentName, accentHex, changeAccentColor, themeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};
