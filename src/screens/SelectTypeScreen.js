// File: src/screens/SelectTypeScreen.js
import React, { useState, useCallback, useContext } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TextInput, 
  FlatList, Pressable, Dimensions, Platform, StatusBar, Modal, TouchableOpacity
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added for direct delete

import { getCustomTypes } from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

const { width } = Dimensions.get('window');
const BOX_WIDTH = (width - 46) / 2; // 16dp padding on sides, 14dp gap

const BP_COLORS = {
  primary: '#6C5CE7',
  primaryGradient: ['#6C5CE7', '#8B7CFF'],
  bg: '#FAFAFB',
  textMain: '#1A1A1A',
  textSub: '#8A8A8A',
  searchBg: '#F6F7FB',
  danger: '#EF4444',
  selectedBg: '#F3F0FF'
};

// 🛡️ Default Types (Cannot be deleted/edited)
const DEFAULT_TYPES = [
  { id: 'd1', name: 'Login', sub: 'Web & App', icon: 'log-in', bg: '#F4F6FF', iconBg: '#E0E7FF', iconColor: '#4A90E2', isCustom: false },
  { id: 'd2', name: 'Card', sub: 'Debit/Credit', icon: 'credit-card', bg: '#F8F5FF', iconBg: '#EDE4FF', iconColor: '#8A7CFF', isCustom: false },
  { id: 'd3', name: 'Bank', sub: 'A/c Details', icon: 'briefcase', bg: '#F2FBF7', iconBg: '#D1F4E0', iconColor: '#2ECC71', isCustom: false },
  { id: 'd4', name: 'Notes', sub: 'Secure Text', icon: 'file-text', bg: '#FFF7F2', iconBg: '#FFEAE0', iconColor: '#F39C12', isCustom: false },
  { id: 'd5', name: 'Wi-Fi', sub: 'Passwords', icon: 'wifi', bg: '#F2F8FF', iconBg: '#E0F0FF', iconColor: '#3498DB', isCustom: false },
  { id: 'd6', name: 'Mail', sub: 'Backup Codes', icon: 'mail', bg: '#FFF2F2', iconBg: '#FFE5E5', iconColor: '#E74C3C', isCustom: false },
];

