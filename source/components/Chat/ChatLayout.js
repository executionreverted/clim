// Updates to ChatLayout.js for Hyperblobs integration

import React, { memo } from 'react';
import { Box, Text } from 'ink';
import { useChat } from '../../contexts/RoomBaseChatContext.js';
import RoomList from './RoomList.js';
import MessageList from './MessageList.js';
import UserList from './UserList.js';
import InputBar from './InputBar.js';
import TopBar from './TopBar.js';
import Loading from '../Loading.js';
import useKeymap from '../../hooks/useKeymap.js';
import { getBindingDescription } from '../../utils/keymap.js';

const ChatLayout = memo(({ width = 100, height = 24 }) => {
  const {
    focusedPanel,
    setFocusedPanel,
    inputMode,
    setInputMode,
    setInputValue,
    handleInputSubmit,
    onBack,
    setShowFileExplorer,
    setShowRoomFiles,
    activeRoomId,
    isLoading,
    loadingMessage,
    downloading
  } = useChat();

  // Calculate panel widths based on terminal size
  const availableWidth = Math.max(60, width);
  const roomListWidth = Math.max(15, Math.floor(availableWidth * 0.20));
  const userListWidth = Math.max(15, Math.floor(availableWidth * 0.20));
  const messageListWidth = availableWidth - roomListWidth - userListWidth - 4; // Subtract borders

  // Calculate heights
  const topBarHeight = 3;
  const bottomHelpHeight = 1;
  const inputBarHeight = 3;
  const contentHeight = Math.max(10, height - topBarHeight - bottomHelpHeight - inputBarHeight - 2);

  // Define handlers for chat actions
  const handlers = {
    switchPanel: () => {
      if (inputMode) return;
      // Cycle through panels: rooms -> messages -> users -> input -> rooms
      if (focusedPanel === 'rooms') setFocusedPanel('messages');
      else if (focusedPanel === 'messages') setFocusedPanel('users');
      else if (focusedPanel === 'users') setFocusedPanel('input');
      else setFocusedPanel('rooms');
    },
    focusInput: () => {
      if (inputMode) {
        if (handleInputSubmit("")) {
          setInputMode(false);
        }
        return;
      }

      if (focusedPanel === 'input' || focusedPanel === 'messages') {
        setInputMode(true);
        return;
      }
    },
    back: () => {
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
    },
    shareFile: () => {
      if (!activeRoomId || inputMode) return;
      // Important fix: Make sure to clear input and show file explorer
      setInputValue('');
      setShowFileExplorer(true);
    },
    viewFiles: () => {
      if (inputMode) return;
      // Show room files
      setInputValue('');
      setShowRoomFiles(true);
    },
    exit: () => onBack && onBack()
  };

  // Add room commands
  const chatContextHandlers = {
    addRoom: () => {
      if (focusedPanel === 'rooms') {
        setInputMode(true);
        setInputValue('');
      }
    }
  };

  // Use the keymap hook
  const { contextBindings } = useKeymap('chat', { ...handlers, ...chatContextHandlers });

  // Get human-readable key descriptions for help text
  const switchPanelKey = getBindingDescription(contextBindings.switchPanel);
  const focusInputKey = getBindingDescription(contextBindings.focusInput);
  const backKey = getBindingDescription(contextBindings.back);
  const shareFileKey = getBindingDescription(contextBindings.shareFile);
  const addRoomKey = getBindingDescription(contextBindings.addRoom);
  const viewFilesKey = getBindingDescription(contextBindings.viewFiles);

  // Show loading overlay if loading state is true
  //
  //
  //
  //
  if (downloading) {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        alignItems="center"
        justifyContent="center"
      >
        <Box marginBottom={1}>
          <Loading text={"Downloading file from peer... File will be saved to downloads folder"} width={width} />
        </Box>
      </Box>
    );
  }
  if (isLoading) {
    return (
      <Box
        flexDirection="column"
        width={width}
        height={height}
        alignItems="center"
        justifyContent="center"
      >
        <Box marginBottom={1}>
          <Loading text={loadingMessage || "Loading..."} width={width} />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
    >
      <TopBar width={width} />

      <Box
        flexDirection="row"
        height={contentHeight}
        width={width}
      >
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
      />

      <Box width={width} height={bottomHelpHeight}>
        <Text dimColor>
          [{switchPanelKey}] Switch panels | [{focusInputKey}] Focus input | [{backKey}] Back/Exit |
          {focusedPanel === 'rooms' && ` [${addRoomKey}] Add room | `}
          [{shareFileKey}] or /send: Share file | [{viewFilesKey}] or /files: View files | /join code | /invite | /profile name
        </Text>
      </Box>
    </Box>
  );
});

export default ChatLayout;
