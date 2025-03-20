// components/Chat/ChatLayout.js
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useChat } from '../../contexts/ChatContext.js';
import RoomList from './RoomList.js';
import MessageList from './MessageList.js';
import UserList from './UserList.js';
import InputBar from './InputBar.js';
import TopBar from './TopBar.js';

const ChatLayout = ({ width = 100, height = 24 }) => {
  const {
    focusedPanel,
    setFocusedPanel,
    inputMode,
    setInputMode,
    inputValue,
    setInputValue,
    handleKeyInput,
    handleInputSubmit,
    onBack
  } = useChat();

  // Calculate panel widths based on terminal size
  const availableWidth = Math.max(60, width);
  const roomListWidth = Math.max(15, Math.floor(availableWidth * 0.15));
  const userListWidth = Math.max(15, Math.floor(availableWidth * 0.20));
  const messageListWidth = availableWidth - roomListWidth - userListWidth;

  // Calculate heights
  const contentHeight = Math.max(10, height - 6); // Reserve space for top and bottom bars

  useInput((input, key) => {
    // Global escape key handling
    if (key.escape) {
      if (inputMode) {
        setInputMode(false);
        return;
      }

      if (focusedPanel === 'input') {
        setFocusedPanel('messages');
        return;
      }

      // Exit chat if no input mode and not focused on input
      onBack && onBack();
      return;
    }

    // Global tab key for panel navigation
    if (key.tab) {
      // Cycle through panels: rooms -> messages -> users -> input -> rooms
      if (focusedPanel === 'rooms') setFocusedPanel('messages');
      else if (focusedPanel === 'messages') setFocusedPanel('users');
      else if (focusedPanel === 'users') setFocusedPanel('input');
      else setFocusedPanel('rooms');
      return;
    }

    // Handle enter key for focusing input or submitting
    if (key.return) {
      if (inputMode) {
        if (handleInputSubmit()) {
          setInputMode(false);
        }
        return;
      }

      if (focusedPanel === 'input' || focusedPanel === 'messages') {
        setInputMode(true);
        return;
      }
    }

    // Handle input mode
    if (inputMode) {
      if (key.backspace || key.delete) {
        setInputValue(prev => prev.slice(0, -1));
        return;
      }

      // Only accept printable characters
      if (input && input.length === 1 && input.charCodeAt(0) >= 32) {
        setInputValue(prev => prev + input);
        return;
      }

      return;
    }

    // Handle panel-specific key inputs when not in input mode
    if (!inputMode) {
      // Let the panel handle its own inputs
      if (handleKeyInput(input)) {
        return;
      }
    }
  });

  return (
    <Box flexDirection="column" width={width} height={height}>
      <TopBar width={width} />

      <Box flexDirection="row" height={contentHeight}>
        <RoomList
          width={roomListWidth}
          height={contentHeight}
          isFocused={focusedPanel === 'rooms'}
        />

        <MessageList
          width={messageListWidth}
          height={contentHeight}
          isFocused={focusedPanel === 'messages'}
        />

        <UserList
          width={userListWidth}
          height={contentHeight}
          isFocused={focusedPanel === 'users'}
        />
      </Box>

      <InputBar
        width={width}
        isFocused={focusedPanel === 'input' || inputMode}
        value={inputValue}
      />

      <Box width={width}>
        <Text dimColor>
          [Tab] Switch panels | [Enter] Focus input | [Esc] Back/Exit |
          {focusedPanel === 'rooms' && ' [a] Add room | '}
          Press ENTER to chat
        </Text>
      </Box>
    </Box>
  );
};

export default ChatLayout;
