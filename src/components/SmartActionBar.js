// File: src/components/SmartActionBar.js
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const SG_ACCENT = '#8B5A2B';

export default function SmartActionBar({ selectedCount, onClearSelection, onActionTrigger, isDark }) {
  const insets = useSafeAreaInsets();
  const slideYAnim = useRef(new Animated.Value(-18)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 60fps Native Animations for entering the screen
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideYAnim, { toValue: 0, tension: 120, friction: 9, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true })
    ]).start();
  }, []);

  const handleAction = (actionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onActionTrigger) onActionTrigger(actionType);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onClearSelection) onClearSelection();
  };

  return (
    <Animated.View style={[
      styles.animatedContainer, 
      { top: insets.top + 10, opacity: fadeAnim, transform: [{ translateY: slideYAnim }] }
    ]}>
      <BlurView intensity={isDark ? 40 : 92} tint={isDark ? "dark" : "light"} style={styles.blurBar}>
        
        {/* 📌 Left: Close & Count */}
        <View style={styles.leftSection}>
          <TouchableOpacity onPress={handleClear} style={styles.closeBtn} activeOpacity={0.6}>
            <Feather name="x" size={22} color={isDark ? '#FFF' : '#111'} />
          </TouchableOpacity>
          <Text style={[styles.countText, { color: isDark ? '#FFF' : '#111' }]}>
            {selectedCount > 99 && width < 360 ? '99+' : `${selectedCount} selected`}
          </Text>
        </View>

        {/* ⚡ Right: Smart Collapsed Actions (Only 4 Icons) */}
        <View style={styles.rightSection}>
          <TouchableOpacity onPress={() => handleAction('favorite')} style={styles.iconButton}>
            <Feather name="star" size={20} color={isDark ? '#FFF' : '#111'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAction('move')} style={styles.iconButton}>
            <Feather name="folder" size={20} color={isDark ? '#FFF' : '#111'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleAction('share')} style={styles.iconButton}>
            <Feather name="share-2" size={20} color={isDark ? '#FFF' : '#111'} />
          </TouchableOpacity>
          
          {/* 🗑️ Delete (Always Last, Red Tint, Never Cut) */}
          <TouchableOpacity onPress={() => handleAction('delete')} style={[styles.iconButton, styles.deleteBtn]}>
            <Feather name="trash-2" size={20} color="#FF4D4D" />
          </TouchableOpacity>
        </View>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedContainer: { 
    position: 'absolute', left: 16, right: 16, zIndex: 1000, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 10 
  },
  blurBar: { 
    height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingLeft: 8, paddingRight: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)', overflow: 'hidden' 
  },
  leftSection: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  closeBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  countText: { fontSize: 20, fontWeight: '700', marginLeft: 6 },
  rightSection: { flexDirection: 'row', alignItems: 'center', gap: 4 }, // Flex gap prevents clipping
  iconButton: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: 'rgba(255, 77, 77, 0.08)', width: 44, height: 44 } // Red tint background
});
