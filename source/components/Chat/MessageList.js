// components/Chat/MessageList.js
import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/RoomBaseChatContext.js';
import { sanitizeTextForTerminal } from '../FileExplorer/utils.js';
import useKeymap from '../../hooks/useKeymap.js';
import useThemeUpdate from '../../hooks/useThemeUpdate.js';

const formatTime = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Calculate effective width of a string, accounting for emoji and wide characters
const getEffectiveWidth = (str) => {
  if (!str) return 0;
  // Count emoji and other wide characters as double width
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const normalText = str.replace(emojiRegex, '');
  const emojiCount = str.length - normalText.length;
  // Count normal chars as 1, emoji as 2
  return normalText.length + (emojiCount * 2);
};

// Split long message text into lines that fit within available width
const prepareMessageLines = (text, maxWidth) => {
  if (!text) return [];
  // First split by natural line breaks
  const naturalLines = text.replaceAll('␍', '\n').replaceAll('↵', '\n').split('\n');
  const result = [];
  // Then ensure each line fits within maxWidth
  naturalLines.forEach(line => {
    if (getEffectiveWidth(line) <= maxWidth) {
      // Line is short enough, add it as is
      result.push(line);
    } else {
      // Line is too long, need to break it
      let currentChunk = '';
      let currentWidth = 0;

      // Process character by character to account for emoji width
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const isEmoji = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu.test(char);
        const charWidth = isEmoji ? 2 : 1;

        if (currentWidth + charWidth > maxWidth) {
          // This character would make the line too long, push current chunk and start a new one
          result.push(currentChunk);
          currentChunk = char;
          currentWidth = charWidth;
        } else {
          // Add character to current chunk
          currentChunk += char;
          currentWidth += charWidth;
        }
      }

      // Add the last chunk if there's anything left
      if (currentChunk.length > 0) {
        result.push(currentChunk);
      }
    }
  });
  return result;
};

