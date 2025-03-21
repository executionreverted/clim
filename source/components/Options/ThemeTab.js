// source/components/Options/ThemeTab.js
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import useKeymap from '../../hooks/useKeymap.js';

// Available themes
const themes = [
  { id: 'default', name: 'Default', description: 'Standard terminal colors' },
  { id: 'dark', name: 'Dark', description: 'Optimized for dark terminals' },
  { id: 'light', name: 'Light', description: 'Optimized for light terminals' },
  { id: 'monochrome', name: 'Monochrome', description: 'Black and white only' },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon colors on dark background' },
];

// Theme settings
const ThemeTab = ({ setIsInNested, width, height }) => {
  // Theme settings with default values
  const [settings, setSettings] = useState({
    theme: 'default',
    showHelpBoxes: true,
    useColoredIcons: true,
    showBorders: true,
    boldText: true,
  });

  // Track selected option and current mode
  const [selectedOption, setSelectedOption] = useState(0);
  const [mode, setMode] = useState('settings'); // 'settings' or 'themes'

  // Settings keys for navigation
  const settingKeys = ['theme', 'showHelpBoxes', 'useColoredIcons', 'showBorders', 'boldText'];

  // Set up a direct handler for escape key in theme selection mode
  // This needs to run before other key handlers to prevent bubbling
  useInput((input, key) => {
    if (key.escape && mode === 'themes') {
      setMode('settings');
      setSelectedOption(0);
      // This effectively cancels theme selection
      return;
    }
  }, { isActive: true });

  // Define handlers for theme tab
  const handlers = {
    navigateUp: () => {
      if (mode === 'settings') {
        setSelectedOption((prev) => Math.max(0, prev - 1));
      } else if (mode === 'themes') {
        setSelectedOption((prev) => Math.max(0, prev - 1));
      }
    },
    navigateDown: () => {
      if (mode === 'settings') {
        setSelectedOption((prev) => Math.min(settingKeys.length - 1, prev + 1));
      } else if (mode === 'themes') {
        setSelectedOption((prev) => Math.min(themes.length - 1, prev + 1));
      }
    },
    toggleOption: () => {
      if (mode === 'settings') {
        const key = settingKeys[selectedOption];

        if (key === 'theme') {
          setIsInNested(true)
          // Switch to theme selection mode
          setMode('themes');
          setSelectedOption(themes.findIndex(t => t.id === settings.theme) || 0);
        } else {
          // Toggle boolean settings
          setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
          }));
        }
      } else if (mode === 'themes') {
        // Select theme and go back to settings
        setSettings(prev => ({
          ...prev,
          theme: themes[selectedOption].id
        }));
        setIsInNested(false)
        setMode('settings');
        setSelectedOption(0); // Back to first settings option
      }
    },
    back: () => {
      if (mode === 'themes') {
        // Go back to settings mode without changing theme
        setMode('settings');
        setSelectedOption(0);
      }
      // For regular settings mode, let the parent handle back
      return false;
    }
  };

  // Use the keymap hook
  useKeymap('options', handlers);

  // Render themes selection view
  if (mode === 'themes') {
    return (
      <Box flexDirection="column" width={width} height={height}>
        <Box marginBottom={1}>
          <Text bold underline>Select Theme</Text>
        </Box>

        {themes.map((theme, index) => {
          const isSelected = index === selectedOption;
          const isActive = theme.id === settings.theme;

          return (
            <Box key={theme.id} marginY={1}>
              <Text>
                {isSelected ? '>' : ' '}
                <Text bold={isSelected || isActive}>
                  {theme.name}
                </Text>
                {isActive ? ' (active)' : ''}
                <Text color="gray"> - {theme.description}</Text>
              </Text>
            </Box>
          );
        })}

        <Box marginTop={2}>
          <Text color="gray" italic>
            Press 'T' to select a theme or 'Escape' to cancel
          </Text>
        </Box>
      </Box>
    );
  }

  // Render settings view
  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box marginBottom={1}>
        <Text bold underline>Theme Settings</Text>
      </Box>

      {/* Theme selection option */}
      <Box marginY={1}>
        <Text>
          {selectedOption === 0 ? '>' : ' '} Theme:
          <Text color="cyan" bold={selectedOption === 0}>
            {' '}{themes.find(t => t.id === settings.theme)?.name || 'Default'}
          </Text>
          <Text color="gray"> (Press T to change)</Text>
        </Text>
      </Box>

      {/* Boolean settings */}
      {settingKeys.slice(1).map((key, index) => {
        const actualIndex = index + 1;
        const isSelected = actualIndex === selectedOption;
        const value = settings[key];

        // Format the key for display
        const displayName = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());

        return (
          <Box key={key} marginY={1}>
            <Text>
              {isSelected ? '>' : ' '} {displayName}:
              <Text color={value ? 'green' : 'red'} bold={isSelected}>
                {' '}{value ? 'Enabled' : 'Disabled'}
              </Text>
            </Text>
          </Box>
        );
      })}

      {/* Preview box */}
      <Box
        marginTop={2}
        borderStyle={settings.showBorders ? "round" : "none"}
        borderColor="cyan"
        padding={1}
      >
        <Text bold={settings.boldText}>
          Theme Preview:
          <Text color={settings.useColoredIcons ? "green" : undefined}>
            {' '}{settings.theme} theme
          </Text>
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="gray" italic>
          Press 'T' to toggle options
        </Text>
      </Box>
    </Box>
  );
};

export default ThemeTab;
