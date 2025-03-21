// Fixed version of source/contexts/ThemeContext.js
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  loadCurrentTheme,
  saveThemeSelection,
  loadAvailableThemes
} from '../utils/theme.js';

// Create theme context
const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Load current theme settings from file
  const [currentTheme, setCurrentTheme] = useState(() => loadCurrentTheme());

  // Load all available themes
  const [availableThemes, setAvailableThemes] = useState(() => loadAvailableThemes());

  // Track if theme settings have been changed
  const [hasChanges, setHasChanges] = useState(false);

  // Track if theme is being updated, used to force re-renders
  const [themeUpdateCount, setThemeUpdateCount] = useState(0);

  // Use ref to avoid issues with stale state in callbacks
  const currentThemeRef = useRef(currentTheme);
  useEffect(() => {
    currentThemeRef.current = currentTheme;
  }, [currentTheme]);

  // Reload available themes
  const refreshThemes = useCallback(() => {
    const themes = loadAvailableThemes();
    setAvailableThemes(themes);
    return themes;
  }, []);

  // Set a new theme by ID and force immediate update
  const setTheme = useCallback((themeId) => {
    const themes = refreshThemes(); // Ensure we have the latest themes
    const newTheme = themes.find(theme => theme.id === themeId);

    if (!newTheme) {
      console.error(`Theme with ID ${themeId} not found`);
      return false;
    }

    setCurrentTheme(newTheme);
    setHasChanges(true);
    // Force re-render of all components using the theme
    setThemeUpdateCount(prev => prev + 1);
    return true;
  }, [refreshThemes]);

  // Update theme settings
  const updateThemeSettings = useCallback((newSettings) => {
    setCurrentTheme(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings
      }
    }));
    setHasChanges(true);
    // Force re-render of all components using the theme
    setThemeUpdateCount(prev => prev + 1);
  }, []);

  // Save current theme settings to disk without causing recursive updates
  const saveTheme = useCallback(() => {
    const success = saveThemeSelection(currentThemeRef.current.id, currentThemeRef.current.settings);
    if (success) {
      setHasChanges(false);
      // Update the theme update count to force a re-render, but don't call setTheme again
      setThemeUpdateCount(prev => prev + 1);
    }
    return success;
  }, []);

  // Get color from current theme directly
  const getColor = useCallback((colorName) => {
    return currentThemeRef.current.colors[colorName];
  }, []);

  // Get setting value from current theme
  const getSetting = useCallback((settingName) => {
    return currentThemeRef.current.settings[settingName];
  }, []);

  // Provide theme context
  const contextValue = {
    currentTheme,
    setCurrentTheme,
    availableThemes,
    setTheme,
    updateThemeSettings,
    saveTheme,
    hasChanges,
    refreshThemes,
    getColor,
    getSetting,
    themeUpdateCount
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
