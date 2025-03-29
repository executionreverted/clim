// components/Welcome.js - Fixed gradient text rendering
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
    // startExplorer: () => onStart('explorer'),
    startOptions: () => onStart('options'),
    exit: () => process.exit(0),
  };

  // Use the keymap hook
  const { contextBindings } = useKeymap('welcome', handlers);

  // Get human-readable key descriptions
  const chatKey = getBindingDescription(contextBindings.startChat);
  const optionsKey = getBindingDescription(contextBindings.startOptions);
  const exitKey = getBindingDescription(contextBindings.exit);

  const titleText = "hyper";
  const titleSubText = "chatters"

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

      {/* Ensure gradient text has enough width */}
      <Box gap={0} justifyContent="center" alignItems="center" flexDirection={"column"} width={"100%"}>
        <Gradient name="rainbow">
          <BigText text={titleText} />
        </Gradient>
        <Gradient name="rainbow">
          <BigText font='tiny' text={titleSubText} />
        </Gradient>
      </Box>

      <Box marginY={1}>
        <Text>A simple terminal app with configurable keymaps</Text>
      </Box>

      <Box flexDirection={"column"} marginY={2} padding={1} borderStyle="round" borderColor="green">
        <Text>Press <Text color="green" bold>{chatKey}</Text> to start p2p chat</Text>
        {/* <Text>Press <Text color="green" bold>{explorerKey}</Text> to start exploring files</Text> */}
        <Text>Press <Text color="green" bold>{optionsKey}</Text> to open options</Text>
        <Text>Press <Text color="green" bold>{exitKey}</Text> to exit</Text>
      </Box>

      <Box marginY={1}>
        <Text dimColor>Loaded  ~/config/.hyperchatters</Text>
      </Box>

      <Box flexGrow={1} />
    </Box>
  );
};

export default Welcome;
