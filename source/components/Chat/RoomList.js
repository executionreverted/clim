// components/Chat/RoomList.js - Updated with better text truncation
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/RoomBaseChatContext.js';
import useKeymap from '../../hooks/useKeymap.js';
import { getBindingDescription } from '../../utils/keymap.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const RoomList = ({ width = 20, height = 20, isFocused = false }) => {
  const {
    rooms,
    activeRoomId,
    setActiveRoomId,
    inputMode,
    inputValue,
    peers
  } = useChat();

  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    errorColor,
    successColor,
    warningColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  const [highlightedIndex, setHighlightedIndex] = useState(
    rooms.findIndex(room => room.id === activeRoomId) || 0
  );

  const [scrollOffset, setScrollOffset] = useState(0);
  const maxVisibleItems = Math.max(3, height - 3);

  // Update highlighted room when active room changes
  useEffect(() => {
    const index = rooms.findIndex(room => room.id === activeRoomId);
    if (index !== -1) {
      setHighlightedIndex(index);

      // Adjust scroll if needed
      if (index < scrollOffset) {
        setScrollOffset(index);
      } else if (index >= scrollOffset + maxVisibleItems) {
        setScrollOffset(index - maxVisibleItems + 1);
      }
    }
  }, [activeRoomId]);

  // Define handlers for room navigation
  const handlers = {
    navigateUp: () => {
      if (rooms.length === 0) return;

      const newIndex = Math.max(0, highlightedIndex - 1);
      setHighlightedIndex(newIndex);
      setActiveRoomId(rooms[newIndex].id);

      // Adjust scroll if needed
      if (newIndex < scrollOffset) {
        setScrollOffset(newIndex);
      }
    },
    navigateDown: () => {
      if (rooms.length === 0) return;

      const newIndex = Math.min(rooms.length - 1, highlightedIndex + 1);
      setHighlightedIndex(newIndex);
      setActiveRoomId(rooms[newIndex].id);

      // Adjust scroll if needed
      if (newIndex >= scrollOffset + maxVisibleItems) {
        setScrollOffset(newIndex - maxVisibleItems + 1);
      }
    }
  };

  // Use the keymap hook
  const { contextBindings } = useKeymap('chat', handlers, {
    isActive: isFocused && !inputMode
  });

  // Get human-readable key for adding a room
  const addRoomKey = getBindingDescription(contextBindings.addRoom);

  // Calculate visible rooms based on scroll offset
  const visibleRooms = rooms.slice(scrollOffset, scrollOffset + maxVisibleItems);

  // Get status icon for room based on its status and peer count
  const getStatusIcon = (room) => {
    const peerCount = peers[room.id] || 0;

    if (room.status === 'error') return { icon: 'o', color: errorColor };
    if (room.status === 'connecting') return { icon: 'o', color: warningColor };

    // Connected status with peer indication
    if (peerCount > 0) return { icon: 'o', color: successColor };
    return { icon: 'o', color: mutedTextColor };
  };

  // Calculate maximum room name width based on panel width
  // Reserve space for: cursor (2), status icon (2), peer count (4), padding (2)
  const maxRoomNameWidth = Math.max(5, width - 10);

  return (
    <Box
      width={width}
      height={height}
      overflow={"hidden"}
      borderStyle="single"
      borderColor={isFocused ? activeBorderColor : borderColor}
      flexDirection="column"
      padding={1}
    >
      <Box>
        <Text bold underline wrap="truncate">
          Rooms {isFocused && inputMode ? "(Adding)" : `(${rooms.length})`}
        </Text>
      </Box>

      {isFocused && inputMode ? (
        <Box>
          <Text color={warningColor} wrap="truncate">New room: {inputValue || "Type name..."}</Text>
        </Box>
      ) : rooms.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>No rooms available</Text>
          <Text color={mutedTextColor} italic>Press '{addRoomKey}' to add</Text>
        </Box>
      ) : (
        <>
          {scrollOffset > 0 && (
            <Box>
              <Text color={secondaryColor}>↑ More rooms</Text>
            </Box>
          )}

          {visibleRooms.map((room, index) => {
            const actualIndex = index + scrollOffset;
            const isSelected = actualIndex === highlightedIndex;
            const status = getStatusIcon(room);
            const peerCount = peers[room.id] || 0;

            // Truncate room name if too long
            const displayName = room.name.length > maxRoomNameWidth
              ? room.name.substring(0, maxRoomNameWidth - 3) + '...'
              : room.name;

            return (
              <Box overflow={"hidden"} key={room.id} width={width - 6}>
                <Text
                  color={isSelected ? successColor : secondaryColor}
                  bold={isSelected}
                  wrap="truncate"
                >
                  {isSelected && isFocused ? ">" : " "}
                  <Text color={status.color}>{status.icon}</Text> {displayName}
                  <Text color={mutedTextColor}> ({peerCount})</Text>
                </Text>
              </Box>
            );
          })}

          {scrollOffset + maxVisibleItems < rooms.length && (
            <Box>
              <Text color={secondaryColor}>↓ More rooms</Text>
            </Box>
          )}

          {isFocused && (
            <Box marginTop={1}>
              <Text color={mutedTextColor} italic>
                Press '{addRoomKey}' to add room
              </Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default RoomList;
