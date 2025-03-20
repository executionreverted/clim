// components/Chat/MessageList.js
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import { sanitizeTextForTerminal } from '../FileExplorer/utils.js';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Safely truncate text to fit within width
const fitTextToWidth = (text, maxWidth) => {
  if (!text) return '';
  if (text.length <= maxWidth) return text;
  return text.substring(0, maxWidth - 3) + '...';
};

// Split long message text into lines that fit within available width
const prepareMessageLines = (text, maxWidth) => {
  if (!text) return [];

  // First split by natural line breaks
  const naturalLines = text.split('\n');
  const result = [];

  // Then ensure each line fits within maxWidth
  naturalLines.forEach(line => {
    // Simple wrapping for lines longer than maxWidth
    for (let i = 0; i < line.length; i += maxWidth) {
      const chunk = line.substring(i, i + maxWidth).trim();
      result.push(chunk);
    }
  });

  return result;
};

const MessageList = ({ width = 60, height = 20, isFocused = false }) => {
  const { activeRoom, inputMode } = useChat();
  const [scrollOffset, setScrollOffset] = useState(0);
  const messages = activeRoom.messages || [];

  // Calculate available width and height
  const contentWidth = Math.max(20, width - 6); // Adjust for borders and padding
  const availableHeight = Math.max(5, height - 6); // Account for header and padding

  // Sort messages by timestamp (oldest first)
  const sortedMessages = [...messages].sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Process messages into display lines
  const processedLines = [];
  sortedMessages.forEach(message => {
    // Add header line
    processedLines.push({
      type: 'header',
      user: message.user,
      timestamp: message.timestamp,
      messageId: message.id
    });

    // Process message content into lines that fit within width
    const contentLines = prepareMessageLines(message.text, contentWidth);
    contentLines.forEach((line, idx) => {
      processedLines.push({
        type: 'content',
        text: line,
        messageId: message.id,
        lineIndex: idx,
        hasAttachment: !!message.attachedFile,
        isFileMessage: message.text && message.text.startsWith('📎')
      });
    });
  });

  const totalLines = processedLines.length;
  const maxScrollOffset = Math.max(0, totalLines - availableHeight);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const isAtBottom = scrollOffset === 0;
    const hasNewMessages = messages.length > prevMessageCount;

    if ((isAtBottom && hasNewMessages) || messages.length === 1) {
      setScrollOffset(0);
    }

    setPrevMessageCount(messages.length);
  }, [messages.length]);

  // Keep track of previous message count
  const [prevMessageCount, setPrevMessageCount] = useState(messages.length);

  // Handle keyboard navigation
  useInput((input, key) => {
    if (!isFocused || inputMode) return;
    if (key.upArrow) {
      setScrollOffset(prev => Math.min(maxScrollOffset, prev + 1));
    } else if (key.downArrow) {
      setScrollOffset(prev => Math.max(0, prev - 1));
    } else if (key.pageUp) {
      setScrollOffset(prev => Math.min(maxScrollOffset, prev + Math.floor(availableHeight / 2)));
    } else if (key.pageDown) {
      setScrollOffset(prev => Math.max(0, prev - Math.floor(availableHeight / 2)));
    } else if (input === 'g') {
      // Go to top (oldest messages)
      setScrollOffset(maxScrollOffset);
    } else if (input === 'G') {
      // Go to bottom (newest messages)
      setScrollOffset(0);
    }
  });

  // Get visible lines based on current scroll offset
  const visibleStartIndex = Math.max(0, totalLines - availableHeight - scrollOffset);
  const visibleEndIndex = Math.min(totalLines, visibleStartIndex + availableHeight);
  const visibleLines = processedLines.slice(visibleStartIndex, visibleEndIndex);

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
        <Text bold wrap="truncate">
          Messages {scrollOffset > 0 ? `(scrolled ${scrollOffset} lines)` : ''}
        </Text>
      </Box>

      {messages.length === 0 ? (
        <Box>
          <Text color="gray" italic>
            No messages in this room yet
          </Text>
        </Box>
      ) : (
        <Box
          flexDirection="column"
          height={availableHeight}
        >
          {/* Message lines */}
          <Box overflow={"hidden"} flexDirection="column">
            {visibleLines.map((line, idx) => {
              if (line.type === 'header') {
                return (
                  <Box overflow={"hidden"} key={`h-${line.messageId}-${idx}`} width={contentWidth}>
                    <Text color="blue" bold>{line.user}</Text>
                    <Text> </Text>
                    <Text color="gray">{formatTime(line.timestamp)}</Text>
                  </Box>
                );
              } else {
                return (
                  <Box overflow="hidden" key={`c-${line.messageId}-${line.lineIndex}-${idx}`} width={contentWidth}>
                    <Text color={line.isFileMessage ? "green" : undefined}>{sanitizeTextForTerminal(line.text).replace('␍', '\n')}</Text>
                  </Box>
                );
              }
            })}
          </Box>
        </Box>
      )}

      {/* Scroll indicators - small and positioned strategically */}
      {scrollOffset > 0 && (
        <Box position="absolute" right={2} top={1}>
          <Text color="yellow" bold>↑{scrollOffset}</Text>
        </Box>
      )}

      {scrollOffset < maxScrollOffset && (
        <Box position="absolute" right={2} bottom={1}>
          <Text color="yellow" bold>↓</Text>
        </Box>
      )}
    </Box>
  );
};

export default MessageList;
