import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

export default function SelectableCard({ item, index, isSelected, isSelectionMode, onPress, onLongPress, cardWidth, collectionInfo, isDark, activeTab, sgAccent }) {
  // 🔥 SMART ACCENT COLOR FIX: Direct from global theme for premium sync
  const accentColor = sgAccent || '#12C7B2';
  const bgTint = isSelected ? `${accentColor}08` : '#F5EFE9'; // Luxury 0.03 opacity tint

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgeScaleAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  // 🎬 Staggered Entrance
  useEffect(() => {
    Animated.timing(entranceAnim, { toValue: 1, duration: 180, delay: Math.min(index * 20, 400), useNativeDriver: true }).start();
  }, [index]);

  // 🪄 Selection Mode Context Animation (Shrink unselected cards)
  useEffect(() => {
    let targetScale = 1;
    if (isSelectionMode) { targetScale = isSelected ? 1 : 0.985; } // V3 Spec
    Animated.spring(scaleAnim, { toValue: targetScale, friction: 6, tension: 140, useNativeDriver: true }).start();
    
    if (isSelected) {
      badgeScaleAnim.setValue(0.7);
      Animated.spring(badgeScaleAnim, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    }
  }, [isSelectionMode, isSelected]);

  const handlePressIn = () => { Animated.timing(scaleAnim, { toValue: 0.96, duration: 90, useNativeDriver: true }).start(); };
  const handlePressOut = () => { Animated.spring(scaleAnim, { toValue: isSelectionMode && !isSelected ? 0.985 : 1, friction: 5, tension: 140, useNativeDriver: true }).start(); };

  const handleLongPress = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onLongPress(item, index); };
  const handlePress = () => { if (isSelectionMode) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(item, index); };

  // 🎨 Clean Borders (V3 Spec: 1dp border)
  const borderWidth = isSelected ? 1 : 0; 
  const borderColor = isSelected ? accentColor : 'transparent';
  const showMetadata = !isSelectionMode; // 🔥 HIDE CLUTTER DURING SELECTION

  return (
    <Animated.View style={[styles.container, { width: cardWidth, height: cardWidth * 1.2, opacity: entranceAnim, transform: [{ scale: scaleAnim }, { translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      {/* 🔥 V3 SPEC: delayLongPress strictly at 280ms */}
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onLongPress={handleLongPress} onPress={handlePress} delayLongPress={280} style={{ flex: 1 }}>
        
        <View style={[
          styles.cardWrapper, 
          { borderWidth, borderColor, backgroundColor: bgTint }, 
          isSelected && { shadowColor: accentColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 } // V3 Glow Ring
        ]}>
          
          <Image source={{ uri: item.uri }} style={styles.image} />
          {isSelected && <View style={styles.selectedOverlay} />}

          {/* 🪄 ONLY SHOW METADATA IF NOT IN SELECTION MODE */}
          {showMetadata && item.locked && (
            <View style={styles.lockBadge}><Feather name="lock" size={11} color="#FFF" /></View>
          )}

          {showMetadata && item.isFavorite && (
            <View style={styles.favBadge}><BlurView intensity={isDark ? 80 : 90} tint={isDark ? "dark" : "light"} style={styles.favBlur}><Feather name="star" size={13} color="#F59E0B" /></BlurView></View>
          )}

          {showMetadata && collectionInfo && activeTab === 'All' && (
            <View style={styles.collectionPillWrapper}>
              <BlurView intensity={isDark ? 72 : 82} tint={isDark ? "dark" : "light"} style={styles.collectionPill}>
                <Feather name="folder" size={12} color={collectionInfo.color} style={{ marginRight: 4 }} />
                <Text style={[styles.collectionPillText, { color: isDark ? '#FFF' : '#111' }]} numberOfLines={1}>{collectionInfo.title}</Text>
              </BlurView>
            </View>
          )}

          {/* ✅ L3: PREMIUM SELECTION BADGE (28dp) */}
          {isSelected && (
            <Animated.View style={[styles.checkBadge, { transform: [{ scale: badgeScaleAnim }], backgroundColor: accentColor }]}>
              <Feather name="check" size={14} color="#FFF" />
            </Animated.View>
          )}

        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  cardWrapper: { flex: 1, borderRadius: 22, overflow: 'hidden' },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  selectedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.03)' }, // Soft minimal dim
  
  lockBadge: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  favBadge: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  favBlur: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  collectionPillWrapper: { position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 10 },
  collectionPill: { flexDirection: 'row', alignItems: 'center', height: 28, borderRadius: 14, paddingHorizontal: 10, minWidth: 74, maxWidth: '100%', overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.3)' },
  collectionPillText: { fontSize: 12, fontWeight: '500', flexShrink: 1 },

  // 🔥 28dp check badge with 2dp white ring
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 4, borderWidth: 2, borderColor: '#FFF' }
});
