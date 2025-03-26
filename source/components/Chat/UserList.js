// components/Chat/UserList.js - Enhanced with status indicators
import React, { memo, useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import { useChat } from '../../contexts/RoomBaseChatContext.js';

// Memoized peer item with status indicator
const PeerItem = memo(({ peer, isFocused, colors }) => {
  const {
    secondaryColor,
    mutedTextColor,
    primaryColor,
    successColor,
    errorColor,
    warningColor
  } = colors;

  // Determine status color based on peer properties
  const getStatusColor = () => {
    if (peer.isYou) return secondaryColor;
    if (peer.status === 'online') return successColor;
    if (peer.status === 'idle') return warningColor;
    if (peer.status === 'offline') return errorColor;
    if (peer.anonymous) return mutedTextColor;

    // Default status color for connected peers
    return primaryColor;
  };

  // Determine status based on lastSeen
  const getPeerStatus = () => {
    if (peer.isYou) return 'online';
    if (!peer.lastSeen) return 'unknown';

    const timeSinceLastSeen = Date.now() - peer.lastSeen;
    if (timeSinceLastSeen < 30000) return 'online'; // Within 30 seconds
    if (timeSinceLastSeen < 300000) return 'idle';  // Within 5 minutes
    return 'offline';                               // More than 5 minutes
  };

  // Set status for display
  const status = getPeerStatus();
  peer.status = status; // Update the peer object with status
  const statusColor = getStatusColor();

  return (
    <Box>
      <Text wrap="truncate">
        {isFocused ? '•' : ' '}
        <Text color={statusColor}>o</Text> {/* Status indicator */}
        <Text
          color={peer.isYou ? secondaryColor : (peer.anonymous ? mutedTextColor : primaryColor)}
          bold={peer.isYou}
        >
          {' '}{peer.username}
          {peer.isYou && ' (you)'}
        </Text>
      </Text>
    </Box>
  );
}, (prevProps, nextProps) => {
  // Only rerender if these props change
  return (
    prevProps.peer.username === nextProps.peer.username &&
    prevProps.peer.isYou === nextProps.peer.isYou &&
    prevProps.peer.anonymous === nextProps.peer.anonymous &&
    prevProps.peer.lastSeen === nextProps.peer.lastSeen &&
    prevProps.isFocused === nextProps.isFocused
  );
});

const UserList = ({ width = 20, height = 20, isFocused = false }) => {
  const { activeRoomId, connections, peers, identity } = useChat();
  const currentTheme = useThemeUpdate();

  // Theme colors for styling
  const {
    primaryColor,
    secondaryColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
    successColor,
    errorColor,
    warningColor
  } = currentTheme.colors;

  // CRUCIAL CHANGE: Maintain our own stable state of user list
  const [stableUserList, setStableUserList] = useState([]);
  const [stablePeerCount, setStablePeerCount] = useState(0);

  // References to track changes
  const lastUpdateTimeRef = useRef(Date.now());
  const pendingUpdateRef = useRef(null);

  // Set up periodic refresh for peer status indicators
  useEffect(() => {
    // Update status indicators every 30 seconds
    const statusTimer = setInterval(() => {
      // Force update of the component to refresh status indicators
      setStableUserList(prev => [...prev]);
    }, 30000);

    return () => clearInterval(statusTimer);
  }, []);

  // Get the raw data from context
  const rawPeerCount = activeRoomId ? (peers[activeRoomId] || 0) : 0;
  const rawConnections = activeRoomId ? (connections?.[activeRoomId] || []) : [];

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
          username: identity.username,
          isYou: true,
          status: 'online',
          lastSeen: Date.now()
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
          username: connection.username || 'Anonymous Peer',
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

  // Get connected peer count (excluding anonymous)
  const connectedPeers = sortedPeers.filter(peer =>
    peer.status === 'online' && !peer.anonymous
  ).length;

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
          Connected Peers ({connectedPeers}/{stablePeerCount})
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
              colors={{
                primaryColor,
                secondaryColor,
                mutedTextColor,
                successColor,
                errorColor,
                warningColor
              }}
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
        {stablePeerCount === 0
          ? <Text>Join a room to connect with peers</Text>
          : <Box flexDirection="column">
            <Text color={successColor}>o online</Text>
            <Text color={warningColor}>o idle</Text>
            <Text color={errorColor}>o offline</Text>
          </Box>
        }
      </Box>
    </Box>
  );
};

export default UserList;