const MessageList = ({ width = 60, height = 20, isFocused = false }) => {
  const { activeRoom, activeRoomId, inputMode, loadMoreMessages } = useChat();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const scrollPositionRef = useRef(0);
  const previousMessagesCountRef = useRef(0);

  const messages = activeRoom?.messages?.length ? activeRoom.messages : [];
  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  // Keep track of messages count to detect new messages
  useEffect(() => {
    if (messages.length > previousMessagesCountRef.current) {
      // New message detected
      const newMessagesCount = messages.length - previousMessagesCountRef.current;

      // If we're at the bottom (scrollOffset = 0), stay at bottom
      if (scrollOffset === 0) {
        setScrollOffset(0);
      } else {
        // Otherwise, adjust scrollOffset to stay at same position with new content
        setScrollOffset(scrollOffset + newMessagesCount);
      }
    }
    previousMessagesCountRef.current = messages.length;
  }, [messages.length]);

  // Calculate available width and height
  const contentWidth = Math.max(20, width - 6); // Adjust for borders and padding
  const availableHeight = Math.max(5, height - 6); // Account for header and padding

  // Process messages into display lines
  const processedLines = [];

  if (messages.length > 0) {
    // Sort messages by timestamp
    const sortedMessages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

    sortedMessages.forEach((message, idx) => {
      // Create a unique message ID if none exists
      const messageId = message.id || `msg-${idx}`;

      // Calculate max username length to prevent overflow
      const maxUsernameLength = Math.min(20, Math.floor(contentWidth / 3));
      const displayName = (message.sender || 'Unknown').length > maxUsernameLength
        ? (message.sender || 'Unknown').substring(0, maxUsernameLength - 2) + '..'
        : (message.sender || 'Unknown');

      // Add header line
      processedLines.push({
        type: 'header',
        user: displayName,
        timestamp: message.timestamp,
        messageId
      });

      // Process message content into lines that fit within width
      const contentLines = prepareMessageLines(message.content, contentWidth);
      contentLines.forEach((line, lineIdx) => {
        processedLines.push({
          type: 'content',
          text: line,
          messageId,
          lineIndex: lineIdx,
          hasAttachment: message.content && message.content.startsWith('📎'),
          isFileMessage: message.content && message.content.startsWith('📎'),
          system: message.system
        });
      });

      // Add a separator between messages
      processedLines.push({
        type: 'separator',
        messageId: `${messageId}-sep`
      });
    });
  }

  const totalLines = processedLines.length;
  const maxScrollOffset = Math.max(0, totalLines - availableHeight);

  // Load more messages when scrolled to top
  const handleLoadMore = async () => {
    if (isLoadingMore || !activeRoomId) return;

    setIsLoadingMore(true);

    try {
      const result = await loadMoreMessages(activeRoomId);

      // Only set to false when we get an empty result
      if (result === false) {
        console.log("No more messages available");
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error("Error loading more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Define keymap handlers for scrolling
  const handlers = {
    navigateUp: () => {
      const isAtTopOfVisibleContent = scrollOffset >= maxScrollOffset;

      // If we're at the top and there might be more messages
      if (isAtTopOfVisibleContent && hasMoreMessages && !isLoadingMore) {
        // Directly trigger loading more
        handleLoadMore();
      }

      // Still allow scrolling up to the current max
      setScrollOffset(prev => Math.min(maxScrollOffset, prev + 1));
    },
    navigateDown: () => {
      // Scroll down
      setScrollOffset(prev => Math.max(0, prev - 1));
    },
    pageUp: () => {
      // Page up: move selection up by page size
      const newOffset = Math.min(maxScrollOffset, scrollOffset + Math.floor(availableHeight / 2));
      setScrollOffset(newOffset);

      // If at the top, try to load more
      if (newOffset >= maxScrollOffset && hasMoreMessages && !isLoadingMore) {
        handleLoadMore();
      }
    },
    pageDown: () => {
      // Page down: move selection down by page size
      setScrollOffset(Math.max(0, scrollOffset - Math.floor(availableHeight / 2)));
    },
    scrollToTop: () => {
      // Scroll to top and load more if available
      setScrollOffset(maxScrollOffset);
      if (hasMoreMessages && !isLoadingMore) {
        handleLoadMore();
      }
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
          {isLoadingMore ? ' (Loading...)' : ''}
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
          {/* Loading indicator */}
          {isLoadingMore && (
            <Box width={contentWidth}>
              <Text color={secondaryColor} italic>Loading older messages...</Text>
            </Box>
          )}

          {/* End of history indicator */}
          {scrollOffset >= maxScrollOffset && !hasMoreMessages && !isLoadingMore && (
            <Box width={contentWidth}>
              <Text color={mutedTextColor} italic>Start of conversation history</Text>
            </Box>
          )}

          {/* Message lines */}
          <Box flexDirection="column">
            {visibleLines.map((line, idx) => {
              if (line.type === 'header') {
                return (
                  <Box
                    key={`h-${line.messageId}-${idx}`}
                    width={contentWidth}
                    flexDirection="row"
                  >
                    {/* Username with fixed max width */}
                    <Box width={Math.min(20, contentWidth / 2)}>
                      <Text
                        color={line.user === 'System' ? mutedTextColor : (line.user.startsWith('User_') ? primaryColor : secondaryColor)}
                        bold
                        wrap="truncate"
                      >
                        {line.user}
                      </Text>
                    </Box>
                    <Text> </Text>
                    <Text color={mutedTextColor}>{formatTime(line.timestamp)}</Text>
                  </Box>
                );
              } else if (line.type === 'separator') {
                return (
                  <Box
                    key={`s-${line.messageId}`}
                    width={contentWidth}
                    height={1}
                  />
                );
              } else {
                // Special handling for file attachments which start with emoji
                if (line.isFileMessage && line.lineIndex === 0) {
                  return (
                    <Box
                      key={`c-${line.messageId}-${line.lineIndex}-${idx}`}
                      width={contentWidth}
                      flexDirection="row"
                    >
                      {/* Emoji in its own fixed-width container */}
                      <Box width={2} marginRight={1}>
                        <Text color={secondaryColor}>📎</Text>
                      </Box>

                      {/* Rest of the text */}
                      <Box width={contentWidth - 3}>
                        <Text color={secondaryColor} wrap="truncate">
                          {sanitizeTextForTerminal(line.text.substring(2))}
                        </Text>
                      </Box>
                    </Box>
                  );
                }

                // Regular message line
                return (
                  <Box
                    key={`c-${line.messageId}-${line.lineIndex}-${idx}`}
                    width={contentWidth}
                  >
                    <Text
                      color={line.system ? mutedTextColor : (line.isFileMessage ? secondaryColor : undefined)}
                      wrap="truncate"
                      italic={line.system}
                    >
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
