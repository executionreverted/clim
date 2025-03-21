// source/utils/theme.js - Simplified version
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logError } from './errorHandler.js';

// Configuration
const THEMES_DIR = path.join(os.homedir(), '.config', '.hyperchatters', 'themes');
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
  light: {
    id: 'light',
    name: 'Light',
    description: 'Optimized for light terminals',
    colors: {
      primaryColor: 'blue',
      secondaryColor: 'magenta',
      textColor: 'black',
      mutedTextColor: 'gray',
      errorColor: 'red',
      successColor: 'green',
      warningColor: 'yellow',
      infoColor: 'blue',
      borderColor: 'gray',
      activeBorderColor: 'blue'
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true
    }
  },
  monochrome: {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Black and white only',
    colors: {
      primaryColor: 'white',
      secondaryColor: 'white',
      textColor: 'white',
      mutedTextColor: 'gray',
      errorColor: 'white',
      successColor: 'white',
      warningColor: 'white',
      infoColor: 'white',
      borderColor: 'gray',
      activeBorderColor: 'white'
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: false,
      showBorders: true,
      boldText: true
    }
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon colors with futuristic feel',
    colors: {
      primaryColor: 'magenta',
      secondaryColor: 'cyan',
      textColor: '#00ffff', // Bright cyan
      mutedTextColor: '#ff00ff', // Bright magenta
      errorColor: '#ff0000', // Bright red
      successColor: '#00ff00', // Bright green
      warningColor: '#ffff00', // Bright yellow
      infoColor: '#00ffff', // Bright cyan
      borderColor: '#7700ff', // Purple
      activeBorderColor: '#ff00ff' // Magenta
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true
    }
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix',
    description: 'Green matrix-like color scheme',
    colors: {
      primaryColor: '#00ff00', // Bright green
      secondaryColor: '#005500', // Darker green
      textColor: '#00ff00', // Bright green
      mutedTextColor: '#009900', // Medium green
      errorColor: '#ff0000', // Red
      successColor: '#00ff00', // Bright green
      warningColor: '#ffff00', // Yellow
      infoColor: '#00ffcc', // Turquoise
      borderColor: '#009900', // Medium green
      activeBorderColor: '#00ff00' // Bright green
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
    // Get the base theme
    const baseTheme = DEFAULT_THEMES[themeId] || DEFAULT_THEMES.default;

    // Merge with custom settings
    const themeData = {
      ...baseTheme,
      settings: {
        ...baseTheme.settings,
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
};

/**
 * Load all available themes from the themes directory
 * @returns {Array} - Array of available themes
 */
export function loadAvailableThemes() {
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
};

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
};

/**
 * Create an example theme file
 * @param {string} themeName - Name of theme to create an example for
 * @returns {boolean} - Success status
 */
export function createExampleTheme(themeName = 'custom') {
  if (!ensureThemesDirectory()) return false;

  try {
    const examplePath = path.join(THEMES_DIR, `${themeName.toLowerCase()}.json`);

    // Skip if file already exists
    if (fs.existsSync(examplePath)) return true;

    // Create example theme based on default
    const exampleTheme = {
      ...DEFAULT_THEMES.default,
      id: themeName.toLowerCase(),
      name: themeName,
      description: `Custom ${themeName} theme`
    };

    fs.writeFileSync(examplePath, JSON.stringify(exampleTheme, null, 2));
    return true;
  } catch (err) {
    logError(err, 'theme-create-example');
    return false;
  }
};

/**
 * Create theme system with default files
 */
export function createThemeSystem() {
  // Create examples for all default themes
  Object.keys(DEFAULT_THEMES).forEach(themeId => {
    createExampleTheme(themeId);
  });

  // Create default theme if none exists
  if (!fs.existsSync(DEFAULT_THEME_PATH)) {
    saveThemeSelection('default');
  }
};

// Initialize theme system
createThemeSystem();

export default {
  DEFAULT_THEMES,
  loadCurrentTheme,
  loadAvailableThemes,
  saveThemeSelection,
  createExampleTheme
};
