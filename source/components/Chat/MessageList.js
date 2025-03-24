// Fixed MessageList.js to resolve duplicate key errors

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

// Force re-render on message send by not memoizing this component
const MessageList = ({ width = 60, height = 20, isFocused = false }) => {
  const {
    activeRoom,
    activeRoomId,
    inputMode,
    loadMoreMessages,
    messageCounts,
  } = useChat();

  const [scrollOffset, setScrollOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const loadingAttemptRef = useRef(0);
  const previousMessagesCountRef = useRef(0);
  const processedLinesRef = useRef([]); // Use a ref to hold processed lines to avoid recreating on each render
  const [forceRender, setForceRender] = useState(0); // Add a state variable to force re-renders

  const messages = activeRoom?.messages?.length ? activeRoom.messages : [];
  const totalMessageCount = messageCounts?.[activeRoomId] ? messageCounts[activeRoomId] : 0;

  const currentTheme = useThemeUpdate();
  const {
    primaryColor,
    secondaryColor,
    mutedTextColor,
    borderColor,
    activeBorderColor,
  } = currentTheme.colors;

  // Update hasMoreMessages when messages or total count changes
  useEffect(() => {
    if (activeRoomId && messages.length > 0) {
      setHasMoreMessages(messages.length < totalMessageCount);
    }
  }, [messages.length, totalMessageCount, activeRoomId]);

  // Reset loading state when active room changes
  useEffect(() => {
    loadingAttemptRef.current = 0;
    setIsLoadingMore(false);
    setHasMoreMessages(true);
    previousMessagesCountRef.current = 0;
  }, [activeRoomId]);

  // Keep track of messages count to detect new messages
  useEffect(() => {
    if (messages.length > previousMessagesCountRef.current) {
      // New message detected
      const newMessagesCount = messages.length - previousMessagesCountRef.current;

      // If we're at the bottom (scrollOffset = 0), stay at bottom
      if (scrollOffset === 0) {
        setScrollOffset(0);
        // Force an immediate re-render for responsiveness
        setForceRender(prev => prev + 1);
      } else {
        // Otherwise, adjust scrollOffset to stay at same position with new content
        setScrollOffset(scrollOffset + newMessagesCount);
      }

      // Force rebuild of processed lines when new messages arrive
      processedLinesRef.current = buildProcessedLines();
    }
    previousMessagesCountRef.current = messages.length;
  }, [messages.length]);

  // Calculate available width and height
  const contentWidth = Math.max(20, width - 6); // Adjust for borders and padding
  const availableHeight = Math.max(5, height - 6); // Account for header and padding

  // Process messages into display lines
  // FIXED KEY GENERATION: We need to ensure each line has a truly unique identifier
  // that remains stable across renders and isn't dependent on array position
  const buildProcessedLines = () => {
    const lines = [];
    // Keep track of seen message IDs to avoid duplicates
    const seenMessageIds = new Set();

    if (messages.length > 0) {
      // Sort messages by timestamp first, then by ID for stable ordering
      const sortedMessages = [...messages].sort((a, b) => {
        const timeDiff = a.timestamp - b.timestamp;
        // If timestamps are the same, use ID as a tiebreaker
        return timeDiff !== 0 ? timeDiff : (a.id || '').localeCompare(b.id || '');
      });

      sortedMessages.forEach((message, messageIndex) => {
        // Generate a deterministic unique ID that's stable across renders
        // Use the message's actual ID if it exists, otherwise create a synthetic one
        let messageId;

        if (message.id) {
          messageId = message.id;
        } else {
          // Create a more unique synthetic ID using timestamp and content hash
          const contentHash = message.content ?
            message.content.slice(0, 10).replace(/\W/g, '') : '';
          messageId = `msg-${message.timestamp}-${contentHash}-${messageIndex}`;
        }

        // Ensure we don't have duplicate IDs (which can happen with poorly generated IDs)
        if (seenMessageIds.has(messageId)) {
          // If we've seen this ID before, make it unique by adding an index
          messageId = `${messageId}-dup-${seenMessageIds.size}`;
        }
        seenMessageIds.add(messageId);

        // Calculate max username length to prevent overflow
        const maxUsernameLength = Math.min(20, Math.floor(contentWidth / 3));
        const displayName = (message.sender || 'Unknown').length > maxUsernameLength
          ? (message.sender || 'Unknown').substring(0, maxUsernameLength - 2) + '..'
          : (message.sender || 'Unknown');

        // Add header line with a truly unique key
        lines.push({
          type: 'header',
          user: displayName,
          timestamp: message.timestamp,
          messageId,
          // Create a globally unique key for this line
          uniqueKey: `h-${messageId}-${forceRender}`
        });

        // Process message content into lines that fit within width
        const contentLines = prepareMessageLines(message.content, contentWidth);
        contentLines.forEach((line, lineIdx) => {
          lines.push({
            type: 'content',
            text: line,
            messageId,
            lineIndex: lineIdx,
            hasAttachment: message.content && message.content.startsWith('📎'),
            isFileMessage: message.content && message.content.startsWith('📎'),
            system: message.system,
            // Create a globally unique key for this line
            uniqueKey: `c-${messageId}-${lineIdx}-${forceRender}`
          });
        });

        // Add a separator with a globally unique key
        lines.push({
          type: 'separator',
          messageId,
          uniqueKey: `s-${messageId}-${forceRender}`
        });
      });
    }

    return lines;
  };

  // Update processed lines when messages change
  useEffect(() => {
    processedLinesRef.current = buildProcessedLines();
    // Force re-render to ensure the UI updates with new messages
    setForceRender(prev => prev + 1);
  }, [messages.length, contentWidth, activeRoomId]);

  const totalLines = processedLinesRef.current.length;
  const maxScrollOffset = Math.max(0, totalLines - availableHeight);


  useEffect(() => {
    if (messages.length == 0 && totalMessageCount > 0) {
      handleLoadMore()
    }
  }, [totalMessageCount, messages?.length])
  // Load more messages when scrolled to top
  const handleLoadMore = async () => {
    if (isLoadingMore || !activeRoomId || !hasMoreMessages) return;

    loadingAttemptRef.current += 1;
    setIsLoadingMore(true);

    try {
      // Load a larger batch each time to efficiently reach older messages
      const batchSize = Math.min(20 * loadingAttemptRef.current, 50);

      const moreAvailable = await loadMoreMessages(activeRoomId, {
        limit: batchSize,
        // Add explicit timestamp check to ensure we get older messages
        lt: messages.length > 0 ? {
          timestamp: Math.min(...messages.map(m => m.timestamp || Number.MAX_SAFE_INTEGER))
        } : undefined
      });

      // Update hasMoreMessages based on returned value
      setHasMoreMessages(moreAvailable);

      // If we have all messages but count doesn't match, try one more time with a different approach
      if (!moreAvailable && messages.length < totalMessageCount && loadingAttemptRef.current < 3) {
        setTimeout(() => {
          setIsLoadingMore(false);
          setHasMoreMessages(true);
        }, 500);
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
  // The forceRender variable is used in this calculation to ensure React re-renders when needed
  const visibleStartIndex = Math.max(0, totalLines - availableHeight - scrollOffset);
  const visibleEndIndex = Math.min(totalLines, visibleStartIndex + availableHeight);
  const visibleLines = processedLinesRef.current.slice(visibleStartIndex, visibleEndIndex);

  // This console.log helps debug render cycles without affecting performance much
  // It will show in the terminal when the component re-renders

  // Add automatic loading of more messages when we reach the top
  useEffect(() => {
    if (scrollOffset >= maxScrollOffset && hasMoreMessages && !isLoadingMore && messages.length < totalMessageCount) {
      handleLoadMore();
    }
  }, [maxScrollOffset, hasMoreMessages, isLoadingMore, messages.length, totalMessageCount]);

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
          Messages({totalMessageCount}) {scrollOffset > 0 ? `(scrolled ${scrollOffset} lines)` : ''}
          {totalMessageCount > 0 && ` ${messages.length}/${totalMessageCount}`}
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

          {/* Message lines - KEY FIX: Use the unique stable key for each line */}
          <Box flexDirection="column">
            {visibleLines.map((line) => {
              if (line.type === 'header') {
                return (
                  <Box
                    key={line.uniqueKey}
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
                    key={line.uniqueKey}
                    width={contentWidth}
                    height={1}
                  />
                );
              } else {
                // Special handling for file attachments which start with emoji
                if (line.isFileMessage && line.lineIndex === 0) {
                  return (
                    <Box
                      key={line.uniqueKey}
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
                    key={line.uniqueKey}
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

      {hasMoreMessages && scrollOffset >= maxScrollOffset && (
        <Box position="absolute" left={2} top={1}>
          <Text color={secondaryColor} bold>• More history available</Text>
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
