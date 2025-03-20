// components/Chat/MessageList.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import { ScrollBox } from '../ScrollBox.js';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const MessageList = ({ width = 60, height = 20, isFocused = false }) => {
  const { activeRoom } = useChat();
  const [scrollOffset, setScrollOffset] = useState(0);
  const messages = activeRoom.messages || [];

  // Calculate how many messages we can show based on available space
  const availableHeight = height - 6; // Account for header, indicators, and padding
  const [maxVisibleMessages, setMaxVisibleMessages] = useState(5);
  const totalMessages = messages.length;

  // Sort messages by timestamp
  const sortedMessages = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // After rendering, adjust max visible message count and scroll position
  useEffect(() => {
    // Calculate how many messages can fit
    const estimatedHeight = 2; // Average height per message
    const estimatedCount = Math.floor(availableHeight / estimatedHeight);
    setMaxVisibleMessages(Math.max(2, estimatedCount));
  }, [height, availableHeight]);

  // Keep track of previous message count to detect new messages
  const [prevMessageCount, setPrevMessageCount] = useState(totalMessages);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Check if we're already at the bottom or if new messages arrived
    const isAtBottom = scrollOffset + maxVisibleMessages >= prevMessageCount;
    const hasNewMessages = totalMessages > prevMessageCount;

    if ((isAtBottom && hasNewMessages) || totalMessages === 1) {
      // Auto-scroll when user is already at bottom or this is the first message
      setScrollOffset(Math.max(0, totalMessages - maxVisibleMessages));
    }

    setPrevMessageCount(totalMessages);
  }, [totalMessages, maxVisibleMessages]);

  // Prevent over-scrolling
  useEffect(() => {
    if (scrollOffset > totalMessages - 1 && totalMessages > 0) {
      setScrollOffset(totalMessages - 1);
    }
  }, [scrollOffset, totalMessages]);

  useInput((input, key) => {
    if (!isFocused) return;

    if (key.upArrow) {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    } else if (key.downArrow) {
      setScrollOffset(Math.min(
        Math.max(0, totalMessages - 1),
        scrollOffset + 1
      ));
    } else if (key.pageUp) {
      setScrollOffset(Math.max(0, scrollOffset - 5));
    } else if (key.pageDown) {
      setScrollOffset(Math.min(
        Math.max(0, totalMessages - 1),
        scrollOffset + 5
      ));
    } else if (input === 'g') {
      // Go to top
      setScrollOffset(0);
    } else if (input === 'G') {
      // Go to bottom
      setScrollOffset(Math.max(0, totalMessages - 1));
    }
  });

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
          {scrollOffset > 0 && (
            <Box width={width - 4}>
              <Text color="yellow">
                ↑ {scrollOffset} more message{scrollOffset !== 1 ? 's' : ''}
              </Text>
            </Box>
          )}

          <ScrollBox height={height - 6} offset={scrollOffset} width={width - 4}>
            {sortedMessages.map((message, index) => {
              return (
                <Box key={message.id} flexDirection="column" marginY={0} paddingY={0}>
                  <Box width={width - 6}>
                    <Text color="blue" bold>{message.user}</Text>
                    <Text> </Text>
                    <Text color="gray">{formatTime(message.timestamp)}</Text>
                  </Box>
                  <Box width={width - 6} flexDirection="column">
                    {message.text.split('\n').map((line, lineIdx) => {
                      // Break long lines into multiple lines
                      const maxLineLength = width - 8;
                      const chunks = [];

                      for (let i = 0; i < line.length; i += maxLineLength) {
                        chunks.push(line.substring(i, i + maxLineLength));
                      }

                      return chunks.map((chunk, chunkIdx) => (
                        <Box key={`line-${index}-${lineIdx}-${chunkIdx}`} width={width - 6}>
                          <Text wrap="truncate">{chunk}</Text>
                        </Box>
                      ));
                    }).flat()}
                  </Box>
                </Box>
              );
            })}
          </ScrollBox>

          {scrollOffset + maxVisibleMessages < totalMessages && (
            <Box width={width - 4}>
              <Text color="yellow">
                ↓ {totalMessages - scrollOffset - maxVisibleMessages} more message
                {totalMessages - scrollOffset - maxVisibleMessages !== 1 ? 's' : ''}
              </Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MessageList;
