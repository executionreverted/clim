// components/Chat/RoomList.js
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import useKeymap from '../../hooks/useKeymap.js';
import { getBindingDescription } from '../../utils/keymap.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const RoomList = ({ width = 20, height = 20, isFocused = false }) => {
  const {
    rooms,
    activeRoomId,
    setActiveRoomId,
    inputMode,
    inputValue
  } = useChat();
  const {
    primaryColor,
    secondaryColor,
    mutedTextColor,
    warningColor,
    borderColor,
    activeBorderColor,
  } = useThemeUpdate().colors
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
  }, [activeRoomId, rooms, scrollOffset, maxVisibleItems]);

  // Define handlers for room navigation
  const handlers = {
    navigateUp: () => {
      const newIndex = Math.max(0, highlightedIndex - 1);
      setHighlightedIndex(newIndex);
      setActiveRoomId(rooms[newIndex].id);

      // Adjust scroll if needed
      if (newIndex < scrollOffset) {
        setScrollOffset(newIndex);
      }
    },
    navigateDown: () => {
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

  const visibleRooms = rooms.slice(scrollOffset, scrollOffset + maxVisibleItems);

  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isFocused ? activeBorderColor : borderColor}
      flexDirection="column"
      padding={1}
    >
      <Box>
        <Text bold underline wrap="truncate">
          Rooms {isFocused && inputMode ? "(Adding)" : ""}
        </Text>
      </Box>

      {isFocused && inputMode ? (
        <Box>
          <Text color={warningColor}>New room: {inputValue || "Type name..."}</Text>
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

            return (
              <Box key={room.id}>
                <Text
                  color={isSelected ? secondaryColor : primaryColor}
                  bold={isSelected}
                  wrap="truncate"
                >
                  {isSelected && isFocused ? ">" : " "} {room.name}
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
