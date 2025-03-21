// source/components/Options/GeneralTab.js
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import useKeymap from '../../hooks/useKeymap.js';

const GeneralTab = ({ width, height }) => {
  // General settings with default values
  const [settings, setSettings] = useState({
    showNotifications: true,
    autoSaveChats: true,
    compactMode: false,
    debugMode: false,
    checkUpdates: true,
  });

  // Track the selected option
  const [selectedOption, setSelectedOption] = useState(0);
  const settingKeys = Object.keys(settings);

  // Define handlers for this tab
  const handlers = {
    navigateUp: () => {
      setSelectedOption((prev) => Math.max(0, prev - 1));
    },
    navigateDown: () => {
      setSelectedOption((prev) => Math.min(settingKeys.length - 1, prev + 1));
    },
    toggleOption: () => {
      const key = settingKeys[selectedOption];
      setSettings(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    }
  };

  // Use the keymap hook
  useKeymap('options', handlers);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box marginBottom={1}>
        <Text bold underline>General Settings</Text>
      </Box>

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
              <Text color={value ? 'green' : 'red'} bold={isSelected}>
                {' '}{value ? 'Enabled' : 'Disabled'}
              </Text>
            </Text>
          </Box>
        );
      })}

      <Box marginTop={2}>
        <Text color="gray" italic>
          Press 'T' to toggle the selected option
        </Text>
      </Box>
    </Box>
  );
};

export default GeneralTab;
