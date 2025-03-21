// Fixed version of source/components/Options/ThemeTab.js
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import useKeymap from '../../hooks/useKeymap.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const ColorPreview = ({ color, label }) => (
  <Box marginRight={1}>
    <Text>
      {label}: <Text color={color}>■■■</Text>
    </Text>
  </Box>
);

const ThemeTab = ({ setIsInNested, width, height }) => {
  // Get theme context
  const {
    availableThemes,
    setTheme,
    updateThemeSettings,
    saveTheme,
    hasChanges,
    refreshThemes
  } = useTheme();
  const currentTheme = useThemeUpdate();

  // Local component state
  const [selectedOption, setSelectedOption] = useState(0);
  const [mode, setMode] = useState('settings'); // 'settings' or 'themes'
  const [messageText, setMessageText] = useState('');

  // List of settings for the selected theme
  const settingKeys = Object.keys(currentTheme.settings || {});

  // Effect to manage the nested state
  useEffect(() => {
    setIsInNested(mode !== 'settings');

    return () => {
      // Clean up when component unmounts
      if (hasChanges) {
        saveTheme();
      }
    };
  }, [mode, hasChanges, saveTheme, setIsInNested]);

  // Display a temporary message
  const showMessage = (message, duration = 3000) => {
    setMessageText(message);
    setTimeout(() => setMessageText(''), duration);
  };

  // Handle theme selection - fixed to ensure proper theme changing
  const handleThemeSelect = useCallback((themeId) => {
    // First check if the theme exists
    const themeToSelect = availableThemes.find(t => t.id === themeId);
    if (!themeToSelect) {
      showMessage(`Error: Theme with ID ${themeId} not found`);
      return;
    }

    // Set the theme
    const success = setTheme(themeId);
    if (success) {
      // Only save if setting was successful
      const saveSuccess = saveTheme();
      if (saveSuccess) {
        showMessage(`Theme set to ${themeToSelect.name}`);
      } else {
        showMessage('Error saving theme settings');
      }
    } else {
      showMessage('Error applying theme');
    }

    // Return to settings mode
    setMode('settings');
    setSelectedOption(0);
  }, [setTheme, saveTheme, availableThemes]);

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
        const maxOption = 1 + settingKeys.length; // Theme, Settings, Save
        setSelectedOption((prev) => Math.min(maxOption, prev + 1));
      } else if (mode === 'themes') {
        setSelectedOption((prev) => Math.min(availableThemes.length - 1, prev + 1));
      }
    },
    toggleOption: () => {
      if (mode === 'settings') {
        // Special handling for theme selection option
        if (selectedOption === 0) {
          // Switch to theme selection mode
          setMode('themes');
          const currentThemeIndex = availableThemes.findIndex(t => t.id === currentTheme.id);
          setSelectedOption(currentThemeIndex >= 0 ? currentThemeIndex : 0);
        }
        // Toggle boolean settings
        else if (selectedOption <= settingKeys.length) {
          const key = settingKeys[selectedOption - 1]; // -1 because first option is theme
          updateThemeSettings({ [key]: !currentTheme.settings[key] });
        }
        // Save option
        else {
          const success = saveTheme();
          showMessage(success ? 'Theme saved successfully!' : 'Failed to save theme.');
        }
      } else if (mode === 'themes') {
        // Select theme and go back to settings
        if (selectedOption >= 0 && selectedOption < availableThemes.length) {
          handleThemeSelect(availableThemes[selectedOption].id);
        }
      }
    },
    back: () => {
      if (mode !== 'settings') {
        // Go back to settings mode
        setMode('settings');
        setSelectedOption(0);
        return true; // Prevent bubbling to parent
      }
      return false; // Let parent handle in settings mode
    },
    refreshThemes: () => {
      refreshThemes();
      showMessage('Refreshed available themes');
    },
    createExampleTheme: () => {
      const THEMES_DIR = path.join(os.homedir(), '.config/.hyperchatters', 'themes');

      // Create a basic example theme file
      try {
        if (!fs.existsSync(THEMES_DIR)) {
          fs.mkdirSync(THEMES_DIR, { recursive: true });
        }

        const examplePath = path.join(THEMES_DIR, `example-${Date.now()}.json`);

        const exampleTheme = {
          id: `custom-${Date.now()}`,
          name: 'My Custom Theme',
          description: 'A custom theme created as an example',
          colors: {
            primaryColor: 'magenta',
            secondaryColor: 'cyan',
            textColor: 'white',
            mutedTextColor: 'gray',
            errorColor: 'red',
            successColor: 'green',
            warningColor: 'yellow',
            infoColor: 'blue',
            borderColor: 'gray',
            activeBorderColor: 'magenta'
          },
          settings: { ...currentTheme.settings }
        };

        fs.writeFileSync(examplePath, JSON.stringify(exampleTheme, null, 2));
        refreshThemes();
        showMessage(`Created example theme at ${examplePath}`);
      } catch (err) {
        showMessage(`Failed to create example theme: ${err.message}`);
      }
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

        {availableThemes.map((theme, index) => {
          const isSelected = index === selectedOption;
          const isActive = theme.id === currentTheme.id;

          return (
            <Box key={theme.id} marginY={1}>
              <Text>
                {isSelected ? '>' : ' '}
                <Text bold={isSelected || isActive} color={isSelected ? 'cyan' : undefined}>
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

        {messageText && (
          <Box marginTop={1} padding={1} borderStyle="round" borderColor="yellow">
            <Text color="yellow">{messageText}</Text>
          </Box>
        )}
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
          <Text color={currentTheme.colors?.primaryColor} bold={selectedOption === 0}>
            {' '}{currentTheme.name || 'Default'}
          </Text>
          <Text color="gray"> (Press T to change)</Text>
        </Text>
      </Box>

      {/* Boolean settings */}
      {settingKeys.map((key, index) => {
        const actualIndex = index + 1; // +1 because first option is theme
        const isSelected = actualIndex === selectedOption;
        const value = currentTheme.settings[key];

        // Format the key for display
        const displayName = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());

        return (
          <Box key={key} marginY={1}>
            <Text>
              {isSelected ? '>' : ' '} {displayName}:
              <Text color={value ? currentTheme.colors?.successColor : currentTheme.colors?.errorColor} bold={isSelected}>
                {' '}{value ? 'Enabled' : 'Disabled'}
              </Text>
            </Text>
          </Box>
        );
      })}

      {/* Save option */}
      <Box marginY={1}>
        <Text>
          {selectedOption === 1 + settingKeys.length ? '>' : ' '}
          <Text color={hasChanges ? currentTheme.colors?.warningColor : currentTheme.colors?.successColor}
            bold={selectedOption === 1 + settingKeys.length}>
            Save Theme {hasChanges ? '(unsaved changes)' : ''}
          </Text>
        </Text>
      </Box>

      {/* Preview box */}
      <Box
        marginTop={2}
        borderStyle="round"
        borderColor={currentTheme.colors?.secondaryColor}
        padding={1}
      >
        <Text bold>
          Theme Preview:
          <Text color={currentTheme.colors?.primaryColor}>
            {' '}{currentTheme.name} theme
          </Text>
        </Text>

        <Box flexDirection="row" flexWrap="wrap" marginTop={1}>
          <ColorPreview color={currentTheme.colors?.primaryColor} label="Primary" />
          <ColorPreview color={currentTheme.colors?.secondaryColor} label="Secondary" />
        </Box>

        <Box flexDirection="row" flexWrap="wrap" marginTop={1}>
          <ColorPreview color={currentTheme.colors?.successColor} label="Success" />
          <ColorPreview color={currentTheme.colors?.warningColor} label="Warning" />
          <ColorPreview color={currentTheme.colors?.errorColor} label="Error" />
          <ColorPreview color={currentTheme.colors?.infoColor} label="Info" />
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="row">
        <Text color="gray" italic>
          Press 'T' to toggle options | 'R' to refresh themes | 'E' to create example theme
        </Text>
      </Box>

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

export default ThemeTab;
