// source/utils/keymap.js
import fs from 'fs';
import path from 'path';
import os from 'os';

// Default keymap configuration
const DEFAULT_KEYMAP = {
  global: {
    exit: { key: 'q', ctrl: true, description: 'Exit application' },
    back: { key: 'escape', description: 'Go back/Cancel' },
    help: { key: 'h', ctrl: true, description: 'Show help' },
  },
  welcome: {
    startChat: { key: 'c', description: 'Start chat' },
    startExplorer: { key: 'e', description: 'Start file explorer' },
    startOptions: { key: 'o', description: 'Open options' },
  },
  fileExplorer: {
    navigateUp: { key: 'upArrow', description: 'Navigate up' },
    navigateDown: { key: 'downArrow', description: 'Navigate down' },
    pageUp: { key: 'pageUp', description: 'Page up' },
    pageDown: { key: 'pageDown', description: 'Page down' },
    openDir: { key: 'return', description: 'Open directory' },
    parentDir: { key: 'h', description: 'Go to parent directory' },
    goBack: { key: 'b', description: 'Go back to previous directory' },
    previewScrollUp: { key: 'k', description: 'Scroll preview up' },
    previewScrollDown: { key: 'j', description: 'Scroll preview down' },
    openFile: { key: 'o', description: 'Open file in system default app' },
    pickFile: { key: 'p', description: 'Pick file (in browse mode)' },
    toggleSelection: { key: 'space', description: 'Toggle selection (in multi-select mode)' },
    space: { key: 'space', description: 'Toggle selection (in multi-select mode)' },
    refresh: { key: 'r', description: 'Refresh file list' },
    delete: { key: 'd', description: 'Delete file' },
    download: { key: 'D', shift: true, description: 'Download file' },
    uploadFile: { key: 'u', description: 'Upload file' }
  },
  chat: {
    switchPanel: { key: 'tab', description: 'Switch between panels' },
    focusInput: { key: 'return', description: 'Focus input/submit' },
    navigateUp: { key: 'upArrow', description: 'Navigate up' },
    navigateDown: { key: 'downArrow', description: 'Navigate down' },
    pageUp: { key: 'pageUp', description: 'Page up through messages' },
    pageDown: { key: 'pageDown', description: 'Page down through messages' },
    addRoom: { key: 'a', description: 'Add chat room' },
    shareFile: { key: 's', description: 'Share file' },
    scrollToTop: { key: 'g', description: 'Scroll to oldest messages' },
    scrollToBottom: { key: 'G', shift: true, description: 'Scroll to newest messages' },
    clearRoom: { key: 'c', ctrl: true, description: 'Clear current room' },
    leaveRoom: { key: 'l', description: 'Leave current room' },
    joinRoom: { key: 'j', description: 'Join a room' },
    directMessage: { key: 'd', description: 'Direct message user' },
    toggleEmoji: { key: 'e', description: 'Toggle emoji picker' },
    formatBold: { key: 'b', ctrl: true, description: 'Format text as bold' },
    formatItalic: { key: 'i', ctrl: true, description: 'Format text as italic' },
    formatCode: { key: 'k', ctrl: true, description: 'Format text as code' },
    // Updated key binding for file viewing
    viewFiles: { key: 'f', description: 'View shared files' }
  },
  options: {
    nextTab: { key: 'rightArrow', description: 'Next tab' },
    previousTab: { key: 'leftArrow', description: 'Previous tab' },
    navigateUp: { key: 'upArrow', description: 'Navigate up' },
    navigateDown: { key: 'downArrow', description: 'Navigate down' },
    toggleOption: { key: 't', description: 'Toggle option' },
    back: { key: 'escape', description: 'Go back' },
    save: { key: 's', ctrl: true, description: 'Save settings' },
    reset: { key: 'r', ctrl: true, description: 'Reset to defaults' },
    refreshThemes: { key: 'r', description: 'Refresh themes' },
    createExampleTheme: { key: 'e', description: 'Create example theme' },
    exportSettings: { key: 'x', description: 'Export settings' },
    importSettings: { key: 'i', description: 'Import settings' },
  },
  // New keymap for room files view
  roomFiles: {
    navigateUp: { key: 'upArrow', description: 'Navigate up' },
    navigateDown: { key: 'downArrow', description: 'Navigate down' },
    pageUp: { key: 'pageUp', description: 'Page up' },
    pageDown: { key: 'pageDown', description: 'Page down' },
    back: { key: 'escape', description: 'Return to chat' },
    previewScrollUp: { key: 'k', description: 'Scroll preview up' },
    previewScrollDown: { key: 'j', description: 'Scroll preview down' },
    download: { key: 'd', description: 'Download file' },
    uploadFile: { key: 'u', description: 'Upload file' },
    delete: { key: 'x', description: 'Delete file' },
    refresh: { key: 'r', description: 'Refresh files' }
  }
};// Config file path
const CONFIG_FILENAME = '.config/.hyperchatters/keymap.json';
const CONFIG_PATH = path.join(os.homedir(), CONFIG_FILENAME);

