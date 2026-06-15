// File: src/screens/VaultScreen.js
import React, { useState, useCallback, useEffect, useRef, useMemo, useContext } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  Pressable, Animated, SectionList, 
  LayoutAnimation, UIManager, Platform, Keyboard, Modal, Share 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Swipeable } from 'react-native-gesture-handler'; 
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication'; 
import { BlurView } from 'expo-blur'; 

import { ThemeContext } from '../ThemeContext'; 
import { getVaultData, saveVaultData, logActivity, getSessionMode, getCustomTypes } from '../utils/storage'; 

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const maskData = (text) => {
  if (!text) return '••••••••';
  text = String(text);
  if (text.includes('@')) {
    const [name, domain] = text.split('@');
    if (name.length <= 2) return `${name}***@${domain}`;
    return `${name.substring(0, 2)}••••@${domain}`;
  }
  if (text.length > 5) return `${text.substring(0, 2)}••••••${text.slice(-2)}`;
  if (text.length > 2) return `${text.substring(0, 1)}••••${text.slice(-1)}`;
  return '••••••••';
};

const VaultCard = React.memo(({ 
  item, isSelected, isSelectionMode, isDark, themeColors, primaryColor,
  onToggle, onOpen, onEdit, onCopy, onDelete, onSwipeOpen, swipeableRefs
}) => {
  
  const getCardStyle = (type) => {
    switch(type) {
      case 'Mail': return { icon: 'mail', bg: isDark ? '#31111D' : '#FDECEF', color: '#F43F5E' };
      case 'Wi-Fi': return { icon: 'wifi', bg: isDark ? '#083344' : '#E9FAFD', color: '#06B6D4' };
      case 'Notes': return { icon: 'file-text', bg: isDark ? '#2E1065' : '#F2EEFF', color: '#8B5CF6' };
      case 'Login': return { icon: 'log-in', bg: isDark ? '#1E3A8A' : '#EFF6FF', color: '#3B82F6' };
      case 'Card': return { icon: 'credit-card', bg: isDark ? '#451A03' : '#FFFBEB', color: '#F59E0B' };
      case 'Bank': return { icon: 'briefcase', bg: isDark ? '#134E4A' : '#CCFBF1', color: '#0D9488' };
      default: return { icon: 'shield', bg: isDark ? '#1E293B' : '#F1F5F9', color: primaryColor }; 
    }
  };
  const styleData = getCardStyle(item.type);

  const renderRightActions = () => (
    <View style={styles.swipeActionsContainer}>
      <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={onEdit}>
        <Feather name="edit-2" size={16} color={isDark ? '#E2E8F0' : '#475569'} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF' }]} onPress={onCopy}>
        <Feather name="copy" size={16} color="#3B82F6" />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.swipeAction, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2' }]} onPress={onDelete}>
        <Feather name="trash-2" size={16} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  const previewText = item.username || item.accNumber || item.email || item.ssid || item.cardNumber || 
                      (item.customFields && item.customFields[0]?.value) || 'Tap to view';

  return (
    <View style={{ marginBottom: 10 }}>
      <Swipeable 
        ref={ref => { if(swipeableRefs) swipeableRefs.current[item.id] = ref; }}
        onSwipeableWillOpen={() => onSwipeOpen(item.id)}
        renderRightActions={isSelectionMode ? undefined : renderRightActions} 
        friction={2} rightThreshold={45} overshootRight={false} containerStyle={{ overflow: 'visible' }} 
      >
        <Pressable 
          delayLongPress={200}
          onLongPress={() => onToggle(item.id, true)}
          onPress={() => { if (isSelectionMode) onToggle(item.id, false); else onOpen(); }}
          style={({ pressed }) => [
            styles.card, 
            { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#F3F4F6' },
            isSelected && { borderColor: primaryColor },
            pressed && { transform: [{ scale: 0.98 }] } 
          ]}
        >
          {/* 🔥 BUG FIX: Solid background with color overlay. Stops weird Android shadows bleeding through! */}
          {isSelected && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: primaryColor, opacity: isDark ? 0.15 : 0.08, borderRadius: 18 }]} pointerEvents="none" />
          )}

          {isSelectionMode && (
            <View style={[styles.selectionDot, { borderColor: isDark ? '#475569' : '#CBD5E1' }, isSelected && { borderColor: primaryColor, backgroundColor: primaryColor }]}>
              {isSelected && <Feather name="check" size={12} color="#FFF" />}
            </View>
          )}

          <View style={[styles.cardIconBox, { backgroundColor: styleData.bg }]}>
            <Feather name={styleData.icon} size={18} color={styleData.color} />
          </View>

          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: isDark ? '#F8FAFC' : '#111827' }]} numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={[styles.cardType, { color: primaryColor }]}>{item.type ? item.type.toUpperCase() : 'UNKNOWN'}</Text>
              <View style={styles.dotSeparator} />
              <Text style={[styles.cardPreview, { color: isDark ? '#64748B' : '#94A3B8' }]} numberOfLines={1}>
                {maskData(previewText)}
              </Text>
            </View>
          </View>
          {!isSelectionMode && <Feather name="chevron-right" size={16} color={isDark ? '#475569' : '#CBD5E1'} />}
        </Pressable>
      </Swipeable>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isDark === nextProps.isDark
  );
});

