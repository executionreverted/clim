// components/Chat/MessageList.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageList = ({ width = 60, height = 20, isFocused = false }) => {
  const { activeRoom } = useChat();
  const [scrollOffset, setScrollOffset] = useState(0);
  const messages = activeRoom.messages || [];

  // Calculate how many messages we can show
  const maxVisibleMessages = Math.max(5, height - 3);
  const totalMessages = messages.length;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (totalMessages > maxVisibleMessages) {
      setScrollOffset(totalMessages - maxVisibleMessages);
    } else {
      setScrollOffset(0);
    }
  }, [totalMessages, maxVisibleMessages]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.upArrow) {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    } else if (key.downArrow) {
      setScrollOffset(Math.min(
        Math.max(0, totalMessages - maxVisibleMessages),
        scrollOffset + 1
      ));
    } else if (key.pageUp) {
      setScrollOffset(Math.max(0, scrollOffset - maxVisibleMessages));
    } else if (key.pageDown) {
      setScrollOffset(Math.min(
        Math.max(0, totalMessages - maxVisibleMessages),
        scrollOffset + maxVisibleMessages
      ));
    } else if (input === 'g') {
      // Go to top
      setScrollOffset(0);
    } else if (input === 'G') {
      // Go to bottom
      setScrollOffset(Math.max(0, totalMessages - maxVisibleMessages));
    }
  });

  // Get visible messages
  const visibleMessages = messages.slice(
    scrollOffset,
    scrollOffset + maxVisibleMessages
  );

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
          Messages
        </Text>
      </Box>

      {messages.length === 0 ? (
        <Box>
          <Text color="gray" italic>
            No messages in this room yet
          </Text>
        </Box>
      ) : (
        <>
          {scrollOffset > 0 && (
            <Box>
              <Text color="yellow">
                ↑ {scrollOffset} more message{scrollOffset !== 1 ? 's' : ''}
              </Text>
            </Box>
          )}

          {visibleMessages.map((message, index) => {
            const maxTextWidth = width - 20; // Account for username, time, and some padding

            // Truncate message if needed
            const text = message.text.length > maxTextWidth
              ? message.text.substring(0, maxTextWidth - 3) + '...'
              : message.text;

            return (
              <Box key={message.id} flexDirection="column" marginTop={index > 0 ? 1 : 0}>
                <Box>
                  <Text color="blue" bold>{message.user}</Text>
                  <Text> </Text>
                  <Text color="gray">{formatTime(message.timestamp)}</Text>
                </Box>
                <Box>
                  <Text wrap="truncate">{text}</Text>
                </Box>
              </Box>
            );
          })}

          {scrollOffset + maxVisibleMessages < totalMessages && (
            <Box>
              <Text color="yellow">
                ↓ {totalMessages - scrollOffset - maxVisibleMessages} more message
                {totalMessages - scrollOffset - maxVisibleMessages !== 1 ? 's' : ''}
              </Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default MessageList;
