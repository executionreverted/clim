// source/components/Options/GeneralTab.js
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import useKeymap from '../../hooks/useKeymap.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
// Configuration file path
const CONFIG_PATH = path.join(os.homedir(), '.hyperchatters', 'config.json');

const GeneralTab = ({ width, height }) => {

  const currentTheme = useThemeUpdate();
  // General settings with default values
  const [settings, setSettings] = useState({
    showNotifications: true,
    autoSaveChats: true,
    compactMode: false,
    debugMode: false,
    checkUpdates: true,
    enableAnimations: true,
    confirmBeforeExit: true,
    logLevel: 'info'
  });

  // Track the selected option
  const [selectedOption, setSelectedOption] = useState(0);
  const settingKeys = Object.keys(settings);

  // Track if settings have been changed
  const [hasChanges, setHasChanges] = useState(false);
  const [messageText, setMessageText] = useState('');

  // Load settings from file on first render
  useEffect(() => {
    loadSettings();
  }, []);

  // Load settings from file
  const loadSettings = () => {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
        const loadedSettings = JSON.parse(configData);
        setSettings(prev => ({ ...prev, ...loadedSettings }));
      }
    } catch (error) {
      showMessage(`Error loading settings: ${error.message}`);
    }
  };

  // Save settings to file
  const saveSettings = () => {
    try {
      // Ensure directory exists
      const configDir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      // Write settings to file
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(settings, null, 2));
      setHasChanges(false);
      showMessage('Settings saved successfully!');
      return true;
    } catch (error) {
      showMessage(`Error saving settings: ${error.message}`);
      return false;
    }
  };

  // Display a temporary message
  const showMessage = (message, duration = 3000) => {
    setMessageText(message);
    setTimeout(() => setMessageText(''), duration);
  };

  // Define handlers for this tab
  const handlers = {
    navigateUp: () => {
      setSelectedOption((prev) => Math.max(0, prev - 1));
    },
    navigateDown: () => {
      setSelectedOption((prev) => Math.min(settingKeys.length, prev + 1));
    },
    toggleOption: () => {
      // Check if we're on the Save option (last option)
      if (selectedOption === settingKeys.length) {
        saveSettings();
        return;
      }

      // Toggle the selected setting
      const key = settingKeys[selectedOption];
      setSettings(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
      setHasChanges(true);
    }
  };

  // Use the keymap hook
  useKeymap('options', handlers);

  // Use theme colors
  const primaryColor = currentTheme.colors.primary;
  const successColor = currentTheme.colors.success;
  const errorColor = currentTheme.colors.error;

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box marginBottom={1}>
        <Text bold underline color={primaryColor}>General Settings</Text>
      </Box>

      {/* Setting options */}
      {settingKeys.map((key, index) => {
        const isSelected = index === selectedOption;
        const value = settings[key];

        // Format the key for display (camelCase to Title Case)
        const displayName = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());

        return (
          <Box key={key} marginY={1}>
            <Text>
              {isSelected ? '>' : ' '} {displayName}:
              <Text
                color={value ? successColor : errorColor}
                bold={isSelected}
              >
                {' '}{value ? 'Enabled' : 'Disabled'}
              </Text>
            </Text>
          </Box>
        );
      })}

      {/* Save option */}
      <Box marginY={1}>
        <Text>
          {selectedOption === settingKeys.length ? '>' : ' '}
          <Text
            color={hasChanges ? currentTheme.colors.warning : successColor}
            bold={selectedOption === settingKeys.length}
          >
            Save Settings {hasChanges ? '(unsaved changes)' : ''}
          </Text>
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text color="gray" italic>
          Press 'T' to toggle the selected option or save settings
        </Text>
      </Box>

      {/* Message display */}
      {messageText && (
        <Box
          marginTop={1}
          padding={1}
          borderStyle="round"
          borderColor="yellow"
        >
          <Text color="yellow">{messageText}</Text>
        </Box>
      )}
    </Box>
  );
};

export default GeneralTab;