export default function VaultScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { themeColors, isDark } = useContext(ThemeContext); 
  const primaryColor = themeColors?.primary || '#12C7B2'; 

  const [entries, setEntries] = useState([]);
  const [customSchemas, setCustomSchemas] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortType, setSortType] = useState('recent'); 
  
  const [isDecoyMode, setIsDecoyMode] = useState(false); 

  const [showSortSheet, setShowSortSheet] = useState(false);
  const [copySheetEntry, setCopySheetEntry] = useState(null); 
  const [showQuickAdd, setShowQuickAdd] = useState(false); 
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', actionText: '', actionStyle: 'primary', onConfirm: null });

  const openSwipeableId = useRef(null); 
  const swipeableRefs = useRef({});
  const dockAnim = useRef(new Animated.Value(20)).current;
  const dockOpacity = useRef(new Animated.Value(0)).current;

  const [toastData, setToastData] = useState({ visible: false, message: '', icon: 'info', color: primaryColor });
  const toastTranslateY = useRef(new Animated.Value(100)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (message, icon = 'check-circle', color = primaryColor) => {
    setToastData({ visible: true, message, icon, color });
    Animated.parallel([
      Animated.spring(toastTranslateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true })
    ]).start();

    setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastTranslateY, { toValue: 100, duration: 300, useNativeDriver: true }),
        Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true })
      ]).start(() => setToastData(prev => ({ ...prev, visible: false })));
    }, 2500);
  };

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(searchInput); }, 250); 
    return () => clearTimeout(handler);
  }, [searchInput]);

  useFocusEffect(useCallback(() => {
    loadData(); return () => { clearSelection(); closeAllSwipes(); };
  }, []));

  const loadData = async () => { 
    const mode = await getSessionMode();
    const decoyStatus = mode === 'LIMITED' || global.isDecoyMode;
    setIsDecoyMode(decoyStatus);
    
    const schemas = await getCustomTypes();
    setCustomSchemas(schemas || []);
    
    if (decoyStatus) {
      setEntries([
        { id: 'demo1', type: 'Login', title: 'Facebook (Demo)', username: 'demo_user_123', password: 'password123', createdAt: new Date().toISOString() },
        { id: 'demo2', type: 'Card', title: 'Visa Credit (Demo)', accNumber: '4111 2222 3333 4444', pin: '1234', createdAt: new Date().toISOString() }
      ]);
      return;
    }

    const data = await getVaultData() || []; 
    const validData = data.filter(e => e && e.id);
    setEntries(validData); 
  };

  const showCustomAlert = (title, message, actionText, actionStyle, onConfirm) => {
    setAlertConfig({ visible: true, title, message, actionText, actionStyle, onConfirm });
  };
  const hideCustomAlert = () => setAlertConfig(prev => ({ ...prev, visible: false }));

  const dynamicCategories = useMemo(() => {
    const types = entries.map(e => e.type).filter(Boolean);
    return ["All", ...Array.from(new Set(types))];
  }, [entries]);

  const getSmartTime = (obj) => {
    const t = obj.updatedAt || obj.createdAt || obj.date || obj.timestamp;
    if (!t) return 0;
    const time = new Date(t).getTime();
    return isNaN(time) ? 0 : time;
  };

  const filteredSections = useMemo(() => {
    let result = [...entries];
    if (activeCategory !== 'All') result = result.filter(item => item.type === activeCategory);
    if (debouncedSearch.trim() !== '') {
      const lowerQuery = debouncedSearch.toLowerCase();
      result = result.filter(item => ((item.title || '').toLowerCase().includes(lowerQuery)));
    }
    const grouped = {};
    result.forEach(entry => {
      let sectionName = entry.type ? entry.type.toUpperCase() : 'CUSTOM ENTRIES';
      if (!grouped[sectionName]) grouped[sectionName] = [];
      grouped[sectionName].push(entry);
    });
    
    const sectionArray = Object.keys(grouped).map(key => {
      let sectionData = grouped[key];
      sectionData.sort((a, b) => {
        const titleA = (a.title || 'Untitled').trim().toLowerCase();
        const titleB = (b.title || 'Untitled').trim().toLowerCase();
        const timeA = getSmartTime(a);
        const timeB = getSmartTime(b);
        
        if (sortType === 'az') return titleA.localeCompare(titleB);
        if (sortType === 'za') return titleB.localeCompare(titleA);
        if (sortType === 'oldest') {
          if (timeA === timeB) return titleA.localeCompare(titleB);
          return timeA - timeB; 
        }
        if (timeA === timeB) return titleA.localeCompare(titleB);
        return timeB - timeA; 
      });
      return { title: key, data: sectionData };
    });
    sectionArray.sort((a, b) => a.title.localeCompare(b.title)); 
    return sectionArray;
  }, [entries, activeCategory, debouncedSearch, sortType]);

  const handleSortChange = (newSort) => {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSortType(newSort);
    setShowSortSheet(false);
  };

  useEffect(() => {
    if (selectedIds.length > 0) {
      Animated.parallel([
        Animated.spring(dockAnim, { toValue: 0, friction: 8, tension: 50, useNativeDriver: true }),
        Animated.timing(dockOpacity, { toValue: 1, duration: 180, useNativeDriver: true })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(dockAnim, { toValue: 20, duration: 140, useNativeDriver: true }),
        Animated.timing(dockOpacity, { toValue: 0, duration: 140, useNativeDriver: true })
      ]).start();
    }
  }, [selectedIds.length]);

  const handleSearchChange = (text) => { setSearchInput(text); closeAllSwipes(); };
  
  const handleCategorySelect = (category) => {
    Haptics.selectionAsync(); setActiveCategory(category); closeAllSwipes(); clearSelection();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };
  
  const toggleSelection = useCallback((id, isLongPress) => {
    if (isLongPress) closeAllSwipes();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); // Smooth layout transition
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);
  
  const clearSelection = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedIds([]);
  };
  
  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const visibleIds = filteredSections.flatMap(section => section.data.map(item => item.id));
    if (selectedIds.length === visibleIds.length) setSelectedIds([]); 
    else setSelectedIds(visibleIds); 
  };

  const handleBulkClone = async () => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const itemsToClone = entries.filter(e => selectedIds.includes(e.id));
    const clonedItems = itemsToClone.map(e => ({
      ...e, id: Math.random().toString(36).substr(2, 9), title: `${e.title || 'Untitled'} (Copy)`, date: new Date().toISOString()
    }));
    const newVaultData = [...clonedItems, ...entries];
    setEntries(newVaultData); await saveVaultData(newVaultData);
    showToast(`${clonedItems.length} entries duplicated`, 'copy', primaryColor);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logActivity('Vault', 'Items Duplicated', `${clonedItems.length} vault entries were cloned/copied.`, 'WORKFLOW');
    clearSelection();
  };

  const promptShare = (idsToShare) => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showCustomAlert("Share Sensitive Data", `You are about to export full details for ${idsToShare.length} entry(s). Please confirm.`, "Proceed", "primary", () => { hideCustomAlert(); executePremiumShare(idsToShare); });
  };

  const executePremiumShare = async (idsToShare) => {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to share sensitive vault data', fallbackLabel: 'Use PIN' });
    if (!auth.success) { showToast('Authentication failed', 'alert-circle', '#EF4444'); return; }

    const itemsToShare = entries.filter(e => idsToShare.includes(e.id));
    let shareText = "🛡️ SAFELOCKER SECURE EXPORT\n=========================\n\n";
    itemsToShare.forEach(e => {
      shareText += `📌 ${(e.title || 'Untitled').toUpperCase()} (${e.type || 'Custom'})\n`;
      Object.keys(e).forEach(k => {
        if(!['id','type','title','date','createdAt','updatedAt','customFields'].includes(k) && e[k]) {
          shareText += `• ${k}: ${e[k]}\n`;
        }
      });
      if (e.customFields) {
        e.customFields.forEach(cf => { if(cf.value) shareText += `• ${cf.label}: ${cf.value}\n`; });
      }
      shareText += `-------------------------\n`;
    });
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Share.share({ message: shareText, title: "SafeLocker Export" });
      clearSelection(); closeAllSwipes();
    } catch (error) { console.log(error); }
  };

  const promptDelete = (idsToDelete) => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    showCustomAlert("Permanently Delete?", `Are you sure you want to delete ${idsToDelete.length} selected entry(s)? This action cannot be undone.`, "Delete", "destructive", () => { hideCustomAlert(); executeDelete(idsToDelete); });
  };

  const executeDelete = async (idsToDelete) => {
    const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to delete vault data', fallbackLabel: 'Use PIN' });
    if (!auth.success) { showToast('Authentication failed', 'alert-circle', '#EF4444'); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Heavy);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); 
    const newEntries = entries.filter(e => !idsToDelete.includes(e.id));
    setEntries(newEntries); await saveVaultData(newEntries);
    showToast(`${idsToDelete.length} entries deleted`, 'trash-2', '#EF4444');
    await logActivity('Vault', 'Entries Deleted', `${idsToDelete.length} vault entries deleted.`, 'CRITICAL');
    clearSelection(); closeAllSwipes();
  };

  const closeAllSwipes = useCallback(() => {
    if (openSwipeableId.current && swipeableRefs.current[openSwipeableId.current]) { swipeableRefs.current[openSwipeableId.current].close(); }
    openSwipeableId.current = null;
  }, []);

  const handleSwipeOpen = useCallback((id) => {
    if (openSwipeableId.current && openSwipeableId.current !== id) {
      if (swipeableRefs.current[openSwipeableId.current]) swipeableRefs.current[openSwipeableId.current].close();
    }
    openSwipeableId.current = id; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const executeSecureCopy = async (text, isSensitive, label) => {
    if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444');
    if (!text) return;
    if (isSensitive) {
      const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to copy sensitive data', fallbackLabel: 'Use PIN' });
      if (!auth.success) { showToast('Authentication failed', 'alert-circle', '#EF4444'); return; }
    }
    await Clipboard.setStringAsync(String(text));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopySheetEntry(null); 
    showToast(`${label} copied`, 'check-circle', primaryColor);
  };

  const renderSmartCopyItems = () => {
    if (!copySheetEntry) return null;
    
    let schemaFields = [];
    const standardSchema = {
      'Login': { username: { label: 'Username' }, password: { label: 'Password', isSecure: true }, url: { label: 'Website' }, notes: { label: 'Notes' } },
      'Card': { cardHolder: { label: 'Name' }, cardNumber: { label: 'Card No' }, 'Card PIN': { label: 'PIN', isSecure: true }, cvv: { label: 'CVV', isSecure: true } },
      'Bank': { accHolder: { label: 'Name' }, accNumber: { label: 'Account No', isSecure: true }, ifsc: { label: 'IFSC' } }
    }[copySheetEntry.type];

    const cSchema = customSchemas.find(t => t.name === copySheetEntry.type);
    
    const ignoredKeys = ['id', 'type', 'title', 'date', 'createdAt', 'updatedAt', 'customFields'];
    Object.keys(copySheetEntry).forEach(key => {
      if (!ignoredKeys.includes(key) && copySheetEntry[key] !== '') {
        let label = key;
        let isSecure = key.toLowerCase().includes('password') || key.toLowerCase().includes('pin') || key.toLowerCase().includes('cvv');
        
        if (standardSchema && standardSchema[key]) {
           label = standardSchema[key].label;
           isSecure = standardSchema[key].isSecure || isSecure;
        } else if (cSchema) {
           const cField = cSchema.fields.find(f => f.id === key);
           if (cField) label = cField.label;
        } else {
           label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        }
        
        schemaFields.push({ label, value: copySheetEntry[key], isSecure });
      }
    });

    if (copySheetEntry.customFields) {
      copySheetEntry.customFields.forEach(cf => {
        if(cf.value && cf.value.trim() !== '') {
          let isSecure = cf.label.toLowerCase().includes('password') || cf.label.toLowerCase().includes('pin');
          schemaFields.push({ label: cf.label, value: cf.value, isSecure });
        }
      });
    }

    return schemaFields.map((field, idx) => (
      <TouchableOpacity 
        key={`sc_${idx}`} 
        style={[styles.copyRow, { backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : '#F8F9FB', borderColor: isDark ? '#334155' : '#EEF1F5' }]} 
        onPress={() => executeSecureCopy(field.value, field.isSecure, field.label)}
      >
        <View style={{ flex: 1 }}>
           <Text style={[styles.copyLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>{field.label}</Text>
           <Text style={[styles.copyValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1}>
             {field.isSecure ? '••••••••' : String(field.value)}
           </Text>
        </View>
        <View style={[styles.copyIconWrapper, { backgroundColor: field.isSecure ? 'rgba(245, 158, 11, 0.1)' : `${primaryColor}15` }]}>
           <Feather name={field.isSecure ? "lock" : "copy"} size={14} color={field.isSecure ? "#F59E0B" : primaryColor} />
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0F172A' : '#F8F9FB' }]}>
      
      {toastData.visible && (
        <Animated.View style={[styles.premiumToast, { transform: [{ translateY: toastTranslateY }], opacity: toastOpacity }]} pointerEvents="none">
           <Feather name={toastData.icon} size={16} color={toastData.color} style={{marginRight: 8}} />
           <Text style={styles.smartToastText}>{toastData.message}</Text>
        </Animated.View>
      )}

      <View style={{ paddingTop: insets.top }}>
        <View style={styles.headerShell}>
          {selectedIds.length > 0 ? (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              <TouchableOpacity onPress={clearSelection}><Feather name="x" size={20} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
              <Text style={[styles.selectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{selectedIds.length} selected</Text>
            </View>
          ) : (
            <>
              <Text style={[styles.headerTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{isDecoyMode ? 'Demo Vault' : 'My Vault'}</Text>
              <View style={styles.headerActions}>
                <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSortSheet(true); }} style={({ pressed }) => [styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : 'rgba(15,23,42,0.04)' }, pressed && { transform: [{ scale: 0.96 }] }, sortType !== 'recent' && { backgroundColor: `${primaryColor}20` }]}>
                  <Feather name="sliders" size={16} color={sortType !== 'recent' ? primaryColor : (isDark ? '#F8FAFC' : '#0F172A')} />
                </Pressable>
                <Pressable onPress={async () => { await logActivity('Security', 'Manual Lock', 'User manually locked the app from Vault', 'INFO'); navigation.replace('Lock'); }} style={({ pressed }) => [styles.iconBtn, { backgroundColor: isDark ? '#1E293B' : 'rgba(15,23,42,0.04)' }, pressed && { transform: [{ scale: 0.96 }] }]}>
                  <Feather name="lock" size={16} color={isDark ? '#F8FAFC' : '#0F172A'} />
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : 'transparent' }, isSearchFocused && { borderColor: primaryColor, shadowColor: primaryColor }]}>
            <Feather name="search" size={16} color={isSearchFocused ? primaryColor : '#94A3B8'} style={{ marginRight: 8 }} />
            <TextInput style={[styles.searchInput, { color: isDark ? '#F8FAFC' : '#0F172A' }]} placeholder="Search secure entries..." placeholderTextColor="#94A3B8" value={searchInput} onChangeText={handleSearchChange} onFocus={() => { setIsSearchFocused(true); closeAllSwipes(); }} onBlur={() => setIsSearchFocused(false)} autoCorrect={false} />
          </View>
        </View>

        <View style={styles.chipScrollContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipContent}>
            {dynamicCategories.map((item) => {
              const isActive = activeCategory === item;
              const count = item === 'All' ? entries.length : entries.filter(e => e.type === item).length;
              return (
                <Pressable key={item} onPress={() => handleCategorySelect(item)} style={[styles.chip, { borderColor: isDark ? '#334155' : 'transparent', backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }, isActive && { backgroundColor: primaryColor, borderColor: primaryColor }]}>
                  <Text style={[styles.chipText, { color: isDark ? '#94A3B8' : '#64748B' }, isActive && { color: '#FFFFFF' }]}>{item}</Text>
                  {isActive && count > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{count}</Text></View>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>

      <SectionList 
        sections={filteredSections} 
        keyExtractor={(item) => item.id} 
        contentContainerStyle={styles.listContainer} 
        showsVerticalScrollIndicator={false} 
        stickySectionHeadersEnabled={false}
        initialNumToRender={12}
        onScrollBeginDrag={() => { closeAllSwipes(); Keyboard.dismiss(); }} 
        renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionLabel}>{title}</Text>}
        renderItem={({ item }) => (
          <VaultCard 
            item={item} 
            isSelected={selectedIds.includes(item.id)}
            isSelectionMode={selectedIds.length > 0}
            isDark={isDark} themeColors={themeColors} primaryColor={primaryColor}
            onToggle={toggleSelection}
            onOpen={() => { if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444'); navigation.navigate('EntryDetail', { entry: item }); }}
            onEdit={() => { if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444'); closeAllSwipes(); navigation.navigate('Form', { type: item.type, editEntry: item }); }}
            onCopy={() => { if (isDecoyMode) return showToast("Disabled in Decoy Mode", "shield-off", '#EF4444'); closeAllSwipes(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setCopySheetEntry(item); }}
            onDelete={() => promptDelete([item.id])}
            onSwipeOpen={handleSwipeOpen}
            swipeableRefs={swipeableRefs}
          />
        )} 
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={{width: 60, height: 60, borderRadius: 20, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: {width:0, height:8}, shadowOpacity: 0.05, shadowRadius: 16, elevation: 3}}>
              <Feather name="shield" size={26} color={primaryColor} />
            </View>
            <Text style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontSize: 15, fontWeight: '700', marginBottom: 4, letterSpacing: -0.2 }}>
              {activeCategory !== 'All' ? `No ${activeCategory} entries` : 'Vault is empty'}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 }}>
              Tap the + button to securely add data.
            </Text>
          </View>
        )}
      />

      {/* MULTI-SELECT DOCK */}
      <Animated.View style={[styles.contextDock, { backgroundColor: isDark ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.9)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' , opacity: dockOpacity, transform: [{ translateY: dockAnim }] }]} pointerEvents={selectedIds.length > 0 ? 'auto' : 'none'}>
        <BlurView intensity={isDark ? 40 : 60} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={styles.dockAction} onPress={handleSelectAll}><Feather name="check-square" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
        <TouchableOpacity style={styles.dockAction} onPress={handleBulkClone}><Feather name="copy" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
        <TouchableOpacity style={styles.dockAction} onPress={() => promptShare(selectedIds)}><Feather name="share-2" size={18} color={isDark ? '#F8FAFC' : '#0F172A'} /></TouchableOpacity>
        <TouchableOpacity style={styles.dockAction} onPress={() => promptDelete(selectedIds)}><Feather name="trash-2" size={18} color="#EF4444" /></TouchableOpacity>
      </Animated.View>

      {selectedIds.length === 0 && !isDecoyMode && (
        <Pressable 
          onPress={() => { closeAllSwipes(); navigation.navigate('SelectType'); }} 
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setShowQuickAdd(true); }}
          style={styles.fabContainer}
        >
          <View style={[styles.fab, { backgroundColor: primaryColor, shadowColor: primaryColor }]}><Feather name="plus" size={24} color="#FFFFFF" /></View>
        </Pressable>
      )}

      {/* QUICK ADD MODAL */}
      <Modal visible={showQuickAdd} transparent animationType="fade" onRequestClose={() => setShowQuickAdd(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowQuickAdd(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
              <Text style={[styles.sheetTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 24 }]}>Quick Add</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                {[
                  { type: 'Login', icon: 'log-in', color: '#3B82F6', bg: isDark ? '#1E3A8A' : '#EFF6FF' },
                  { type: 'Card', icon: 'credit-card', color: '#F59E0B', bg: isDark ? '#451A03' : '#FFFBEB' },
                  { type: 'Bank', icon: 'briefcase', color: '#0D9488', bg: isDark ? '#134E4A' : '#CCFBF1' },
                  { type: 'Notes', icon: 'file-text', color: '#8B5CF6', bg: isDark ? '#2E1065' : '#F2EEFF' },
                ].map(item => (
                  <TouchableOpacity 
                    key={item.type} 
                    style={{ alignItems: 'center', width: '22%' }}
                    onPress={() => { setShowQuickAdd(false); navigation.navigate('Form', { type: item.type }); }}
                  >
                    <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                      <Feather name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#F8FAFC' : '#0F172A' }}>{item.type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* SMART COPY MODAL */}
      <Modal visible={!!copySheetEntry} transparent animationType="fade" onRequestClose={() => setCopySheetEntry(null)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCopySheetEntry(null)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Feather name="zap" size={18} color={primaryColor} style={{ marginRight: 8 }} />
                <Text style={[styles.sheetTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>Smart Copy</Text>
              </View>
              <Text style={[styles.sheetSubTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Tap any field from '{copySheetEntry?.title}' to copy.</Text>
              
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.copyList}>
                 {renderSmartCopyItems()}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* SORT OPTIONS MODAL */}
      <Modal visible={showSortSheet} transparent animationType="fade" onRequestClose={() => setShowSortSheet(false)}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortSheet(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20, backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }]}>
              <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]} />
              <Text style={[styles.sheetTitle, { color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 16 }]}>Sort Vault Entries</Text>
              
              {[
                { id: 'recent', label: 'Recently Added', icon: 'clock', sub: 'Newest entries first' }, 
                { id: 'oldest', label: 'Oldest First', icon: 'calendar', sub: 'Earliest entries first' },
                { id: 'az', label: 'Name (A → Z)', icon: 'arrow-down', sub: 'Alphabetical order' }, 
                { id: 'za', label: 'Name (Z → A)', icon: 'arrow-up', sub: 'Reverse alphabetical' }
              ].map((option, index) => {
                const isActive = sortType === option.id;
                return (
                  <TouchableOpacity key={option.id} style={[styles.sortOptionRow, { borderBottomColor: isDark ? '#334155' : '#F8F9FB', borderBottomWidth: index === 3 ? 0 : 1, paddingVertical: 14 }]} onPress={() => handleSortChange(option.id)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                       <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: isActive ? primaryColor + '15' : (isDark ? '#0F172A' : '#F1F5F9'), justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                         <Feather name={option.icon} size={16} color={isActive ? primaryColor : (isDark ? '#94A3B8' : '#64748B')} />
                       </View>
                       <View>
                         <Text style={[styles.sortOptionText, { color: isDark ? '#F8FAFC' : '#1E293B', fontSize: 14 }, isActive && { color: primaryColor, fontWeight: '700' }]}>{option.label}</Text>
                         <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '500' }}>{option.sub}</Text>
                       </View>
                    </View>
                    {isActive && <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: primaryColor, justifyContent: 'center', alignItems: 'center' }}><Feather name="check" size={12} color="#FFF" /></View>}
                  </TouchableOpacity>
                );
              })}
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* CUSTOM ALERT BOX */}
      <Modal visible={alertConfig.visible} transparent animationType="fade" onRequestClose={hideCustomAlert}>
        <View style={StyleSheet.absoluteFill}>
          <BlurView intensity={40} tint={isDark ? "dark" : "light"} style={styles.alertOverlayBg}>
            <View style={[styles.customAlertBox, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderWidth: 1, borderColor: isDark ? '#334155' : 'rgba(0,0,0,0.05)' }]}>
              <View style={[styles.alertIconBox, { backgroundColor: alertConfig.actionStyle === 'destructive' ? '#FEF2F2' : `${primaryColor}15` }]}>
                <Feather name={alertConfig.actionStyle === 'destructive' ? "alert-triangle" : "shield"} size={28} color={alertConfig.actionStyle === 'destructive' ? "#EF4444" : primaryColor} />
              </View>
              <Text style={[styles.alertTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>{alertConfig.title}</Text>
              <Text style={[styles.alertMessage, { color: isDark ? '#94A3B8' : '#64748B' }]}>{alertConfig.message}</Text>
              <View style={styles.alertBtnRow}>
                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]} onPress={hideCustomAlert}>
                  <Text style={[styles.alertBtnText, { color: isDark ? '#F8FAFC' : '#475569' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.alertBtn, { backgroundColor: alertConfig.actionStyle === 'destructive' ? '#EF4444' : primaryColor }]} onPress={alertConfig.onConfirm}>
                  <Text style={[styles.alertBtnText, { color: '#FFFFFF' }]}>{alertConfig.actionText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerShell: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44, marginTop: 8, marginBottom: 10, paddingHorizontal: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  selectionTitle: { fontSize: 16, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { paddingHorizontal: 20, marginBottom: 12 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 }, 
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500', height: '100%' },
  chipScrollContainer: { height: 34, marginBottom: 6 },
  chipContent: { paddingHorizontal: 20, gap: 8, paddingRight: 30, flexGrow: 1 },
  chip: { height: 34, minWidth: 64, borderRadius: 17, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 3, elevation: 0.5 }, 
  chipText: { fontSize: 13, fontWeight: '600' },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  listContainer: { paddingHorizontal: 20, paddingBottom: 130 },
  sectionLabel: { marginTop: 14, marginBottom: 8, paddingLeft: 2, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#94A3B8' },
  
  // 🔥 CHOTE, SLEEK AUR COMPACT CARDS
  card: { flexDirection: 'row', alignItems: 'center', height: 70, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 1.5, overflow: 'hidden' }, 
  selectionDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  cardIconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 }, 
  cardContent: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2, letterSpacing: 0.1 },
  cardType: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  dotSeparator: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1', marginHorizontal: 6 },
  cardPreview: { fontSize: 11.5, flexShrink: 1 },
  
  swipeActionsContainer: { flexDirection: 'row', width: 130, height: 70, alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, gap: 6 },
  swipeAction: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  contextDock: { position: 'absolute', bottom: 90, left: 30, right: 30, height: 56, borderRadius: 28, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12, overflow: 'hidden' }, 
  dockAction: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  
  fabContainer: { position: 'absolute', bottom: 90, right: 24, zIndex: 100 },
  fab: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  
  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  bottomSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 15 }, 
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  sheetSubTitle: { fontSize: 12, fontWeight: '500', marginBottom: 16, marginTop: 4 },
  
  // 🔥 COMPACT SMART COPY STYLES
  copyList: { gap: 8 },
  copyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1 },
  copyLabel: { fontSize: 10, fontWeight: '700', marginBottom: 2, letterSpacing: 0.4, textTransform: 'uppercase' },
  copyValue: { fontSize: 13, fontWeight: '600' },
  copyIconWrapper: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  
  sortOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sortOptionText: { fontSize: 14, fontWeight: '600' },

  premiumToast: { position: 'absolute', bottom: 130, alignSelf: 'center', zIndex: 9999999, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, backgroundColor: '#0F172A', shadowColor: '#000', shadowOffset: {width:0,height:6}, shadowOpacity: 0.3, shadowRadius: 12, elevation: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  smartToastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', marginLeft: 8 },

  alertOverlayBg: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  customAlertBox: { width: '100%', borderRadius: 32, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.2, shadowRadius: 32, elevation: 16 }, 
  alertIconBox: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10, textAlign: 'center', letterSpacing: -0.2 },
  alertMessage: { fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 20, fontWeight: '500' },
  alertBtnRow: { flexDirection: 'row', gap: 10, width: '100%' },
  alertBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, 
  alertBtnText: { fontSize: 14, fontWeight: '700' }
});
