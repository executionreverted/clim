// components/Chat/UserList.js - Updated for P2P integration
import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import useKeymap from '../../hooks/useKeymap.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const UserList = ({ width = 20, height = 20, isFocused = false, peerCount = 0 }) => {
  const { activeRoom, inputMode } = useChat();
  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  // In a real P2P system, we'd show connected peer information here
  // For now, create a basic representation of connected peers
  const peers = [];

  // Add yourself
  peers.push({ id: 'you', name: 'You (this device)', isYou: true });

  // Add anonymous peers based on count
  for (let i = 0; i < peerCount; i++) {
    peers.push({ id: `peer-${i}`, name: `Peer ${i + 1}`, isYou: false });
  }

  return (
    <Box
      flexGrow={1}
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isFocused ? activeBorderColor : borderColor}
      flexDirection="column"
      padding={1}
    >
      <Box>
        <Text bold underline wrap="truncate">
          Connected Peers ({peers.length})
        </Text>
      </Box>

      {peers.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>
            No peers connected
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {peers.map((peer) => (
            <Box key={peer.id}>
              <Text
                color={peer.isYou ? secondaryColor : primaryColor}
                bold={peer.isYou}
                wrap="truncate"
              >
                {isFocused ? '•' : ' '} {peer.name}
              </Text>
            </Box>
          ))}

          {peerCount > 0 && (
            <Box marginTop={1}>
              <Text color={mutedTextColor} italic wrap="truncate">
                {peerCount === 1 ? '1 peer connected' : `${peerCount} peers connected`}
              </Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={mutedTextColor} italic wrap="truncate">
          P2P connections are anonymous
        </Text>
      </Box>
    </Box>
  );
};

export default UserList;
