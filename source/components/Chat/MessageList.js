// components/Chat/MessageList.js - Updated for P2P integration
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import { sanitizeTextForTerminal } from '../FileExplorer/utils.js';
import useKeymap from '../../hooks/useKeymap.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';
import { useP2PRoom } from '../../contexts/P2PRoomContext.js';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Split long message text into lines that fit within available width
const prepareMessageLines = (text, maxWidth) => {
  if (!text) return [];

  // First split by natural line breaks
  const naturalLines = text.replaceAll('␍', '\n').replaceAll('↵', '\n').split('\n');
  const result = [];

  // Then ensure each line fits within maxWidth
  naturalLines.forEach(line => {
    // Simple wrapping for lines longer than maxWidth
    for (let i = 0; i < line.length; i += maxWidth) {
      const chunk = line.substring(i, i + maxWidth).trim();
      if (chunk.length > 0) {
        result.push(chunk);
      }
    }
  });

  return result;
};

const MessageList = ({ width = 60, height = 20, isFocused = false }) => {
  const { activeRoom, inputMode } = useChat();
  const { identity } = useP2PRoom();
  const [scrollOffset, setScrollOffset] = useState(0);
  const messages = activeRoom?.messages || [];

  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  // Calculate available width and height
  const contentWidth = Math.max(20, width - 6); // Adjust for borders and padding
  const availableHeight = Math.max(5, height - 6); // Account for header and padding

  // Process messages into display lines
  const processedLines = [];

  if (messages.length > 0) {
    // Sort messages by timestamp
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

    sortedMessages.forEach((message, idx) => {
      // Add header line
      processedLines.push({
        type: 'header',
        user: message.sender || 'Unknown',
        timestamp: message.timestamp,
        messageId: message.id || `msg-${idx}`
      });

      // Process message content into lines that fit within width
      const contentLines = prepareMessageLines(message.content, contentWidth);
      contentLines.forEach((line, lineIdx) => {
        processedLines.push({
          type: 'content',
          text: line,
          messageId: message.id || `msg-${idx}`,
          lineIndex: lineIdx,
          hasAttachment: message.content && message.content.startsWith('📎'),
          isFileMessage: message.content && message.content.startsWith('📎')
        });
      });

      // Add a separator between messages
      const unique = (message.id || `msg-${idx}`) + '-sep';
      processedLines.push({
        type: 'content',
        text: " ",
        messageId: unique,
        lineIndex: unique,
        hasAttachment: false,
        isFileMessage: false
      });
    });
  }

  const totalLines = processedLines.length;
  const maxScrollOffset = Math.max(0, totalLines - availableHeight);

  // Auto-scroll to bottom when new messages arrive
  const [prevMessageCount, setPrevMessageCount] = useState(messages.length);

  useEffect(() => {
    const isAtBottom = scrollOffset === 0;
    const hasNewMessages = messages.length > prevMessageCount;

    if ((isAtBottom && hasNewMessages) || messages.length === 1) {
      setScrollOffset(0);
    }

    setPrevMessageCount(messages.length);
  }, [messages.length, scrollOffset, prevMessageCount]);

  // Define keymap handlers for navigation
  const handlers = {
    navigateUp: () => {
      setScrollOffset(prev => Math.min(maxScrollOffset, prev + 1));
    },
    navigateDown: () => {
      setScrollOffset(prev => Math.max(0, prev - 1));
    },
    pageUp: () => {
      setScrollOffset(prev => Math.min(maxScrollOffset, prev + Math.floor(availableHeight / 2)));
    },
    pageDown: () => {
      setScrollOffset(prev => Math.max(0, prev - Math.floor(availableHeight / 2)));
    },
    scrollToTop: () => {
      // Go to top (oldest messages)
      setScrollOffset(maxScrollOffset);
    },
    scrollToBottom: () => {
      // Go to bottom (newest messages)
      setScrollOffset(0);
    }
  };

  // Use the keymap hook
  useKeymap('chat', handlers, {
    isActive: isFocused && !inputMode
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
      borderColor={isFocused ? activeBorderColor : borderColor}
      flexDirection="column"
      padding={1}
    >
      <Box marginBottom={1}>
        <Text bold wrap="truncate">
          Messages {scrollOffset > 0 ? `(scrolled ${scrollOffset} lines)` : ''}
        </Text>
      </Box>

      {!messages || messages.length === 0 ? (
        <Box>
          <Text color={mutedTextColor} italic>
            {activeRoom ? 'No messages in this room yet' : 'Select a room to view messages'}
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
                  <Box
                    overflow={"hidden"}
                    key={`h-${line.messageId}-${idx}`}
                    width={contentWidth}
                  >
                    <Text
                      color={line.user === identity?.username ? primaryColor : secondaryColor}
                      bold
                    >
                      {line.user}
                    </Text>
                    <Text> </Text>
                    <Text color={mutedTextColor}>{formatTime(line.timestamp)}</Text>
                  </Box>
                );
              } else {
                return (
                  <Box
                    overflow="hidden"
                    key={`c-${line.messageId}-${line.lineIndex}-${idx}`}
                    width={contentWidth}
                  >
                    <Text color={line.isFileMessage ? secondaryColor : undefined}>
                      {sanitizeTextForTerminal(line.text)}
                    </Text>
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
          <Text color={secondaryColor} bold>↑{scrollOffset}</Text>
        </Box>
      )}

      {scrollOffset < maxScrollOffset && (
        <Box position="absolute" right={2} bottom={1}>
          <Text color={secondaryColor} bold>↓</Text>
        </Box>
      )}
    </Box>
  );
};

export default MessageList;
