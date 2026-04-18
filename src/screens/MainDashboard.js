// File: src/screens/MainDashboard.js
import React, { useRef, useContext, useState, useEffect, useMemo } from 'react'; // 🔥 SMART FIX: Added useMemo here!
import { 
  View, StyleSheet, Animated, Dimensions, 
  TouchableOpacity, Platform, Keyboard, FlatList 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext } from '../ThemeContext';

import VaultScreen from './VaultScreen';
import ScanScreen from './ScanScreen';
import SettingsScreen from './SettingsScreen';

const { width } = Dimensions.get('window');

// 🔥 Create an Animated version of FlatList
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// 📐 ULTRA PREMIUM SLIM METRICS
const NAV_HEIGHT = 72; 
const PILL_WIDTH = 104; 
const PILL_HEIGHT = 46; 
const TAB_WIDTH = (width - 32) / 3; 
const PILL_OFFSET = (TAB_WIDTH - PILL_WIDTH) / 2;

export default function MainDashboard({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  // Screens Array for FlatList
  const screens = useMemo(() => [
    { key: 'vault', component: <VaultScreen navigation={navigation} /> },
    { key: 'gallery', component: <ScanScreen navigation={navigation} /> },
    { key: 'settings', component: <SettingsScreen navigation={navigation} /> }
  ], [navigation]);

  useEffect(() => {
    const kbShow = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsScrollEnabled(false));
    const kbHide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsScrollEnabled(true));
    return () => { kbShow.remove(); kbHide.remove(); };
  }, []);

  const handleTabPress = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); 
    // 🔥 FlatList specific scroll method
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const pillTranslateX = scrollX.interpolate({
    inputRange: [0, width, width * 2],
    outputRange: [PILL_OFFSET, TAB_WIDTH + PILL_OFFSET, TAB_WIDTH * 2 + PILL_OFFSET],
    extrapolate: 'clamp'
  });

  const getScreenStyle = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.96, 1, 0.96], extrapolate: 'clamp' });
    const opacity = scrollX.interpolate({ inputRange, outputRange: [0.6, 1, 0.6], extrapolate: 'clamp' });
    return { width, height: '100%', transform: [{ scale }], opacity };
  };

  const getIconTranslateY = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return scrollX.interpolate({ inputRange, outputRange: [2, -2, 2], extrapolate: 'clamp' });
  };

  const getIconScale = (index) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
    return scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' });
  };

  const getActiveOpacity = (targetIndex) => {
    const start = (targetIndex - 0.5) * width;
    const end = (targetIndex + 0.5) * width;
    return scrollX.interpolate({ inputRange: [start - 0.1, start, end, end + 0.1], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  };

  const getInactiveOpacity = (targetIndex) => {
    const start = (targetIndex - 0.5) * width;
    const end = (targetIndex + 0.5) * width;
    return scrollX.interpolate({ inputRange: [start - 0.1, start, end, end + 0.1], outputRange: [1, 0, 0, 1], extrapolate: 'clamp' });
  };

  const activeColor = '#FFFFFF'; 
  const inactiveColor = isDark ? '#8A8A8A' : '#9AA0A6'; 
  const primaryAccent = themeColors?.primary || '#12C7B2';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F8F8FB' }]}>
      
      {/* 🔥 SMART FIX: Replaced ScrollView with AnimatedFlatList to solve VirtualizedList Error */}
      <AnimatedFlatList
        ref={flatListRef}
        data={screens}
        keyExtractor={(item) => item.key}
        horizontal 
        pagingEnabled 
        scrollEnabled={isScrollEnabled}
        showsHorizontalScrollIndicator={false} 
        scrollEventThrottle={16} 
        bounces={true} 
        initialNumToRender={3} 
        getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }], 
          { 
            useNativeDriver: false,
            listener: (event) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              const newIndex = Math.round(offsetX / width);
              if (currentIndex !== newIndex) {
                setCurrentIndex(newIndex);
              }
            }
          } 
        )}
        renderItem={({ item, index }) => (
          <Animated.View style={getScreenStyle(index)}>
            {item.component}
          </Animated.View>
        )}
      />

      {/* 🧭 PREMIUM SLIM NAV */}
      <View style={[
        styles.bottomNav, 
        { 
          backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', 
          bottom: Platform.OS === 'ios' ? insets.bottom || 12 : 12,
          shadowColor: isDark ? '#000' : 'rgba(17, 24, 39, 0.06)'
        }
      ]}>
        
        {/* 🎴 SLIM ROUNDED RECTANGLE PILL */}
        <Animated.View 
          style={[
            styles.activePill, 
            { 
              transform: [{ translateX: pillTranslateX }],
              backgroundColor: primaryAccent, 
              shadowColor: primaryAccent 
            }
          ]} 
        />

        {[0, 1, 2].map((idx) => {
          const icons = ['shield', 'grid', 'settings'];
          const labels = ['Vault', 'Gallery', 'Settings'];
          return (
            <TouchableOpacity key={idx} style={styles.navItem} activeOpacity={1} onPress={() => handleTabPress(idx)}>
              <Animated.View style={{ alignItems: 'center', transform: [{ scale: getIconScale(idx) }, { translateY: getIconTranslateY(idx) }] }}>
                <View style={styles.iconWrapper}>
                  <Animated.View style={{ position: 'absolute', opacity: getInactiveOpacity(idx) }}><Feather name={icons[idx]} size={20} color={inactiveColor} /></Animated.View>
                  <Animated.View style={{ position: 'absolute', opacity: getActiveOpacity(idx) }}><Feather name={icons[idx]} size={20} color={activeColor} /></Animated.View>
                </View>
                <View style={styles.textWrapper}>
                  <Animated.Text style={[styles.navText, { opacity: getInactiveOpacity(idx), color: inactiveColor }]}>{labels[idx]}</Animated.Text>
                  <Animated.Text style={[styles.navText, { opacity: getActiveOpacity(idx), color: activeColor, position: 'absolute' }]}>{labels[idx]}</Animated.Text>
                </View>
              </Animated.View>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bottomNav: { 
    flexDirection: 'row', alignItems: 'center', 
    height: NAV_HEIGHT, borderRadius: 24, position: 'absolute', left: 16, right: 16, zIndex: 100, 
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 8
  }, 
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', zIndex: 2 }, 
  iconWrapper: { width: 22, height: 22, justifyContent: 'center', alignItems: 'center' }, 
  textWrapper: { height: 16, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  navText: { fontSize: 13, fontWeight: '600' }, 
  activePill: { 
    position: 'absolute', 
    width: PILL_WIDTH, 
    height: PILL_HEIGHT, 
    borderRadius: 23, 
    zIndex: 1,
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 6, 
    elevation: 3
  }
});
