// components/Chat/index.js
import React, { useState, useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { ChatProvider, useChat } from '../../contexts/ChatContext.js';
import ChatLayout from './ChatLayout.js';
import FileExplorer from '../FileExplorer/index.js';

// Inner component that can access the chat context
const ChatContent = ({ width, height }) => {
  const { showFileExplorer, setShowFileExplorer, handleFileSelect } = useChat();

  if (showFileExplorer) {
    return (
      <FileExplorer
        initialPath={process.cwd()}
        onBack={() => setShowFileExplorer(false)}
        onFileSelect={handleFileSelect}
        mode="picker" // Use picker mode for selecting files
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
