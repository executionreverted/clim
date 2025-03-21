// components/Chat/TopBar.js
import React from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import { getBindingDescription, getBindingsForContext } from '../../utils/keymap.js';

const TopBar = ({ width = 100 }) => {
  const { activeRoom, focusedPanel } = useChat();

  // Get key binding descriptions
  const contextBindings = getBindingsForContext('chat');
  const switchPanelKey = getBindingDescription(contextBindings.switchPanel);

  return (
    <Box
      width={width}
      height={3}
      borderStyle="single"
      borderColor="gray"
      flexDirection="column"
      padding={0}
    >
      <Box width={width - 2} justifyContent="center">
        <Text bold color="green">
          {activeRoom.name} Chat Room
        </Text>
      </Box>

      <Box width={width - 2} justifyContent="center">
        <Text color="gray" wrap="truncate">
          Currently focused: <Text color="cyan">{focusedPanel}</Text> |
          {switchPanelKey} to navigate between panels
        </Text>
      </Box>
    </Box>
  );
};

export default TopBar;
