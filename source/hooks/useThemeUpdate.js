// source/hooks/useThemeUpdate.js
import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext.js';

/**
 * Custom hook to ensure a component re-renders when theme changes
 * @returns {Object} The current theme
 */
export function useThemeUpdate() {
  const { currentTheme, themeUpdateCount } = useTheme();
  const [renderKey, setRenderKey] = useState(0);

  // Force re-render when themeUpdateCount changes
  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [themeUpdateCount, currentTheme.id]);

  return currentTheme;
}

export default useThemeUpdate;
