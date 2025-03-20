// components/Chat/index.js
import React, { useState, useEffect } from 'react';
import { Box, useStdout } from 'ink';
import { ChatProvider } from '../../contexts/ChatContext.js';
import ChatLayout from './ChatLayout.js';

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
      <ChatLayout
        width={terminalWidth}
        height={terminalHeight}
      />
    </ChatProvider>
  );
};

export default Chat;
