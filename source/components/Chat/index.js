// Fix for source/components/Chat/index.js

import React, { memo, useState, useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { RoomBaseChatProvider } from '../../contexts/RoomBaseChatContext.js';
import ChatLayout from './ChatLayout.js';
import FileExplorer from '../FileExplorer/index.js';
import useKeymap from '../../hooks/useKeymap.js';
import { useChat } from '../../contexts/RoomBaseChatContext.js';
import RoomFiles from '../RoomFiles/index.js';

// Inner component that can access the chat context
const ChatContent = memo(({ width, height }) => {
  const {
    showFileExplorer,
    setShowFileExplorer,
    handleFileSelect,
    showRoomFiles,
    setShowRoomFiles,
    activeRoomId
  } = useChat();

  // Define handlers for file explorer in chat
  const handlers = {
    back: () => {
      if (showFileExplorer) {
        setShowFileExplorer(false);
        return;
      }
      if (showRoomFiles) {
        setShowRoomFiles(false);
        return;
      }
    },
    exit: () => {
      if (showFileExplorer) {
        setShowFileExplorer(false);
        return;
      }
      if (showRoomFiles) {
        setShowRoomFiles(false);
        return;
      }
    }
  };

  // Use keymap only when file explorer or room files is shown
  useKeymap('global', handlers, { isActive: showFileExplorer || showRoomFiles });

  // Return the appropriate component based on current state
  if (showFileExplorer) {
    return (
      <FileExplorer
        initialPath={process.cwd()}
        onBack={handlers.back}
        onFileSelect={(files) => {
          if (files) {
            handleFileSelect(files);
          } else {
            setShowFileExplorer(false);
          }
        }}
        mode="picker"
        multiSelect={true} // Enable multiselect
      />
    );
  }

  if (showRoomFiles && activeRoomId) {
    return (
      <RoomFiles onBack={() => setShowRoomFiles(false)} />
    );
  }

  return (
    <ChatLayout
      width={width}
      height={height}
    />
  );
});

// Main chat component
const Chat = ({ onBack }) => {
  const { stdout } = useStdout();
  const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 100);
  const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

  // Update terminal dimensions if they change
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(stdout.columns);
      setTerminalHeight(stdout.rows);
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return (
    <RoomBaseChatProvider onBack={onBack}>
      <ChatContent
        width={terminalWidth}
        height={terminalHeight}
      />
    </RoomBaseChatProvider>
  );
};

export default Chat;
