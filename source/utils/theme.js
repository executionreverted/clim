// source/utils/theme.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logError } from './errorHandler.js';

// Configuration
const THEMES_DIR = path.join(os.homedir(), '.hyperchatters', 'themes');
const DEFAULT_THEME_PATH = path.join(THEMES_DIR, 'current.json');

// Default theme configuration
export const DEFAULT_THEMES = {
  default: {
    id: 'default',
    name: 'Default',
    description: 'Standard terminal colors',
    colors: {
      primary: 'green',
      secondary: 'blue',
      tertiary: 'cyan',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'blue',
      text: {
        primary: 'white',
        secondary: 'gray',
        muted: 'dimGray'
      },
      border: {
        active: 'green',
        inactive: 'gray',
        focus: 'blue'
      },
      background: {
        primary: undefined, // Use terminal default
        secondary: undefined,
        highlight: undefined
      }
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true,
      useGradients: true
    }
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    description: 'Optimized for dark terminals',
    colors: {
      primary: 'cyan',
      secondary: 'blue',
      tertiary: 'magenta',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'blue',
      text: {
        primary: 'white',
        secondary: 'gray',
        muted: 'dimGray'
      },
      border: {
        active: 'cyan',
        inactive: 'gray',
        focus: 'blue'
      },
      background: {
        primary: undefined,
        secondary: undefined,
        highlight: undefined
      }
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true,
      useGradients: true
    }
  },
  light: {
    id: 'light',
    name: 'Light',
    description: 'Optimized for light terminals',
    colors: {
      primary: 'blue',
      secondary: 'magenta',
      tertiary: 'cyan',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'blue',
      text: {
        primary: 'black',
        secondary: 'gray',
        muted: 'dimGray'
      },
      border: {
        active: 'blue',
        inactive: 'gray',
        focus: 'cyan'
      },
      background: {
        primary: undefined,
        secondary: undefined,
        highlight: undefined
      }
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true,
      useGradients: false
    }
  },
  monochrome: {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Black and white only',
    colors: {
      primary: 'white',
      secondary: 'white',
      tertiary: 'white',
      success: 'white',
      warning: 'white',
      error: 'white',
      info: 'white',
      text: {
        primary: 'white',
        secondary: 'gray',
        muted: 'dimGray'
      },
      border: {
        active: 'white',
        inactive: 'gray',
        focus: 'white'
      },
      background: {
        primary: undefined,
        secondary: undefined,
        highlight: undefined
      }
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: false,
      showBorders: true,
      boldText: true,
      useGradients: false
    }
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon colors on dark background',
    colors: {
      primary: 'magenta',
      secondary: 'cyan',
      tertiary: 'yellow',
      success: '#00ff00', // Bright neon green
      warning: '#ff00ff', // Neon pink
      error: '#ff0000', // Bright red
      info: '#00ffff', // Bright cyan
      text: {
        primary: '#00ffff', // Cyan
        secondary: '#ff00ff', // Magenta
        muted: '#7700ff' // Purple
      },
      border: {
        active: '#00ffff', // Cyan
        inactive: '#7700ff', // Purple
        focus: '#ff00ff' // Magenta
      },
      background: {
        primary: undefined,
        secondary: undefined,
        highlight: undefined
      }
    },
    settings: {
      showHelpBoxes: true,
      useColoredIcons: true,
      showBorders: true,
      boldText: true,
      useGradients: true
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
}

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
}

/**
 * Create theme context provider and hook
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
}

/**
 * Apply theme styles to a component
 * @param {string} elementType - Type of UI element
 * @param {string} state - Element state (active, inactive, etc.)
 * @param {Object} theme - Theme object
 * @returns {Object} - Style object for the element
 */
export function getThemeStyles(elementType, state = 'default', theme = null) {
  const currentTheme = theme || loadCurrentTheme();
  const styles = {};

  switch (elementType) {
    case 'border':
      styles.borderColor = currentTheme.colors.border[state] || currentTheme.colors.border.inactive;
      styles.borderStyle = currentTheme.settings.showBorders ? 'single' : 'none';
      break;
    case 'text':
      styles.color = currentTheme.colors.text[state] || currentTheme.colors.text.primary;
      styles.bold = state === 'heading' ? currentTheme.settings.boldText : false;
      break;
    case 'button':
      styles.color = state === 'active' ? currentTheme.colors.primary : currentTheme.colors.text.secondary;
      styles.bold = state === 'active';
      break;
    case 'highlight':
      styles.color = currentTheme.colors[state] || currentTheme.colors.primary;
      styles.bold = currentTheme.settings.boldText;
      break;
    default:
      styles.color = currentTheme.colors.text.primary;
  }

  return styles;
}

// Initialize theme system
createThemeSystem();

export default {
  DEFAULT_THEMES,
  loadCurrentTheme,
  loadAvailableThemes,
  saveThemeSelection,
  createExampleTheme,
  getThemeStyles
};
