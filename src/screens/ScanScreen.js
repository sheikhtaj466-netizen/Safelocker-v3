// File: src/screens/ScanScreen.js
import React, { useState, useCallback, useContext, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, Platform, Modal, Animated, Easing, ActivityIndicator, SafeAreaView, AppState, Dimensions, PanResponder, ScrollView, Alert 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing'; 

import * as FileSystem from 'expo-file-system/legacy'; 
import * as ScreenCapture from 'expo-screen-capture';

import { ThemeContext } from '../ThemeContext';
import PremiumZoomViewer from '../components/PremiumZoomViewer'; 
import SelectableCard from '../components/SelectableCard'; 
import SmartActionBar from '../components/SmartActionBar'; 

import { logActivity } from '../utils/storage';

const { width } = Dimensions.get('window');
const GRID_PADDING = 14;
const COLUMN_GAP = 10;
const PHOTO_ITEM_WIDTH = (width - (GRID_PADDING * 2) - (COLUMN_GAP * 2)) / 3;
const ROW_HEIGHT = PHOTO_ITEM_WIDTH * 1.2 + COLUMN_GAP; 

const GALLERY_PHOTOS_KEY = 'SAFEGALLERY_PHOTOS';
const COLLECTIONS_KEY = 'SAFEGALLERY_COLLECTIONS';
const AUTO_DELETE_KEY = 'SAFEGALLERY_AUTO_DELETE'; 
const SAF_EXPORT_DIR_KEY = 'SAF_EXPORT_DIR_URI'; 

export default function ScanScreen({ navigation }) {
  const { isDark, themeColors } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();

  const sgAccent = themeColors.primary;
  const sgAccentLight = isDark ? themeColors.primary + '25' : themeColors.primary + '15';

  const [activeTab, setActiveTab] = useState('All');
  const [photos, setPhotos] = useState([]);
  const [collections, setCollections] = useState([]); 
  const [alwaysDeleteOriginal, setAlwaysDeleteOriginal] = useState(false);

  const customTabs = collections.map(c => c.title);
  const galleryTabs = ['All', 'Favorites', ...customTabs];

  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [sortType, setSortType] = useState('newest'); 
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [smartModal, setSmartModal] = useState({ visible: false, type: null, title: '', message: '', payload: null });
  const [newColName, setNewColName] = useState('');
  
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0); 
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [appIsActive, setAppIsActive] = useState(true);
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isZoomingState, setIsZoomingState] = useState(false);

  const uiOpacityAnim = useRef(new Animated.Value(1)).current;
  const viewerOpacityAnim = useRef(new Animated.Value(0)).current; 
  const isUiVisibleRef = useRef(true);
  const [showActionSheet, setShowActionSheet] = useState(false);

  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const selectedPhotosRef = useRef([]); 
  const displayPhotosRef = useRef([]); 
  const isSelectionMode = selectedPhotos.length > 0;
  
  const scrollY = useRef(0);
  const hapticTickCounter = useRef(0);

  useEffect(() => { selectedPhotosRef.current = selectedPhotos; }, [selectedPhotos]);

  const [flowState, setFlowState] = useState('idle'); 
  const fabMenuAnim = useRef(new Animated.Value(0)).current;
  const viewerFlatListRef = useRef(null);
  const toastTranslateY = useRef(new Animated.Value(-100)).current;
  const [toastData, setToastData] = useState({ message: '', icon: 'check', type: 'success' });

  const showSmartToast = (message, icon = 'check', type = 'success') => {
    setToastData({ message, icon, type });
    Animated.sequence([
      Animated.timing(toastTranslateY, { toValue: insets.top + 20, duration: 300, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
      Animated.delay(3500),
      Animated.timing(toastTranslateY, { toValue: -100, duration: 300, easing: Easing.in(Easing.ease), useNativeDriver: true })
    ]).start();
  };

  let displayPhotos = photos.filter(p => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Favorites') return p.isFavorite;
    const matchedCol = collections.find(c => c.title === activeTab);
    return matchedCol && p.collectionId === matchedCol.id;
  });

  displayPhotos.sort((a, b) => {
    if (sortType === 'favorites_first') {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.addedAt) - new Date(a.addedAt);
    }
    if (sortType === 'oldest') return new Date(a.addedAt) - new Date(b.addedAt);
    return new Date(b.addedAt) - new Date(a.addedAt);
  });

  useEffect(() => { displayPhotosRef.current = displayPhotos; }, [displayPhotos]);

  const dragSelectResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return selectedPhotosRef.current.length > 0 && Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (evt, gestureState) => {
        const { pageX, pageY } = evt.nativeEvent;
        const headerOffset = insets.top + 140; 
        const yInsideGrid = pageY - headerOffset + scrollY.current;
        const xInsideGrid = pageX - GRID_PADDING;
        if (yInsideGrid < 0 || xInsideGrid < 0 || xInsideGrid > width - GRID_PADDING * 2) return;
        const col = Math.floor(xInsideGrid / (PHOTO_ITEM_WIDTH + COLUMN_GAP));
        const row = Math.floor(yInsideGrid / ROW_HEIGHT);
        if (col < 0 || col > 2) return;
        const index = row * 3 + col;
        if (index >= 0 && index < displayPhotosRef.current.length) {
          const targetPhoto = displayPhotosRef.current[index];
          if (!selectedPhotosRef.current.includes(targetPhoto.id)) {
            setSelectedPhotos(prev => [...prev, targetPhoto.id]);
            hapticTickCounter.current += 1;
            if (hapticTickCounter.current % 2 === 0) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        }
      },
      onPanResponderRelease: () => { hapticTickCounter.current = 0; },
      onPanResponderTerminate: () => { hapticTickCounter.current = 0; }
    })
  ).current;

  const toggleImmersiveMode = () => {
    const nextState = !isUiVisibleRef.current;
    isUiVisibleRef.current = nextState;
    setIsUiVisible(nextState);
    Animated.timing(uiOpacityAnim, { toValue: nextState ? 1 : 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  };

  const openViewer = (photo, index) => { 
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
    setViewerIndex(index);
    setCurrentPhoto(photo); 
    setIsUiVisible(true);
    isUiVisibleRef.current = true;
    uiOpacityAnim.setValue(1);
    setShowActionSheet(false);
    setIsZoomingState(false);
    setViewerVisible(true); 
    
    // 🚀 SENIOR DEV FIX: Smart Log - Photo Viewed (Appears in All Logs only due to INFO priority)
    logActivity('Gallery', 'IMAGE_VIEWED', 'User opened an image in the secure viewer.', 'INFO');
    
    Animated.timing(viewerOpacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    setTimeout(() => { if (viewerFlatListRef.current) viewerFlatListRef.current.scrollToIndex({ index, animated: false }); }, 50);
  };

  const closeViewer = () => {
    Animated.timing(viewerOpacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => { setViewerVisible(false); });
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const enableProtection = async () => { if(isActive) await ScreenCapture.preventScreenCaptureAsync(); };
      enableProtection(); loadGalleryData(); checkAutoDeletePref();
      return () => { isActive = false; ScreenCapture.allowScreenCaptureAsync(); };
    }, [])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => { setAppIsActive(nextAppState === 'active'); });
    return () => subscription.remove();
  }, []);

  const checkAutoDeletePref = async () => { const pref = await AsyncStorage.getItem(AUTO_DELETE_KEY); if (pref === 'true') setAlwaysDeleteOriginal(true); };
  const loadGalleryData = async () => { try { const pData = await AsyncStorage.getItem(GALLERY_PHOTOS_KEY); const cData = await AsyncStorage.getItem(COLLECTIONS_KEY); if (pData) setPhotos(JSON.parse(pData)); if (cData) setCollections(JSON.parse(cData)); } catch(e) {} };
  const saveGalleryData = async (newPhotos, newCollections) => { try { if (newPhotos) { await AsyncStorage.setItem(GALLERY_PHOTOS_KEY, JSON.stringify(newPhotos)); setPhotos(newPhotos); } if (newCollections) { await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(newCollections)); setCollections(newCollections); } } catch(e) {} };
  const closeSmartModal = () => setSmartModal({ visible: false, type: null, title: '', message: '', payload: null });

  const toggleFabMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isFabMenuOpen) {
      Animated.timing(fabMenuAnim, { toValue: 0, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }).start(() => setIsFabMenuOpen(false));
    } else {
      setIsFabMenuOpen(true);
      Animated.timing(fabMenuAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }).start();
    }
  };

  const handleCreateCollection = async () => {
    if (!newColName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newCol = { id: `col_${Date.now()}`, title: newColName.trim(), color: sgAccent, createdAt: new Date().toISOString() };
    await saveGalleryData(null, [...collections, newCol]);
    
    // 🚀 SENIOR DEV FIX: Smart Log - Folder Created (Main Logs + All Logs)
    await logActivity('Gallery', 'FOLDER_CREATED', `Created a new gallery folder: ${newColName.trim()}`, 'WORKFLOW');
    
    setShowCreateCollection(false); setNewColName(''); setActiveTab(newCol.title); 
    showSmartToast('Folder Created Successfully', 'folder-plus');
    toggleFabMenu(); 
  };

  const movePhotosFromGallery = async () => {
    toggleFabMenu(); 
    setTimeout(async () => {
      global.activeFlow = 'IMPORT_FLOW'; 
      try {
        const result = await ImagePicker.launchImageLibraryAsync({ 
          mediaTypes: ImagePicker.MediaTypeOptions.Images, 
          allowsMultipleSelection: true,
          quality: 1
        });
        global.activeFlow = null;

        if (!result.canceled && result.assets && result.assets.length > 0) {
          setIsProcessingAction(true);
          const selectedCol = collections.find(c => c.title === activeTab);
          const targetColId = selectedCol ? selectedCol.id : null;
          const newSecureImages = [];

          for (let i = 0; i < result.assets.length; i++) {
             const asset = result.assets[i];
             let ext = 'jpg';
             if (asset.uri.includes('.')) { 
                const parts = asset.uri.split('.');
                ext = parts[parts.length-1].toLowerCase();
             }
             const newFileName = `safelocker_${Date.now()}_${i}.${ext}`;
             const newUri = FileSystem.documentDirectory + newFileName;
             
             try {
                await FileSystem.copyAsync({ from: asset.uri, to: newUri });
             } catch (e) {
                const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
                await FileSystem.writeAsStringAsync(newUri, base64, { encoding: 'base64' });
             }

             newSecureImages.push({ id: `img_${Date.now()}_${i}`, uri: newUri, collectionId: targetColId, isFavorite: false, locked: true, addedAt: new Date().toISOString() });
          }

          await saveGalleryData([...newSecureImages, ...photos], null);
          setIsProcessingAction(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // 🚀 SENIOR DEV FIX: Smart Log - Images Imported
          await logActivity('Gallery', 'IMAGES_IMPORTED', `Secured ${result.assets.length} images into the vault gallery.`, 'WORKFLOW');
          
          setTimeout(() => {
            setSmartModal({
              visible: true, type: 'import_warning', title: 'Photos Secured 🔒', 
              message: `Successfully moved ${result.assets.length} items to vault.\n\nNote: Please delete the original photos from your main Gallery now.`, payload: null
            });
          }, 300);
        }
      } catch (err) { 
        global.activeFlow = null; setIsProcessingAction(false); showSmartToast(`System Error: ${err.message}`, 'alert-triangle', 'warning');
      }
    }, 300);
  };

  const handleCardPress = (item, index) => { 
    if (isSelectionMode) setSelectedPhotos(prev => prev.includes(item.id) ? prev.filter(pid => pid !== item.id) : [...prev, item.id]);
    else openViewer(item, index); 
  };
  
  const handleCardLongPress = (item) => { if (!isSelectionMode) setSelectedPhotos([item.id]); };
  const clearSelection = () => setSelectedPhotos([]);

  const triggerSmartAction = async (type) => {
    const isBulk = selectedPhotos.length > 0;
    const activePhoto = viewerVisible ? displayPhotos[viewerIndex] : displayPhotos.find(p => p.id === selectedPhotos[0]);
    setShowActionSheet(false); 
    if (type === 'share' && isBulk && selectedPhotos.length > 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); showSmartToast('Only 1 photo can be shared at a time.', 'info', 'warning'); return; 
    }
    if (type === 'favorite') {
      const updatedPhotos = photos.map(p => (isBulk ? selectedPhotos.includes(p.id) : p.id === activePhoto.id) ? { ...p, isFavorite: !p.isFavorite } : p);
      if (!isBulk && viewerVisible) setCurrentPhoto({ ...currentPhoto, isFavorite: !currentPhoto.isFavorite });
      saveGalleryData(updatedPhotos, null);
      if (isBulk) clearSelection();
      
      // 🚀 SENIOR DEV FIX: Smart Log - Favorite Toggled
      await logActivity('Gallery', 'FAVORITE_TOGGLED', isBulk ? `Toggled favorites for ${selectedPhotos.length} gallery items.` : 'Toggled favorite for a gallery image.', 'WORKFLOW');
      
      showSmartToast(isBulk ? 'Favorites Updated' : 'Favorite Toggled', 'star'); return;
    }
    setTimeout(() => {
      setSmartModal({
        visible: true, type: type, isBulk: isBulk,
        title: type === 'move' ? 'Move to Folder' : type === 'delete' ? 'Delete Photo' : type === 'export' ? 'Export Photo' : 'Share Photo',
        message: type === 'delete' ? 'Are you sure you want to permanently delete this from SafeLocker?' : type === 'export' ? 'This will restore the photo to your device gallery and remove it from the vault.' : type === 'share' ? 'Are you sure you want to share this private photo?' : '',
        payload: isBulk ? selectedPhotos : [activePhoto.id]
      });
    }, 50);
  };

  const executeSilentExport = async (targetDir, payload, isBulk) => {
    setIsProcessingAction(true);
    try {
      for (const id of payload) {
        const photo = photos.find(p => p.id === id);
        if (photo && photo.uri) {
          const base64Data = await FileSystem.readAsStringAsync(photo.uri, { encoding: 'base64' });
          const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(targetDir, `SafeLocker_Export_${Date.now()}.jpg`, 'image/jpeg');
          await FileSystem.writeAsStringAsync(newFileUri, base64Data, { encoding: 'base64' });
        }
      }
      const updatedPhotos = photos.filter(p => !payload.includes(p.id));
      await saveGalleryData(updatedPhotos, null);
      if (!isBulk && viewerVisible) closeViewer(); else clearSelection();
      setIsProcessingAction(false); closeSmartModal();
      
      // 🚀 SENIOR DEV FIX: Smart Log - Image Exported
      await logActivity('Gallery', 'IMAGES_EXPORTED', isBulk ? `Exported ${payload.length} images out of the vault to device gallery.` : 'Exported an image back to device gallery.', 'IMPORTANT');
      
      showSmartToast('Directly Saved to Device! 🚀', 'download');
    } catch (err) {
      console.error("🔥 SAF Silent Export Error:", err); setIsProcessingAction(false);
      await AsyncStorage.removeItem(SAF_EXPORT_DIR_KEY); closeSmartModal();
      showSmartToast('Export Failed. Folder might have been deleted. Try again.', 'x', 'warning');
    }
  };

  const executeSmartModalAction = async () => {
    const { type, payload, isBulk } = smartModal;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    if (type === 'delete') {
      const updatedPhotos = photos.filter(p => !payload.includes(p.id));
      await saveGalleryData(updatedPhotos, null);
      if (!isBulk && viewerVisible) closeViewer(); else clearSelection();
      
      // 🚀 SENIOR DEV FIX: Smart Log - Image Deleted
      await logActivity('Gallery', 'IMAGES_DELETED', isBulk ? `Permanently deleted ${payload.length} images from the vault.` : 'Permanently deleted an image from the vault.', 'IMPORTANT');
      
      showSmartToast('Deleted Securely', 'trash-2');
    } 
    else if (type === 'export') {
      try {
        const savedDirUri = await AsyncStorage.getItem(SAF_EXPORT_DIR_KEY);
        if (!savedDirUri) {
          closeSmartModal();
          Alert.alert("Setup Export Folder 🚀", "Please create a folder named 'SafeLocker' (or choose Downloads) and tap 'Use this folder'. We will save it so you never have to do this again!", [
              { text: "Cancel", style: "cancel" },
              { text: "Select Folder", onPress: async () => {
                  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                  if (!permissions.granted) { showSmartToast('Folder access denied!', 'alert-triangle', 'warning'); return; }
                  await AsyncStorage.setItem(SAF_EXPORT_DIR_KEY, permissions.directoryUri);
                  executeSilentExport(permissions.directoryUri, payload, isBulk);
                } }
            ]); return;
        } else { await executeSilentExport(savedDirUri, payload, isBulk); return; }
      } catch (err) { console.error("Export Error:", err); }
    } 
    else if (type === 'share') {
      try {
        const photo = photos.find(p => p.id === payload[0]); 
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(photo.uri, { dialogTitle: 'Share securely' });
          // 🚀 SENIOR DEV FIX: Smart Log - Image Shared
          await logActivity('Gallery', 'EXPORT_SHARED', 'Shared a secure image externally.', 'IMPORTANT');
        }
        if (isBulk) clearSelection();
      } catch (err) { console.error("Share Error:", err); }
    }
    if (type !== 'export') closeSmartModal();
  };

  const executeMoveAction = async (targetColId) => {
    const targetCol = collections.find(c => c.id === targetColId);
    const colName = targetCol ? targetCol.title : 'All Gallery';
    const updatedPhotos = photos.map(p => smartModal.payload.includes(p.id) ? { ...p, collectionId: targetColId } : p);
    await saveGalleryData(updatedPhotos, null);
    if (!smartModal.isBulk && viewerVisible) setCurrentPhoto({ ...currentPhoto, collectionId: targetColId });
    else clearSelection();
    closeSmartModal();
    
    // 🚀 SENIOR DEV FIX: Smart Log - Image Moved
    await logActivity('Gallery', 'IMAGES_MOVED', `Moved ${smartModal.payload.length} images to ${colName}.`, 'WORKFLOW');
    
    showSmartToast(`Moved to ${colName} ✅`, 'folder');
  };

  const getCollectionInfo = (colId) => collections.find(c => c.id === colId);
  const topTranslateY = uiOpacityAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 0] });
  const bottomTranslateY = uiOpacityAnim.interpolate({ inputRange: [0, 1], outputRange: [150, 0] });

  const renderActionSheet = () => (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100000, elevation: 10 }]}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowActionSheet(false)} />
      <View style={[styles.bottomSheet, { backgroundColor: themeColors.card, paddingBottom: insets.bottom + 20, position: 'absolute', bottom: 0, left:0, right: 0 }]}>
         <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} />
         <Text style={[styles.sheetTitle, { color: themeColors.textDark, marginBottom: 24 }]}>Quick Actions</Text>
         <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 20 }}>
            {[
              { icon: 'folder', text: 'Move', action: 'move', color: themeColors.textDark },
              { icon: 'star', text: displayPhotos[viewerIndex]?.isFavorite ? 'Unfavorite' : 'Favorite', action: 'favorite', color: displayPhotos[viewerIndex]?.isFavorite ? '#F59E0B' : themeColors.textDark },
              { icon: 'share-2', text: 'Share', action: 'share', color: themeColors.textDark },
              { icon: 'download', text: 'Export', action: 'export', color: themeColors.textDark },
              { icon: 'trash-2', text: 'Delete', action: 'delete', color: '#EF4444' },
            ].map((item, idx) => (
               <TouchableOpacity key={idx} onPress={() => triggerSmartAction(item.action)} style={{ width: '48%', backgroundColor: themeColors.inputBg, padding: 16, borderRadius: 16, marginBottom: 12, alignItems: 'center' }}>
                  <Feather name={item.icon} size={24} color={item.color} style={{ marginBottom: 8 }} />
                  <Text style={{ color: item.color, fontWeight: '600', fontSize: 14 }}>{item.text}</Text>
               </TouchableOpacity>
            ))}
         </View>
      </View>
    </View>
  );

  const renderSmartModal = () => (
    <View style={[StyleSheet.absoluteFill, { zIndex: 110000, elevation: 11, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }]}>
       <View style={{ width: '85%', backgroundColor: themeColors.card, borderRadius: 28, padding: 24, paddingTop: 36, shadowColor: '#000', shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.3, shadowRadius: 20 }}>
          <TouchableOpacity onPress={closeSmartModal} style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.inputBg, borderRadius: 18 }}>
             <Feather name="x" size={20} color={themeColors.textDark} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
             {smartModal.type === 'delete' && <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}><Feather name="trash-2" size={28} color="#EF4444" /></View>}
             {smartModal.type === 'move' && <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: sgAccentLight, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}><Feather name="folder" size={28} color={sgAccent} /></View>}
             {smartModal.type === 'import_warning' && <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(52, 211, 153, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}><Feather name="shield" size={28} color="#34D399" /></View>}
             <Text style={[styles.sheetTitle, { color: themeColors.textDark, marginBottom: 8, textAlign: 'center' }]}>{smartModal.title}</Text>
             {smartModal.message !== '' && <Text style={{ color: themeColors.textLight, textAlign: 'center', fontSize: 14, lineHeight: 22 }}>{smartModal.message}</Text>}
          </View>
          {smartModal.type === 'move' && (
             <ScrollView style={{ maxHeight: 220, width: '100%', marginBottom: 10 }} showsVerticalScrollIndicator={false}>
               {collections.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => executeMoveAction(c.id)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: themeColors.inputBg, borderRadius: 14, marginBottom: 8 }}>
                     <Feather name="folder" size={20} color={sgAccent} style={{ marginRight: 12 }}/>
                     <Text style={{ color: themeColors.textDark, fontWeight: '600', fontSize: 15 }}>{c.title}</Text>
                  </TouchableOpacity>
               ))}
               <TouchableOpacity onPress={() => executeMoveAction(null)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: themeColors.inputBg, borderRadius: 14, marginTop: 8 }}>
                  <Feather name="grid" size={20} color={themeColors.textLight} style={{ marginRight: 12 }}/>
                  <Text style={{ color: themeColors.textDark, fontWeight: '600', fontSize: 15 }}>Remove from folder</Text>
               </TouchableOpacity>
             </ScrollView>
          )}
          {(smartModal.type === 'delete' || smartModal.type === 'export' || smartModal.type === 'share') && (
             <TouchableOpacity onPress={executeSmartModalAction} style={[styles.applyBtn, { backgroundColor: smartModal.type === 'delete' ? '#EF4444' : sgAccent, width: '100%', height: 52, borderRadius: 14 }]}>
                <Text style={[styles.applyBtnText, { fontSize: 16 }]}>{smartModal.title}</Text>
             </TouchableOpacity>
          )}
          {smartModal.type === 'import_warning' && (
            <TouchableOpacity onPress={closeSmartModal} style={[styles.applyBtn, { backgroundColor: sgAccent, width: '100%', height: 52, borderRadius: 14 }]}>
              <Text style={[styles.applyBtnText, { fontSize: 16 }]}>I Understand</Text>
            </TouchableOpacity>
          )}
       </View>
    </View>
  );

  return (
    <View style={styles.containerMain}>
      {isSelectionMode && (
        <SmartActionBar selectedCount={selectedPhotos.length} onClearSelection={clearSelection} onActionTrigger={triggerSmartAction} isDark={isDark} />
      )}
      <Animated.View style={[styles.smartToast, { transform: [{ translateY: toastTranslateY }], zIndex: 999999 }]} pointerEvents="none">
         <Feather name={toastData.icon} size={18} color="#FFF" />
         <Text style={styles.smartToastText}>{toastData.message}</Text>
      </Animated.View>
      {flowState === 'idle' && (
        <LinearGradient colors={themeColors.background} style={styles.containerMain}>
          {isSelectionMode && <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.04)', zIndex: 1 }]} pointerEvents="none" />}
          <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 12, zIndex: 2 }]}>
            
            <View style={[styles.header, isSelectionMode && { opacity: 0.3 }]}>
              <Text style={[styles.headerTitle, { color: themeColors.textDark }]}>SafeGallery</Text>
              <TouchableOpacity onPress={() => setShowSortSheet(true)} style={[styles.iconBtn, { backgroundColor: themeColors.inputBg }]} disabled={isSelectionMode}>
                <Feather name="sliders" size={20} color={themeColors.textDark} />
                {sortType !== 'newest' && <View style={[styles.sortDot, { backgroundColor: sgAccent }]} />}
              </TouchableOpacity>
            </View>

            <View style={[styles.chipContainer, isSelectionMode && { opacity: 0.3 }]} pointerEvents={isSelectionMode ? 'none' : 'auto'}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
                {galleryTabs.map((item) => {
                  const isActive = activeTab === item;
                  return (
                    <TouchableOpacity key={item} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab(item); }} style={[styles.chip, isActive ? { backgroundColor: sgAccent } : { backgroundColor: isDark ? themeColors.inputBg : '#F1F2F6' }]}>
                      <Text style={[styles.chipText, isActive ? { color: '#FFFFFF', fontWeight: '700' } : { color: themeColors.textLight, fontWeight: '600' }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <View style={[{ paddingHorizontal: 20, paddingBottom: 10 }, isSelectionMode && { opacity: 0.3 }]}>
              <Text style={{ color: themeColors.textLight, fontSize: 11, fontWeight: '600' }}>
                {photos.length} photos • {photos.filter(p=>p.isFavorite).length} favorites • {collections.length} folders
              </Text>
            </View>
            <View style={{flex: 1}} {...dragSelectResponder.panHandlers}>
              <FlatList 
                data={displayPhotos} keyExtractor={(item) => item.id} 
                numColumns={3} columnWrapperStyle={styles.columnWrapper} contentContainerStyle={styles.gridContent} 
                showsVerticalScrollIndicator={false} scrollEnabled={!isSelectionMode} 
                onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16} removeClippedSubviews={Platform.OS === 'android'}
                maxToRenderPerBatch={10} windowSize={5} initialNumToRender={12}
                renderItem={({ item, index }) => (
                  <SelectableCard 
                    item={item} index={index} cardWidth={PHOTO_ITEM_WIDTH} isSelected={selectedPhotos.includes(item.id)} 
                    isSelectionMode={isSelectionMode} onPress={handleCardPress} onLongPress={handleCardLongPress}
                    collectionInfo={getCollectionInfo(item.collectionId)} isDark={isDark} activeTab={activeTab} sgAccent={sgAccent}
                  />
                )}
              />
            </View>
          </SafeAreaView>

          {!isSelectionMode && (
            <>
              {isFabMenuOpen && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
                   <BlurView intensity={isDark ? 40 : 20} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
                   <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={toggleFabMenu} />
                   <Animated.View style={[styles.fabMenuOptions, { transform: [{ translateY: fabMenuAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] }]} pointerEvents="box-none">
                      <TouchableOpacity style={styles.fabOptionRow} onPress={() => { toggleFabMenu(); setTimeout(() => setShowCreateCollection(true), 200); }} activeOpacity={0.7}>
                         <Text style={[styles.fabOptionText, {color: themeColors.textDark}]}>New Folder</Text>
                         <View style={[styles.fabOptionIcon, { backgroundColor: themeColors.card }]}><Feather name="folder-plus" size={20} color={sgAccent} /></View>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.fabOptionRow} onPress={movePhotosFromGallery} activeOpacity={0.7}>
                         <Text style={[styles.fabOptionText, {color: themeColors.textDark}]}>Move from Gallery</Text>
                         <View style={[styles.fabOptionIcon, { backgroundColor: themeColors.card }]}><Feather name="log-in" size={20} color={sgAccent} /></View>
                      </TouchableOpacity>
                   </Animated.View>
                </View>
              )}
              <View style={[styles.fabContainer, { shadowColor: sgAccent, zIndex: 51 }]}>
                <TouchableOpacity onPress={toggleFabMenu} activeOpacity={0.8}>
                  <Animated.View style={[styles.fab, { backgroundColor: sgAccent, transform: [{ rotate: fabMenuAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }]}><Feather name="plus" size={28} color="#FFFFFF" /></Animated.View>
                </TouchableOpacity>
              </View>
            </>
          )}

        </LinearGradient>
      )}
      
      {/* PROCESSING MODAL */}
      <Modal visible={isProcessingAction} transparent animationType="fade">
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }]}>
           <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
           <ActivityIndicator size="large" color={sgAccent} style={{ transform: [{scale: 1.5}], marginBottom: 24 }} />
           <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>Securing in Vault...</Text>
        </View>
      </Modal>

      {(!viewerVisible && showSortSheet) && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setShowSortSheet(false)}>
          <TouchableOpacity style={styles.modalOverlayBottom} activeOpacity={1} onPress={() => setShowSortSheet(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { backgroundColor: themeColors.card }]}>
              <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} /><Text style={[styles.sheetTitle, { color: themeColors.textDark }]}>Sort Images</Text>
              {['newest', 'oldest', 'favorites_first'].map((option) => (
                <TouchableOpacity key={option} style={styles.sortOptionRow} onPress={() => { setSortType(option); setShowSortSheet(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                   <Text style={[styles.sortOptionText, { color: themeColors.textDark }]}>{option === 'newest' ? 'Newest First 🗓️' : option === 'oldest' ? 'Oldest First 🕰️' : 'Favorites First ⭐'}</Text>
                   {sortType === option && <Feather name="check" size={20} color={sgAccent} />}
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
      {(!viewerVisible && showCreateCollection) && (
        <Modal visible={true} transparent animationType="slide" onRequestClose={() => setShowCreateCollection(false)}>
          <TouchableOpacity style={styles.modalOverlayBottom} activeOpacity={1} onPress={() => setShowCreateCollection(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.bottomSheet, { backgroundColor: themeColors.card }]}>
              <View style={[styles.sheetHandle, { backgroundColor: themeColors.separator }]} /><Text style={[styles.sheetTitle, { color: themeColors.textDark }]}>Create Collection Folder</Text>
              <View style={{ marginBottom: 30 }}><TextInput style={[styles.inputBox, {backgroundColor: themeColors.inputBg, color: themeColors.textDark}]} placeholder="Example: Private, IDs, Bills" placeholderTextColor={themeColors.textLight} value={newColName} onChangeText={setNewColName} /></View>
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: sgAccent }]} onPress={handleCreateCollection}><Text style={styles.applyBtnText}>Create Tab</Text></TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
      {(!viewerVisible && smartModal.visible) && (
        <Modal visible={true} transparent animationType="fade" onRequestClose={closeSmartModal}>{renderSmartModal()}</Modal>
      )}
      {viewerVisible && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={closeViewer}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: viewerOpacityAnim }]} />
          <View style={{ flex: 1 }}>
            <FlatList
              ref={viewerFlatListRef} data={displayPhotos} horizontal pagingEnabled scrollEnabled={!isZoomingState} 
              showsHorizontalScrollIndicator={false} initialScrollIndex={viewerIndex}
              getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
              onMomentumScrollEnd={(e) => {
                const newIdx = Math.round(e.nativeEvent.contentOffset.x / width);
                setViewerIndex(newIdx); setCurrentPhoto(displayPhotos[newIdx]);
              }}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={{ width, height: '100%' }}>
                   <PremiumZoomViewer uri={item.uri} onSingleTap={toggleImmersiveMode} onDismiss={closeViewer} onZoomChange={(zoomed) => setIsZoomingState(zoomed)} />
                </View>
              )}
            />
          </View>
          <Animated.View style={[styles.topGradientContainer, { paddingTop: insets.top, opacity: uiOpacityAnim, transform: [{ translateY: topTranslateY }] }]} pointerEvents={isUiVisible ? 'auto' : 'none'}>
             <LinearGradient colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
             <SafeAreaView style={styles.viewerHeader}>
                <TouchableOpacity onPress={closeViewer} style={styles.viewerIconBtn}><Feather name="arrow-left" size={24} color="#FFF" /></TouchableOpacity>
                <View style={{alignItems: 'center'}}><Text style={{color: '#FFF', fontSize: 14, fontWeight: '700'}}>Private View</Text><Text style={{color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2}}>{displayPhotos[viewerIndex] ? new Date(displayPhotos[viewerIndex].addedAt).toLocaleDateString() : ''}</Text></View>
                <View style={styles.viewerIconBtn} />
             </SafeAreaView>
          </Animated.View>
          <Animated.View style={[styles.bottomDockContainer, { bottom: insets.bottom + 20, opacity: uiOpacityAnim, transform: [{ translateY: bottomTranslateY }] }]} pointerEvents={isUiVisible ? 'auto' : 'none'}>
             <BlurView intensity={75} tint="dark" style={styles.bottomDock}>
                <TouchableOpacity onPress={() => setShowActionSheet(true)} style={styles.viewerActionBtn}><Feather name="chevron-up" size={24} color="#FFF" /><Text style={styles.viewerActionText}>Actions</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => triggerSmartAction('favorite')} style={styles.viewerActionBtn}><Feather name="star" size={24} color={displayPhotos[viewerIndex]?.isFavorite ? "#F59E0B" : "#FFF"} /><Text style={[styles.viewerActionText, displayPhotos[viewerIndex]?.isFavorite && {color: '#F59E0B'}]}>Favorite</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => triggerSmartAction('share')} style={styles.viewerActionBtn}><Feather name="share-2" size={24} color="#FFF" /><Text style={styles.viewerActionText}>Share</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => triggerSmartAction('delete')} style={styles.viewerActionBtn}><Feather name="trash-2" size={24} color="#EF4444" /><Text style={[styles.viewerActionText, {color: '#EF4444'}]}>Delete</Text></TouchableOpacity>
             </BlurView>
          </Animated.View>
          {showActionSheet && renderActionSheet()}
          {smartModal.visible && renderSmartModal()}
          <Animated.View style={[styles.smartToast, { transform: [{ translateY: toastTranslateY }], zIndex: 9999999, top: Platform.OS === 'android' ? insets.top + 20 : 60 }]} pointerEvents="none">
             <Feather name={toastData.icon} size={18} color="#FFF" /><Text style={styles.smartToastText}>{toastData.message}</Text>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerMain: { flex: 1 }, safeArea: { flex: 1 }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 64 },
  headerTitle: { fontSize: 32, fontWeight: '800' }, 
  sortDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 }, 
  iconBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  chipContainer: { paddingBottom: 6 }, chip: { height: 38, borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center', marginRight: 8 }, chipText: { fontSize: 14 },
  gridContent: { paddingHorizontal: GRID_PADDING, paddingBottom: 180, paddingTop: 8 },
  columnWrapper: { justifyContent: 'flex-start', gap: COLUMN_GAP },
  
  fabContainer: { position: 'absolute', bottom: 95, right: 24, shadowOffset: {width: 0, height: 10}, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }, 
  fab: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  fabMenuOptions: { position: 'absolute', bottom: 175, right: 24, alignItems: 'flex-end', gap: 16 },
  
  fabOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  fabOptionText: { fontSize: 16, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)' },
  fabOptionIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  modalOverlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }, 
  bottomSheet: { width: '100%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 }, 
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }, 
  sheetTitle: { fontSize: 18, fontWeight: '800' }, 
  inputBox: { height: 54, borderRadius: 16, paddingHorizontal: 16, fontSize: 16, fontWeight: '600' }, 
  applyBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, applyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  sortOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  sortOptionText: { fontSize: 16, fontWeight: '600' },
  topGradientContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: 130, zIndex: 11000 },
  viewerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  viewerIconBtn: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  bottomDockContainer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 11000 },
  bottomDock: { width: '92%', height: 78, borderRadius: 26, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', overflow: 'hidden', backgroundColor: 'rgba(20,20,20,0.5)' },
  viewerActionBtn: { alignItems: 'center', justifyContent: 'center', width: 62 },
  viewerActionText: { color: '#FFF', fontSize: 11, fontWeight: '600', marginTop: 6 },
  smartToast: { position: 'absolute', alignSelf: 'center', backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 99, shadowColor: '#000', shadowOffset: {width:0,height:8}, shadowOpacity: 0.15, shadowRadius: 12 },
  smartToastText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginLeft: 8 }
});
