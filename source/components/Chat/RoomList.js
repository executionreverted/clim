// components/Chat/RoomList.js
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';

const RoomList = ({ width = 20, height = 20, isFocused = false }) => {
  const {
    rooms,
    activeRoomId,
    setActiveRoomId,
    inputMode,
    inputValue
  } = useChat();

  const [highlightedIndex, setHighlightedIndex] = useState(
    rooms.findIndex(room => room.id === activeRoomId) || 0
  );

  const [scrollOffset, setScrollOffset] = useState(0);
  const maxVisibleItems = Math.max(3, height - 3);

  // Update highlighted room when active room changes
  React.useEffect(() => {
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

  useInput((input, key) => {
    if (!isFocused || inputMode) return;

    if (key.upArrow) {
      const newIndex = Math.max(0, highlightedIndex - 1);
      setHighlightedIndex(newIndex);
      setActiveRoomId(rooms[newIndex].id);

      // Adjust scroll if needed
      if (newIndex < scrollOffset) {
        setScrollOffset(newIndex);
      }
    } else if (key.downArrow) {
      const newIndex = Math.min(rooms.length - 1, highlightedIndex + 1);
      setHighlightedIndex(newIndex);
      setActiveRoomId(rooms[newIndex].id);

      // Adjust scroll if needed
      if (newIndex >= scrollOffset + maxVisibleItems) {
        setScrollOffset(newIndex - maxVisibleItems + 1);
      }
    }
  });

  const visibleRooms = rooms.slice(scrollOffset, scrollOffset + maxVisibleItems);

  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isFocused ? "green" : "gray"}
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
          <Text color="yellow">New room: {inputValue || "Type name..."}</Text>
        </Box>
      ) : (
        <>
          {scrollOffset > 0 && (
            <Box>
              <Text color="yellow">↑ More rooms</Text>
            </Box>
          )}

          {visibleRooms.map((room, index) => {
            const actualIndex = index + scrollOffset;
            const isSelected = actualIndex === highlightedIndex;

            return (
              <Box key={room.id}>
                <Text
                  color={isSelected ? "green" : undefined}
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
              <Text color="yellow">↓ More rooms</Text>
            </Box>
          )}

          {isFocused && (
            <Box marginTop={1}>
              <Text color="gray" italic>
                Press 'a' to add room
              </Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default RoomList;
