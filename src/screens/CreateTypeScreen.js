// File: src/screens/CreateTypeScreen.js
import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  ScrollView, Platform, Alert, KeyboardAvoidingView, Pressable, ActivityIndicator, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage'; 

import { saveCustomType, getCustomTypes, logActivity } from '../utils/storage';
import { ThemeContext } from '../ThemeContext';

export default function CreateTypeScreen({ route, navigation }) {
  const { themeColors, isDark } = useContext(ThemeContext);
  
  // 🧩 Extract Edit Data (If editing an existing type)
  const { editTypeData } = route.params || {};

  const [typeName, setTypeName] = useState('');
  const [fields, setFields] = useState([
    { id: Date.now().toString(), label: '', placeholder: '' } 
  ]);
  
  const [focusedField, setFocusedField] = useState(null);
  const [saveState, setSaveState] = useState('idle');

  // 🧠 PRE-FILL DATA IF EDITING
  useEffect(() => {
    if (editTypeData) {
      setTypeName(editTypeData.name);
      if (editTypeData.fields && editTypeData.fields.length > 0) {
        setFields(editTypeData.fields.map(f => ({
          id: f.id,
          label: f.label,
          placeholder: f.placeholder
        })));
      }
    }
  }, [editTypeData]);

  // Validation: Must have a Title and at least one custom field with a label
  const isFormValid = typeName.trim().length > 0 && fields[0].label.trim().length > 0;

  const handleAddField = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFields([...fields, { id: Date.now().toString(), label: '', placeholder: '' }]);
  };

  const handleRemoveField = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFields(fields.filter(f => f.id !== id));
  };

  const updateField = (id, key, value) => {
    setFields(fields.map(f => f.id === id ? { ...f, [key]: value } : f));
  };

  // 🔥 SMART SAVE & AUTO-REDIRECT ENGINE
  const performSave = async () => {
    if (!isFormValid || saveState !== 'idle') return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaveState('loading');
    Keyboard.dismiss(); // Smart Keyboard dismiss

    try {
      const existingTypes = await getCustomTypes();
      
      // Check for duplicate names (unless editing the same type)
      const isDuplicate = existingTypes.some(t => 
        t.name.toLowerCase() === typeName.trim().toLowerCase() && 
        t.id !== (editTypeData ? editTypeData.id : '')
      );
      
      if (isDuplicate) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Already Exists", `A type named "${typeName.trim()}" already exists.`);
        setSaveState('idle');
        return;
      }

      // Clean empty fields and map them to the proper schema
      const validFields = fields.filter(f => f.label.trim() !== '').map((f, index) => ({
        id: `c${index + 1}`,
        label: f.label.trim(),
        placeholder: `Enter ${f.label.trim().toLowerCase()}`
      }));

      const customTypeObj = {
        id: editTypeData ? editTypeData.id : Date.now().toString(), 
        name: typeName.trim(),
        subtitle: 'Custom Form',
        icon: 'layers',
        isCustom: true, 
        fields: validFields
      };

      if (editTypeData) {
        // UPDATE EXISTING
        const updatedTypes = existingTypes.map(t => t.id === editTypeData.id ? customTypeObj : t);
        await AsyncStorage.setItem('CUSTOM_VAULT_TYPES', JSON.stringify(updatedTypes));
        
        await logActivity('Settings', 'CUSTOM_TYPE_EDITED', `Custom template '${typeName.trim()}' was updated.`, 'INFO');
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaveState('success');
        setTimeout(() => navigation.goBack(), 600); 

      } else {
        // CREATE NEW
        await saveCustomType(customTypeObj);
        
        await logActivity('Settings', 'CUSTOM_TYPE_CREATED', `New template '${typeName.trim()}' was created.`, 'INFO');

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaveState('success');
        
        // 🔥 SMART REDIRECT: Seedha naye Form par bhej do!
        setTimeout(() => {
          navigation.replace('Form', { 
            type: customTypeObj.name, 
            customFields: customTypeObj.fields 
          });
        }, 600);
      }

    } catch (error) {
      setSaveState('idle');
      Alert.alert('System Error', error.message || 'Something went wrong.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? themeColors.background : '#FFFFFF' }]}>
      
      {/* 🔝 STRICT HEADER FIX */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({pressed}) => [styles.backBtn, { backgroundColor: isDark ? themeColors.card : '#F3F4F8' }, pressed && {opacity: 0.7}]}>
          <Feather name="arrow-left" size={20} color={isDark ? themeColors.textDark : '#111827'} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? themeColors.textDark : '#111827' }]}>
          {editTypeData ? 'Edit Format' : 'Custom Form'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 🔥 SMART PADDING BOTTOM FOR KEYBOARD */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          <Text style={[styles.infoText, { color: themeColors.textLight }]}>
            {editTypeData 
              ? "Update your custom format structure. Changes will apply to future entries." 
              : "Step 1: Define your format structure.\nStep 2: You will be redirected to add your data."}
          </Text>
          
          <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>Basic Info</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: themeColors.textLight }]}>Template Name *</Text>
            <View style={[
              styles.inputWrapper, 
              { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6', borderColor: 'transparent' },
              focusedField === 'type' && { borderColor: themeColors.primary, borderWidth: 1.5, backgroundColor: isDark ? themeColors.card : '#FFFFFF' }
            ]}>
              <TextInput 
                style={[styles.input, { color: isDark ? themeColors.textDark : '#111827' }]} 
                placeholder="e.g. Crypto Wallet, Server Login" 
                placeholderTextColor="#9CA3AF" 
                value={typeName} 
                onChangeText={setTypeName} 
                autoCapitalize="words"
                onFocus={() => { Haptics.selectionAsync(); setFocusedField('type'); }} 
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: themeColors.primary, marginTop: 12 }]}>Data Fields</Text>
          
          {/* STATIC TITLE FIELD (Every entry needs a title) */}
          <View style={[styles.staticFieldBox, { backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6' }]}>
            <View style={[styles.iconBoxStatic, { backgroundColor: themeColors.primaryLight }]}>
              <Feather name="type" size={16} color={themeColors.primary} />
            </View>
            <Text style={[styles.fieldTextStatic, { color: themeColors.textLight }]}>Title (Default Field)</Text>
            <Feather name="lock" size={14} color={themeColors.textLight} style={{ opacity: 0.5 }} />
          </View>

          {/* DYNAMIC FIELDS */}
          {fields.map((field, index) => (
            <View key={field.id} style={styles.dynamicFieldBox}>
              <View style={[
                styles.inputWrapper, 
                { flex: 1, backgroundColor: isDark ? themeColors.inputBg : '#F3F4F6', borderColor: 'transparent' },
                focusedField === field.id && { borderColor: themeColors.primary, borderWidth: 1.5, backgroundColor: isDark ? themeColors.card : '#FFFFFF' }
              ]}>
                <TextInput 
                  style={[styles.input, { color: isDark ? themeColors.textDark : '#111827' }]} 
                  placeholder={`Custom Field ${index + 1} Name *`} 
                  placeholderTextColor="#9CA3AF" 
                  value={field.label} 
                  onChangeText={(text) => updateField(field.id, 'label', text)} 
                  autoCapitalize="words"
                  onFocus={() => { Haptics.selectionAsync(); setFocusedField(field.id); }} 
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              {fields.length > 1 && (
                <TouchableOpacity onPress={() => handleRemoveField(field.id)} style={styles.deleteBtn}>
                  <Feather name="trash-2" size={22} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* ADD BUTTON */}
          <TouchableOpacity activeOpacity={0.7} onPress={handleAddField} style={styles.addFieldBtn}>
            <Feather name="plus" size={18} color={themeColors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.addFieldText, { color: themeColors.primary }]}>Add Another Field</Text>
          </TouchableOpacity>

          {/* 🔥 STRICT SMART SAVE BUTTON */}
          <Pressable 
            disabled={!isFormValid || saveState !== 'idle'}
            activeOpacity={0.8} 
            onPress={performSave} 
            style={({ pressed }) => [styles.btnWrapper, pressed && { transform: [{ scale: 0.96 }] }]}
          >
            {isFormValid ? (
              <LinearGradient colors={saveState === 'success' ? ['#2ECC71', '#27AE60'] : themeColors.primaryGradient} style={styles.primaryBtn}>
                {saveState === 'loading' ? (
                  <ActivityIndicator color="#FFF" />
                ) : saveState === 'success' ? (
                  <Text style={styles.primaryBtnText}>{editTypeData ? '✔ Updated' : '✔ Created! Redirecting...'}</Text>
                ) : (
                  <Text style={styles.primaryBtnText}>{editTypeData ? 'Update Format' : 'Create & Add Data'}</Text>
                )}
              </LinearGradient>
            ) : (
              <View style={[styles.primaryBtn, { backgroundColor: isDark ? themeColors.inputBg : '#D1D5DB', elevation: 0, shadowOpacity: 0 }]}>
                <Text style={[styles.primaryBtnText, { color: isDark ? themeColors.textLight : '#FFFFFF' }]}>
                  {editTypeData ? 'Update Format' : 'Create & Add Data'}
                </Text>
              </View>
            )}
          </Pressable>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // 🔧 EXACT HEADER SPACING
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  
  // 🔥 MASSIVE BOTTOM PADDING FOR KEYBOARD
  scrollContent: { paddingHorizontal: 16, paddingBottom: 200, paddingTop: 10 },
  
  infoText: { fontSize: 13, lineHeight: 20, marginBottom: 24, fontWeight: '500' },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase' },
  
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1.5 },
  input: { flex: 1, fontSize: 15, fontWeight: '500', height: '100%' },

  staticFieldBox: { flexDirection: 'row', alignItems: 'center', height: 52, paddingHorizontal: 14, borderRadius: 14, marginBottom: 12 },
  iconBoxStatic: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  fieldTextStatic: { flex: 1, fontSize: 15, fontWeight: '600' },

  dynamicFieldBox: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  deleteBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'flex-end', marginLeft: 4 },
  
  addFieldBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 4, marginTop: 4 },
  addFieldText: { fontWeight: '700', fontSize: 15 },

  btnWrapper: { marginTop: 32 },
  primaryBtn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }
});
