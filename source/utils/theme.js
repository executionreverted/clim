// Fix for source/utils/theme.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logError } from './errorHandler.js';

// Fix the configuration paths to be consistent
const CONFIG_DIR = path.join(os.homedir(), '.config/.hyperchatters');
const THEMES_DIR = path.join(CONFIG_DIR, 'themes');
const DEFAULT_THEME_PATH = path.join(THEMES_DIR, 'current.json');

// Default theme configuration with simplified color scheme
export const DEFAULT_THEMES = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Standard terminal colors',
    colors: {
      primaryColor: 'green',
      secondaryColor: 'blue',
      textColor: 'white',
      mutedTextColor: 'gray',
      errorColor: 'red',
      successColor: 'green',
      warningColor: 'yellow',
      infoColor: 'cyan',
      borderColor: 'gray',
      activeBorderColor: 'green'
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true
    }
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Optimized for dark terminals',
    colors: {
      primaryColor: 'cyan',
      secondaryColor: 'blue',
      textColor: 'white',
      mutedTextColor: 'gray',
      errorColor: 'red',
      successColor: 'green',
      warningColor: 'yellow',
      infoColor: 'cyan',
      borderColor: 'gray',
      activeBorderColor: 'cyan'
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true
    }
  },
  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin',
    description: 'Soothing pastel theme',
    colors: {
      primaryColor: '#f5c2e7', // Pink
      secondaryColor: '#cba6f7', // Lavender
      textColor: '#cdd6f4', // Text
      mutedTextColor: '#bac2de', // Subtext1
      errorColor: '#f38ba8', // Red
      successColor: '#a6e3a1', // Green
      warningColor: '#fab387', // Peach
      infoColor: '#89dceb', // Sky
      borderColor: '#a6adc8', // Overlay0
      activeBorderColor: '#f5c2e7' // Pink
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true
    }
  }
  // Other theme definitions remain the same...
};

/**
 * Ensures the themes directory exists
 */
const ensureThemesDirectory = () => {
  try {
    if (!fs.existsSync(THEMES_DIR)) {
      fs.mkdirSync(THEMES_DIR, { recursive: true });
    }
    return true;
  } catch (err) {
    logError(err, 'theme-directory-creation');
    return false;
  }
};

/**
 * Save current theme selection to disk
 * @param {string} themeId - ID of the selected theme
 * @param {Object} settings - Custom settings to override theme defaults
 * @returns {boolean} - Success status
 */
export function saveThemeSelection(themeId, settings = {}) {
  if (!ensureThemesDirectory()) return false;

  try {
    // First, find the theme from available themes
    const availableThemes = loadAvailableThemes();
    const themeToSave = availableThemes.find(theme => theme.id === themeId);

    if (!themeToSave) {
      console.error(`Theme with ID ${themeId} not found`);
      return false;
    }

    // Merge with custom settings
    const themeData = {
      ...themeToSave,
      settings: {
        ...themeToSave.settings,
        ...settings
      }
    };

    // Write to disk
    fs.writeFileSync(DEFAULT_THEME_PATH, JSON.stringify(themeData, null, 2));
    return true;
  } catch (err) {
    logError(err, 'theme-save');
    return false;
  }
}

/**
 * Load all available themes from the themes directory
 * @returns {Array} - Array of available themes
 */
export function loadAvailableThemes() {
  // Start with default themes
  const themes = Object.values(DEFAULT_THEMES);

  // Create themes directory if it doesn't exist
  if (!ensureThemesDirectory()) return themes;

  try {
    // Read custom themes from directory
    const files = fs.readdirSync(THEMES_DIR);

    for (const file of files) {
      if (file === 'current.json') continue; // Skip current theme file

      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(THEMES_DIR, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const theme = JSON.parse(content);

          // Validate theme has required properties
          if (theme.id && theme.name && theme.colors) {
            // Check if theme already exists in list (by ID)
            const existingIndex = themes.findIndex(t => t.id === theme.id);
            if (existingIndex >= 0) {
              // Replace existing theme
              themes[existingIndex] = theme;
            } else {
              // Add new theme
              themes.push(theme);
            }
          }
        } catch (err) {
          logError(err, `theme-parse-${file}`);
        }
      }
    }
  } catch (err) {
    logError(err, 'theme-directory-read');
  }

  return themes;
}

/**
 * Load the current theme settings
 * @returns {Object} - Current theme object
 */
export function loadCurrentTheme() {
  try {
    if (fs.existsSync(DEFAULT_THEME_PATH)) {
      const content = fs.readFileSync(DEFAULT_THEME_PATH, 'utf8');
      const theme = JSON.parse(content);
      return theme;
    }
  } catch (err) {
    logError(err, 'theme-load-current');
  }

  // Return default theme if no saved theme or error
  return DEFAULT_THEMES.default;
}

/**
 * Create the theme system with default files
 */
export function createThemeSystem() {
  // Create themes directory
  ensureThemesDirectory();

  // Create default theme if none exists
  if (!fs.existsSync(DEFAULT_THEME_PATH)) {
    saveThemeSelection('default');
  }
}

export default {
  DEFAULT_THEMES,
  loadCurrentTheme,
  loadAvailableThemes,
  saveThemeSelection,
  createExampleTheme: (themeName) => { } // Stub for backward compatibility
};