/**
 * Load custom keymap from config file and merge with defaults
 * @returns {Object} Merged keymap configuration
 */
export function loadKeymap() {
  try {
    // Check if config file exists
    if (fs.existsSync(CONFIG_PATH)) {
      const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
      const userConfig = JSON.parse(configData);

      // Deep merge with defaults
      return deepMerge(DEFAULT_KEYMAP, userConfig);
    }
  } catch (error) {
    console.error(`Error loading keymap: ${error.message}`);
  }

  // Return defaults if anything fails
  return DEFAULT_KEYMAP;
}

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge in
 * @returns {Object} - Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        output[key] = source[key];
      }
    });
  }

  return output;
}

/**
 * Check if value is an object
 * @param {*} item - Value to check
 * @returns {boolean} - True if object
 */
function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Check if a key event matches a defined key binding
 * @param {Object} keyEvent - Key event from useInput
 * @param {Object} binding - Key binding definition
 * @returns {boolean} - True if the event matches the binding
 */
export function matchesKeyBinding(keyEvent, binding) {
  // If no binding or key defined, no match
  if (!binding || !binding.key) return false;

  // First check modifiers - these must match regardless of key
  if (binding.ctrl && !keyEvent.ctrl) return false;
  if (binding.shift && !keyEvent.shift) return false;
  if (binding.alt && !keyEvent.alt) return false;

  // Special handling for space - can be represented as "space" or " "
  if (binding.key === "space" && keyEvent.space) return true;
  if (binding.key === " " && keyEvent.space) return true;

  // Check for other special keys
  const specialKeyMap = {
    'return': 'return',
    'enter': 'return',
    'escape': 'escape',
    'esc': 'escape',
    'backspace': 'backspace',
    'delete': 'delete',
    'tab': 'tab',
    'up': 'upArrow',
    'upArrow': 'upArrow',
    'down': 'downArrow',
    'downArrow': 'downArrow',
    'left': 'leftArrow',
    'leftArrow': 'leftArrow',
    'right': 'rightArrow',
    'rightArrow': 'rightArrow',
    'pageUp': 'pageUp',
    'pageDown': 'pageDown',
    'home': 'home',
    'end': 'end'
  };

  if (binding.key in specialKeyMap) {
    return keyEvent[specialKeyMap[binding.key]] === true;
  }

  // For single character keys
  if (typeof binding.key === 'string' && binding.key.length === 1) {
    // For shift+letter combinations, input will be uppercase
    if (binding.shift && /[a-z]/.test(binding.key)) {
      return keyEvent.input === binding.key.toUpperCase();
    }
    return keyEvent.input === binding.key;
  }

  // For any other keys
  return false;
}

/**
 * Get a human-readable description of a key binding
 * @param {Object} binding - Key binding definition
 * @returns {string} - Human-readable key combination
 */
export function getBindingDescription(binding) {
  const modifiers = [];
  if (binding.ctrl) modifiers.push('Ctrl');
  if (binding.shift) modifiers.push('Shift');
  if (binding.alt) modifiers.push('Alt');

  let keyName = binding.key;

  // Make key names more user-friendly
  const keyNameMap = {
    return: 'Enter',
    escape: 'Esc',
    upArrow: '↑',
    downArrow: '↓',
    leftArrow: '←',
    rightArrow: '→',
    pageUp: 'PgUp',
    pageDown: 'PgDn',
    space: 'Space',
  };

  if (keyNameMap[keyName]) {
    keyName = keyNameMap[keyName];
  }

  // Capitalize single letter keys when using Shift
  if (binding.shift && keyName.length === 1) {
    keyName = keyName.toUpperCase();
  }

  if (modifiers.length > 0) {
    return `${modifiers.join('+')}+${keyName}`;
  }

  return keyName;
}

/**
 * Get a mapping of action names to their key bindings for a specific context
 * @param {string} context - Context name (e.g., 'global', 'fileExplorer')
 * @param {Object} keymap - Complete keymap configuration
 * @returns {Object} - Mapping of action names to bindings
 */
export function getBindingsForContext(context, keymap = null) {
  const fullKeymap = keymap || loadKeymap();

  // Combine global bindings with context-specific ones
  const contextBindings = fullKeymap[context] || {};
  return { ...fullKeymap.global, ...contextBindings };
}

/**
 * Create an example configuration file if it doesn't exist
 */
export function createExampleConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      // Create a simple example with some customized keys
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_KEYMAP, null, 2));
    }
  } catch (error) {
    console.error(`Failed to create example config: ${error.message}`);
  }
}

// Export the default keymap as well
export { DEFAULT_KEYMAP };