export default function SelectTypeScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const [customTypes, setCustomTypes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 🔥 SMART SELECTION STATE
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // 🔥 MODALS STATE
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sortType, setSortType] = useState('recent'); // 'recent', 'az', 'za'

  useFocusEffect(
    useCallback(() => {
      loadCustomTypes();
      clearSelection();
    }, [])
  );

  const loadCustomTypes = async () => {
    const types = await getCustomTypes();
    setCustomTypes(types || []);
  };

  // 🎯 CLICK BEHAVIOR ENGINE
  const handlePress = (item) => {
    if (isSelectionMode) {
      if (!item.isCustom) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return; // Default types can't be selected
      }
      toggleSelection(item.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('Form', { type: item.name, customFields: item.fields });
    }
  };

  const handleLongPress = (item) => {
    if (!item.isCustom) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return; // Only custom types can be selected/deleted
    }
    if (!isSelectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsSelectionMode(true);
      setSelectedIds([item.id]);
    }
  };

  const toggleSelection = (id) => {
    Haptics.selectionAsync();
    if (selectedIds.includes(id)) {
      const newSelection = selectedIds.filter(selectedId => selectedId !== id);
      setSelectedIds(newSelection);
      if (newSelection.length === 0) setIsSelectionMode(false);
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const clearSelection = () => {
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  // 🗑️ DELETE SYSTEM (BULK)
  const confirmDelete = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const remainingTypes = customTypes.filter(t => !selectedIds.includes(t.id));
    
    // Direct storage update for speed and reliability
    await AsyncStorage.setItem('CUSTOM_VAULT_TYPES', JSON.stringify(remainingTypes));
    setCustomTypes(remainingTypes);
    
    setShowDeleteModal(false);
    clearSelection();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ✏️ EDIT SYSTEM
  const handleEdit = () => {
    if (selectedIds.length !== 1) return;
    const typeToEdit = customTypes.find(t => t.id === selectedIds[0]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearSelection();
    // Navigating to CreateType with params (You will need to handle these params in CreateTypeScreen later to pre-fill)
    navigation.navigate('CreateType', { editTypeData: typeToEdit }); 
  };

  // 📊 SORT & FILTER ENGINE
  let allTypes = [...DEFAULT_TYPES, ...customTypes];
  
  if (searchQuery.trim() !== '') {
    allTypes = allTypes.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  if (sortType === 'az') {
    allTypes.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortType === 'za') {
    allTypes.sort((a, b) => b.name.localeCompare(a.name));
  } // 'recent' leaves default order (Defaults first, then newest customs appended at bottom)

  // 🧱 RENDER CARD (100dp, Selectable)
  const renderTypeBox = ({ item }) => {
    const isSelected = selectedIds.includes(item.id);
    const isDimmed = isSelectionMode && !isSelected;

    return (
      <Pressable 
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
        style={({ pressed }) => [
          styles.typeBox, 
          { backgroundColor: isSelected ? BP_COLORS.selectedBg : (isDark ? themeColors.card : (item.bg || '#FAFAFB')) },
          isSelected && { borderColor: BP_COLORS.primary, borderWidth: 2 },
          (!isSelected && !isDark) && { borderColor: '#E5E7EB', borderWidth: 1 },
          isDimmed && { opacity: 0.6 }, // Dim unselected cards
          pressed && { transform: [{ scale: 0.96 }] } // 120ms snap feel
        ]}
      >
        {/* Selection Checkbox */}
        {isSelectionMode && item.isCustom && (
          <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
            {isSelected && <Feather name="check" size={14} color="#FFF" />}
          </View>
        )}

        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconBox, { backgroundColor: isDark ? themeColors.inputBg : (item.iconBg || '#E0E7FF') }]}>
            <Feather name={item.icon || 'layers'} size={20} color={isDark ? themeColors.primary : (item.iconColor || BP_COLORS.primary)} />
          </View>
        </View>

        <View>
          <Text style={[styles.typeName, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.typeSub, { color: isDark ? themeColors.textLight : BP_COLORS.textSub }]} numberOfLines={1}>{item.sub || 'Custom Type'}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <LinearGradient colors={isDark ? themeColors.background : [BP_COLORS.searchBg, '#FFFFFF']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        
        {/* 🔝 SMART HEADER MORPHING */}
        {!isSelectionMode ? (
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.backBtn, { backgroundColor: isDark ? themeColors.card : '#F3F4F8' }, pressed && {opacity: 0.7}]}>
              <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : BP_COLORS.textMain} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }]}>Select Type</Text>
            <TouchableOpacity onPress={() => setShowSortSheet(true)} style={styles.sortBtn}>
              <Feather name="sliders" size={22} color={isDark ? themeColors.textDark : BP_COLORS.textMain} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.header, styles.selectionHeader]}>
            <TouchableOpacity onPress={clearSelection} style={styles.backBtn}>
              <Feather name="x" size={22} color={BP_COLORS.textMain} />
            </TouchableOpacity>
            <Text style={styles.selectionTitle}>{selectedIds.length} Selected</Text>
            <View style={styles.selectionActions}>
              {selectedIds.length === 1 && (
                <TouchableOpacity onPress={handleEdit} style={styles.actionBtn}>
                  <Feather name="edit-2" size={20} color={BP_COLORS.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowDeleteModal(true)} style={styles.actionBtn}>
                <Feather name="trash-2" size={20} color={BP_COLORS.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 🔍 SEARCH BAR */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: isDark ? themeColors.inputBg : '#FFFFFF', borderColor: isDark ? themeColors.inputBorder : '#E5E7EB' }]}>
            <Feather name="search" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
            <TextInput 
              style={[styles.searchInput, { color: isDark ? themeColors.textDark : BP_COLORS.textMain }]}
              placeholder="Search types..." placeholderTextColor="#9CA3AF"
              value={searchQuery} onChangeText={setSearchQuery} autoCorrect={false}
            />
          </View>
        </View>

        {/* 📊 GRID SYSTEM (100dp Cards) */}
        <FlatList
          data={allTypes}
          keyExtractor={(item) => item.id || item.name}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={{ gap: 14, marginBottom: 14 }} // Exact 14dp gap
          showsVerticalScrollIndicator={false}
          renderItem={renderTypeBox}
          ListFooterComponent={() => (
            <View style={{ flexDirection: 'row', marginTop: searchQuery ? 0 : 4 }}>
              {!searchQuery && !isSelectionMode && (
                <Pressable 
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('CreateType'); }}
                  style={({ pressed }) => [
                    styles.typeBox, styles.customTypeBox,
                    { backgroundColor: isDark ? themeColors.inputBg : '#F9F9FF', borderColor: '#C7C9D9' },
                    pressed && { transform: [{ scale: 0.95 }] }
                  ]}
                >
                  <View style={[styles.iconBox, { backgroundColor: isDark ? themeColors.card : '#FFFFFF', shadowOpacity: 0.02, elevation: 1 }]}>
                    <Feather name="plus" size={20} color={BP_COLORS.primary} />
                  </View>
                  <View>
                    <Text style={[styles.typeName, { color: BP_COLORS.primary }]}>Create Type</Text>
                    <Text style={[styles.typeSub, { color: isDark ? themeColors.textLight : BP_COLORS.textSub }]}>Custom Form</Text>
                  </View>
                </Pressable>
              )}
            </View>
          )}
        />

        {/* 🗑️ DELETE CONFIRMATION MODAL */}
        <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
          <View style={styles.modalOverlayCenter}>
            <View style={styles.deleteModalBox}>
              <View style={styles.deleteWarningIcon}>
                <Feather name="alert-triangle" size={28} color={BP_COLORS.danger} />
              </View>
              <Text style={styles.deleteTitle}>Delete {selectedIds.length} {selectedIds.length > 1 ? 'Types' : 'Type'}?</Text>
              <Text style={styles.deleteDesc}>This action cannot be undone. Vault entries using this type will lose their format structure.</Text>
              
              <View style={styles.deleteModalActions}>
                <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowDeleteModal(false)}>
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmDeleteBtn} onPress={confirmDelete}>
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ⚙️ SORT BOTTOM SHEET */}
        <Modal visible={showSortSheet} transparent animationType="slide" onRequestClose={() => setShowSortSheet(false)}>
          <TouchableOpacity style={styles.modalOverlayBottom} activeOpacity={1} onPress={() => setShowSortSheet(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { backgroundColor: isDark ? themeColors.card : '#FFFFFF' }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Sort Types By</Text>
              
              {['recent', 'az', 'za'].map(sortOption => (
                <TouchableOpacity 
                  key={sortOption} 
                  style={styles.sortOptionRow} 
                  onPress={() => { setSortType(sortOption); setShowSortSheet(false); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.sortOptionText, sortType === sortOption && { color: BP_COLORS.primary, fontWeight: '700' }]}>
                    {sortOption === 'recent' ? 'Recently Created' : sortOption === 'az' ? 'Name (A → Z)' : 'Name (Z → A)'}
                  </Text>
                  {sortType === sortOption && <Feather name="check" size={20} color={BP_COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 📐 SAFE AREA SYSTEM
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 8 : 8 },
  
  // HEADER
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sortBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  
  // SELECTION MODE HEADER
  selectionHeader: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F8' },
  selectionTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: { padding: 4 },

  searchContainer: { paddingHorizontal: 16, paddingVertical: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', height: 46, borderRadius: 14, paddingHorizontal: 16, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },
  
  // 📐 GRID SYSTEM
  gridContent: { paddingHorizontal: 16, paddingBottom: 40 },
  typeBox: { 
    width: BOX_WIDTH, 
    height: 100, // 🔥 EXACT 100dp Height
    borderRadius: 18, 
    padding: 14, 
    justifyContent: 'space-between', 
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  iconBox: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  checkbox: { position: 'absolute', top: 12, right: 12, width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  checkboxActive: { backgroundColor: BP_COLORS.primary, borderColor: BP_COLORS.primary },
  
  typeName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  typeSub: { fontSize: 12, fontWeight: '500' },

  customTypeBox: { borderWidth: 2, borderStyle: 'dashed', elevation: 0 },

  // 🗑️ DELETE MODAL
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  deleteModalBox: { width: '100%', backgroundColor: '#FFF', borderRadius: 18, padding: 24, alignItems: 'center' },
  deleteWarningIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  deleteDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  deleteModalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelModalBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  cancelModalText: { fontSize: 15, fontWeight: '600', color: '#4B5563' },
  confirmDeleteBtn: { flex: 1, height: 48, borderRadius: 12, backgroundColor: BP_COLORS.danger, justifyContent: 'center', alignItems: 'center' },
  confirmDeleteText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // ⚙️ SORT BOTTOM SHEET
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bottomSheet: { width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  sortOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  sortOptionText: { fontSize: 16, fontWeight: '500', color: '#4B5563' }
});
