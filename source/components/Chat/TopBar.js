// components/Chat/TopBar.js - Updated to use RoomBaseContext
import React from 'react';
import { Box, Text } from 'ink';
import { getBindingDescription, getBindingsForContext } from '../../utils/keymap.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import { useChat } from '../../contexts/RoomBaseChatContext.js';

const TopBar = ({ width = 100 }) => {
  const { error, activeRoom, focusedPanel, activeRoomId, peers, connections } = useChat();
  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    successColor,
    warningColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  // Get peer count for the active room from the actual swarm connections
  const peerCount = activeRoomId ? (peers[activeRoomId] || 0) : 0;

  // Get the number of identified (non-anonymous) peers
  const identifiedPeers = activeRoomId && connections?.[activeRoomId]
    ? connections[activeRoomId].filter(p => !p.anonymous).length
    : 0;

  // Get key binding descriptions
  const contextBindings = getBindingsForContext('chat');
  const switchPanelKey = getBindingDescription(contextBindings.switchPanel);

  // Status for the room
  const getStatusText = () => {
    if (!activeRoom) return 'No room selected';
    if (error) return error

    if (activeRoom.status === 'error') return JSON.stringify(activeRoom.error);
    if (activeRoom.status === 'connecting') return 'Connecting...';

    if (peerCount > 0) {
      if (identifiedPeers > 0) {
        return `Connected (${peerCount} ${peerCount === 1 ? 'peer' : 'peers'}, ${identifiedPeers} identified)`;
      } else {
        return `Connected (${peerCount} ${peerCount === 1 ? 'peer' : 'peers'})`;
      }
    }

    return 'Connected (0 peers)';
  };

  // Status color
  const getStatusColor = () => {
    if (!activeRoom) return borderColor;

    if (activeRoom.status === 'error') return 'red';
    if (activeRoom.status === 'connecting') return warningColor;

    return peerCount > 0 ? successColor : primaryColor;
  };

  return (
    <Box
      width={width}
      height={3}
      borderStyle="single"
      borderColor={borderColor}
      flexDirection="column"
      padding={0}
    >
      <Box width={width - 2} justifyContent="center">
        <Text bold color={successColor}>
          {activeRoom ? activeRoom.name : 'P2P Chat'}
          <Text color={getStatusColor()}> - {getStatusText()}</Text>
          <Text>
            {error}</Text>
        </Text>
      </Box>

      <Box width={width - 2} justifyContent="center">
        <Text color="gray" wrap="truncate">
          Currently focused: <Text color={activeBorderColor}>{focusedPanel}</Text> |
          {switchPanelKey} to navigate between panels
        </Text>
      </Box>
    </Box>
  );
};

export default TopBar;
