// components/Chat/MessageList.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Pre-calculate line chunks to avoid doing it during render
const getTextChunks = (text, maxLength) => {
  return text.split('\n').map(line => {
    const chunks = [];
    for (let i = 0; i < line.length; i += maxLength) {
      chunks.push(line.substring(i, i + maxLength));
    }
    return chunks;
  });
};

const MessageList = ({ width = 60, height = 20, isFocused = false }) => {
  const { activeRoom } = useChat();
  const [scrollPosition, setScrollPosition] = useState(0);
  const messages = activeRoom.messages || [];

  // Calculate available height for messages
  const availableHeight = height - 6; // Account for header, indicators, and padding

  // Sort messages by timestamp
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Keep track of previous message count to detect new messages
  const [prevMessageCount, setPrevMessageCount] = useState(messages.length);

  // Simple fixed-height approach to avoid infinite loops
  const messagesPerPage = Math.max(1, Math.floor(availableHeight / 3)); // Assume each message takes ~3 lines
  const totalPages = Math.ceil(sortedMessages.length / messagesPerPage);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const isAtBottom = scrollPosition === 0;
    const hasNewMessages = messages.length > prevMessageCount;

    if ((isAtBottom && hasNewMessages) || messages.length === 1) {
      setScrollPosition(0);
    }

    setPrevMessageCount(messages.length);
  }, [messages.length, prevMessageCount]);

  // Handle keyboard navigation
  useInput((input, key) => {
    if (!isFocused) return;

    if (key.upArrow) {
      setScrollPosition(prev => Math.min(totalPages - 1, prev + 1));
    } else if (key.downArrow) {
      setScrollPosition(prev => Math.max(0, prev - 1));
    } else if (key.pageUp) {
      setScrollPosition(prev => Math.min(totalPages - 1, prev + 3));
    } else if (key.pageDown) {
      setScrollPosition(prev => Math.max(0, prev - 3));
    } else if (input === 'g') {
      // Go to top (oldest messages)
      setScrollPosition(totalPages - 1);
    } else if (input === 'G') {
      // Go to bottom (newest messages)
      setScrollPosition(0);
    }
  });

  // Get visible messages based on current scroll position
  const startIdx = Math.max(0, sortedMessages.length - ((scrollPosition + 1) * messagesPerPage));
  const endIdx = Math.min(sortedMessages.length, startIdx + messagesPerPage);
  const visibleMessages = sortedMessages.slice(startIdx, endIdx);

  return (
    <Box
      width={width}
      height={height}
      borderStyle="single"
      borderColor={isFocused ? "green" : "gray"}
      flexDirection="column"
      padding={1}
    >
      <Box marginBottom={1}>
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
        <Box flexDirection="column" height={height - 4}>
          {/* Scroll indicators */}
          {scrollPosition < totalPages - 1 && startIdx > 0 && (
            <Box width={width - 4}>
              <Text color="yellow">
                ↑ {startIdx} more message(s)
              </Text>
            </Box>
          )}

          {/* Message list */}
          <Box flexDirection="column" height={availableHeight}>
            {visibleMessages.map((message) => (
              <Box key={message.id} flexDirection="column" marginBottom={1}>
                {/* Username and timestamp header */}
                <Box width={width - 6}>
                  <Text color="blue" bold>{message.user}</Text>
                  <Text> </Text>
                  <Text color="gray">{formatTime(message.timestamp)}</Text>
                </Box>

                {/* Message content */}
                <Box width={width - 6} flexDirection="column">
                  {message.text.split('\n').map((line, lineIdx) => {
                    // Simple line truncation to avoid recursion issues
                    const maxLineLength = width - 8;
                    return (
                      <Box key={`${message.id}-line-${lineIdx}`} width={width - 6}>
                        <Text wrap="truncate">{line}</Text>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Bottom indicator */}
          {scrollPosition > 0 && endIdx < sortedMessages.length && (
            <Box width={width - 4}>
              <Text color="yellow">
                ↓ {sortedMessages.length - endIdx} more message(s)
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MessageList;
