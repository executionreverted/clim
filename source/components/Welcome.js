// components/Welcome.js
import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import useKeymap from '../hooks/useKeymap.js';
import { getBindingDescription } from '../utils/keymap.js';

const Welcome = ({ onStart, width = 100, height = 24 }) => {
  // Define handlers for welcome screen actions
  const handlers = {
    startChat: () => onStart('chat'),
    startExplorer: () => onStart('explorer'),
    exit: () => process.exit(0),
  };

  // Use the keymap hook
  const { contextBindings } = useKeymap('welcome', handlers);

  // Get human-readable key descriptions
  const chatKey = getBindingDescription(contextBindings.startChat);
  const explorerKey = getBindingDescription(contextBindings.startExplorer);
  const exitKey = getBindingDescription(contextBindings.exit);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width={width}
      height={height}
      padding={0}
    >
      {/* Center the content vertically in the available space */}
      <Box flexGrow={1} />

      <Gradient name="rainbow">
        <BigText text="Termin4LHub" align="center" font="block" />
      </Gradient>

      <Box marginY={1}>
        <Text>A simple terminal app with configurable keymaps</Text>
      </Box>

      <Box marginY={2} padding={1} borderStyle="round" borderColor="green">
        <Text>Press <Text color="green" bold>{chatKey}</Text> to start p2p chat</Text>
        <Text>Press <Text color="green" bold>{explorerKey}</Text> to start exploring files</Text>
        <Text>Press <Text color="green" bold>{exitKey}</Text> to exit</Text>
      </Box>

      <Box marginY={1}>
        <Text dimColor>Customize keys in ~/.hyperchatters.conf</Text>
      </Box>

      <Box flexGrow={1} />
    </Box>
  );
};

export default Welcome;
