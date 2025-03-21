// components/Chat/index.js
import React, { useState, useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { ChatProvider, useChat } from '../../contexts/ChatContext.js';
import ChatLayout from './ChatLayout.js';
import FileExplorer from '../FileExplorer/index.js';
import useKeymap from '../../hooks/useKeymap.js';

// Inner component that can access the chat context
const ChatContent = ({ width, height }) => {
  const { showFileExplorer, setShowFileExplorer, handleFileSelect } = useChat();

  // Define handlers for file explorer in chat
  const handlers = {
    back: () => setShowFileExplorer(false),
    exit: () => setShowFileExplorer(false)
  };

  // Use keymap only when file explorer is shown
  useKeymap('global', handlers, { isActive: showFileExplorer });

  if (showFileExplorer) {
    return (
      <FileExplorer
        initialPath={process.cwd()}
        onBack={() => setShowFileExplorer(false)}
        onFileSelect={handleFileSelect}
        mode="picker"
        multiSelect={true} // Enable multiselect
      />
    );
  }

  return (
    <ChatLayout
      width={width}
      height={height}
    />
  );
};

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
    <ChatProvider onBack={onBack}>
      <ChatContent
        width={terminalWidth}
        height={terminalHeight}
      />
    </ChatProvider>
  );
};

export default Chat;
