// components/Chat/UserList.js - With stability to prevent empty lists during updates
import React, { memo, useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import { useP2PRoom } from '../../contexts/P2PRoomContext.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

// Memoized peer item to prevent unnecessary rerenders
const PeerItem = memo(({ peer, isFocused, colors }) => {
  const { secondaryColor, mutedTextColor, primaryColor } = colors;

  return (
    <Box>
      <Text
        color={peer.isYou ? secondaryColor : (peer.anonymous ? mutedTextColor : primaryColor)}
        bold={peer.isYou}
        wrap="truncate"
      >
        {isFocused ? '•' : ' '} {peer.name}
        {peer.isYou && ' (you)'}
      </Text>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Only rerender if these props change
  return (
    prevProps.peer.name === nextProps.peer.name &&
    prevProps.peer.isYou === nextProps.peer.isYou &&
    prevProps.peer.anonymous === nextProps.peer.anonymous &&
    prevProps.isFocused === nextProps.isFocused
  );
});

const UserList = ({ width = 20, height = 20, isFocused = false }) => {
  const { activeRoomId } = useChat();
  const { identity, peers, roomConnections } = useP2PRoom();
  const currentTheme = useThemeUpdate();

  // Theme colors for styling
  const {
    primaryColor,
    secondaryColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  // CRUCIAL CHANGE: Maintain our own stable state of user list
  const [stableUserList, setStableUserList] = useState([]);
  const [stablePeerCount, setStablePeerCount] = useState(0);

  // References to track changes
  const lastUpdateTimeRef = useRef(Date.now());
  const pendingUpdateRef = useRef(null);

  // Get the raw data from context
  const rawPeerCount = activeRoomId ? (peers[activeRoomId] || 0) : 0;
  const rawConnections = roomConnections[activeRoomId] || [];

  // Update the stable list only after a debounce period
  useEffect(() => {
    // Clear any pending update
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current);
    }

    // Only update if we have connections or it's been over 5 seconds since last update
    if (rawConnections.length > 0 || Date.now() - lastUpdateTimeRef.current > 5000) {
      // Create a list of peers to display
      const newUserList = [];

      // First add yourself
      if (identity) {
        newUserList.push({
          id: identity.publicKey,
          stableKey: 'you',
          name: identity.username,
          isYou: true
        });
      }

      // Add all peers from connections
      rawConnections.forEach(connection => {
        // Skip if this is us
        if (connection.publicKey === identity?.publicKey) return;

        const stableKey = connection.publicKey || connection.id || `anonymous-${Math.random().toString(36).substring(2, 9)}`;
        newUserList.push({
          id: connection.id || connection.publicKey || stableKey,
          stableKey: stableKey,
          name: connection.username || 'Anonymous Peer',
          isYou: false,
          publicKey: connection.publicKey,
          lastSeen: connection.lastSeen,
          anonymous: !connection.publicKey || connection.anonymous
        });
      });
      setStableUserList(newUserList);
      setStablePeerCount(rawPeerCount);
      lastUpdateTimeRef.current = Date.now();
    }
  }, [rawConnections, rawPeerCount, identity]);


  // Calculate how many max peers we can show based on available height
  // Accounting for header (2 lines) and footer (2 lines)
  const maxVisiblePeers = Math.max(1, height - 4);

  // Sort peers: you first, then identified peers, then anonymous
  const sortedPeers = [...stableUserList].sort((a, b) => {
    if (a.isYou) return -1;
    if (b.isYou) return 1;
    if (a.anonymous && !b.anonymous) return 1;
    if (!a.anonymous && b.anonymous) return -1;
    return (b.lastSeen || 0) - (a.lastSeen || 0); // Most recent first
  });

  // Limit to visible peers
  const visiblePeers = sortedPeers.slice(0, maxVisiblePeers);

  // If we have no peers yet BUT we have raw connection data, show a loading message instead of "No peers"
  const isLoading = stableUserList.length === 0 && rawConnections.length > 0;

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
          Connected Peers ({stablePeerCount})
        </Text>
      </Box>

      {stableUserList.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>
            {isLoading ? "Loading peers..." : "No peers connected"}
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {visiblePeers.map((peer) => (
            <PeerItem
              key={peer.stableKey || peer.id}
              peer={peer}
              isFocused={isFocused}
              colors={{ primaryColor, secondaryColor, mutedTextColor }}
            />
          ))}

          {sortedPeers.length > maxVisiblePeers && (
            <Box marginTop={1}>
              <Text color={mutedTextColor} italic wrap="truncate">
                {sortedPeers.length - maxVisiblePeers} more peers not shown
              </Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={mutedTextColor} italic wrap="truncate">
          {stablePeerCount === 0
            ? 'Join a room to connect with peers'
            : 'Some peers may appear as anonymous'}
        </Text>
      </Box>
    </Box>
  );
};

export default UserList;
