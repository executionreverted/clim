// source/components/Options/KeymapTab.js
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import path from 'path';
import os from 'os';
import fs from 'fs';
import open from 'open';
import useKeymap from '../../hooks/useKeymap.js';
import { loadKeymap, DEFAULT_KEYMAP, getBindingDescription } from '../../utils/keymap.js';

const KeymapTab = ({ width, height }) => {
  const [selectedAction, setSelectedAction] = useState(0);
  const CONFIG_PATH = path.join(os.homedir(), '.config/.hyperchatters.conf');
  const keymap = loadKeymap();

  // Actions for keymap management
  const actions = [
    {
      id: 'open',
      name: 'Open Config File',
      description: 'Open the keymap configuration file in your default editor'
    },
    {
      id: 'reset',
      name: 'Reset to Default',
      description: 'Reset all keybindings to default values'
    },
    {
      id: 'create',
      name: 'Create Example',
      description: 'Create an example configuration if none exists'
    },
  ];

  // Define handlers for keymap tab
  const handlers = {
    navigateUp: () => {
      setSelectedAction((prev) => Math.max(0, prev - 1));
    },
    navigateDown: () => {
      setSelectedAction((prev) => Math.min(actions.length - 1, prev + 1));
    },
    toggleOption: async () => {
      const action = actions[selectedAction];

      switch (action.id) {
        case 'open':
          try {
            await open(CONFIG_PATH);
          } catch (error) {
            console.error('Failed to open config file:', error);
          }
          break;
        case 'reset':
          try {
            if (fs.existsSync(CONFIG_PATH)) {
              fs.unlinkSync(CONFIG_PATH);
            }
          } catch (error) {
            console.error('Failed to reset keymap:', error);
          }
          break;
        case 'create':
          try {
            if (!fs.existsSync(path.dirname(CONFIG_PATH))) {
              fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
            }
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_KEYMAP, null, 2));
          } catch (error) {
            console.error('Failed to create example config:', error);
          }
          break;
        default:
          break;
      }
    }
  };

  // Use the keymap hook
  useKeymap('options', handlers);

  // Get contexts to display
  const contexts = Object.keys(keymap);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box marginBottom={1}>
        <Text bold underline>Keymap Configuration</Text>
      </Box>

      <Box marginY={1}>
        <Text>
          Your keymap configuration file is located at:
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="cyan" wrap="truncate">
          {CONFIG_PATH}
        </Text>
      </Box>

      <Box marginY={1}>
        <Text wrap="wrap">
          Edit this file to customize your keyboard shortcuts. The file uses JSON format
          with nested objects for different contexts.
        </Text>
      </Box>

      <Box marginY={1}>
        <Text bold>Available Contexts:</Text>
      </Box>

      <Box flexDirection="row" flexWrap="wrap" marginBottom={1}>
        {contexts.map((context, i) => (
          <Box key={context} marginRight={1} marginBottom={1}>
            <Text color="blue">{context}</Text>
            {i < contexts.length - 1 && <Text>, </Text>}
          </Box>
        ))}
      </Box>

      <Box flexDirection={"column"} marginY={2} borderStyle="single" borderColor="gray" padding={1}>
        <Text bold>Actions</Text>
        {actions.map((action, index) => {
          const isSelected = index === selectedAction;

          return (
            <Box key={action.id} marginY={1}>
              <Text>
                {isSelected ? '>' : ' '}
                <Text color="green" bold={isSelected}>
                  {action.name}
                </Text>
                <Text color="gray"> - {action.description}</Text>
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray" italic>
          Press 'T' to execute the selected action
        </Text>
      </Box>
    </Box>
  );
};

export default KeymapTab;
