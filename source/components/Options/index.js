// source/components/Options/index.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useStdout } from 'ink';
import useKeymap from '../../hooks/useKeymap.js';
import GeneralTab from './GeneralTab.js';
import ThemeTab from './ThemeTab.js';
import KeymapTab from './KeymapTab.js';
import TabSelector from './TabSelector.js';
import { getBindingDescription } from '../../utils/keymap.js';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext.js';

// Options wrapper component with ThemeProvider
const Options = ({ onBack }) => {
  return (
    <OptionsContent onBack={onBack} />
  );
};

// Main options content with theme context
const OptionsContent = ({ onBack }) => {
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);
  const [activeTab, setActiveTab] = useState(0);
  const [isInNested, setIsInNested] = useState(false);
  const { currentTheme, hasChanges, saveTheme } = useTheme();

  // Update terminal dimensions on resize
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(stdout.columns);
      setTerminalHeight(stdout.rows);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);

      // Save theme changes when exiting options
      if (hasChanges) {
        saveTheme();
      }
    };
  }, [stdout, hasChanges]);

  // Tabs configuration
  const tabs = [
    { id: 'general', label: 'General', component: GeneralTab },
    { id: 'theme', label: 'Theme', component: ThemeTab },
    { id: 'keymap', label: 'Keymap', component: KeymapTab },
  ];

  // Define handlers for options page
  const handlers = {
    back: () => {
      if (isInNested) {
        return false;
      }

      // Save any unsaved theme changes before exiting
      if (hasChanges) {
        saveTheme();
      }

      onBack();
      return true;
    },
    exit: () => {
      // Save any unsaved theme changes before exiting
      if (hasChanges) {
        saveTheme();
      }

      onBack();
      return true;
    },
    nextTab: () => {
      setActiveTab((prevTab) => (prevTab + 1) % tabs.length);
      return true;
    },
    previousTab: () => {
      setActiveTab((prevTab) => (prevTab - 1 + tabs.length) % tabs.length);
      return true;
    },
  };

  // Use the keymap hook
  const { contextBindings } = useKeymap('options', handlers, { isActive: !isInNested });

  // Get key bindings for help text
  const toggleKey = getBindingDescription(contextBindings.toggleOption);
  const backKey = getBindingDescription(contextBindings.back);

  // Get the active component for the current tab
  const ActiveTabComponent = tabs[activeTab].component;

  // Apply theme colors
  const borderColor = currentTheme.colors.border.active;
  const tabBorderColor = currentTheme.colors.border.inactive;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {/* Header */}
      <Box borderStyle="single" borderColor="green" padding={1} marginBottom={1}>
        <Text bold>Application Settings {hasChanges ? "(Unsaved Changes)" : ""}</Text>
      </Box>

      {/* Tab Selector */}
      <TabSelector
        tabs={tabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        width={terminalWidth}
        borderColor={currentTheme.colors.border.inactive}
        activeColor={currentTheme.colors.primary}
      />

      {/* Tab Content */}
      <Box
        borderStyle="single"
        borderColor="gray"
        padding={1}
        flexGrow={1}
        flexDirection="column"
        height={terminalHeight - 10}
      >
        <ActiveTabComponent setIsInNested={setIsInNested} width={terminalWidth - 4} height={terminalHeight - 12} />
      </Box>

      {/* Help Footer */}
      <Box borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
        <Text wrap="truncate">
          <Text color={currentTheme.colors.primary}>←/→</Text>: Switch tabs |
          <Text color={currentTheme.colors.primary}> {toggleKey}</Text>: Toggle option |
          <Text color={currentTheme.colors.primary}> {backKey}</Text>: Back to main menu
        </Text>
      </Box>
    </Box>
  );
};

export default Options;
