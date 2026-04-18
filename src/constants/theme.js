// File: src/constants/theme.js

export const COLORS = {
  primary: '#6C63FF',
  primaryLight: '#8A84FF',
  background: '#F6F7FB',
  cardBg: '#FFFFFF',
  textDark: '#1E1E2D',
  textLight: '#8A8FA3',
  danger: '#FF4D4D',
  searchBg: '#EEF0F6',
  transparent: 'transparent',
};

export const SIZES = {
  // Typography
  heading: 24, 
  cardTitle: 16,
  subtitle: 13,
  
  // Spacing System
  padding: 16,
  cardPadding: 14,
  cardGap: 12,
  sectionGap: 20,
  
  // Border Radius
  cardRadius: 20,
  inputRadius: 14,
  fabRadius: 30, // 60x60 circle ka half
  iconBoxRadius: 12,
};

export const SHADOWS = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  heavy: { // FAB button ke liye heavy shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 6,
  }
};
